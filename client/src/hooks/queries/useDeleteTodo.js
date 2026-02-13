import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { deleteTodo } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { useTodoCalendarStore } from '../../features/todo-calendar/store/todoCalendarStore';

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();
  const invalidateAdjacentMonths = useTodoCalendarStore(state => state.invalidateAdjacentMonths);

  return useMutation({
    onMutate: async (todo) => {
      const mutateStartTime = performance.now();
      
      // 1. 진행 중인 refetch 취소
      await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
      await queryClient.cancelQueries({ queryKey: ['todos', todo.startDate] });
      
      // 2. 이전 데이터 백업
      const previousAll = queryClient.getQueryData(['todos', 'all']);
      const previousDate = queryClient.getQueryData(['todos', todo.startDate]);
      
      // 3. 캐시에서 제거
      queryClient.setQueryData(['todos', 'all'], (old) => {
        if (!old) return old;
        return old.filter(t => t._id !== todo._id);
      });
      
      // 날짜별 캐시: 단일 날짜 일정만 onMutate에서 업데이트
      const isMultiDay = todo.startDate !== todo.endDate;
      
      if (!todo.recurrence && !isMultiDay && todo.startDate) {
        queryClient.setQueryData(['todos', todo.startDate], (old) => {
          if (!old) return old;
          return old.filter(t => t._id !== todo._id);
        });
      }
      
      if (todo.categoryId) {
        queryClient.setQueryData(['todos', 'category', todo.categoryId], (old) => {
          if (!old) return old;
          return old.filter(t => t._id !== todo._id);
        });
      }
      
      const mutateEndTime = performance.now();
      console.log(`⚡ [useDeleteTodo] onMutate 완료: ${(mutateEndTime - mutateStartTime).toFixed(2)}ms`);
      
      return { previousAll, previousDate, deletedTodo: todo };
    },
    mutationFn: async (todo) => {
      const fnStartTime = performance.now();

      // 로컬 삭제 헬퍼 함수
      const deleteLocally = async () => {
        await ensureDatabase();
        await deleteTodo(todo._id);
        await addPendingChange({
          type: 'deleteTodo',
          entityId: todo._id,
        });
        return { message: 'SQLite 삭제 완료', deletedTodo: todo };
      };

      // 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        const result = await deleteLocally();
        const fnEndTime = performance.now();
        console.log(`⚡ [useDeleteTodo] mutationFn 완료 (오프라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return result;
      }

      // 온라인이면 서버로 전송 시도
      try {
        const res = await todoAPI.deleteTodo(todo._id);

        // 서버 삭제 성공 시 SQLite에서도 삭제
        await ensureDatabase();
        await deleteTodo(todo._id);

        const fnEndTime = performance.now();
        console.log(`⚡ [useDeleteTodo] mutationFn 완료 (온라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return { ...res.data, deletedTodo: todo };
      } catch (error) {
        console.error('⚠️ [useDeleteTodo] 서버 요청 실패 → SQLite 삭제로 fallback:', error.message);
        const result = await deleteLocally();
        const fnEndTime = performance.now();
        console.log(`⚡ [useDeleteTodo] mutationFn 완료 (서버 실패): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return result;
      }
    },
    onSuccess: (data, variables) => {
      const successStartTime = performance.now();
      
      // 1. 모든 캐시에서 삭제된 Todo 제거 (Ghosting 방지)
      queryClient.setQueriesData(
        { queryKey: ['todos'] },
        (oldData) => {
          if (!oldData) return oldData;
          return oldData.filter(todo => todo._id !== variables._id);
        }
      );
      
      // 2. 서버 데이터 재검증
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      // Phase 2: 캘린더 캐시 무효화
      if (variables?.date || variables?.startDate) {
        const dateStr = variables.date || variables.startDate;
        const [year, month] = dateStr.split('-').map(Number);
        invalidateAdjacentMonths(year, month);
        console.log(`📅 [useDeleteTodo] Calendar cache invalidated for ${year}-${month}`);
      }
      
      const successEndTime = performance.now();
      console.log(`⚡ [useDeleteTodo] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, todo, context) => {
      console.error('❌ [useDeleteTodo] 에러 발생 - 롤백 시작:', error.message);
      
      if (context?.previousAll) {
        queryClient.setQueryData(['todos', 'all'], context.previousAll);
      }
      
      if (context?.previousDate && todo.startDate) {
        queryClient.setQueryData(['todos', todo.startDate], context.previousDate);
      }
      
      if (todo.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', todo.categoryId] });
      }
      
      console.error('❌ [useDeleteTodo] 할일 삭제 실패:', error.message);
    },
  });
};
