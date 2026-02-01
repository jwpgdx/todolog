import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@completions';

/**
 * 전체 Completion 로드
 * @returns {Object} { "todoId_date": { todoId, date, completedAt } }
 */
export const loadCompletions = async () => {
  try {
    console.log('📂 [completionStorage] Loading completions from storage...');
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    const completions = data ? JSON.parse(data) : {};
    console.log('✅ [completionStorage] Loaded:', Object.keys(completions).length, 'completions');
    return completions;
  } catch (error) {
    console.error('❌ [completionStorage] Completion 로드 실패:', error);
    return {};
  }
};

/**
 * 전체 Completion 저장
 * @param {Object} completions - { "todoId_date": { todoId, date, completedAt } }
 */
export const saveCompletions = async (completions) => {
  try {
    console.log('💾 [completionStorage] Saving completions:', Object.keys(completions).length);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(completions));
    console.log('✅ [completionStorage] Saved successfully');
  } catch (error) {
    console.error('❌ [completionStorage] Completion 저장 실패:', error);
    throw error;
  }
};

/**
 * 로컬에서 완료 토글 (즉시 반영)
 * @param {string} todoId - Todo ID
 * @param {string} date - 날짜 ("YYYY-MM-DD" or null)
 * @returns {boolean} 새로운 완료 상태 (true: 완료, false: 미완료)
 */
export const toggleCompletionLocally = async (todoId, date) => {
  try {
    const completions = await loadCompletions();
    const key = `${todoId}_${date || 'null'}`;
    
    if (completions[key]) {
      // 완료 기록 있음 → 삭제 (미완료)
      delete completions[key];
      await saveCompletions(completions);
      console.log('✅ [completionStorage] 완료 취소:', key);
      return false;
    } else {
      // 완료 기록 없음 → 생성 (완료)
      completions[key] = {
        todoId,
        date: date || null,
        completedAt: new Date().toISOString(),
      };
      await saveCompletions(completions);
      console.log('✅ [completionStorage] 완료 처리:', key);
      return true;
    }
  } catch (error) {
    console.error('❌ [completionStorage] 토글 실패:', error);
    throw error;
  }
};

/**
 * 특정 Completion 조회
 * @param {string} todoId - Todo ID
 * @param {string} date - 날짜 ("YYYY-MM-DD" or null)
 * @returns {Object|null} Completion 객체 또는 null
 */
export const getCompletion = async (todoId, date) => {
  try {
    const completions = await loadCompletions();
    const key = `${todoId}_${date || 'null'}`;
    return completions[key] || null;
  } catch (error) {
    console.error('❌ [completionStorage] Completion 조회 실패:', error);
    return null;
  }
};

/**
 * 델타 병합 - 로컬 데이터에 서버 변경사항 반영
 * @param {Object} local - 로컬 Completion 객체
 * @param {Object} delta - { updated: Array, deleted: Array }
 * @returns {Object} 병합된 Completion 객체
 */
export const mergeCompletionDelta = (local, delta) => {
  const { updated = [], deleted = [] } = delta;
  
  // Map으로 변환 (효율적인 병합)
  const map = new Map();
  
  // 로컬 데이터 먼저 추가
  Object.entries(local).forEach(([key, value]) => {
    map.set(key, value);
  });
  
  // 서버 업데이트 반영
  updated.forEach(completion => {
    const key = `${completion.todoId}_${completion.date || 'null'}`;
    map.set(key, completion);
  });
  
  // 서버 삭제 반영
  deleted.forEach(completion => {
    const key = `${completion.todoId}_${completion.date || 'null'}`;
    map.delete(key);
  });
  
  // Object로 변환
  const result = {};
  map.forEach((value, key) => {
    result[key] = value;
  });
  
  console.log('🔄 [completionStorage] 델타 병합 완료:', {
    local: Object.keys(local).length,
    updated: updated.length,
    deleted: deleted.length,
    result: Object.keys(result).length,
  });
  
  return result;
};

/**
 * 전체 로컬 Completion 초기화
 */
export const clearCompletions = async () => {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
    console.log('✅ [completionStorage] Completion 데이터 초기화 완료');
  } catch (error) {
    console.error('❌ [completionStorage] 초기화 실패:', error);
    throw error;
  }
};
