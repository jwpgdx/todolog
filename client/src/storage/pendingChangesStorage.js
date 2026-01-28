import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@pending_changes';

/**
 * Pending Change 객체 형태
 * {
 *   id: string (nanoid),
 *   type: 'create' | 'update' | 'delete',
 *   todoId: string (기존 Todo의 경우),
 *   data: object (create/update의 경우),
 *   timestamp: string (ISO timestamp)
 * }
 */

/**
 * 대기 중인 변경사항 추가
 * @param {Object} change - { type, todoId?, data?, tempId? }
 */
export const addPendingChange = async (change) => {
    try {
        const pending = await getPendingChanges();

        const newChange = {
            id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            ...change,
        };

        pending.push(newChange);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

        console.log('📝 [pendingChanges] 변경사항 추가:', newChange.type, newChange.todoId || newChange.tempId);
        return newChange;
    } catch (error) {
        console.error('❌ [pendingChanges] 추가 실패:', error);
        throw error;
    }
};

/**
 * 대기 중인 변경사항 조회
 * @returns {Array} 대기 중인 변경사항 배열
 */
export const getPendingChanges = async () => {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('❌ [pendingChanges] 조회 실패:', error);
        return [];
    }
};

/**
 * 특정 변경사항 제거 (처리 완료 후)
 * @param {string} changeId - 변경사항 ID
 */
export const removePendingChange = async (changeId) => {
    try {
        const pending = await getPendingChanges();
        const filtered = pending.filter(p => p.id !== changeId);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

        console.log('✅ [pendingChanges] 변경사항 제거:', changeId);
    } catch (error) {
        console.error('❌ [pendingChanges] 제거 실패:', error);
        throw error;
    }
};

/**
 * 특정 Todo에 대한 대기 중인 변경사항 조회
 * @param {string} todoId - Todo ID
 * @returns {Array} 해당 Todo의 대기 중인 변경사항들
 */
export const getPendingChangesForTodo = async (todoId) => {
    try {
        const pending = await getPendingChanges();
        return pending.filter(p => p.todoId === todoId || p.tempId === todoId);
    } catch (error) {
        console.error('❌ [pendingChanges] Todo별 조회 실패:', error);
        return [];
    }
};

/**
 * 대기 중인 변경사항 개수 확인
 * @returns {number}
 */
export const getPendingCount = async () => {
    const pending = await getPendingChanges();
    return pending.length;
};

/**
 * 모든 대기 중인 변경사항 초기화
 */
export const clearPendingChanges = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
        console.log('✅ [pendingChanges] 전체 초기화 완료');
    } catch (error) {
        console.error('❌ [pendingChanges] 초기화 실패:', error);
        throw error;
    }
};

/**
 * tempId를 실제 ID로 업데이트 (create 성공 후)
 * @param {string} tempId - 임시 ID
 * @param {string} realId - 서버에서 받은 실제 ID
 */
export const updateTempIdToRealId = async (tempId, realId) => {
    try {
        const pending = await getPendingChanges();
        const updated = pending.map(p => {
            if (p.tempId === tempId) {
                return { ...p, todoId: realId, tempId: undefined };
            }
            return p;
        });
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (error) {
        console.error('❌ [pendingChanges] ID 업데이트 실패:', error);
        throw error;
    }
};

/**
 * Pending Changes에서 특정 tempId를 실제 ID로 일괄 업데이트
 * CREATE 성공 후 해당 tempId를 참조하는 모든 pending changes 업데이트
 * @param {string} tempId - 임시 ID
 * @param {string} realId - 서버에서 받은 실제 ID
 */
export const replaceTempIdInPending = async (tempId, realId) => {
    try {
        const pending = await getPendingChanges();
        let updateCount = 0;
        
        const updated = pending.map(p => {
            // todoId가 tempId인 경우 (update/delete)
            if (p.todoId === tempId) {
                updateCount++;
                return { ...p, todoId: realId };
            }
            // tempId 필드가 있는 경우 (create)
            if (p.tempId === tempId) {
                updateCount++;
                return { ...p, tempId: undefined, todoId: realId };
            }
            return p;
        });
        
        if (updateCount > 0) {
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
            console.log(`✅ [pendingChanges] tempId 교체 완료: ${tempId} → ${realId} (${updateCount}개)`);
        }
        
        return updateCount;
    } catch (error) {
        console.error('❌ [pendingChanges] tempId 교체 실패:', error);
        throw error;
    }
};
