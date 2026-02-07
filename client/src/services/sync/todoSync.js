import { todoAPI } from '../../api/todos';
import { upsertTodos } from '../db/todoService';
import { ensureDatabase } from '../db/database';

/**
 * Todo Full Sync
 * 서버의 모든 할일을 SQLite로 동기화
 */
export const syncTodos = async () => {
  try {
    console.log('🔄 [syncTodos] 시작');
    
    await ensureDatabase();
    
    // 서버에서 모든 할일 가져오기
    const response = await todoAPI.getTodos();
    const serverTodos = response.data;
    
    console.log(`📥 [syncTodos] 서버: ${serverTodos.length}개`);
    
    // SQLite에 저장
    if (serverTodos.length > 0) {
      await upsertTodos(serverTodos);
      console.log(`✅ [syncTodos] SQLite 저장 완료: ${serverTodos.length}개`);
    }
    
    return { success: true, count: serverTodos.length };
  } catch (error) {
    console.error('❌ [syncTodos] 실패:', error);
    throw error;
  }
};
