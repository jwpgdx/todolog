import { useQuery } from '@tanstack/react-query';
import { ensureDatabase } from '../../services/db/database';
import { todoAPI } from '../../api/todos';
import { runCommonQueryForDate } from '../../services/query-aggregation';
import { adaptTodoScreenFromDateHandoff } from '../../services/query-aggregation/adapters';
import { useSyncContext } from '../../providers/SyncProvider';

/**
 * 날짜별 Todo 조회 Hook (SQLite 기반)
 * 
 * SQLite만 조회 (Read Only):
 * 1. SQLite에서 직접 조회 (Source of Truth)
 * 2. 완료 상태도 SQLite에서 조회
 * 3. 서버 동기화는 useSyncService가 담당
 */
export const useTodos = (date) => {
  const { isSyncing, error, lastSyncTime } = useSyncContext();

  return useQuery({
    queryKey: ['todos', date],
    queryFn: async () => {
      // 1. SQLite 초기화 보장 (자동 대기)
      try {
        await ensureDatabase();
      } catch (error) {
        console.log('⚠️ [useTodos] SQLite 초기화 실패 - 서버로 폴백');
        try {
          const res = await todoAPI.getTodos(date);
          return res.data || [];
        } catch (apiError) {
          console.error('❌ [useTodos] 서버 요청도 실패:', apiError.message);
          return [];
        }
      }

      // 2. 공통 조회/집계 레이어 실행 (SQLite-only)
      const startTime = performance.now();
      const result = await runCommonQueryForDate({
        targetDate: date,
        syncStatus: { isSyncing, error, lastSyncTime },
      });

      if (!result.ok) {
        console.warn(`⚠️ [useTodos] 공통 레이어 실패: ${result.error}`);
        return [];
      }

      const adapted = adaptTodoScreenFromDateHandoff(result);
      if (!adapted.ok) {
        console.warn(`⚠️ [useTodos] TodoScreen adapter 실패: ${adapted.error}`);
        return [];
      }

      const todosWithCompletion = adapted.items;

      const endTime = performance.now();
      console.log(`⚡ [useTodos] 전체: ${todosWithCompletion.length}개 (${(endTime - startTime).toFixed(2)}ms)`);
      console.log(`  📊 [useTodos] stage: candidate=${result.stage.candidate}, decided=${result.stage.decided}, aggregated=${result.stage.aggregated}`);
      console.log(`  ⏱️ [useTodos] elapsed(ms): total=${result.elapsed.totalMs}, candidate=${result.elapsed.candidateMs}, decision=${result.elapsed.decisionMs}, aggregation=${result.elapsed.aggregationMs}`);
      console.log(`  🧭 [useTodos] stale: isStale=${result.meta.isStale}, reason=${result.meta.staleReason || 'none'}, lastSync=${result.meta.lastSyncTime || 'null'}`);

      return todosWithCompletion;
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5,
  });
};
