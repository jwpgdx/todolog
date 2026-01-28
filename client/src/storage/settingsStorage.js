import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@userSettings';

/**
 * 사용자 설정 저장
 * @param {Object} settings - 설정 객체
 */
export const saveSettings = async (settings) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        console.log('✅ [settingsStorage] 설정 저장 완료');
    } catch (error) {
        console.error('❌ [settingsStorage] 설정 저장 실패:', error);
        throw error;
    }
};

/**
 * 사용자 설정 로드
 * @returns {Object|null} 설정 객체
 */
export const loadSettings = async () => {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : null;
    } catch (error) {
        console.error('❌ [settingsStorage] 설정 로드 실패:', error);
        return null;
    }
};

/**
 * 개별 설정 업데이트
 * @param {string} key - 설정 키
 * @param {any} value - 설정 값
 */
export const updateSetting = async (key, value) => {
    try {
        const settings = await loadSettings() || {};
        settings[key] = value;
        await saveSettings(settings);
        console.log('✅ [settingsStorage] 설정 업데이트:', key, value);
    } catch (error) {
        console.error('❌ [settingsStorage] 설정 업데이트 실패:', error);
        throw error;
    }
};

/**
 * 설정 데이터 초기화
 */
export const clearSettings = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
        console.log('✅ [settingsStorage] 설정 데이터 초기화 완료');
    } catch (error) {
        console.error('❌ [settingsStorage] 데이터 초기화 실패:', error);
        throw error;
    }
};
