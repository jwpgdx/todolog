import React, { createContext, useContext } from 'react';
import { useSyncService } from '../services/sync';

/**
 * 동기화 컨텍스트
 * 앱 전역에서 동기화 상태 및 함수에 접근 가능
 */
const SyncContext = createContext(null);

export const useSyncContext = () => {
    const context = useContext(SyncContext);
    if (!context) {
        console.warn('[SyncContext] Provider 내부에서 사용해야 합니다');
        return {
            syncAll: () => { },
            isSyncing: false,
            error: null,
            lastSyncTime: null,
        };
    }
    return context;
};

/**
 * SyncProvider - 중앙 집중 동기화를 관리하는 Provider
 * 자식 컴포넌트에서 동기화 상태 및 함수에 접근 가능
 */
export const SyncProvider = ({ children }) => {
    const syncState = useSyncService();

    return (
        <SyncContext.Provider value={syncState}>
            {children}
        </SyncContext.Provider>
    );
};

export default SyncProvider;
