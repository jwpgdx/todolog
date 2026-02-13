import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { useAuthStore } from '../../store/authStore';
import { syncCategories } from './categorySync';
import { syncTodos } from './todoSync';
import { syncCompletions } from './completionSync';
import { useTodoCalendarStore } from '../../features/todo-calendar/store/todoCalendarStore';

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
  
  const isSyncingRef = useRef(false);
  const debounceTimerRef = useRef(null);
  
  /**
   * 전체 동기화 실행
   * 순서: Category → Todo → Completion → 캐시 무효화
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
      
      // 1. Category 동기화
      await syncCategories();
      
      // 2. Todo 동기화
      await syncTodos();
      
      // 3. Completion 동기화
      await syncCompletions();
      
      // 4. React Query 캐시 무효화
      console.log('🔄 [useSyncService] 캐시 무효화 시작');
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      
      // Phase 2: 캘린더 캐시 클리어
      useTodoCalendarStore.getState().clearAll();
      console.log('📅 [useSyncService] 캘린더 캐시 클리어 완료');
      
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
  };
};
