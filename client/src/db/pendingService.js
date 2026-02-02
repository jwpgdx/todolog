/**
 * Pending Service - 오프라인 큐 관리
 * 
 * UUID Migration: 모든 타입 통합
 * - Category: createCategory, updateCategory, deleteCategory
 * - Todo: createTodo, updateTodo, deleteTodo
 * - Completion: createCompletion, deleteCompletion
 * 
 * 레거시 호환: create, update, delete (Todo용)
 */

import { getDatabase } from './database';
import { generateId } from '../utils/idGenerator';

// ============================================================
// 조회
// ============================================================

/**
 * 모든 Pending Changes 조회 (FIFO 순서)
 * 
 * @returns {Promise<Array>}
 */
export async function getPendingChanges() {
    const db = getDatabase();

    const result = await db.getAllAsync(
        'SELECT * FROM pending_changes ORDER BY created_at ASC'
    );

    return result.map(deserializePendingChange);
}

/**
 * 타입별 Pending Changes 조회
 * 
 * @param {string} type
 * @returns {Promise<Array>}
 */
export async function getPendingChangesByType(type) {
    const db = getDatabase();

    const result = await db.getAllAsync(
        'SELECT * FROM pending_changes WHERE type = ? ORDER BY created_at ASC',
        [type]
    );

    return result.map(deserializePendingChange);
}

/**
 * Entity별 Pending Changes 조회
 * 
 * @param {string} entityId - todoId 또는 categoryId
 * @returns {Promise<Array>}
 */
export async function getPendingChangesByEntityId(entityId) {
    const db = getDatabase();

    const result = await db.getAllAsync(
        'SELECT * FROM pending_changes WHERE entity_id = ? ORDER BY created_at ASC',
        [entityId]
    );

    return result.map(deserializePendingChange);
}

/**
 * Pending Changes 개수 조회
 * 
 * @returns {Promise<number>}
 */
export async function getPendingChangesCount() {
    const db = getDatabase();
    const result = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM pending_changes'
    );
    return result?.count || 0;
}

/**
 * Pending Change 존재 여부 확인
 * 
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function hasPendingChange(id) {
    const db = getDatabase();
    const result = await db.getFirstAsync(
        'SELECT 1 FROM pending_changes WHERE id = ?',
        [id]
    );
    return !!result;
}

// ============================================================
// 쓰기
// ============================================================

/**
 * Pending Change 추가
 * 
 * @param {Object} change
 * @param {string} change.type - createTodo, updateTodo, deleteTodo, createCategory, updateCategory, deleteCategory, createCompletion, deleteCompletion
 * @param {string} [change.entityId] - todoId 또는 categoryId
 * @param {Object} [change.data]
 * @param {string} [change.date] - Completion용 날짜
 * @returns {Promise<string>} - 생성된 ID
 */
export async function addPendingChange(change) {
    const db = getDatabase();
    const id = change.id || generateId();

    await db.runAsync(`
    INSERT INTO pending_changes 
    (id, type, entity_id, data, date, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [
        id,
        change.type,
        change.entityId || change.todoId || null,  // 레거시 호환
        change.data ? JSON.stringify(change.data) : null,
        change.date || null,
        new Date().toISOString(),
    ]);

    return id;
}

/**
 * 다중 Pending Change 추가 (트랜잭션)
 * 
 * @param {Array} changes
 * @returns {Promise<void>}
 */
export async function addPendingChanges(changes) {
    const db = getDatabase();

    await db.withTransactionAsync(async () => {
        for (const change of changes) {
            const id = change.id || generateId();
            await db.runAsync(`
        INSERT INTO pending_changes 
        (id, type, entity_id, data, date, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
                id,
                change.type,
                change.entityId || change.todoId || null,
                change.data ? JSON.stringify(change.data) : null,
                change.date || null,
                new Date().toISOString(),
            ]);
        }
    });
}

/**
 * Pending Change 삭제
 * 
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function removePendingChange(id) {
    const db = getDatabase();
    await db.runAsync('DELETE FROM pending_changes WHERE id = ?', [id]);
}

/**
 * 다중 Pending Change 삭제
 * 
 * @param {Array<string>} ids
 * @returns {Promise<void>}
 */
export async function removePendingChanges(ids) {
    const db = getDatabase();

    await db.withTransactionAsync(async () => {
        for (const id of ids) {
            await db.runAsync('DELETE FROM pending_changes WHERE id = ?', [id]);
        }
    });
}

/**
 * Entity의 모든 Pending Changes 삭제
 * 
 * @param {string} entityId - todoId 또는 categoryId
 * @returns {Promise<void>}
 */
export async function removePendingChangesByEntityId(entityId) {
    const db = getDatabase();
    await db.runAsync('DELETE FROM pending_changes WHERE entity_id = ?', [entityId]);
}

/**
 * 타입별 Pending Changes 삭제
 * 
 * @param {string} type
 * @returns {Promise<void>}
 */
export async function removePendingChangesByType(type) {
    const db = getDatabase();
    await db.runAsync('DELETE FROM pending_changes WHERE type = ?', [type]);
}

/**
 * 전체 Pending Changes 삭제
 * 
 * @returns {Promise<void>}
 */
export async function clearPendingChanges() {
    const db = getDatabase();
    await db.runAsync('DELETE FROM pending_changes');
}

// ============================================================
// 동기화 헬퍼
// ============================================================

/**
 * Pending Changes를 처리하고 삭제
 * (콜백으로 실제 처리 로직 주입)
 * 
 * @param {Function} processor - async (change) => boolean (성공 여부)
 * @returns {Promise<{ success: number, failed: number }>}
 */
export async function processPendingChanges(processor) {
    const changes = await getPendingChanges();
    let success = 0;
    let failed = 0;

    for (const change of changes) {
        try {
            const result = await processor(change);
            if (result) {
                await removePendingChange(change.id);
                success++;
            } else {
                failed++;
            }
        } catch (error) {
            console.error(`[Pending] Failed to process ${change.id}:`, error);
            failed++;
        }
    }

    return { success, failed };
}

/**
 * Category 관련 Pending Changes만 가져오기
 */
export async function getCategoryPendingChanges() {
    const db = getDatabase();

    const result = await db.getAllAsync(`
    SELECT * FROM pending_changes 
    WHERE type IN ('createCategory', 'updateCategory', 'deleteCategory')
    ORDER BY created_at ASC
  `);

    return result.map(deserializePendingChange);
}

/**
 * Todo CRUD 관련 Pending Changes만 가져오기 (레거시 + 신규 타입)
 */
export async function getTodoPendingChanges() {
    const db = getDatabase();

    const result = await db.getAllAsync(`
    SELECT * FROM pending_changes 
    WHERE type IN ('create', 'update', 'delete', 'createTodo', 'updateTodo', 'deleteTodo')
    ORDER BY created_at ASC
  `);

    return result.map(deserializePendingChange);
}

/**
 * Completion 관련 Pending Changes만 가져오기
 */
export async function getCompletionPendingChanges() {
    const db = getDatabase();

    const result = await db.getAllAsync(`
    SELECT * FROM pending_changes 
    WHERE type IN ('createCompletion', 'deleteCompletion')
    ORDER BY created_at ASC
  `);

    return result.map(deserializePendingChange);
}

// ============================================================
// 직렬화/역직렬화
// ============================================================

function deserializePendingChange(row) {
    return {
        id: row.id,
        type: row.type,
        entityId: row.entity_id,
        todoId: row.entity_id,  // 레거시 호환
        data: row.data ? JSON.parse(row.data) : null,
        date: row.date,
        createdAt: row.created_at,
        // 호환성 (기존 코드에서 timestamp 사용)
        timestamp: row.created_at,
    };
}
