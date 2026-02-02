import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { completionAPI } from '../../api/todos';
import { toggleCompletion as sqliteToggleCompletion } from '../../db/completionService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';

/**
 * Completion 토글 훅 (SQLite 기반 + Optimistic Update)
 * 
 * 새로운 흐름:
 * 1. SQLite 즉시 토글 (0.1ms)
 * 2. 캐시 직접 업데이트
 * 3. 네트워크 확인
 *    - 온라인: 서버 요청 (백그라운드)
 *    - 오프라인: Pending Queue (SQLite)
 * 4. 실패 시: Pending Queue 추가
 */
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, date, currentCompleted }) => {
      console.log('🔄 [useToggleCompletion] 시작:', { todoId, date, currentCompleted });

      // 1. SQLite 초기화 보장 후 토글
      let newState;
      try {
        await ensureDatabase();
        newState = await sqliteToggleCompletion(todoId, date);
        console.log(`✅ [useToggleCompletion] SQLite 토글 완료: ${newState}`);
      } catch (error) {
        console.error('❌ [useToggleCompletion] SQLite 토글 실패:', error.message);
        throw error;
      }

      // 2. 네트워크 확인
      const netInfo = await NetInfo.fetch();
      console.log('🌐 [useToggleCompletion] 네트워크 상태:', netInfo.isConnected);

      if (!netInfo.isConnected) {
        console.log('📵 [useToggleCompletion] 오프라인 - Pending Queue 추가');
        await addPendingChange({
          type: newState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
        });
        return { completed: newState, offline: true };
      }

      // 3. 온라인: 서버 요청 (백그라운드)
      try {
        console.log('🌐 [useToggleCompletion] 서버 요청 시작');
        const res = await completionAPI.toggleCompletion(todoId, date);
        console.log('✅ [useToggleCompletion] 서버 요청 성공:', res.data);
        return res.data;
      } catch (error) {
        console.error('❌ [useToggleCompletion] 서버 요청 실패:', error.message);
        await addPendingChange({
          type: newState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
        });
        return { completed: newState, offline: true };
      }
    },
    onSuccess: (data, variables) => {
      console.log('✅ [useToggleCompletion] onSuccess:', data);

      // 날짜별 Todo 캐시 업데이트
      if (variables.date) {
        queryClient.setQueryData(['todos', variables.date], (oldData) => {
          if (!oldData) return oldData;
          return oldData.map(todo => {
            if (todo._id === variables.todoId) {
              return { ...todo, completed: data.completed };
            }
            return todo;
          });
        });
      }

      // 캘린더/월별 쿼리 무효화
      queryClient.invalidateQueries({ queryKey: ['calendarSummary'], refetchType: 'none' });
      queryClient.invalidateQueries({ queryKey: ['monthEvents'], refetchType: 'none' });
    },
    onError: (error, variables) => {
      console.error('❌ [useToggleCompletion] onError:', error);
    }
  });
};
