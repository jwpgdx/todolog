import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { completionAPI } from '../../api/todos';
import { 
  toggleCompletion as sqliteToggleCompletion,
  createCompletion,
  deleteCompletion 
} from '../../db/completionService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';
import { generateId } from '../../utils/idGenerator';

/**
 * Completion 토글 훅 (SQLite 기반 + Server Sync)
 * 
 * 수정된 흐름 (2026-02-03):
 * 1. SQLite 즉시 토글 (Optimistic Update)
 * 2. 네트워크 확인
 *    - 온라인: 서버 요청 → 서버 응답으로 SQLite 동기화
 *    - 오프라인: Pending Queue 추가
 * 3. 실패 시: Pending Queue 추가
 * 
 * 버그 수정:
 * - 이전: SQLite와 서버가 독립적으로 토글 → 불일치 발생
 * - 수정: 서버 응답을 Source of Truth로 사용 → SQLite 동기화
 */
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, date, currentCompleted }) => {
      console.log('🔄 [useToggleCompletion] 시작:', { todoId, date, currentCompleted });

      // 1. SQLite 초기화 보장 후 토글 (Optimistic)
      let optimisticState;
      try {
        await ensureDatabase();
        optimisticState = await sqliteToggleCompletion(todoId, date);
        console.log(`✅ [useToggleCompletion] SQLite 토글 완료 (Optimistic): ${optimisticState}`);
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
          type: optimisticState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
        });
        return { completed: optimisticState, offline: true };
      }

      // 3. 온라인: 서버 요청
      try {
        console.log('🌐 [useToggleCompletion] 서버 요청 시작');
        
        // Completion ID 생성 (완료 생성 시에만 필요)
        const completionId = optimisticState ? `${todoId}_${date || 'null'}` : undefined;
        
        const res = await completionAPI.toggleCompletion(todoId, date, completionId);
        console.log('✅ [useToggleCompletion] 서버 요청 성공:', res.data);

        // 🔧 FIX: 서버 응답으로 SQLite 동기화
        const serverState = res.data.completed;
        if (serverState !== optimisticState) {
          console.warn(`⚠️ [useToggleCompletion] 상태 불일치 감지! SQLite=${optimisticState}, Server=${serverState}`);
          console.log(`🔄 [useToggleCompletion] SQLite를 서버 상태로 동기화: ${serverState}`);
          
          // SQLite를 서버 상태로 강제 동기화
          if (serverState) {
            await createCompletion(todoId, date);
          } else {
            await deleteCompletion(todoId, date);
          }
          console.log(`✅ [useToggleCompletion] SQLite 동기화 완료: ${serverState}`);
        }

        return res.data;
      } catch (error) {
        console.error('❌ [useToggleCompletion] 서버 요청 실패:', error.message);
        await addPendingChange({
          type: optimisticState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
        });
        return { completed: optimisticState, offline: true };
      }
    },
    onSuccess: (data, variables) => {
      const successStartTime = performance.now();
      console.log('✅ [useToggleCompletion] onSuccess:', data);
      
      // ✅ 날짜별 캐시 업데이트 (TodoScreen용)
      if (variables.date) {
        queryClient.setQueryData(['todos', variables.date], (oldData) => {
          if (!oldData) return oldData;
          const updated = oldData.map(todo => {
            if (todo._id === variables.todoId) {
              return { ...todo, completed: data.completed };
            }
            return todo;
          });
          console.log('📅 [useToggleCompletion] 날짜별 캐시 업데이트 완료:', {
            date: variables.date,
            todoId: variables.todoId,
            completed: data.completed
          });
          return updated;
        });
      }
      
      // ❌ 제거: ['todos', 'all'] 업데이트 불필요
      // - Completion 변경은 캘린더 이벤트(색상, 제목)와 무관
      // - 불필요한 캘린더 재계산 방지
      
      const successEndTime = performance.now();
      console.log(`⚡ [useToggleCompletion] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error, variables) => {
      console.error('❌ [useToggleCompletion] onError:', error);
    }
  });
};
