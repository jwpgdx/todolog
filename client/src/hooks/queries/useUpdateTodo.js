import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  upsertTodo,
  getTodoById,
  getNextCategoryOrder,
  getNextFavoriteOrder,
} from '../../services/db/todoService';
import { addPendingChangeOnConnection } from '../../services/db/pendingService';
import { ensureDatabase, withWriteTransaction } from '../../services/db/database';
import { invalidateTodoSummary as invalidateDaySummariesTodo } from '../../features/calendar-day-summaries';
import { invalidateTodoCalendarV2Layouts } from '../../features/todo-calendar-v2/services/todoCalendarV2InvalidationService';
import { useSyncContext } from '../../providers/SyncProvider';

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    onMutate: async ({ id, data }) => {
      const mutateStartTime = performance.now();

      // 1. 진행 중인 todo refetch 취소 + 실제 all-query family snapshot
      await queryClient.cancelQueries({ queryKey: ['todos'] });
      const previousAllQueries = queryClient.getQueriesData({ queryKey: ['todos', 'all'] });
      let oldTodo = previousAllQueries
        .flatMap(([, queryData]) => (Array.isArray(queryData) ? queryData : []))
        .find((todo) => todo?._id === id);
      if (!oldTodo) {
        await ensureDatabase();
        oldTodo = await getTodoById(id);
      }
      const previousDateKey = data.startDate || oldTodo?.startDate || oldTodo?.date || null;
      const previousDate = previousDateKey
        ? queryClient.getQueryData(['todos', previousDateKey])
        : undefined;

      // 3. 캐시 직접 업데이트
      queryClient.setQueriesData({ queryKey: ['todos', 'all'] }, (old) => {
        if (!old) return old;
        return old.map(todo =>
          todo._id === id
            ? { ...todo, ...data, updatedAt: new Date().toISOString() }
            : todo
        );
      });

      // 날짜 처리: 반복 일정 또는 기간 일정 관련 여부 확인
      const startDateProvided = Object.prototype.hasOwnProperty.call(data, 'startDate');
      const endDateProvided = Object.prototype.hasOwnProperty.call(data, 'endDate');
      const recurrenceProvided = Object.prototype.hasOwnProperty.call(data, 'recurrence');
      const previousStartDate = oldTodo?.startDate || oldTodo?.date || null;
      const nextStartDate = startDateProvided ? data.startDate : previousStartDate;
      const nextEndDate = endDateProvided ? data.endDate : oldTodo?.endDate;
      const wasRecurrence = oldTodo && oldTodo.recurrence;
      const nowRecurrence = recurrenceProvided ? data.recurrence : oldTodo?.recurrence;
      const wasMultiDay = oldTodo && oldTodo.startDate !== oldTodo.endDate;
      const nowMultiDay = Boolean(nextStartDate) && nextStartDate !== (nextEndDate || nextStartDate);

      if (wasRecurrence || nowRecurrence || wasMultiDay || nowMultiDay) {
        // 반복/기간 일정 관련: onSuccess에서 처리
      } else {
        // 단일 → 단일: Optimistic Update
        if (oldTodo && startDateProvided && previousStartDate !== nextStartDate) {
          // 이전 날짜 캐시에서 제거
          if (previousStartDate) {
            queryClient.setQueryData(['todos', previousStartDate], (old) => {
              if (!old) return old;
              return old.filter(t => t._id !== id);
            });
          }

          // 새 날짜 캐시에 추가
          if (nextStartDate) {
            queryClient.setQueryData(['todos', nextStartDate], (old) => {
              const updatedTodo = { ...oldTodo, ...data, updatedAt: new Date().toISOString() };
              return old ? [...old, updatedTodo] : [updatedTodo];
            });
          }
        } else if (previousStartDate) {
          // 날짜 변경 없음 - 기존 날짜 캐시 업데이트
          queryClient.setQueryData(['todos', previousStartDate], (old) => {
            if (!old) return old;
            return old.map(todo =>
              todo._id === id
                ? { ...todo, ...data, updatedAt: new Date().toISOString() }
                : todo
            );
          });
        }
      }

      // 카테고리 변경 처리: partial update에서 categoryId가 없으면 건드리지 않는다.
      const categoryIdProvided = Object.prototype.hasOwnProperty.call(data, 'categoryId');
      if (oldTodo && categoryIdProvided && oldTodo.categoryId !== data.categoryId) {
        // 이전 카테고리 캐시에서 제거
        if (oldTodo.categoryId) {
          queryClient.setQueriesData({ queryKey: ['todos', 'category', oldTodo.categoryId] }, (old) => {
            if (!old) return old;
            return old.filter(t => t._id !== id);
          });
        }

        // 새 카테고리 캐시에 추가
        if (data.categoryId) {
          queryClient.setQueriesData({ queryKey: ['todos', 'category', data.categoryId] }, (old) => {
            const updatedTodo = { ...oldTodo, ...data, updatedAt: new Date().toISOString() };
            return old ? [...old, updatedTodo] : old;
          });
        }
      } else if (oldTodo?.categoryId) {
        // 카테고리 변경 없음(또는 categoryId가 없는 partial update) - 기존 family 업데이트
        queryClient.setQueriesData({ queryKey: ['todos', 'category', oldTodo.categoryId] }, (old) => {
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

      return { previousAllQueries, previousDate, previousDateKey, oldTodo };
    },
    mutationFn: async ({ id, data }) => {
      const fnStartTime = performance.now();

      const result = await withWriteTransaction(async (transaction) => {
        const existingTodo = await getTodoById(id, transaction);

        if (existingTodo) {
          const categoryChanged =
            Object.prototype.hasOwnProperty.call(data, 'categoryId') &&
            data.categoryId &&
            existingTodo.categoryId !== data.categoryId;
          const favoriteFlagProvided = Object.prototype.hasOwnProperty.call(data, 'isFavorite');
          const toggledFavoriteOn = favoriteFlagProvided && Boolean(data.isFavorite) && !Boolean(existingTodo.isFavorite);
          const toggledFavoriteOff = favoriteFlagProvided && !Boolean(data.isFavorite);
          const nextOrder = {
            custom: existingTodo.order?.custom ?? existingTodo.customOrder ?? 0,
            category: existingTodo.order?.category ?? existingTodo.categoryOrder ?? 0,
            favorite: existingTodo.order?.favorite ?? existingTodo.favoriteOrder ?? null,
            ...(data.order || {}),
          };

          if (categoryChanged && data.order?.category === undefined) {
            nextOrder.category = await getNextCategoryOrder(data.categoryId, transaction);
          }

          if (toggledFavoriteOn && data.order?.favorite === undefined) {
            nextOrder.favorite = await getNextFavoriteOrder(transaction);
          }

          if (toggledFavoriteOff) {
            nextOrder.favorite = null;
          }

          const updatedTodo = {
            ...existingTodo,
            ...data,
            order: nextOrder,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending',
          };

          await upsertTodo(updatedTodo, transaction);

          const pendingData = {
            ...data,
            order: nextOrder,
          };

          // Pending changes에 추가
          await addPendingChangeOnConnection(transaction, {
            type: 'updateTodo',
            entityId: id,
            data: pendingData,
          });

          return updatedTodo;
        }

        throw new Error('SQLite에서 할일을 찾을 수 없습니다');
      });

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
      
      const oldTodo = context?.oldTodo;

      invalidateDaySummariesTodo(oldTodo);
      invalidateDaySummariesTodo(data || { ...oldTodo, ...updateData });
      invalidateTodoCalendarV2Layouts({
        todo: oldTodo,
        reason: 'update-todo:old',
      });
      invalidateTodoCalendarV2Layouts({
        todo: data || { ...oldTodo, ...updateData },
        reason: 'update-todo:new',
      });

      const successEndTime = performance.now();
      console.log(`⚡ [useUpdateTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, { id, data }, context) => {
      console.error('❌ [useUpdateTodo] 에러 발생 - 롤백 시작:', error.message);

      if (Array.isArray(context?.previousAllQueries)) {
        context.previousAllQueries.forEach(([queryKey, queryData]) => {
          queryClient.setQueryData(queryKey, queryData);
        });
      }

      if (context?.previousDate && context?.previousDateKey) {
        queryClient.setQueryData(['todos', context.previousDateKey], context.previousDate);
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
      const categoryIdProvided = Object.prototype.hasOwnProperty.call(data, 'categoryId');
      if (
        context?.oldTodo &&
        categoryIdProvided &&
        context.oldTodo.categoryId !== data.categoryId
      ) {
        if (context.oldTodo.categoryId) {
          queryClient.invalidateQueries({ queryKey: ['todos', 'category', context.oldTodo.categoryId] });
        }
        if (data.categoryId) {
          queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.categoryId] });
        }
      }
      queryClient.invalidateQueries({ queryKey: ['todos', 'category'] });

      console.error('❌ [useUpdateTodo] 할일 수정 실패:', error.message);
    },
  });
};
