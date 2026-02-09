import * as categoryApi from '../../api/categories';
import { upsertCategories } from '../db/categoryService';
import { ensureDatabase } from '../db/database';

/**
 * Category Full Sync
 * 서버의 모든 카테고리를 SQLite로 동기화
 */
export const syncCategories = async () => {
  try {
    console.log('🔄 [syncCategories] 시작');
    
    await ensureDatabase();
    
    // 서버에서 모든 카테고리 가져오기 (이미 response.data 반환됨)
    const serverCategories = await categoryApi.getCategories();
    
    console.log(`📥 [syncCategories] 서버: ${serverCategories.length}개`);
    
    // SQLite에 저장
    if (serverCategories.length > 0) {
      await upsertCategories(serverCategories);
      console.log(`✅ [syncCategories] SQLite 저장 완료: ${serverCategories.length}개`);
    }
    
    return { success: true, count: serverCategories.length };
  } catch (error) {
    console.error('❌ [syncCategories] 실패:', error);
    throw error;
  }
};
