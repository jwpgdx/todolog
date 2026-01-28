import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@categories';

/**
 * 전체 카테고리 저장
 * @param {Array} categories - 카테고리 배열
 */
export const saveCategories = async (categories) => {
    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(categories));
        console.log('✅ [categoryStorage] Saved', categories.length, 'categories');
    } catch (error) {
        console.error('❌ [categoryStorage] 카테고리 저장 실패:', error);
        throw error;
    }
};

/**
 * 전체 카테고리 로드
 * @returns {Array} 카테고리 배열
 */
export const loadCategories = async () => {
    try {
        const data = await AsyncStorage.getItem(STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    } catch (error) {
        console.error('❌ [categoryStorage] 카테고리 로드 실패:', error);
        return [];
    }
};

/**
 * 개별 카테고리 추가/업데이트
 * @param {Object} category - 카테고리 객체
 */
export const upsertCategory = async (category) => {
    try {
        const categories = await loadCategories();
        const index = categories.findIndex(c => c._id === category._id);

        if (index !== -1) {
            categories[index] = category;
        } else {
            categories.push(category);
        }

        await saveCategories(categories);
    } catch (error) {
        console.error('❌ [categoryStorage] 카테고리 upsert 실패:', error);
        throw error;
    }
};

/**
 * 개별 카테고리 삭제
 * @param {string} categoryId - 카테고리 ID
 */
export const removeCategory = async (categoryId) => {
    try {
        const categories = await loadCategories();
        const filtered = categories.filter(c => c._id !== categoryId);
        await saveCategories(filtered);
    } catch (error) {
        console.error('❌ [categoryStorage] 카테고리 삭제 실패:', error);
        throw error;
    }
};

/**
 * 전체 카테고리 데이터 초기화
 */
export const clearCategoryData = async () => {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
        console.log('✅ [categoryStorage] 카테고리 데이터 초기화 완료');
    } catch (error) {
        console.error('❌ [categoryStorage] 데이터 초기화 실패:', error);
        throw error;
    }
};
