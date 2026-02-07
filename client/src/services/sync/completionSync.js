import api from '../../api/axios';
import { upsertCompletions } from '../db/completionService';
import { ensureDatabase } from '../db/database';

/**
 * Completion Full Sync
 * 서버의 모든 완료 기록을 SQLite로 동기화
 */
export const syncCompletions = async () => {
  try {
    console.log('🔄 [syncCompletions] 시작');
    
    await ensureDatabase();
    
    // 서버에서 모든 완료 기록 가져오기
    const response = await api.get('/completions/all');
    const serverCompletions = response.data;
    
    console.log(`📥 [syncCompletions] 서버: ${serverCompletions.length}개`);
    
    // SQLite에 저장
    if (serverCompletions.length > 0) {
      await upsertCompletions(serverCompletions);
      console.log(`✅ [syncCompletions] SQLite 저장 완료: ${serverCompletions.length}개`);
    }
    
    return { success: true, count: serverCompletions.length };
  } catch (error) {
    console.error('❌ [syncCompletions] 실패:', error);
    throw error;
  }
};
