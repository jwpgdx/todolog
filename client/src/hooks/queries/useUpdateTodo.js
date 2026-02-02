import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { todoAPI } from '../../api/todos';
import { invalidateAffectedMonths } from '../../utils/cacheUtils';
import { upsertTodo, getTodoById } from '../../db/todoService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';

export const useUpdateTodo = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('📝 [useUpdateTodo] 할일 수정 요청:', { id, data });

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
          
          await upsertTodo(updatedTodo);

          // Pending changes에 추가
          await addPendingChange({
            type: 'update',
            todoId: id,
            data,
          });

          return updatedTodo;
        }

        throw new Error('SQLite에서 할일을 찾을 수 없습니다');
      };

      // 네트워크 상태 확인
      if (!netInfo.isConnected) {
        return await updateLocally();
      }

      // 온라인이면 서버로 전송 시도
      try {
        const res = await todoAPI.updateTodo(id, data);
        console.log('✅ [useUpdateTodo] 서버 수정 성공:', res.data);

        // 서버 수정 성공 시 SQLite에도 저장
        await ensureDatabase();
        await upsertTodo(res.data);

        return res.data;
      } catch (error) {
        console.error('⚠️ [useUpdateTodo] 서버 요청 실패 → SQLite 저장으로 fallback:', error.message);
        // 서버 요청 실패 시 오프라인 처리
        return await updateLocally();
      }
    },
    onSuccess: (data) => {
      console.log('🎉 [useUpdateTodo] onSuccess 호출됨');

      // 전체 캐시 무효화 (SQLite에서 다시 조회)
      queryClient.invalidateQueries({ queryKey: ['todos', 'all'] });

      // 날짜별 캐시 무효화
      if (data.startDate) {
        queryClient.invalidateQueries({ queryKey: ['todos', data.startDate] });
      }

      // 카테고리 뷰 무효화
      if (data.categoryId) {
        queryClient.invalidateQueries({ queryKey: ['todos', 'category', data.categoryId] });
      }

      // 영향받는 월의 캐시 무효화
      invalidateAffectedMonths(queryClient, data);
    },
    onError: (error) => {
      console.error('❌ [useUpdateTodo] 할일 수정 실패:', error);
    },
  });
};

