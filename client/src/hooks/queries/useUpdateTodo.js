import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { upsertTodo, loadTodos, saveTodos } from '../../storage/todoStorage';
import { addPendingChange } from '../../storage/pendingChangesStorage';

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('📝 [useUpdateTodo] 할일 수정 요청:', { id, data });

      // 네트워크 상태 확인
      const netInfo = await NetInfo.fetch();

      // 로컬 저장 헬퍼 함수
      const updateLocally = async () => {
        console.log('📵 [useUpdateTodo] 오프라인/서버실패 - 로컬 저장');

        // 기존 로컬 데이터 업데이트
        const todos = await loadTodos();
        const index = todos.findIndex(t => t._id === id);

        if (index !== -1) {
          const updatedTodo = {
            ...todos[index],
            ...data,
            updatedAt: new Date().toISOString(),
            syncStatus: 'pending',
          };
          todos[index] = updatedTodo;
          await saveTodos(todos);

          // Pending changes에 추가
          await addPendingChange({
            type: 'update',
            todoId: id,
            data,
          });

          return updatedTodo;
        }

        throw new Error('로컬에서 할일을 찾을 수 없습니다');
      };

      // 네트워크 상태 확인
      if (!netInfo.isConnected) {
        return await updateLocally();
      }

      // 온라인이면 서버로 전송 시도
      try {
        const res = await todoAPI.updateTodo(id, data);
        console.log('✅ [useUpdateTodo] 서버 수정 성공:', res.data);

        // 서버 수정 성공 시 로컬에도 저장 (델타 동기화 전까지 유지)
        await upsertTodo(res.data);

        return res.data;
      } catch (error) {
        console.error('⚠️ [useUpdateTodo] 서버 요청 실패 → 로컬 저장으로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        return await updateLocally();
      }
    },
    onSuccess: (data) => {
      console.log('🎉 [useUpdateTodo] onSuccess 호출됨');

      // 1. ['todos', 'all'] 캐시 직접 업데이트
      queryClient.setQueryData(['todos', 'all'], (oldData) => {
        if (!oldData) return oldData;

        console.log('🔄 [useUpdateTodo] 전체 캐시에서 항목 업데이트:', data._id);
        const index = oldData.findIndex(t => t._id === data._id);

        if (index !== -1) {
          const newData = [...oldData];
          newData[index] = data;
          return newData;
        }
        return oldData;
      });

      // 2. 카테고리 뷰 무효화
      if (data.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.categoryId] });
      }

      // 3. 영향받는 월의 캐시 무효화
      invalidateAffectedMonths(queryClient, data);
    },
    onError: (error) => {
      console.error('❌ [useUpdateTodo] 할일 수정 실패:', error);
    },
  });
};

