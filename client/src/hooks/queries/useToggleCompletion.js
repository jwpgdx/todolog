import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import {
  toggleCompletion as sqliteToggleCompletion,
} from '../../services/db/completionService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';
import { invalidateCompletionDependentCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

/**
 * Completion 토글 훅 (SQLite 기반 + Pending Push)
 *
 * 흐름:
 * 1. SQLite 즉시 토글
 * 2. 항상 Pending Queue 추가
 * 3. 온라인이면 SyncService를 백그라운드 트리거 (await 하지 않음)
 */
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async ({ todoId, date, todo }) => {
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

      const pendingData = optimisticState
        ? { _id: completionId, todoId, date: completionDate, isRecurring }
        : { todoId, date: completionDate, isRecurring };

      await addPendingChange({
        type: optimisticState ? 'createCompletion' : 'deleteCompletion',
        entityId: completionKey,
        data: pendingData,
      });

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => { });
        }
      } catch { }

      const fnEndTime = performance.now();
      console.log(`⚡ [useToggleCompletion] mutationFn 완료 (local-first): ${(fnEndTime - fnStartTime).toFixed(2)}ms`);
      return {
        completed: optimisticState,
        isRecurring,
        completionKey,
        completionDate,
      };
    },
    onSuccess: (data, variables) => {
      const successStartTime = performance.now();

      const dateStr = variables?.date || variables?.todo?.date || variables?.todo?.startDate || null;
      invalidateCompletionDependentCaches({
        queryClient,
        reason: 'completion:toggle',
        date: dateStr,
      });

      const successEndTime = performance.now();
      console.log(`⚡ [useToggleCompletion] onSuccess 완료: ${(successEndTime - successStartTime).toFixed(2)}ms`);
    },
    onError: (error) => {
      console.error('❌ [useToggleCompletion] onError:', error);
    }
  });
};
