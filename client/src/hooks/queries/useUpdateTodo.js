import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { upsertTodo, getTodoById } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { useTodoCalendarStore } from '../../features/todo-calendar/store/todoCalendarStore';
import { invalidateTodoSummary } from '../../features/strip-calendar/services/stripCalendarDataAdapter';
import { useSyncContext } from '../../providers/SyncProvider';

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();
  const invalidateAdjacentMonths = useTodoCalendarStore(state => state.invalidateAdjacentMonths);
  const { syncAll } = useSyncContext();

  return useMutation({
    onMutate: async ({ id, data }) => {
      const mutateStartTime = performance.now();

      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', data.startDate] });

      // 2. 이전 데이터 백업
      const previousAll = queryClient.getQueryData(['todos', 'all']);
      const previousDate = queryClient.getQueryData(['todos', data.startDate]);

      // 기존 Todo 찾기
      const oldTodo = previousAll?.find(t => t._id === id);

      // 3. 캐시 직접 업데이트
      queryClient.setQueryData(['todos', 'all'], (old) => {
        if (!old) return old;
        return old.map(todo =>
          todo._id === id
            ? { ...todo, ...data, updatedAt: new Date().toISOString() }
            : todo
        );
      });

      // 날짜 처리: 반복 일정 또는 기간 일정 관련 여부 확인
      const wasRecurrence = oldTodo && oldTodo.recurrence;
      const nowRecurrence = data.recurrence;
      const wasMultiDay = oldTodo && oldTodo.startDate !== oldTodo.endDate;
      const nowMultiDay = data.startDate !== data.endDate;

      if (wasRecurrence || nowRecurrence || wasMultiDay || nowMultiDay) {
        // 반복/기간 일정 관련: onSuccess에서 처리
      } else {
        // 단일 → 단일: Optimistic Update
        if (oldTodo && oldTodo.startDate !== data.startDate) {
          // 이전 날짜 캐시에서 제거
          if (oldTodo.startDate) {
            queryClient.setQueryData(['todos', oldTodo.startDate], (old) => {
              if (!old) return old;
              return old.filter(t => t._id !== id);
            });
          }

          // 새 날짜 캐시에 추가
          if (data.startDate) {
            queryClient.setQueryData(['todos', data.startDate], (old) => {
              const updatedTodo = { ...oldTodo, ...data, updatedAt: new Date().toISOString() };
              return old ? [...old, updatedTodo] : [updatedTodo];
            });
          }
        } else if (data.startDate) {
          // 날짜 변경 없음 - 기존 날짜 캐시 업데이트
          queryClient.setQueryData(['todos', data.startDate], (old) => {
            if (!old) return old;
            return old.map(todo =>
              todo._id === id
                ? { ...todo, ...data, updatedAt: new Date().toISOString() }
                : todo
            );
          });
        }
      }

      // 카테고리 변경 처리
      if (oldTodo && oldTodo.categoryId !== data.categoryId) {
        // 이전 카테고리 캐시에서 제거
        if (oldTodo.categoryId) {
          queryClient.setQueryData(['todos', 'category', oldTodo.categoryId], (old) => {
            if (!old) return old;
            return old.filter(t => t._id !== id);
          });
        }

        // 새 카테고리 캐시에 추가
        if (data.categoryId) {
          queryClient.setQueryData(['todos', 'category', data.categoryId], (old) => {
            const updatedTodo = { ...oldTodo, ...data, updatedAt: new Date().toISOString() };
            return old ? [...old, updatedTodo] : [updatedTodo];
          });
        }
      } else if (data.categoryId) {
        // 카테고리 변경 없음 - 기존 카테고리 캐시 업데이트
        queryClient.setQueryData(['todos', 'category', data.categoryId], (old) => {
          if (!old) return old;
          return old.map(todo =>
            todo._id === id
              ? { ...todo, ...data, updatedAt: new Date().toISOString() }
              : todo
          );
        });
      }

      const mutateEndTime = performance.now();
      console.log(`⚡ [useUpdateTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);

      return { previousAll, previousDate, oldTodo };
    },
    mutationFn: async ({ id, data }) => {
      const fnStartTime = performance.now();

      // 로컬 저장 헬퍼 함수
      const updateLocally = async () => {
        await ensureDatabase();

        // 기존 SQLite 데이터 업데이트
        const existingTodo = await getTodoById(id);

        if (existingTodo) {
          const updatedTodo = {
            ...existingTodo,
            ...data,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending',
          };

          await upsertTodo(updatedTodo);

          // Pending changes에 추가
          await addPendingChange({
            type: 'updateTodo',
            entityId: id,
            data,
          });

          return updatedTodo;
        }

        throw new Error('SQLite에서 할일을 찾을 수 없습니다');
      };

      // Offline-first: 항상 로컬 반영 + Pending에 추가하고, 서버 반영은 SyncService(Pending Push)에 맡긴다.
      const result = await updateLocally();

      // 온라인이면 백그라운드 동기화 트리거 (UI는 기다리지 않음)
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => { });
        }
      } catch { }

      const fnEndTime = performance.now();
      console.log(`⚡ [useUpdateTodo] mutationFn 완료 (local-first): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
      return result;
    },
    onSuccess: (data, { data: updateData }, context) => {
      const successStartTime = performance.now();
      
      // 모든 todos 캐시 무효화 (단순화)
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      // Phase 2: 캘린더 캐시 무효화
      // 새 날짜 무효화
      if (data?.date || data?.startDate) {
        const dateStr = data.date || data.startDate;
        const [year, month] = dateStr.split('-').map(Number);
        invalidateAdjacentMonths(year, month);
        console.log(`📅 [useUpdateTodo] Calendar cache invalidated for new date ${year}-${month}`);
      }
      
      // 날짜 변경 시: 이전 날짜도 무효화
      const oldTodo = context?.oldTodo;
      if (oldTodo) {
        const oldDateStr = oldTodo.date || oldTodo.startDate;
        const newDateStr = data?.date || data?.startDate;
        
        if (oldDateStr && newDateStr && oldDateStr !== newDateStr) {
          const [oldYear, oldMonth] = oldDateStr.split('-').map(Number);
          invalidateAdjacentMonths(oldYear, oldMonth);
          console.log(`📅 [useUpdateTodo] Calendar cache invalidated for old date ${oldYear}-${oldMonth}`);
        }
      }

      invalidateTodoSummary(oldTodo);
      invalidateTodoSummary(data || { ...oldTodo, ...updateData });

      const successEndTime = performance.now();
      console.log(`⚡ [useUpdateTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, { id, data }, context) => {
      console.error('❌ [useUpdateTodo] 에러 발생 - 롤백 시작:', error.message);

      if (context?.previousAll) {
        queryClient.setQueryData(['todos', 'all'], context.previousAll);
      }

      if (context?.previousDate && data.startDate) {
        queryClient.setQueryData(['todos', data.startDate], context.previousDate);
      }

      // 날짜 변경 시 추가된 캐시 롤백
      if (context?.oldTodo && context.oldTodo.startDate !== data.startDate) {
        if (context.oldTodo.startDate) {
          queryClient.invalidateQueries({ queryKey: ['todos', context.oldTodo.startDate] });
        }
        if (data.startDate) {
          queryClient.invalidateQueries({ queryKey: ['todos', data.startDate] });
        }
      }

      // 카테고리 변경 시 추가된 캐시 롤백
      if (context?.oldTodo && context.oldTodo.categoryId !== data.categoryId) {
        if (context.oldTodo.categoryId) {
          queryClient.invalidateQueries({ queryKey: ['todos', 'category', context.oldTodo.categoryId] });
        }
        if (data.categoryId) {
          queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.categoryId] });
        }
      }

      console.error('❌ [useUpdateTodo] 할일 수정 실패:', error.message);
    },
  });
};
