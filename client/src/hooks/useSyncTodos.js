import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { todoAPI } from '../api/todos';
import api from '../api/axios';
import { saveSettings } from '../storage/settingsStorage';
import {
    loadTodos,
    saveTodos,
    loadSyncMetadata,
    saveSyncMetadata,
    mergeDelta,
    upsertTodo,
    removeTodo,
} from '../storage/todoStorage';
import { loadCategories } from '../storage/categoryStorage';
import { occursOnDate } from '../utils/recurrenceUtils';
import {
    getPendingChanges,
    removePendingChange,
    clearPendingChanges,
    replaceTempIdInPending,
} from '../storage/pendingChangesStorage';

/**
 * 델타 동기화 핵심 훅
 * - 앱 시작 시 로컬 데이터 로드 후 서버와 동기화
 * - 오프라인 → 온라인 전환 시 pending changes 처리
 * - TanStack Query 캐시에 자동 반영
 */
export const useSyncTodos = () => {
    const queryClient = useQueryClient();
    const { isLoggedIn } = useAuthStore();

    const [isSyncing, setIsSyncing] = useState(false);
    const [lastSyncTime, setLastSyncTime] = useState(null);
    const [error, setError] = useState(null);
    const [pendingCount, setPendingCount] = useState(0);

    const isSyncingRef = useRef(false);

    /**
     * 로컬 데이터를 TanStack Query 캐시에 주입
     * [최적화] 전체 캐시만 주입, 일별/월별은 필요할 때 필터링
     */
    const populateCache = useCallback((todos) => {
        const startTime = performance.now();
        
        if (!todos || todos.length === 0) {
            console.log('⚠️ [useSyncTodos.populateCache] 데이터 없음');
            return;
        }

        console.log('📦 [useSyncTodos.populateCache] 캐시 주입:', todos.length, '개');
        
        // 전체 캐시만 주입 (빠름!)
        queryClient.setQueryData(['todos', 'all'], todos);
        
        const endTime = performance.now();
        console.log(`✅ [useSyncTodos.populateCache] 완료 (${(endTime - startTime).toFixed(2)}ms)`);
    }, [queryClient]);

    /**
     * Pending Changes 처리 (오프라인 수정 → 서버 반영)
     */
    const processPendingChanges = useCallback(async () => {
        const pending = await getPendingChanges();
        if (pending.length === 0) return { success: 0, failed: 0 };

        console.log('🔄 [useSyncTodos] Pending changes 처리 시작:', pending.length);

        let success = 0;
        let failed = 0;

        for (const change of pending) {
            try {
                switch (change.type) {
                    case 'create':
                        const createRes = await todoAPI.createTodo(change.data);
                        // tempId 제거하고 서버 데이터 저장
                        await removeTodo(change.tempId);
                        await upsertTodo(createRes.data);
                        
                        // 다른 pending changes에서 이 tempId를 참조하는 경우 실제 ID로 교체
                        await replaceTempIdInPending(change.tempId, createRes.data._id);
                        
                        console.log('✅ [useSyncTodos] 서버 생성 완료, 로컬 저장:', createRes.data._id);
                        break;

                    case 'update':
                        // tempId인 경우 스킵 (이미 create에서 처리됨)
                        if (change.todoId && change.todoId.startsWith('temp_')) {
                            console.log('⏭️ [useSyncTodos] tempId 수정 스킵 (create에서 처리됨):', change.todoId);
                            await removePendingChange(change.id);
                            success++;
                            break;
                        }
                        
                        await todoAPI.updateTodo(change.todoId, change.data);
                        console.log('✅ [useSyncTodos] 서버 수정 완료:', change.todoId);
                        break;

                    case 'delete':
                        // tempId인 경우 스킵 (로컬에서만 삭제)
                        if (change.todoId && change.todoId.startsWith('temp_')) {
                            console.log('⏭️ [useSyncTodos] tempId 삭제 스킵 (로컬에서만 삭제):', change.todoId);
                            await removePendingChange(change.id);
                            success++;
                            break;
                        }
                        
                        await todoAPI.deleteTodo(change.todoId);
                        console.log('✅ [useSyncTodos] 서버 삭제 완료:', change.todoId);
                        break;
                }

                await removePendingChange(change.id);
                success++;
            } catch (err) {
                console.error('❌ [useSyncTodos] Pending change 처리 실패:', change, err);
                failed++;
            }
        }

        console.log('✅ [useSyncTodos] Pending changes 처리 완료:', { success, failed });
        return { success, failed };
    }, []);

    /**
     * 메인 동기화 함수
     */
    const syncTodos = useCallback(async (options = {}) => {
        const { forceFullSync = false } = options;

        // 중복 실행 방지 (동기적으로 먼저 설정)
        if (isSyncingRef.current) {
            console.log('⏭️ [useSyncTodos] 이미 동기화 중 - 스킵');
            return;
        }
        
        // 즉시 플래그 설정 (race condition 방지)
        isSyncingRef.current = true;
        setIsSyncing(true);
        setError(null);

        // 로그인 상태 확인 (Store 상태가 아직 업데이트되지 않았을 수 있으므로 토큰도 확인)
        const token = await AsyncStorage.getItem('token');
        if (!isLoggedIn && !token) {
            console.log('⏭️ [useSyncTodos] 로그인 안됨 (토큰 없음) - 스킵');
            isSyncingRef.current = false;
            setIsSyncing(false);
            return;
        }

        try {
            // 1. 로컬 데이터 먼저 로드 (즉시 화면 표시)
            const localTodos = await loadTodos();
            const metadata = await loadSyncMetadata();

            // 1-1. 설정도 서버에서 가져오기 (백그라운드)
            try {
                const settingsResponse = await api.get('/auth/settings');
                const serverSettings = settingsResponse.data.settings || settingsResponse.data;
                await saveSettings(serverSettings);
                queryClient.setQueryData(['settings'], serverSettings);
                console.log('✅ [useSyncTodos] 설정 동기화 완료');
            } catch (settingsError) {
                console.log('⚠️ [useSyncTodos] 설정 동기화 실패 (로컬 설정 사용):', settingsError.message);
            }

            if (localTodos.length > 0) {
                console.log('📱 [useSyncTodos] 로컬 데이터 로드:', localTodos.length, '개');
                console.log('📱 [useSyncTodos] 로컬 데이터 샘플:', localTodos.slice(0, 2).map(t => t.title));
                populateCache(localTodos);
            } else {
                console.log('⚠️ [useSyncTodos] 로컬 데이터 없음!');
            }

            // 2. 네트워크 확인
            const netInfo = await NetInfo.fetch();
            console.log('🌐 [useSyncTodos] 네트워크 상태:', netInfo.isConnected, netInfo.type);
            if (!netInfo.isConnected) {
                console.log('📵 [useSyncTodos] 오프라인 - 로컬 데이터만 사용');
                setIsSyncing(false);
                isSyncingRef.current = false;
                return;
            }

            // 3. Pending changes 먼저 처리
            const pendingResult = await processPendingChanges();
            setPendingCount(0);

            // Pending Changes 처리 후 로컬 데이터 다시 로드 (중복 방지)
            if (pendingResult.success > 0) {
                console.log('🔄 [useSyncTodos] Pending changes 처리 완료 - 로컬 데이터 재로드');
                const updatedLocalTodos = await loadTodos();
                populateCache(updatedLocalTodos);
                
                // lastSyncTime을 현재 시간으로 업데이트 (방금 생성한 항목이 델타에서 중복으로 안 들어오도록)
                const now = new Date().toISOString();
                await saveSyncMetadata({ lastSyncTime: now });
                metadata.lastSyncTime = now;
                console.log('✅ [useSyncTodos] lastSyncTime 업데이트:', now);
            }

            // 4. 서버와 동기화
            if (!metadata.lastSyncTime || forceFullSync) {
                // 최초 동기화: 전체 데이터 받기
                console.log('🌐 [useSyncTodos] 최초 동기화 - 전체 데이터 로드');
                const response = await todoAPI.getAllTodos();
                const allTodos = response.data;

                await saveTodos(allTodos);
                await saveSyncMetadata({ lastSyncTime: new Date().toISOString() });
                populateCache(allTodos);

                setLastSyncTime(new Date());
                console.log('✅ [useSyncTodos] 최초 동기화 완료:', allTodos.length, '개');
            } else {
                // 델타 동기화: 변경사항만
                console.log('🔄 [useSyncTodos] 델타 동기화 시작:', metadata.lastSyncTime);
                const response = await todoAPI.getDeltaSync(metadata.lastSyncTime);
                const delta = response.data;

                if (delta.updated.length > 0 || delta.deleted.length > 0) {
                    console.log('📥 [useSyncTodos] 델타 수신:', {
                        updated: delta.updated.length,
                        deleted: delta.deleted.length
                    });

                    const merged = mergeDelta(localTodos, delta);
                    await saveTodos(merged);
                    await saveSyncMetadata({ lastSyncTime: delta.syncTime });
                    populateCache(merged);
                } else {
                    console.log('✨ [useSyncTodos] 변경사항 없음');
                    await saveSyncMetadata({ lastSyncTime: delta.syncTime });
                }

                setLastSyncTime(new Date());
            }
        } catch (err) {
            console.error('❌ [useSyncTodos] 동기화 실패:', err);
            setError(err.message || '동기화 실패');
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    }, [isLoggedIn, populateCache, processPendingChanges]);

    /**
     * 강제 전체 동기화
     */
    const forceFullSync = useCallback(() => {
        return syncTodos({ forceFullSync: true });
    }, [syncTodos]);

    /**
     * Pending count 업데이트
     */
    const updatePendingCount = useCallback(async () => {
        const pending = await getPendingChanges();
        setPendingCount(pending.length);
    }, []);

    /**
     * 앱 상태 변경 감지 (포그라운드 복귀 시 동기화)
     */
    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                console.log('📱 [useSyncTodos] 앱 포그라운드 복귀 → 동기화');
                syncTodos();
            }
        });

        return () => subscription.remove();
    }, [syncTodos]);

    /**
     * 네트워크 상태 변경 감지 (온라인 복귀 시 동기화)
     */
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected) {
                console.log('🌐 [useSyncTodos] 온라인 복귀 → 동기화');
                syncTodos();
            }
        });

        return () => unsubscribe();
    }, [syncTodos]);

    /**
     * 초기 캐시 준비 - 로그인 여부와 관계없이 즉시 실행
     */
    useEffect(() => {
        const prepareCache = async () => {
            try {
                // Todos
                const localTodos = await loadTodos();
                if (localTodos.length > 0) {
                    console.log('⚡ [useSyncTodos] 초기 Todos 캐시 준비:', localTodos.length, '개');
                    populateCache(localTodos);
                } else {
                    console.log('⚠️ [useSyncTodos] 로컬 Todos 없음');
                }
                
                // Categories
                const localCategories = await loadCategories();
                if (localCategories.length > 0) {
                    console.log('⚡ [useSyncTodos] 초기 Categories 캐시 준비:', localCategories.length, '개');
                    queryClient.setQueryData(['categories'], localCategories);
                } else {
                    console.log('⚠️ [useSyncTodos] 로컬 Categories 없음');
                }
            } catch (error) {
                console.error('❌ [useSyncTodos] 초기 캐시 준비 실패:', error);
            }
        };
        
        // 즉시 캐시 준비 (로그인 여부 무관)
        prepareCache();
    }, []);

    /**
     * 로그인 후 동기화
     */
    useEffect(() => {
        if (isLoggedIn) {
            syncTodos();
            updatePendingCount();
        }
    }, [isLoggedIn]);

    return {
        syncTodos,
        forceFullSync,
        isSyncing,
        lastSyncTime,
        error,
        pendingCount,
        updatePendingCount,
    };
};
