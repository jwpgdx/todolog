import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../../store/authStore';
import { invalidateAllScreenCaches } from '../query-aggregation/cache';
import { ensureDatabase, getMetadata, setMetadata } from '../db/database';
import { runPendingPush } from './pendingPush';
import { runDeltaPull } from './deltaPull';

const SYNC_CURSOR_KEY = 'sync.last_success_at';
const DEFAULT_SYNC_CURSOR = '1970-01-01T00:00:00.000Z';

function normalizeCursor(value) {
  if (!value) return DEFAULT_SYNC_CURSOR;
  const ts = Date.parse(value);
  if (Number.isNaN(ts)) return DEFAULT_SYNC_CURSOR;
  return new Date(ts).toISOString();
}

/**
 * 중앙 집중 동기화 서비스
 * - Category, Todo, Completion 모두 동기화
 * - 트리거 통합 및 디바운스
 * - 동기화 상태 관리
 */
export const useSyncService = () => {
  const queryClient = useQueryClient();
  const { isLoggedIn } = useAuthStore();
  
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState(null);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  
  const isSyncingRef = useRef(false);
  const debounceTimerRef = useRef(null);

  // 앱 시작 시 마지막 성공 커서 로드 (stale 메타 주입용)
  useEffect(() => {
    if (!isLoggedIn) {
      setLastSyncTime(null);
      return;
    }

    let cancelled = false;
    const loadLastSyncCursor = async () => {
      try {
        await ensureDatabase();
        const rawCursor = await getMetadata(SYNC_CURSOR_KEY);
        if (!rawCursor) {
          if (!cancelled) setLastSyncTime(null);
          return;
        }

        const normalized = normalizeCursor(rawCursor);
        if (!cancelled) {
          setLastSyncTime(rawCursor === normalized ? normalized : null);
        }
      } catch {
        if (!cancelled) setLastSyncTime(null);
      }
    };

    loadLastSyncCursor();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);
  
  /**
   * 전체 동기화 실행
   * 순서:
   * 1) ensureDatabase
   * 2) Pending Push
   * 3) Delta Pull
   * 4) Cursor Commit
   * 5) Cache Refresh
   */
  const syncAll = useCallback(async () => {
    // 로그인 안 됨 (게스트 포함)
    if (!isLoggedIn) {
      console.log('⏭️ [useSyncService] 로그인 안됨 - 스킵');
      return;
    }
    
    // 이미 동기화 중
    if (isSyncingRef.current) {
      console.log('⏭️ [useSyncService] 이미 동기화 중 - 스킵');
      return;
    }
    
    try {
      isSyncingRef.current = true;
      setIsSyncing(true);
      setError(null);
      
      console.log('🚀 [useSyncService] 전체 동기화 시작');

      // 0. DB 준비
      await ensureDatabase();
      const rawCursor = await getMetadata(SYNC_CURSOR_KEY);
      const cursor = normalizeCursor(rawCursor);
      if (!rawCursor) {
        console.log(`🧭 [useSyncService] 커서 없음 → 기본값 사용 (${DEFAULT_SYNC_CURSOR})`);
        setLastSyncTime(null);
      } else if (rawCursor !== cursor) {
        console.warn(`⚠️ [useSyncService] 커서 파싱 실패 → 기본값 사용 (${DEFAULT_SYNC_CURSOR})`);
        setLastSyncTime(null);
      } else {
        setLastSyncTime(cursor);
      }

      // 1. Pending Push (실패 시 Pull 중단)
      const pushResult = await runPendingPush({ maxItems: 200 });
      console.log('📤 [useSyncService] Pending Push 결과:', pushResult);

      if (!pushResult.ok) {
        const message = pushResult.lastError || 'Pending push failed';
        console.warn('⛔ [useSyncService] Pending Push 실패로 Pull 단계 중단:', message);
        setError(message);
        return;
      }

      // 2. Delta Pull
      const pullResult = await runDeltaPull({ cursor });
      console.log('📥 [useSyncService] Delta Pull 결과:', pullResult);

      if (!pullResult.ok) {
        const message = pullResult.lastError || 'Delta pull failed';
        console.warn('⛔ [useSyncService] Delta Pull 실패로 Cursor Commit/Cache Refresh 중단:', message);
        setError(message);
        return;
      }

      // 3. Cursor Commit (push + pull 성공 시에만)
      const nextCursor = pullResult.serverSyncTime;
      if (!nextCursor || Number.isNaN(Date.parse(nextCursor))) {
        const message = `Invalid serverSyncTime: ${nextCursor}`;
        console.warn('⛔ [useSyncService] Cursor Commit 중단:', message);
        setError(message);
        return;
      }
      await setMetadata(SYNC_CURSOR_KEY, nextCursor);
      setLastSyncTime(nextCursor);
      console.log('🧭 [useSyncService] Cursor commit 완료:', { from: cursor, to: nextCursor });

      const hasDataChange =
        pushResult.succeeded > 0 ||
        pullResult.todos.updated > 0 ||
        pullResult.todos.deleted > 0 ||
        pullResult.completions.updated > 0 ||
        pullResult.completions.deleted > 0;

      console.log('🔄 [useSyncService] 캐시 무효화 시작');
      if (hasDataChange) {
        invalidateAllScreenCaches({
          queryClient,
          reason: 'sync:data-changed',
        });
        console.log('🧹 [useSyncService] 공통 캐시/스토어 무효화 완료 (변경 있음)');
      } else {
        queryClient.invalidateQueries({ queryKey: ['todos'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
        console.log('🧹 [useSyncService] React Query만 무효화 (데이터 변경 없음)');
      }

      console.log('✅ [useSyncService] 캐시 무효화 완료');
      
      console.log('✅ [useSyncService] 전체 동기화 완료');
    } catch (err) {
      console.error('❌ [useSyncService] 동기화 실패:', err);
      setError(err.message);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, [isLoggedIn, queryClient]);
  
  /**
   * 디바운스된 동기화 트리거
   * 300ms 내 여러 트리거 → 하나로 병합
   */
  const triggerSync = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      console.log('⏱️ [useSyncService] 디바운스: 이전 타이머 취소');
    }
    
    console.log('⏱️ [useSyncService] 디바운스: 300ms 후 실행 예약');
    debounceTimerRef.current = setTimeout(() => {
      syncAll();
    }, 300);
  }, [syncAll]);
  
  /**
   * AppState 변경 감지 (백그라운드 → 포그라운드)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🌐 [useSyncService] 앱 활성화 → 동기화');
        triggerSync();
      }
    });
    
    return () => subscription.remove();
  }, [triggerSync]);
  
  /**
   * 네트워크 상태 변경 감지 (오프라인 → 온라인)
   */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      console.log(`🌐 [useSyncService] 네트워크 상태: ${state.isConnected ? '온라인' : '오프라인'} (type: ${state.type})`);
      
      if (state.isConnected) {
        console.log('🌐 [useSyncService] 온라인 복귀 → 동기화 트리거');
        triggerSync();
      }
    });
    
    return () => unsubscribe();
  }, [triggerSync]);
  
  /**
   * isLoggedIn 변경 감지 (로그인 시)
   */
  useEffect(() => {
    if (isLoggedIn) {
      console.log('🌐 [useSyncService] 로그인 감지 → 동기화');
      triggerSync();
    }
  }, [isLoggedIn, triggerSync]);
  
  return {
    syncAll,
    isSyncing,
    error,
    lastSyncTime,
  };
};
