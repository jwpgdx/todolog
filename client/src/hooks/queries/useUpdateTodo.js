import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { upsertTodo, getTodoById } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async ({ id, data }) => {
      const mutateStartTime = performance.now();
      console.log('🔄 [useUpdateTodo] onMutate 시작:', { id, data });
      
      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', data.startDate] });
      console.log('⏸️ [useUpdateTodo] 진행 중인 쿼리 취소 완료');
      
      // 2. 이전 데이터 백업
      const previousAll = queryClient.getQueryData(['todos', 'all']);
      const previousDate = queryClient.getQueryData(['todos', data.startDate]);
      
      // 기존 Todo 찾기
      const oldTodo = previousAll?.find(t => t._id === id);
      
      console.log('💾 [useUpdateTodo] 백업 완료:', {
        allCount: previousAll?.length || 0,
        dateCount: previousDate?.length || 0,
        oldTodo: oldTodo ? { id: oldTodo._id, title: oldTodo.title } : null
      });
      
      // 3. 캐시 직접 업데이트
      queryClient.setQueryData(['todos', 'all'], (old) => {
        if (!old) return old;
        const updated = old.map(todo => 
          todo._id === id 
            ? { ...todo, ...data, updatedAt: new Date().toISOString() }
            : todo
        );
        console.log('📝 [useUpdateTodo] 전체 캐시 업데이트 완료:', {
          totalCount: updated.length
        });
        return updated;
      });
      
      // 날짜 처리: 반복 일정 또는 기간 일정 관련 여부 확인
      const wasRecurrence = oldTodo && oldTodo.recurrence;
      const nowRecurrence = data.recurrence;
      const wasMultiDay = oldTodo && oldTodo.startDate !== oldTodo.endDate;
      const nowMultiDay = data.startDate !== data.endDate;
      
      if (wasRecurrence || nowRecurrence || wasMultiDay || nowMultiDay) {
        // 반복/기간 일정 관련 (반복→반복, 반복→단일, 단일→반복, 기간→기간, 기간→단일, 단일→기간):
        // onMutate에서는 날짜별 캐시를 건드리지 않음
        // onSuccess에서 모든 날짜별 캐시 무효화 → SQLite 재조회
        console.log('🔄 [useUpdateTodo] 반복/기간 일정 관련 - 날짜별 캐시는 onSuccess에서 무효화');
      } else {
        // 단일 → 단일: Optimistic Update (날짜 변경 여부에 따라 처리)
        if (oldTodo && oldTodo.startDate !== data.startDate) {
          // 이전 날짜 캐시에서 제거
          if (oldTodo.startDate) {
            queryClient.setQueryData(['todos', oldTodo.startDate], (old) => {
              if (!old) return old;
              const updated = old.filter(t => t._id !== id);
              console.log('🗑️ [useUpdateTodo] 이전 날짜 캐시에서 제거:', {
                oldDate: oldTodo.startDate,
                before: old.length,
                after: updated.length
              });
              return updated;
            });
          }
          
          // 새 날짜 캐시에 추가
          if (data.startDate) {
            queryClient.setQueryData(['todos', data.startDate], (old) => {
              const updatedTodo = { ...oldTodo, ...data, updatedAt: new Date().toISOString() };
              const updated = old ? [...old, updatedTodo] : [updatedTodo];
              console.log('➕ [useUpdateTodo] 새 날짜 캐시에 추가:', {
                newDate: data.startDate,
                after: updated.length
              });
              return updated;
            });
          }
        } else if (data.startDate) {
          // 날짜 변경 없음 - 기존 날짜 캐시 업데이트
          queryClient.setQueryData(['todos', data.startDate], (old) => {
            if (!old) return old;
            const updated = old.map(todo => 
              todo._id === id 
                ? { ...todo, ...data, updatedAt: new Date().toISOString() }
                : todo
            );
            console.log('📅 [useUpdateTodo] 날짜별 캐시 업데이트 완료');
            return updated;
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
          console.log('🗑️ [useUpdateTodo] 이전 카테고리 캐시에서 제거');
        }
        
        // 새 카테고리 캐시에 추가
        if (data.categoryId) {
          queryClient.setQueryData(['todos', 'category', data.categoryId], (old) => {
            const updatedTodo = { ...oldTodo, ...data, updatedAt: new Date().toISOString() };
            return old ? [...old, updatedTodo] : [updatedTodo];
          });
          console.log('➕ [useUpdateTodo] 새 카테고리 캐시에 추가');
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
        console.log('📂 [useUpdateTodo] 카테고리별 캐시 업데이트 완료');
      }
      
      const mutateEndTime = performance.now();
      console.log(`⚡ [useUpdateTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);
      
      return { previousAll, previousDate, oldTodo };
    },
    mutationFn: async ({ id, data }) => {
      const fnStartTime = performance.now();
      console.log('📝 [useUpdateTodo] mutationFn 시작:', { id, data });

      // 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();

      // 로컬 저장 헬퍼 함수
      const updateLocally = async () => {
        console.log('📵 [useUpdateTodo] 오프라인/서버실패 - SQLite 저장');
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

          const sqliteStart = performance.now();
          await upsertTodo(updatedTodo);
          const sqliteEnd = performance.now();
          console.log(`✅ [useUpdateTodo] SQLite 저장 완료 (${(sqliteEnd - sqliteStart).toFixed(2)}ms)`);

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

      // 네트워크 상태 확인
      if (!netInfo.isConnected) {
        const result = await updateLocally();
        const fnEndTime = performance.now();
        console.log(`⚡ [useUpdateTodo] mutationFn 완료 (오프라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return result;
      }

      // 온라인이면 서버로 전송 시도
      try {
        const serverStart = performance.now();
        const res = await todoAPI.updateTodo(id, data);
        const serverEnd = performance.now();
        console.log(`✅ [useUpdateTodo] 서버 수정 성공 (${(serverEnd - serverStart).toFixed(2)}ms):`, res.data);

        // 서버 수정 성공 시 SQLite에도 저장
        await ensureDatabase();
        await upsertTodo(res.data);

        const fnEndTime = performance.now();
        console.log(`⚡ [useUpdateTodo] mutationFn 완료 (온라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return res.data;
      } catch (error) {
        console.error('⚠️ [useUpdateTodo] 서버 요청 실패 → SQLite 저장으로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        const result = await updateLocally();
        const fnEndTime = performance.now();
        console.log(`⚡ [useUpdateTodo] mutationFn 완료 (서버 실패): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return result;
      }
    },
    onSuccess: (data, { id }, context) => {
      const successStartTime = performance.now();
      console.log('🎉 [useUpdateTodo] onSuccess:', data._id);
      
      // ✅ 서버 응답으로 최종 업데이트
      queryClient.setQueryData(['todos', 'all'], (old) => {
        if (!old) return old;
        const updated = old.map(todo => todo._id === data._id ? data : todo);
        console.log('🔄 [useUpdateTodo] 전체 캐시 최종 업데이트 완료');
        return updated;
      });
      
      // 날짜별 캐시: 반복 일정 또는 기간 일정 관련 여부 확인
      const wasRecurrence = context?.oldTodo?.recurrence;
      const nowRecurrence = data.recurrence;
      const wasMultiDay = context?.oldTodo && context.oldTodo.startDate !== context.oldTodo.endDate;
      const nowMultiDay = data.startDate !== data.endDate;
      
      if (wasRecurrence || nowRecurrence || wasMultiDay || nowMultiDay) {
        // 반복/기간 일정 관련 (반복→반복, 반복→단일, 단일→반복, 기간→기간, 기간→단일, 단일→기간):
        // 모든 날짜별 캐시 무효화 → SQLite 재조회
        queryClient.invalidateQueries({ 
          queryKey: ['todos'], 
          predicate: (query) => {
            // ['todos', 'YYYY-MM-DD'] 형식의 쿼리만 무효화
            return query.queryKey[0] === 'todos' && 
                   typeof query.queryKey[1] === 'string' && 
                   query.queryKey[1].match(/^\d{4}-\d{2}-\d{2}$/);
          }
        });
        console.log('📅 [useUpdateTodo] 반복/기간 일정 관련 - 모든 날짜별 캐시 무효화 (onSuccess)');
      } else if (data.startDate) {
        // 단일 → 단일: 날짜별 캐시 최종 업데이트
        queryClient.setQueryData(['todos', data.startDate], (old) => {
          if (!old) return old;
          const updated = old.map(todo => todo._id === data._id ? data : todo);
          console.log('🔄 [useUpdateTodo] 날짜별 캐시 최종 업데이트 완료');
          return updated;
        });
      }
      
      if (data.categoryId) {
        queryClient.setQueryData(['todos', 'category', data.categoryId], (old) => {
          if (!old) return old;
          const updated = old.map(todo => todo._id === data._id ? data : todo);
          console.log('🔄 [useUpdateTodo] 카테고리별 캐시 최종 업데이트 완료');
          return updated;
        });
      }
      
      const successEndTime = performance.now();
      console.log(`⚡ [useUpdateTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, { id, data }, context) => {
      const errorStartTime = performance.now();
      console.error('❌ [useUpdateTodo] 에러 발생 - 롤백 시작:', error.message);
      
      if (context?.previousAll) {
        queryClient.setQueryData(['todos', 'all'], context.previousAll);
        console.log('🔙 [useUpdateTodo] 전체 캐시 롤백 완료:', {
          restoredCount: context.previousAll.length
        });
      }
      
      if (context?.previousDate && data.startDate) {
        queryClient.setQueryData(['todos', data.startDate], context.previousDate);
        console.log('🔙 [useUpdateTodo] 날짜별 캐시 롤백 완료');
      }
      
      // 날짜 변경 시 추가된 캐시 롤백
      if (context?.oldTodo && context.oldTodo.startDate !== data.startDate) {
        if (context.oldTodo.startDate) {
          queryClient.invalidateQueries({ queryKey: ['todos', context.oldTodo.startDate] });
        }
        if (data.startDate) {
          queryClient.invalidateQueries({ queryKey: ['todos', data.startDate] });
        }
        console.log('🔙 [useUpdateTodo] 날짜 변경 캐시 롤백 완료');
      }
      
      // 카테고리 변경 시 추가된 캐시 롤백
      if (context?.oldTodo && context.oldTodo.categoryId !== data.categoryId) {
        if (context.oldTodo.categoryId) {
          queryClient.invalidateQueries({ queryKey: ['todos', 'category', context.oldTodo.categoryId] });
        }
        if (data.categoryId) {
          queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.categoryId] });
        }
        console.log('🔙 [useUpdateTodo] 카테고리 변경 캐시 롤백 완료');
      }
      
      const errorEndTime = performance.now();
      console.error('❌ [useUpdateTodo] 할일 수정 실패:', {
        error: error.message,
        rollbackTime: `${(errorEndTime - errorStartTime).toFixed(2)}ms`
      });
    },
  });
};

