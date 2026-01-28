import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { removeTodo as removeFromStorage } from '../../storage/todoStorage';
import { addPendingChange } from '../../storage/pendingChangesStorage';

export const useDeleteTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (todo) => {
      console.log('🗑️ [useDeleteTodo] 할일 삭제 요청:', todo._id);

      // 로컬 삭제 헬퍼 함수
      const deleteLocally = async () => {
        console.log('📵 [useDeleteTodo] 오프라인/서버실패 - 로컬 삭제');
        console.log('📦 [useDeleteTodo] 삭제 대상:', { id: todo._id, title: todo.title });
        
        await removeFromStorage(todo._id);
        console.log('✅ [useDeleteTodo] 로컬 저장소에서 삭제 완료');
        
        await addPendingChange({
          type: 'delete',
          todoId: todo._id,
        });
        console.log('✅ [useDeleteTodo] Pending queue 추가 완료');
        
        return { message: '로컬 삭제 완료', deletedTodo: todo };
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
        
        // 서버 삭제 성공 시 로컬에서도 삭제 (동기화)
        await removeFromStorage(todo._id);
        console.log('✅ [useDeleteTodo] 로컬 저장소에서도 삭제 완료');
        
        return { ...res.data, deletedTodo: todo };
      } catch (error) {
        console.error('⚠️ [useDeleteTodo] 서버 요청 실패 → 로컬 삭제로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        return await deleteLocally();
      }
    },
    onSuccess: (data) => {
      console.log('🎉 [useDeleteTodo] onSuccess 호출됨');

      // 1. ['todos', 'all'] 캐시 직접 업데이트 (화면 즉시 갱신용)
      queryClient.setQueryData(['todos', 'all'], (oldData) => {
        if (!oldData) return oldData;
        console.log('🧹 [useDeleteTodo] 전체 캐시에서 항목 제거:', data.deletedTodo._id);
        return oldData.filter(t => t._id !== data.deletedTodo._id);
      });

      // 2. 현재 카테고리 뷰 무효화
      if (data.deletedTodo.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.deletedTodo.categoryId] });
      }

      // 3. 삭제된 Todo의 영향받는 월 캐시 무효화
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
