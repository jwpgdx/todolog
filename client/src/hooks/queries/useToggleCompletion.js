import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { completionAPI } from '../../api/todos';
import { 
  toggleCompletion as sqliteToggleCompletion,
  createCompletion,
  deleteCompletion 
} from '../../services/db/completionService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
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
    mutationFn: async ({ todoId, date, currentCompleted, todo }) => {
      console.log('🔄 [useToggleCompletion] 시작:', { todoId, date, currentCompleted });

      // 기간 일정 여부 확인
      const isRangeTodo = todo && todo.startDate !== todo.endDate;
      const completionDate = isRangeTodo ? null : date;
      
      if (isRangeTodo) {
        console.log('📅 [useToggleCompletion] 기간 일정 감지:', {
          startDate: todo.startDate,
          endDate: todo.endDate,
          completionDate: 'null (전체 기간)'
        });
      }

      // UUID 생성 (완료 생성 시 사용)
      const completionId = generateId();
      console.log('🆔 [useToggleCompletion] UUID 생성:', completionId);

      // 1. SQLite 초기화 보장 후 토글 (Optimistic)
      let optimisticState;
      try {
        await ensureDatabase();
        optimisticState = await sqliteToggleCompletion(todoId, completionDate, completionId);
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
          entityId: completionId,
          data: { todoId, date: completionDate },
        });
        return { completed: optimisticState, offline: true, isRangeTodo };
      }

      // 3. 온라인: 서버 요청
      try {
        console.log('🌐 [useToggleCompletion] 서버 요청 시작');
        
        const res = await completionAPI.toggleCompletion(todoId, completionDate, completionId);
        console.log('✅ [useToggleCompletion] 서버 요청 성공:', res.data);

        // 🔧 FIX: 서버 응답으로 SQLite 동기화
        const serverState = res.data.completed;
        if (serverState !== optimisticState) {
          console.warn(`⚠️ [useToggleCompletion] 상태 불일치 감지! SQLite=${optimisticState}, Server=${serverState}`);
          console.log(`🔄 [useToggleCompletion] SQLite를 서버 상태로 동기화: ${serverState}`);
          
          // SQLite를 서버 상태로 강제 동기화
          if (serverState) {
            await createCompletion(todoId, completionDate, completionId);
          } else {
            await deleteCompletion(todoId, completionDate);
          }
          console.log(`✅ [useToggleCompletion] SQLite 동기화 완료: ${serverState}`);
        }

        return { ...res.data, isRangeTodo };
      } catch (error) {
        console.error('❌ [useToggleCompletion] 서버 요청 실패:', error.message);
        await addPendingChange({
          type: optimisticState ? 'createCompletion' : 'deleteCompletion',
          entityId: completionId,
          data: { todoId, date: completionDate },
        });
        return { completed: optimisticState, offline: true, isRangeTodo };
      }
    },
    onSuccess: (data, variables) => {
      const successStartTime = performance.now();
      console.log('✅ [useToggleCompletion] onSuccess:', data);
      
      // 기간 일정인 경우 모든 날짜 캐시 무효화
      if (data.isRangeTodo) {
        console.log('📅 [useToggleCompletion] 기간 일정 - 모든 날짜별 캐시 무효화');
        queryClient.invalidateQueries({ 
          queryKey: ['todos'], 
          predicate: (query) => {
            // ['todos', 'YYYY-MM-DD'] 형식의 쿼리만 무효화
            return query.queryKey[0] === 'todos' && 
                   typeof query.queryKey[1] === 'string' && 
                   query.queryKey[1].match(/^\d{4}-\d{2}-\d{2}$/);
          }
        });
      } else {
        // 단일 일정인 경우 해당 날짜만 업데이트
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
