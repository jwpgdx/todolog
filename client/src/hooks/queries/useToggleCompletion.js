import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { completionAPI } from '../../api/todos';
import {
  toggleCompletion as sqliteToggleCompletion,
} from '../../services/db/completionService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';
import { useTodoCalendarStore } from '../../features/todo-calendar/store/todoCalendarStore';
import { invalidateDateSummary } from '../../features/strip-calendar/services/stripCalendarDataAdapter';

/**
 * Completion 토글 훅 (SQLite 기반 + Server Sync)
 * 
 * 수정된 흐름 (2026-02-03):
 * 1. SQLite 즉시 토글 (Optimistic Update)
 * 2. 네트워크 확인
 *    - 온라인: completion create/delete 명시 API 호출
 *    - 오프라인: Pending Queue 추가
 * 3. 실패 시: Pending Queue 추가
 * 
 * 버그 수정:
 * - 이전: SQLite와 서버가 독립적으로 토글 → 불일치 발생
 * - 수정: 재시도/리플레이 안정성을 위해 toggle replay 금지, 명시 API 사용
 */
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();
  const invalidateAdjacentMonths = useTodoCalendarStore(state => state.invalidateAdjacentMonths);

  return useMutation({
    mutationFn: async ({ todoId, date, currentCompleted, todo }) => {
      const fnStartTime = performance.now();

      // 반복 vs 비반복으로만 구분
      // - 반복 일정: 날짜별로 완료 추적 (매일/매주 다른 완료 상태)
      // - 비반복 일정 (단일/기간 모두): 한 번 완료하면 끝 → null
      const isRecurring = todo && !!todo.recurrence;
      const completionDate = isRecurring ? date : null;
      const completionKey = `${todoId}_${completionDate || 'null'}`;

      // UUID 생성 (완료 생성 시 사용)
      const completionId = generateId();

      // 1. SQLite 초기화 보장 후 토글 (Optimistic)
      let optimisticState;
      try {
        await ensureDatabase();
        optimisticState = await sqliteToggleCompletion(todoId, completionDate, completionId);
      } catch (error) {
        console.error('❌ [useToggleCompletion] SQLite 토글 실패:', error.message);
        throw error;
      }

      // 2. 네트워크 확인
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        const pendingData = optimisticState
          ? { _id: completionId, todoId, date: completionDate, isRecurring }
          : { todoId, date: completionDate, isRecurring };

        await addPendingChange({
          type: optimisticState ? 'createCompletion' : 'deleteCompletion',
          entityId: completionKey,
          data: pendingData,
        });
        const fnEndTime = performance.now();
        console.log(`⚡ [useToggleCompletion] mutationFn 완료 (오프라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return { completed: optimisticState, offline: true, isRecurring };
      }

      // 3. 온라인: 서버 요청
      try {
        const res = optimisticState
          ? await completionAPI.createCompletion({
            _id: completionId,
            todoId,
            date: completionDate,
            isRecurring,
          })
          : await completionAPI.deleteCompletion({
            todoId,
            date: completionDate,
            isRecurring,
          });

        const fnEndTime = performance.now();
        console.log(`⚡ [useToggleCompletion] mutationFn 완료 (온라인): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return { ...res.data, completed: optimisticState, isRecurring };
      } catch (error) {
        console.error('❌ [useToggleCompletion] 서버 요청 실패:', error.message);
        const pendingData = optimisticState
          ? { _id: completionId, todoId, date: completionDate, isRecurring }
          : { todoId, date: completionDate, isRecurring };

        await addPendingChange({
          type: optimisticState ? 'createCompletion' : 'deleteCompletion',
          entityId: completionKey,
          data: pendingData,
        });
        const fnEndTime = performance.now();
        console.log(`⚡ [useToggleCompletion] mutationFn 완료 (서버 실패): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
        return { completed: optimisticState, offline: true, isRecurring };
      }
    },
    onSuccess: (data, variables) => {
      const successStartTime = performance.now();
      
      // 모든 todos 캐시 무효화 (단순화)
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      
      // Phase 2: 캘린더 캐시 무효화
      if (variables?.date || variables?.todo?.date || variables?.todo?.startDate) {
        const dateStr = variables.date || variables.todo?.date || variables.todo?.startDate;
        const [year, month] = dateStr.split('-').map(Number);
        invalidateAdjacentMonths(year, month);
        console.log(`📅 [useToggleCompletion] Calendar cache invalidated for ${year}-${month}`);
        invalidateDateSummary(dateStr);
      }

      const successEndTime = performance.now();
      console.log(`⚡ [useToggleCompletion] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error) => {
      console.error('❌ [useToggleCompletion] onError:', error);
    }
  });
};
