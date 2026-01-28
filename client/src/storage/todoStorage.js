import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    TODOS: '@todos',
    SYNC_METADATA: '@sync_metadata',
};

/**
 * 전체 Todo 저장
 * @param {Array} todos - Todo 배열
 */
export const saveTodos = async (todos) => {
    try {
        console.log('💾 [todoStorage] Saving todos to storage:', todos.length);
        await AsyncStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
        console.log('✅ [todoStorage] Saved successfully');
    } catch (error) {
        console.error('❌ [todoStorage] Todo 저장 실패:', error);
        throw error;
    }
};

/**
 * 전체 Todo 로드
 * @returns {Array} Todo 배열
 */
export const loadTodos = async () => {
    try {
        console.log('📂 [todoStorage] Loading todos from storage...');
        const data = await AsyncStorage.getItem(STORAGE_KEYS.TODOS);
        console.log('✅ [todoStorage] Loaded data:', data ? `${data.length} chars` : 'null');
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('❌ [todoStorage] Todo 로드 실패:', error);
        return [];
    }
};

/**
 * 동기화 메타데이터 저장
 * @param {Object} metadata - { lastSyncTime: string }
 */
export const saveSyncMetadata = async (metadata) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEYS.SYNC_METADATA, JSON.stringify(metadata));
    } catch (error) {
        console.error('❌ [todoStorage] 메타데이터 저장 실패:', error);
        throw error;
    }
};

/**
 * 동기화 메타데이터 로드
 * @returns {Object} { lastSyncTime: string | null }
 */
export const loadSyncMetadata = async () => {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEYS.SYNC_METADATA);
        return data ? JSON.parse(data) : { lastSyncTime: null };
    } catch (error) {
        console.error('❌ [todoStorage] 메타데이터 로드 실패:', error);
        return { lastSyncTime: null };
    }
};

/**
 * 델타 병합 - 로컬 데이터에 서버 변경사항 반영
 * @param {Array} localTodos - 로컬 Todo 배열
 * @param {Object} delta - { updated: Array, deleted: Array<string> }
 * @returns {Array} 병합된 Todo 배열
 */
export const mergeDelta = (localTodos, delta) => {
    const { updated = [], deleted = [] } = delta;

    // ID로 맵핑
    const todoMap = new Map(localTodos.map(t => [t._id, t]));

    // 업데이트된 것들 반영
    updated.forEach(todo => {
        todoMap.set(todo._id, todo);
    });

    // 삭제된 것들 제거
    deleted.forEach(id => {
        todoMap.delete(id);
    });

    return Array.from(todoMap.values());
};

/**
 * 개별 Todo 추가/업데이트 (로컬)
 * @param {Object} todo - Todo 객체
 */
export const upsertTodo = async (todo) => {
    try {
        const todos = await loadTodos();
        const index = todos.findIndex(t => t._id === todo._id);

        if (index !== -1) {
            todos[index] = todo;
        } else {
            todos.push(todo);
        }

        await saveTodos(todos);
    } catch (error) {
        console.error('❌ [todoStorage] Todo upsert 실패:', error);
        throw error;
    }
};

/**
 * 개별 Todo 삭제 (로컬)
 * @param {string} todoId - Todo ID
 */
export const removeTodo = async (todoId) => {
    try {
        const todos = await loadTodos();
        const filtered = todos.filter(t => t._id !== todoId);
        await saveTodos(filtered);
    } catch (error) {
        console.error('❌ [todoStorage] Todo 삭제 실패:', error);
        throw error;
    }
};

/**
 * 전체 로컬 데이터 초기화
 */
export const clearAllData = async () => {
    try {
        await AsyncStorage.multiRemove([STORAGE_KEYS.TODOS, STORAGE_KEYS.SYNC_METADATA]);
        console.log('✅ [todoStorage] 전체 데이터 초기화 완료');
    } catch (error) {
        console.error('❌ [todoStorage] 데이터 초기화 실패:', error);
        throw error;
    }
};
