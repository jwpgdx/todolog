import { useState, useCallback, useRef, useEffect } from 'react';
import { AppState } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { todoAPI } from '../api/todos';
import api from '../api/axios';
import { saveSettings } from '../storage/settingsStorage';
// SQLite Services
import { ensureDatabase, getMetadata, setMetadata } from '../db/database';
import {
    getAllTodos as sqliteGetAllTodos,
    upsertTodo as sqliteUpsertTodo,
    deleteTodo as sqliteDeleteTodo,
    upsertTodos as bulkUpsertTodos,
} from '../db/todoService';
import {
    getAllCompletions as sqliteGetAllCompletions,
    createCompletion,
    deleteCompletion,
} from '../db/completionService';
import {
    getPendingChanges as sqliteGetPendingChanges,
    removePendingChange as sqliteRemovePendingChange,
    clearPendingChanges as sqliteClearPendingChanges,
} from '../db/pendingService';
import { getAllCategories as sqliteGetAllCategories } from '../db/categoryService';

/**
 * 델타 동기화 핵심 훅 (SQLite 기반)
 * - 앱 시작 시 SQLite 데이터 → React Query 캐시
 * - 오프라인 → 온라인 전환 시 pending changes 처리
 * - 서버 델타 동기화 → SQLite 업데이트
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
     * SQLite 데이터를 React Query 캐시에 주입
     */
    const populateCache = useCallback(async () => {
        const startTime = performance.now();

        try {
            await ensureDatabase();

            const todos = await sqliteGetAllTodos();
            if (todos.length > 0) {
                queryClient.setQueryData(['todos', 'all'], todos);
                console.log('📦 [useSyncTodos] 캐시 주입:', todos.length, '개');
            }

            const endTime = performance.now();
            console.log(`✅ [useSyncTodos.populateCache] 완료 (${(endTime - startTime).toFixed(2)}ms)`);
        } catch (error) {
            console.error('❌ [useSyncTodos.populateCache] 실패:', error.message);
        }
    }, [queryClient]);

    /**
     * SQLite에 델타 병합
     */
    const mergeDeltaToSQLite = useCallback(async (delta) => {
        // Updated todos
        if (delta.updated && delta.updated.length > 0) {
            await bulkUpsertTodos(delta.updated);
            console.log(`📥 [useSyncTodos] ${delta.updated.length}개 Todo 업데이트`);
        }

        // Deleted todos
        if (delta.deleted && delta.deleted.length > 0) {
            for (const id of delta.deleted) {
                await sqliteDeleteTodo(id);
            }
            console.log(`🗑️ [useSyncTodos] ${delta.deleted.length}개 Todo 삭제`);
        }
    }, []);

    /**
     * Pending Changes 처리 (SQLite 기반)
     * 
     * UUID Migration:
     * - tempId 스킵 로직 제거 (더 이상 tempId 없음)
     * - 타입별 정렬: Category → Todo → Completion
     * - 새 타입: createCategory, updateCategory, deleteCategory, createTodo, updateTodo, deleteTodo
     */
    const processPendingChanges = useCallback(async () => {
        await ensureDatabase();
        const pending = await sqliteGetPendingChanges();
        if (pending.length === 0) return { success: 0, failed: 0 };

        // 🔧 타입별 정렬 (Category 먼저, Completion 마지막)
        const typeOrder = {
            createCategory: 1, updateCategory: 2, deleteCategory: 3,
            create: 4, createTodo: 4, update: 5, updateTodo: 5, delete: 6, deleteTodo: 6,
            createCompletion: 7, deleteCompletion: 8,
        };

        const sorted = [...pending].sort((a, b) => {
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });

        console.log('🔄 [useSyncTodos] Pending changes 처리 시작 (정렬됨):', sorted.length);

        let success = 0;
        let failed = 0;

        for (const change of sorted) {
            try {
                const data = change.data;

                switch (change.type) {
                    // === Category ===
                    case 'createCategory':
                        await api.post('/categories', data);
                        console.log('✅ [useSyncTodos] Category 생성 완료:', change.entityId);
                        break;
                    case 'updateCategory':
                        await api.put(`/categories/${change.entityId}`, data);
                        console.log('✅ [useSyncTodos] Category 수정 완료:', change.entityId);
                        break;
                    case 'deleteCategory':
                        await api.delete(`/categories/${change.entityId}`);
                        console.log('✅ [useSyncTodos] Category 삭제 완료:', change.entityId);
                        break;

                    // === Todo (신규 타입) ===
                    case 'createTodo':
                        const createRes = await todoAPI.createTodo(data);
                        await sqliteUpsertTodo(createRes.data);
                        console.log('✅ [useSyncTodos] Todo 생성 완료:', createRes.data._id);
                        break;
                    case 'updateTodo':
                        await todoAPI.updateTodo(change.entityId, data);
                        console.log('✅ [useSyncTodos] Todo 수정 완료:', change.entityId);
                        break;
                    case 'deleteTodo':
                        try {
                            await todoAPI.deleteTodo(change.entityId);
                            console.log('✅ [useSyncTodos] Todo 삭제 완료:', change.entityId);
                        } catch (err) {
                            // 404는 이미 삭제된 것으로 간주 (성공 처리)
                            if (err.response?.status === 404) {
                                console.log('✅ [useSyncTodos] Todo 이미 삭제됨 (404):', change.entityId);
                            } else {
                                throw err; // 다른 에러는 재발생
                            }
                        }
                        break;

                    // === Todo (레거시 타입 호환) ===
                    case 'create':
                        const legacyCreateRes = await todoAPI.createTodo(data);
                        await sqliteUpsertTodo(legacyCreateRes.data);
                        console.log('✅ [useSyncTodos] 레거시 Todo 생성 완료:', legacyCreateRes.data._id);
                        break;
                    case 'update':
                        await todoAPI.updateTodo(change.entityId || change.todoId, data);
                        console.log('✅ [useSyncTodos] 레거시 Todo 수정 완료:', change.entityId || change.todoId);
                        break;
                    case 'delete':
                        try {
                            await todoAPI.deleteTodo(change.entityId || change.todoId);
                            console.log('✅ [useSyncTodos] 레거시 Todo 삭제 완료:', change.entityId || change.todoId);
                        } catch (err) {
                            // 404는 이미 삭제된 것으로 간주 (성공 처리)
                            if (err.response?.status === 404) {
                                console.log('✅ [useSyncTodos] 레거시 Todo 이미 삭제됨 (404):', change.entityId || change.todoId);
                            } else {
                                throw err; // 다른 에러는 재발생
                            }
                        }
                        break;

                    // === Completion ===
                    case 'createCompletion':
                    case 'deleteCompletion':
                        await api.post('/completions/toggle', {
                            todoId: change.entityId || change.todoId,
                            date: change.date,
                        });
                        console.log('✅ [useSyncTodos] Completion 토글 완료:', change.entityId || change.todoId);
                        break;
                }

                await sqliteRemovePendingChange(change.id);
                success++;
            } catch (err) {
                console.error('❌ [useSyncTodos] Pending change 처리 실패:', change.type, err.message);
                failed++;
            }
        }

        console.log('✅ [useSyncTodos] Pending changes 처리 완료:', { success, failed });
        return { success, failed };
    }, []);

    /**
     * 메인 동기화 함수 (SQLite 기반)
     */
    const syncTodos = useCallback(async (options = {}) => {
        const { forceFullSync = false } = options;

        if (isSyncingRef.current) {
            console.log('⏭️ [useSyncTodos] 이미 동기화 중 - 스킵');
            return;
        }

        isSyncingRef.current = true;
        setIsSyncing(true);
        setError(null);

        const token = await AsyncStorage.getItem('token');
        if (!isLoggedIn && !token) {
            console.log('⏭️ [useSyncTodos] 로그인 안됨 - 스킵');
            isSyncingRef.current = false;
            setIsSyncing(false);
            return;
        }

        try {
            await ensureDatabase();

            // 1. SQLite에서 로컬 데이터 로드
            const localTodos = await sqliteGetAllTodos();
            const lastSyncTimeValue = await getMetadata('lastSyncTime');

            // 1-1. 설정 동기화 (백그라운드)
            try {
                const settingsResponse = await api.get('/auth/settings');
                const serverSettings = settingsResponse.data.settings || settingsResponse.data;
                await saveSettings(serverSettings);
                queryClient.setQueryData(['settings'], serverSettings);
                console.log('✅ [useSyncTodos] 설정 동기화 완료');
            } catch (settingsError) {
                console.log('⚠️ [useSyncTodos] 설정 동기화 실패:', settingsError.message);
            }

            if (localTodos.length > 0) {
                console.log('📱 [useSyncTodos] 로컬 Todos 로드:', localTodos.length, '개');
                queryClient.setQueryData(['todos', 'all'], localTodos);
            } else {
                console.log('⚠️ [useSyncTodos] 로컬 Todos 없음!');
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

            // 3. Pending changes 처리
            const pendingResult = await processPendingChanges();
            setPendingCount(0);

            if (pendingResult.success > 0) {
                const now = new Date().toISOString();
                await setMetadata('lastSyncTime', now);
            }

            // 4. Todo 델타 동기화
            if (!lastSyncTimeValue || forceFullSync) {
                console.log('🌐 [useSyncTodos] 최초 Todo 동기화');
                const response = await todoAPI.getAllTodos();
                const allTodos = response.data;

                await bulkUpsertTodos(allTodos);
                const now = new Date().toISOString();
                await setMetadata('lastSyncTime', now);

                queryClient.setQueryData(['todos', 'all'], allTodos);
                setLastSyncTime(new Date());
                console.log('✅ [useSyncTodos] 최초 동기화 완료:', allTodos.length, '개');
            } else {
                console.log('🔄 [useSyncTodos] Todo 델타 동기화 시작:', lastSyncTimeValue);
                const response = await todoAPI.getDeltaSync(lastSyncTimeValue);
                const delta = response.data;

                if (delta.updated.length > 0 || delta.deleted.length > 0) {
                    console.log('📥 [useSyncTodos] Todo 델타:', {
                        updated: delta.updated.length,
                        deleted: delta.deleted.length
                    });

                    await mergeDeltaToSQLite(delta);
                    await setMetadata('lastSyncTime', delta.syncTime);

                    // 캐시 갱신
                    const updatedTodos = await sqliteGetAllTodos();
                    queryClient.setQueryData(['todos', 'all'], updatedTodos);
                } else {
                    console.log('✨ [useSyncTodos] Todo 변경사항 없음');
                    await setMetadata('lastSyncTime', delta.syncTime);
                }

                setLastSyncTime(new Date());
            }

            // 5. Completion 델타 동기화
            const lastCompletionSyncTime = await getMetadata('lastCompletionSyncTime');
            if (lastCompletionSyncTime) {
                console.log('🔄 [useSyncTodos] Completion 델타 동기화 시작:', lastCompletionSyncTime);

                try {
                    const completionResponse = await api.get(
                        `/completions/delta-sync?lastSyncTime=${lastCompletionSyncTime}`
                    );
                    const completionDelta = completionResponse.data;

                    if (completionDelta.updated.length > 0 || completionDelta.deleted.length > 0) {
                        console.log('📥 [useSyncTodos] Completion 델타:', {
                            updated: completionDelta.updated.length,
                            deleted: completionDelta.deleted.length
                        });

                        // SQLite에 Completion 업데이트
                        for (const completion of completionDelta.updated) {
                            await createCompletion(completion.todoId, completion.date);
                        }
                        for (const deletedItem of completionDelta.deleted) {
                            // deleted는 {_id, todoId, date} 객체 배열
                            await deleteCompletion(deletedItem.todoId, deletedItem.date);
                        }

                        await setMetadata('lastCompletionSyncTime', completionDelta.syncTime);
                        console.log('✅ [useSyncTodos] Completion 델타 동기화 완료');

                        // 캐시 무효화
                        queryClient.invalidateQueries({
                            predicate: (query) => query.queryKey[0] === 'todos'
                        });
                    } else {
                        console.log('✨ [useSyncTodos] Completion 변경사항 없음');
                        await setMetadata('lastCompletionSyncTime', completionDelta.syncTime);
                    }
                } catch (completionError) {
                    console.error('❌ [useSyncTodos] Completion 델타 동기화 실패:', completionError.message);
                }
            } else {
                console.log('🌐 [useSyncTodos] 최초 Completion 동기화');
                const now = new Date().toISOString();
                await setMetadata('lastCompletionSyncTime', now);
            }
        } catch (err) {
            console.error('❌ [useSyncTodos] 동기화 실패:', err);
            setError(err.message || '동기화 실패');
        } finally {
            setIsSyncing(false);
            isSyncingRef.current = false;
        }
    }, [isLoggedIn, processPendingChanges, queryClient, mergeDeltaToSQLite]);

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
        try {
            await ensureDatabase();
            const pending = await sqliteGetPendingChanges();
            setPendingCount(pending.length);
        } catch (error) {
            console.error('❌ [useSyncTodos] Pending count 업데이트 실패:', error.message);
        }
    }, []);

    /**
     * 앱 포그라운드 복귀 시 동기화
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
     * 네트워크 온라인 복귀 시 동기화
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
     * 초기 캐시 준비 (SQLite 기반)
     * 
     * ⚠️ DISABLED: React Query already caches from UI queries (useTodos, useCategories)
     * This was causing lock contention with UI queries.
     * 
     * If needed in the future, uncomment and ensure proper delay/sequencing.
     */
    /*
    useEffect(() => {
        const prepareCache = async () => {
            try {
                // 500ms 지연: UI 쿼리(useTodos, useCategories)가 먼저 실행되도록
                await new Promise(resolve => setTimeout(resolve, 500));
                
                await ensureDatabase();

                const startTime = performance.now();

                // Todos
                const localTodos = await sqliteGetAllTodos();
                if (localTodos.length > 0) {
                    console.log('⚡ [useSyncTodos] 초기 Todos 캐시 준비:', localTodos.length, '개');
                    queryClient.setQueryData(['todos', 'all'], localTodos);
                }

                // Categories
                const localCategories = await sqliteGetAllCategories();
                if (localCategories.length > 0) {
                    console.log('⚡ [useSyncTodos] 초기 Categories 캐시 준비:', localCategories.length, '개');
                    queryClient.setQueryData(['categories'], localCategories);
                }

                // Completions
                const localCompletions = await sqliteGetAllCompletions();
                if (Object.keys(localCompletions).length > 0) {
                    console.log('⚡ [useSyncTodos] 초기 Completions 캐시 준비:', Object.keys(localCompletions).length, '개');
                    queryClient.setQueryData(['completions'], localCompletions);
                }

                const endTime = performance.now();
                console.log(`✅ [useSyncTodos] 초기 캐시 준비 완료 (${(endTime - startTime).toFixed(2)}ms)`);
            } catch (error) {
                console.error('❌ [useSyncTodos] 초기 캐시 준비 실패:', error);
            }
        };

        prepareCache();
    }, [queryClient]);
    */

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
