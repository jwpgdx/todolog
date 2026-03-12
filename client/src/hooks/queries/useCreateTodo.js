import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { upsertTodo } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';
import { useTodoCalendarStore } from '../../features/todo-calendar/store/todoCalendarStore';
import { invalidateTodoSummary } from '../../features/strip-calendar/services/stripCalendarDataAdapter';
import { invalidateTodoSummary as invalidateDaySummariesTodo } from '../../features/calendar-day-summaries';
import { useSyncContext } from '../../providers/SyncProvider';

export const useCreateTodo = () => {
  const queryClient = useQueryClient();
  const invalidateAdjacentMonths = useTodoCalendarStore(state => state.invalidateAdjacentMonths);
  const { syncAll } = useSyncContext();

  return useMutation({
    onMutate: async (variables) => {
      const mutateStartTime = performance.now();
      
      // UUID가 없으면 생성 (variables에 직접 추가)
      if (!variables._id) {
        variables._id = generateId();
      }
      
      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', variables.startDate] });
      
      // 2. 이전 데이터 백업
      const previousAll = queryClient.getQueryData(['todos', 'all']);
      const previousDate = queryClient.getQueryData(['todos', variables.startDate]);
      
      // 3. Optimistic Todo 생성
      const optimisticTodo = {
        ...variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completed: false,
        syncStatus: 'pending',
      };
      
      // 4. 캐시 직접 업데이트
      queryClient.setQueryData(['todos', 'all'], (old) => {
        return old ? [...old, optimisticTodo] : [optimisticTodo];
      });
      
      // 날짜별 캐시: 단일 날짜 일정만 onMutate에서 업데이트
      const isMultiDay = variables.startDate !== variables.endDate;
      
      if (!variables.recurrence && !isMultiDay && variables.startDate) {
        queryClient.setQueryData(['todos', variables.startDate], (old) => {
          return old ? [...old, optimisticTodo] : [optimisticTodo];
        });
      }
      
      const mutateEndTime = performance.now();
      console.log(`⚡ [useCreateTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);
      
      // 5. 백업 데이터 반환 (롤백용)
      return { previousAll, previousDate, optimisticTodo };
    },
    mutationFn: async (data) => {
      const fnStartTime = performance.now();

      await ensureDatabase();

      // variables에서 전달된 _id 사용 (새로 생성하지 않음)
      const todo = {
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      // SQLite에 즉시 저장
      await upsertTodo(todo);

      // Offline-first: 항상 Pending에 추가하고, 서버 반영은 SyncService(Pending Push)에 맡긴다.
      await addPendingChange({
        type: 'createTodo',
        entityId: data._id,
        data: todo,
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
      
      // Phase 2: 캘린더 캐시 무효화
      if (data?.date || data?.startDate) {
        const dateStr = data.date || data.startDate;
        const [year, month] = dateStr.split('-').map(Number);
        invalidateAdjacentMonths(year, month);
        console.log(`📅 [useCreateTodo] Calendar cache invalidated for ${year}-${month}`);
      }

      invalidateTodoSummary(data || variables);
      invalidateDaySummariesTodo(data || variables);
      
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
      if (context?.previousAll) {
        queryClient.setQueryData(['todos', 'all'], context.previousAll);
      }
      
      if (context?.previousDate && variables.startDate) {
        queryClient.setQueryData(['todos', variables.startDate], context.previousDate);
      }
      
      if (context?.optimisticTodo && variables.categoryId) {
        queryClient.setQueryData(['todos', 'category', variables.categoryId], (old) => {
          if (!old) return old;
          return old.filter(todo => todo._id !== context.optimisticTodo._id);
        });
      }
      
      console.error('❌ [useCreateTodo] 할일 생성 실패:', error.message);
    },
  });
};
