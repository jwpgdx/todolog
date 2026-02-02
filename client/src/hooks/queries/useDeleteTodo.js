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
    mutationFn: async (todo) => {
      console.log('🗑️ [useDeleteTodo] 할일 삭제 요청:', todo._id);

      // 로컬 삭제 헬퍼 함수
      const deleteLocally = async () => {
        console.log('📵 [useDeleteTodo] 오프라인/서버실패 - SQLite 삭제');
        console.log('📦 [useDeleteTodo] 삭제 대상:', { id: todo._id, title: todo.title });
        
        await ensureDatabase();
        await deleteTodo(todo._id);
        console.log('✅ [useDeleteTodo] SQLite에서 삭제 완료');
        
        await addPendingChange({
          type: 'delete',
          todoId: todo._id,
        });
        console.log('✅ [useDeleteTodo] Pending queue 추가 완료');
        
        return { message: 'SQLite 삭제 완료', deletedTodo: todo };
      };

      // 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useDeleteTodo] 네트워크 상태:', { isConnected: netInfo.isConnected, type: netInfo.type });

      if (!netInfo.isConnected) {
        console.log('🚫 [useDeleteTodo] 오프라인 감지 → 로컬 삭제');
        return await deleteLocally();
      }

      // 온라인이면 서버로 전송 시도
      console.log('🚀 [useDeleteTodo] 온라인 → 서버 요청 시도');
      try {
        const res = await todoAPI.deleteTodo(todo._id);
        console.log('✅ [useDeleteTodo] 서버 삭제 성공');
        
        // 서버 삭제 성공 시 SQLite에서도 삭제
        await ensureDatabase();
        await deleteTodo(todo._id);
        console.log('✅ [useDeleteTodo] SQLite에서도 삭제 완료');
        
        return { ...res.data, deletedTodo: todo };
      } catch (error) {
        console.error('⚠️ [useDeleteTodo] 서버 요청 실패 → SQLite 삭제로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        return await deleteLocally();
      }
    },
    onSuccess: (data) => {
      console.log('🎉 [useDeleteTodo] onSuccess 호출됨');

      // 전체 캐시 무효화 (SQLite에서 다시 조회)
      queryClient.invalidateQueries({ queryKey: ['todos', 'all'] });

      // 날짜별 캐시 무효화
      if (data.deletedTodo.startDate) {
        queryClient.invalidateQueries({ queryKey: ['todos', data.deletedTodo.startDate] });
      }

      // 카테고리 뷰 무효화
      if (data.deletedTodo.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.deletedTodo.categoryId] });
      }

      // 삭제된 Todo의 영향받는 월 캐시 무효화
      if (data.deletedTodo) {
        invalidateAffectedMonths(queryClient, data.deletedTodo);
      } else {
        // 폴백: 전체 캐시 무효화
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['events'] });
        queryClient.invalidateQueries({ queryKey: ['calendarSummary'] });
      }
    },
    onError: (error) => {
      console.error('❌ [useDeleteTodo] 할일 삭제 실패:', error);
    },
  });
};
