import { useMutation, useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { upsertTodo } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';

export const useCreateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (variables) => {
      const mutateStartTime = performance.now();
      console.log('🔄 [useCreateTodo] onMutate 시작:', variables);
      
      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', variables.startDate] });
      console.log('⏸️ [useCreateTodo] 진행 중인 쿼리 취소 완료');
      
      // 2. 이전 데이터 백업
      const previousAll = queryClient.getQueryData(['todos', 'all']);
      const previousDate = queryClient.getQueryData(['todos', variables.startDate]);
      
      console.log('💾 [useCreateTodo] 백업 완료:', {
        allCount: previousAll?.length || 0,
        dateCount: previousDate?.length || 0
      });
      
      // 3. 새 Todo 객체 생성 (mutationFn과 동일한 구조)
      const todoId = generateId();
      const optimisticTodo = {
        _id: todoId,
        ...variables,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completed: false,
        syncStatus: 'pending',
      };
      
      console.log('✨ [useCreateTodo] Optimistic Todo 생성:', {
        id: optimisticTodo._id,
        title: optimisticTodo.title
      });
      
      // 4. 캐시 직접 업데이트
      queryClient.setQueryData(['todos', 'all'], (old) => {
        const updated = old ? [...old, optimisticTodo] : [optimisticTodo];
        console.log('📝 [useCreateTodo] 전체 캐시 업데이트:', {
          before: old?.length || 0,
          after: updated.length
        });
        return updated;
      });
      
      // 날짜별 캐시: 반복 일정 또는 기간 일정은 onSuccess에서 처리
      const isMultiDay = variables.startDate !== variables.endDate;
      
      if (!variables.recurrence && !isMultiDay) {
        // 단일 날짜 일정만 onMutate에서 날짜별 캐시 업데이트
        if (variables.startDate) {
          queryClient.setQueryData(['todos', variables.startDate], (old) => {
            const updated = old ? [...old, optimisticTodo] : [optimisticTodo];
            console.log('📅 [useCreateTodo] 날짜별 캐시 업데이트:', {
              date: variables.startDate,
              before: old?.length || 0,
              after: updated.length
            });
            return updated;
          });
        }
      } else {
        console.log('🔄 [useCreateTodo] 반복/기간 일정 - 날짜별 캐시는 onSuccess에서 처리');
      }
      
      const mutateEndTime = performance.now();
      console.log(`⚡ [useCreateTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);
      
      // 5. 백업 데이터 반환 (롤백용)
      return { previousAll, previousDate, optimisticTodo };
    },
    mutationFn: async (data) => {
      const fnStartTime = performance.now();
      console.log('🚀 [useCreateTodo] mutationFn 시작:', data);

      await ensureDatabase();

      // UUID 생성 (클라이언트에서)
      const todoId = generateId();
      const todo = {
        _id: todoId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      // SQLite에 즉시 저장
      const sqliteStart = performance.now();
      await upsertTodo(todo);
      const sqliteEnd = performance.now();
      console.log(`✅ [useCreateTodo] SQLite 저장 완료: ${todoId} (${(sqliteEnd - sqliteStart).toFixed(2)}ms)`);

      // 네트워크 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useCreateTodo] 네트워크 상태:', { isConnected: netInfo.isConnected });

      if (!netInfo.isConnected) {
        console.log('📵 [useCreateTodo] 오프라인 - Pending 추가');
        await addPendingChange({
          type: 'createTodo',
          entityId: todoId,
          data: { _id: todoId, ...data },
        });
        const fnEndTime = performance.now();
        console.log(`⚡ [useCreateTodo] mutationFn 완료 (오프라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return todo;
      }

      // 온라인: 서버 전송
      try {
        const serverStart = performance.now();
        const res = await todoAPI.createTodo({ _id: todoId, ...data });
        const serverEnd = performance.now();
        console.log(`✅ [useCreateTodo] 서버 저장 성공: ${res.data._id} (${(serverEnd - serverStart).toFixed(2)}ms)`);

        // 서버 응답으로 SQLite 업데이트
        await upsertTodo(res.data);
        const fnEndTime = performance.now();
        console.log(`⚡ [useCreateTodo] mutationFn 완료 (온라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return res.data;
      } catch (error) {
        console.error('⚠️ [useCreateTodo] 서버 실패 → Pending 추가:', error.message);
        await addPendingChange({
          type: 'createTodo',
          entityId: todoId,
          data: { _id: todoId, ...data },
        });
        const fnEndTime = performance.now();
        console.log(`⚡ [useCreateTodo] mutationFn 완료 (서버 실패): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return todo;
      }
    },
    onSuccess: async (data, variables, context) => {
      const successStartTime = performance.now();
      console.log('🎉 [useCreateTodo] onSuccess:', { id: data._id, title: data.title });
      
      // ✅ 서버 응답으로 Optimistic Todo 교체
      queryClient.setQueryData(['todos', 'all'], (old) => {
        if (!old) return [data];
        const updated = old.map(todo => 
          todo._id === context.optimisticTodo._id ? data : todo
        );
        console.log('🔄 [useCreateTodo] Optimistic → 서버 데이터 교체:', {
          optimisticId: context.optimisticTodo._id,
          serverId: data._id,
          totalCount: updated.length
        });
        return updated;
      });
      
      // 날짜별 캐시: 반복 일정 또는 기간 일정은 무효화, 단일 일정은 교체
      const isMultiDay = data.startDate !== data.endDate;
      
      if (data.recurrence || isMultiDay) {
        // 반복 일정 또는 기간 일정: 모든 날짜별 캐시 무효화
        queryClient.invalidateQueries({ 
          queryKey: ['todos'], 
          predicate: (query) => {
            // ['todos', 'YYYY-MM-DD'] 형식의 쿼리만 무효화
            return query.queryKey[0] === 'todos' && 
                   typeof query.queryKey[1] === 'string' && 
                   query.queryKey[1].match(/^\d{4}-\d{2}-\d{2}$/);
          }
        });
        console.log('📅 [useCreateTodo] 반복/기간 일정 - 모든 날짜별 캐시 무효화 (onSuccess)');
      } else if (data.startDate) {
        // 단일 날짜 일정: 해당 날짜 캐시 교체
        queryClient.setQueryData(['todos', data.startDate], (old) => {
          if (!old) return [data];
          const updated = old.map(todo => 
            todo._id === context.optimisticTodo._id ? data : todo
          );
          console.log('🔄 [useCreateTodo] 날짜별 캐시 교체 완료');
          return updated;
        });
      }
      
      // 카테고리 뷰 캐시 업데이트
      if (data.categoryId) {
        queryClient.setQueryData(['todos', 'category', data.categoryId], (old) => {
          if (!old) return [data];
          const updated = old.map(todo => 
            todo._id === context.optimisticTodo._id ? data : todo
          );
          console.log('🔄 [useCreateTodo] 카테고리별 캐시 교체 완료');
          return updated;
        });
      }
      
      // 사용자 편의를 위한 마지막 사용 정보 저장
      try {
        const todoType = variables.recurrence ? 'routine' : 'todo';
        await AsyncStorage.setItem('lastUsedTodoType', todoType);

        if (variables.categoryId) {
          await AsyncStorage.setItem('lastUsedCategoryId', variables.categoryId);
        }
        console.log('💾 [useCreateTodo] 사용자 편의 정보 저장 완료');
      } catch (error) {
        console.error('❌ [useCreateTodo] 로컬 저장 실패:', error);
      }
      
      const successEndTime = performance.now();
      console.log(`⚡ [useCreateTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, variables, context) => {
      const errorStartTime = performance.now();
      console.error('❌ [useCreateTodo] 에러 발생 - 롤백 시작:', error.message);
      
      // 백업 데이터로 복구
      if (context?.previousAll) {
        queryClient.setQueryData(['todos', 'all'], context.previousAll);
        console.log('🔙 [useCreateTodo] 전체 캐시 롤백 완료:', {
          restoredCount: context.previousAll.length
        });
      }
      
      if (context?.previousDate && variables.startDate) {
        queryClient.setQueryData(['todos', variables.startDate], context.previousDate);
        console.log('🔙 [useCreateTodo] 날짜별 캐시 롤백 완료:', {
          date: variables.startDate,
          restoredCount: context.previousDate.length
        });
      }
      
      if (context?.optimisticTodo && variables.categoryId) {
        queryClient.setQueryData(['todos', 'category', variables.categoryId], (old) => {
          if (!old) return old;
          return old.filter(todo => todo._id !== context.optimisticTodo._id);
        });
        console.log('🔙 [useCreateTodo] 카테고리별 캐시 롤백 완료');
      }
      
      const errorEndTime = performance.now();
      console.error('❌ [useCreateTodo] 할일 생성 실패:', {
        error: error.message,
        variables,
        rollbackTime: `${(errorEndTime - errorStartTime).toFixed(2)}ms`
      });
    },
  });
};
