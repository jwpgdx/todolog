import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { buildNewTodoOrders, upsertTodo } from '../../services/db/todoService';
import { addPendingChangeOnConnection } from '../../services/db/pendingService';
import { ensureDatabase, withWriteTransaction } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';
import { invalidateTodoSummary as invalidateDaySummariesTodo } from '../../features/calendar-day-summaries';
import { invalidateTodoCalendarV2Layouts } from '../../features/todo-calendar-v2/services/todoCalendarV2InvalidationService';
import { useSyncContext } from '../../providers/SyncProvider';

export const useCreateTodo = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    onMutate: async (variables) => {
      const mutateStartTime = performance.now();
      
      // UUID가 없으면 생성 (variables에 직접 추가)
      if (!variables._id) {
        variables._id = generateId();
      }

      await ensureDatabase();

      const optimisticOrder = variables.order || await buildNewTodoOrders({
          categoryId: variables.categoryId,
          isFavorite: Boolean(variables.isFavorite),
        });
      
      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', variables.startDate] });
      
      // 2. 이전 데이터 백업
      const previousAllQueries = queryClient.getQueriesData({ queryKey: ['todos', 'all'] });
      const previousDate = queryClient.getQueryData(['todos', variables.startDate]);
      
      // 3. Optimistic Todo 생성
      const optimisticTodo = {
        ...variables,
        order: optimisticOrder,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completed: false,
        syncStatus: 'pending',
      };
      
      // 4. 캐시 직접 업데이트
      queryClient.setQueriesData({ queryKey: ['todos', 'all'] }, (old) => {
        return old ? [...old, optimisticTodo] : [optimisticTodo];
      });
      
      // 날짜별 캐시: 단일 날짜 일정만 onMutate에서 업데이트
      const isMultiDay = variables.startDate !== variables.endDate;
      
      if (!variables.recurrence && !isMultiDay && variables.startDate) {
        queryClient.setQueryData(['todos', variables.startDate], (old) => {
          return old ? [...old, optimisticTodo] : [optimisticTodo];
        });
      }

      if (variables.categoryId) {
        queryClient.setQueriesData(
          { queryKey: ['todos', 'category', variables.categoryId] },
          (old) => (old ? [...old, optimisticTodo] : old)
        );
      }
      
      const mutateEndTime = performance.now();
      console.log(`⚡ [useCreateTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);
      
      // 5. 백업 데이터 반환 (롤백용)
      return { previousAllQueries, previousDate, optimisticTodo };
    },
    mutationFn: async (data) => {
      const fnStartTime = performance.now();

      const todo = await withWriteTransaction(async (transaction) => {
        const order = data.order || await buildNewTodoOrders({
          categoryId: data.categoryId,
          isFavorite: Boolean(data.isFavorite),
        }, transaction);
        const now = new Date().toISOString();
        const nextTodo = {
          ...data,
          order,
          createdAt: now,
          updatedAt: now,
          syncStatus: 'pending',
        };

        await upsertTodo(nextTodo, transaction);
        await addPendingChangeOnConnection(transaction, {
          type: 'createTodo',
          entityId: data._id,
          data: nextTodo,
        });

        return nextTodo;
      });

      // 온라인이면 백그라운드 동기화 트리거 (UI는 기다리지 않음)
      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => { });
        }
      } catch { }

      const fnEndTime = performance.now();
      console.log(`⚡ [useCreateTodo] mutationFn 완료 (local-first): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
      return todo;
    },
    onSuccess: async (data, variables) => {
      const successStartTime = performance.now();
      
      // 모든 todos 캐시 무효화 (단순화)
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      invalidateDaySummariesTodo(data || variables);
      invalidateTodoCalendarV2Layouts({
        todo: data || variables,
        reason: 'create-todo',
      });
      
      // 사용자 편의를 위한 마지막 사용 정보 저장
      try {
        const todoType = variables.recurrence ? 'routine' : 'todo';
        await AsyncStorage.setItem('lastUsedTodoType', todoType);

        if (variables.categoryId) {
          await AsyncStorage.setItem('lastUsedCategoryId', variables.categoryId);
        }
      } catch (error) {
        console.error('❌ [useCreateTodo] 로컬 저장 실패:', error);
      }
      
      const successEndTime = performance.now();
      console.log(`⚡ [useCreateTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, variables, context) => {
      console.error('❌ [useCreateTodo] 에러 발생 - 롤백 시작:', error.message);
      
      // 백업 데이터로 복구
      if (Array.isArray(context?.previousAllQueries)) {
        context.previousAllQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      
      if (context?.previousDate && variables.startDate) {
        queryClient.setQueryData(['todos', variables.startDate], context.previousDate);
      }
      
      if (context?.optimisticTodo && variables.categoryId) {
        queryClient.setQueriesData({ queryKey: ['todos', 'category', variables.categoryId] }, (old) => {
          if (!old) return old;
          return old.filter(todo => todo._id !== context.optimisticTodo._id);
        });
      }
      
      console.error('❌ [useCreateTodo] 할일 생성 실패:', error.message);
    },
  });
};
