import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { deleteTodo } from '../../db/todoService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    onMutate: async (todo) => {
      const mutateStartTime = performance.now();
      console.log('🔄 [useDeleteTodo] onMutate 시작:', todo._id);
      
      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', todo.startDate] });
      console.log('⏸️ [useDeleteTodo] 진행 중인 쿼리 취소 완료');
      
      // 2. 이전 데이터 백업
      const previousAll = queryClient.getQueryData(['todos', 'all']);
      const previousDate = queryClient.getQueryData(['todos', todo.startDate]);
      
      console.log('💾 [useDeleteTodo] 백업 완료:', {
        allCount: previousAll?.length || 0,
        dateCount: previousDate?.length || 0,
        deletingTodo: { id: todo._id, title: todo.title }
      });
      
      // 3. 캐시에서 제거
      queryClient.setQueryData(['todos', 'all'], (old) => {
        if (!old) return old;
        const updated = old.filter(t => t._id !== todo._id);
        console.log('🗑️ [useDeleteTodo] 전체 캐시에서 제거:', {
          before: old.length,
          after: updated.length
        });
        return updated;
      });
      
      // 날짜별 캐시: 반복 일정 또는 기간 일정은 onSuccess에서 처리
      const isMultiDay = todo.startDate !== todo.endDate;
      
      if (!todo.recurrence && !isMultiDay) {
        // 단일 날짜 일정만 onMutate에서 날짜별 캐시 업데이트
        if (todo.startDate) {
          queryClient.setQueryData(['todos', todo.startDate], (old) => {
            if (!old) return old;
            const updated = old.filter(t => t._id !== todo._id);
            console.log('🗑️ [useDeleteTodo] 날짜별 캐시에서 제거:', {
              date: todo.startDate,
              before: old.length,
              after: updated.length
            });
            return updated;
          });
        }
      } else {
        console.log('🔄 [useDeleteTodo] 반복/기간 일정 - 날짜별 캐시는 onSuccess에서 처리');
      }
      
      if (todo.categoryId) {
        queryClient.setQueryData(['todos', 'category', todo.categoryId], (old) => {
          if (!old) return old;
          const updated = old.filter(t => t._id !== todo._id);
          console.log('🗑️ [useDeleteTodo] 카테고리별 캐시에서 제거');
          return updated;
        });
      }
      
      const mutateEndTime = performance.now();
      console.log(`⚡ [useDeleteTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);
      
      return { previousAll, previousDate, deletedTodo: todo };
    },
    mutationFn: async (todo) => {
      const fnStartTime = performance.now();
      console.log('🗑️ [useDeleteTodo] mutationFn 시작:', todo._id);

      // 로컬 삭제 헬퍼 함수
      const deleteLocally = async () => {
        console.log('📵 [useDeleteTodo] 오프라인/서버실패 - SQLite 삭제');
        console.log('📦 [useDeleteTodo] 삭제 대상:', { id: todo._id, title: todo.title });

        await ensureDatabase();
        
        const sqliteStart = performance.now();
        await deleteTodo(todo._id);
        const sqliteEnd = performance.now();
        console.log(`✅ [useDeleteTodo] SQLite에서 삭제 완료 (${(sqliteEnd - sqliteStart).toFixed(2)}ms)`);

        await addPendingChange({
          type: 'deleteTodo',
          entityId: todo._id,
        });
        console.log('✅ [useDeleteTodo] Pending queue 추가 완료');

        return { message: 'SQLite 삭제 완료', deletedTodo: todo };
      };

      // 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useDeleteTodo] 네트워크 상태:', { isConnected: netInfo.isConnected, type: netInfo.type });

      if (!netInfo.isConnected) {
        console.log('🚫 [useDeleteTodo] 오프라인 감지 → 로컬 삭제');
        const result = await deleteLocally();
        const fnEndTime = performance.now();
        console.log(`⚡ [useDeleteTodo] mutationFn 완료 (오프라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return result;
      }

      // 온라인이면 서버로 전송 시도
      console.log('🚀 [useDeleteTodo] 온라인 → 서버 요청 시도');
      try {
        const serverStart = performance.now();
        const res = await todoAPI.deleteTodo(todo._id);
        const serverEnd = performance.now();
        console.log(`✅ [useDeleteTodo] 서버 삭제 성공 (${(serverEnd - serverStart).toFixed(2)}ms)`);

        // 서버 삭제 성공 시 SQLite에서도 삭제
        await ensureDatabase();
        await deleteTodo(todo._id);
        console.log('✅ [useDeleteTodo] SQLite에서도 삭제 완료');

        const fnEndTime = performance.now();
        console.log(`⚡ [useDeleteTodo] mutationFn 완료 (온라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return { ...res.data, deletedTodo: todo };
      } catch (error) {
        console.error('⚠️ [useDeleteTodo] 서버 요청 실패 → SQLite 삭제로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        const result = await deleteLocally();
        const fnEndTime = performance.now();
        console.log(`⚡ [useDeleteTodo] mutationFn 완료 (서버 실패): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return result;
      }
    },
    onSuccess: (data, todo) => {
      const successStartTime = performance.now();
      console.log('🎉 [useDeleteTodo] onSuccess:', todo._id);
      
      // 반복 일정 또는 기간 일정: 모든 날짜별 캐시 무효화
      const isMultiDay = todo.startDate !== todo.endDate;
      
      if (todo.recurrence || isMultiDay) {
        queryClient.invalidateQueries({ 
          queryKey: ['todos'], 
          predicate: (query) => {
            // ['todos', 'YYYY-MM-DD'] 형식의 쿼리만 무효화
            return query.queryKey[0] === 'todos' && 
                   typeof query.queryKey[1] === 'string' && 
                   query.queryKey[1].match(/^\d{4}-\d{2}-\d{2}$/);
          }
        });
        console.log('📅 [useDeleteTodo] 반복/기간 일정 - 모든 날짜별 캐시 무효화 (onSuccess)');
      } else if (todo.startDate) {
        // 단일 날짜 일정: 해당 날짜 캐시 무효화 (onMutate에서 업데이트 못했을 경우 대비)
        queryClient.invalidateQueries({ queryKey: ['todos', todo.startDate] });
        console.log('📅 [useDeleteTodo] 단일 일정 - 날짜별 캐시 무효화:', todo.startDate);
      }
      
      const successEndTime = performance.now();
      console.log(`⚡ [useDeleteTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, todo, context) => {
      const errorStartTime = performance.now();
      console.error('❌ [useDeleteTodo] 에러 발생 - 롤백 시작:', error.message);
      
      if (context?.previousAll) {
        queryClient.setQueryData(['todos', 'all'], context.previousAll);
        console.log('🔙 [useDeleteTodo] 전체 캐시 롤백 완료:', {
          restoredCount: context.previousAll.length
        });
      }
      
      if (context?.previousDate && todo.startDate) {
        queryClient.setQueryData(['todos', todo.startDate], context.previousDate);
        console.log('🔙 [useDeleteTodo] 날짜별 캐시 롤백 완료:', {
          date: todo.startDate,
          restoredCount: context.previousDate.length
        });
      }
      
      if (todo.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', todo.categoryId] });
        console.log('🔙 [useDeleteTodo] 카테고리별 캐시 롤백 완료');
      }
      
      const errorEndTime = performance.now();
      console.error('❌ [useDeleteTodo] 할일 삭제 실패:', {
        error: error.message,
        rollbackTime: `${(errorEndTime - errorStartTime).toFixed(2)}ms`
      });
    },
  });
};
