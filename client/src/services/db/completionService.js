/**
 * Completion Service - SQLite CRUD
 * 
 * Phase 3: Completion 데이터 관리
 */

import { getDatabase } from './database';
import { generateId } from '../../utils/idGenerator';

function buildCompletionKey(todoId, date) {
    return `${todoId}_${date || 'null'}`;
}

function mapCompletionRow(row) {
    return {
        _id: row._id,
        key: row.key,
        todoId: row.todo_id,
        date: row.date,
        completedAt: row.completed_at,
        deletedAt: row.deleted_at ?? null,
    };
}

function mapCompletionRowsToObject(rows) {
    const map = {};
    rows.forEach(row => {
        map[row.key] = mapCompletionRow(row);
    });
    return map;
}

async function getCompletionRowByKey(db, key) {
    return db.getFirstAsync('SELECT * FROM completions WHERE key = ?', [key]);
}

async function insertCompletionRow(db, { _id, key, todoId, date, completedAt }) {
    await db.runAsync(
        'INSERT INTO completions (_id, key, todo_id, date, completed_at, deleted_at) VALUES (?, ?, ?, ?, ?, NULL)',
        [_id, key, todoId, date, completedAt]
    );
}

async function restoreCompletionRow(db, { key, completedAt, todoId = null, date = null }) {
    await db.runAsync(
        `UPDATE completions
         SET todo_id = COALESCE(?, todo_id),
             date = ?,
             completed_at = ?,
             deleted_at = NULL
         WHERE key = ?`,
        [todoId, date, completedAt, key]
    );
}

async function softDeleteCompletionByKey(db, key, deletedAt = new Date().toISOString()) {
    await db.runAsync(
        'UPDATE completions SET deleted_at = ? WHERE key = ? AND deleted_at IS NULL',
        [deletedAt, key]
    );
}

// ============================================================
// 조회
// ============================================================

/**
 * 날짜별 Completion 조회
 * 
 * 기간 일정 지원:
 * - 단일 일정: date = 'YYYY-MM-DD'
 * - 기간 일정: date = null (모든 날짜에서 완료 표시)
 * 
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Object>} - { key: { _id, todoId, date, completedAt } }
 */
export async function getCompletionsByDate(date) {
    const startTotal = performance.now();
    const db = getDatabase();

    // 🔍 DEBUG: 쿼리 전 전체 completions 확인
    const allCompletions = await db.getAllAsync('SELECT * FROM completions');
    console.log(`🔍 [DEBUG] getCompletionsByDate 호출 - 요청 date: ${JSON.stringify(date)}`);
    console.log(`🔍 [DEBUG] 현재 completions 테이블 전체 (${allCompletions.length}개):`);
    allCompletions.forEach((comp, i) => {
        console.log(`  [${i}] key: ${comp.key}`);
        console.log(`       date: ${JSON.stringify(comp.date)} (type: ${typeof comp.date}, isNull: ${comp.date === null})`);
    });

    const startQuery = performance.now();
    // 해당 날짜 + date=null (기간 일정) 모두 조회
    const result = await db.getAllAsync(
        'SELECT * FROM completions WHERE deleted_at IS NULL AND (date = ? OR date IS NULL)',
        [date]
    );
    const endQuery = performance.now();

    console.log(`🔍 [DEBUG] 쿼리 결과: ${result.length}개 (date=${JSON.stringify(date)} OR date IS NULL)`);

    const map = mapCompletionRowsToObject(result);
    const endTotal = performance.now();

    console.log(`⏱️ [getCompletionsByDate] ${(endTotal - startTotal).toFixed(2)}ms | Query: ${(endQuery - startQuery).toFixed(2)}ms | Rows: ${result.length}`);
    console.log(`  📋 [getCompletionsByDate] 조회 결과:`, result.map(row => ({
        key: row.key,
        date: row.date,
        todoId: row.todo_id.slice(-8)
    })));

    return map;
}

/**
 * 월별 Completion 조회 (캘린더용)
 * 
 * @param {number} year
 * @param {number} month
 * @returns {Promise<Object>}
 */
export async function getCompletionsByMonth(year, month) {
    const db = getDatabase();

    const pattern = `${year}-${String(month).padStart(2, '0')}%`;
    const result = await db.getAllAsync(
        'SELECT * FROM completions WHERE deleted_at IS NULL AND date LIKE ?',
        [pattern]
    );

    return mapCompletionRowsToObject(result);
}

/**
 * 날짜 범위 Completion 조회
 * 
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Object>}
 */
export async function getCompletionsByRange(startDate, endDate) {
    const db = getDatabase();

    const result = await db.getAllAsync(
        'SELECT * FROM completions WHERE deleted_at IS NULL AND date >= ? AND date <= ?',
        [startDate, endDate]
    );

    return mapCompletionRowsToObject(result);
}

/**
 * Todo의 모든 Completion 조회
 * 
 * @param {string} todoId
 * @returns {Promise<Array>}
 */
export async function getCompletionsByTodoId(todoId) {
    const db = getDatabase();

    const result = await db.getAllAsync(
        'SELECT * FROM completions WHERE todo_id = ? AND deleted_at IS NULL ORDER BY date ASC',
        [todoId]
    );

    return result.map(mapCompletionRow);
}

/**
 * 전체 Completion 조회 (디버그용)
 * 
 * @returns {Promise<Object>}
 */
export async function getAllCompletions() {
    const db = getDatabase();

    const result = await db.getAllAsync('SELECT * FROM completions');

    return mapCompletionRowsToObject(result);
}

/**
 * 월별 완료 통계 (캘린더 dot용)
 * 
 * @param {number} year
 * @param {number} month
 * @returns {Promise<Array>} - [{ date, count }]
 */
export async function getCompletionStats(year, month) {
    const db = getDatabase();

    const pattern = `${year}-${String(month).padStart(2, '0')}%`;
    const result = await db.getAllAsync(`
    SELECT date, COUNT(*) as count
    FROM completions
    WHERE deleted_at IS NULL AND date LIKE ?
    GROUP BY date
    ORDER BY date ASC
  `, [pattern]);

    return result;
}

/**
 * 특정 Completion 존재 여부 확인
 * 
 * @param {string} todoId
 * @param {string|null} date
 * @returns {Promise<boolean>}
 */
export async function hasCompletion(todoId, date) {
    const db = getDatabase();
    const key = buildCompletionKey(todoId, date);

    const result = await db.getFirstAsync(
        'SELECT 1 FROM completions WHERE key = ? AND deleted_at IS NULL',
        [key]
    );

    return !!result;
}

// ============================================================
// 쓰기
// ============================================================

/**
 * Completion 토글 (핵심!)
 * 완료 상태 → 미완료, 미완료 → 완료
 * 
 * @param {string} todoId
 * @param {string|null} date - null for period todo
 * @param {string} completionId - UUID (클라이언트 생성)
 * @returns {Promise<{ completed: boolean, effectiveCompletionId: string }>} - 새 완료 상태와 실제 completion ID
 */
export async function toggleCompletion(todoId, date, completionId) {
    const db = getDatabase();
    const key = buildCompletionKey(todoId, date);

    console.log(`🔄 [toggleCompletion] 시작: key=${key}, date=${JSON.stringify(date)}`);

    const existing = await getCompletionRowByKey(db, key);

    console.log(`🔄 [toggleCompletion] 기존 데이터:`, existing ? `있음 (${existing.key})` : '없음');

    if (existing && !existing.deleted_at) {
        await softDeleteCompletionByKey(db, key);
        console.log(`🔄 [toggleCompletion] 삭제 완료 → 미완료 상태로 전환`);

        // 삭제 후 확인
        const afterDelete = await db.getAllAsync('SELECT key, date, deleted_at FROM completions WHERE todo_id = ?', [todoId]);
        console.log(`🔄 [toggleCompletion] 삭제 후 해당 todo의 completions:`, afterDelete);

        return {
            completed: false,
            effectiveCompletionId: existing._id,
        };
    }

    if (existing && existing.deleted_at) {
        const completedAt = new Date().toISOString();
        await restoreCompletionRow(db, {
            key,
            todoId,
            date,
            completedAt,
        });
        console.log(`🔄 [toggleCompletion] 복구 완료 → 완료 상태로 전환`);
        return {
            completed: true,
            effectiveCompletionId: existing._id,
        };
    } else {
        const completedAt = new Date().toISOString();
        await insertCompletionRow(db, {
            _id: completionId,
            key,
            todoId,
            date,
            completedAt,
        });
        console.log(`🔄 [toggleCompletion] 생성 완료 → 완료 상태로 전환`);
        return {
            completed: true,
            effectiveCompletionId: completionId,
        };
    }
}

/**
 * Completion 생성
 * 
 * @param {string} todoId
 * @param {string|null} date
 * @param {string} completionId - UUID (클라이언트 생성)
 * @returns {Promise<string>} - 실제 사용된 completion ID
 */
export async function createCompletion(todoId, date, completionId = generateId()) {
    const db = getDatabase();
    const key = buildCompletionKey(todoId, date);
    const existing = await getCompletionRowByKey(db, key);

    if (existing && !existing.deleted_at) {
        return existing._id;
    }

    if (existing && existing.deleted_at) {
        await restoreCompletionRow(db, {
            key,
            todoId,
            date,
            completedAt: new Date().toISOString(),
        });
        return existing._id;
    }

    await insertCompletionRow(db, {
        _id: completionId,
        key,
        todoId,
        date,
        completedAt: new Date().toISOString(),
    });
    return completionId;
}

/**
 * Completion 삭제
 * 
 * @param {string} todoId
 * @param {string|null} date
 * @returns {Promise<void>}
 */
export async function deleteCompletion(todoId, date) {
    const db = getDatabase();
    const key = buildCompletionKey(todoId, date);

    await softDeleteCompletionByKey(db, key);
}

/**
 * 키로 Completion 삭제
 * 
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteCompletionByKey(key) {
    const db = getDatabase();
    await softDeleteCompletionByKey(db, key);
}

/**
 * Todo의 모든 Completion 삭제
 * 
 * @param {string} todoId
 * @returns {Promise<void>}
 */
export async function deleteCompletionsByTodoId(todoId) {
    const db = getDatabase();
    await db.runAsync(
        'UPDATE completions SET deleted_at = ? WHERE todo_id = ? AND deleted_at IS NULL',
        [new Date().toISOString(), todoId]
    );
}

/**
 * 키 목록으로 Completion 다중 삭제 (트랜잭션)
 *
 * @param {Array<string>} keys
 * @returns {Promise<void>}
 */
export async function deleteCompletionsByKeys(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return;

    const db = getDatabase();
    const deletedAt = new Date().toISOString();
    await db.withTransactionAsync(async () => {
        for (const key of keys) {
            await db.runAsync(
                'UPDATE completions SET deleted_at = ? WHERE key = ? AND deleted_at IS NULL',
                [deletedAt, key]
            );
        }
    });
}

/**
 * 다중 Completion Upsert (동기화용)
 * 
 * @param {Array} completions - [{ _id, todoId, date, completedAt }]
 * @returns {Promise<void>}
 */
export async function upsertCompletions(completions) {
    const db = getDatabase();

    await db.withTransactionAsync(async () => {
        for (const comp of completions) {
            const key = buildCompletionKey(comp.todoId, comp.date);
            const updateResult = await db.runAsync(
                `UPDATE completions
                 SET _id = ?,
                     todo_id = ?,
                     date = ?,
                     completed_at = ?,
                     deleted_at = NULL
                 WHERE key = ?`,
                [comp._id, comp.todoId, comp.date, comp.completedAt, key]
            );

            if (!updateResult?.changes) {
                await insertCompletionRow(db, {
                    _id: comp._id,
                    key,
                    todoId: comp.todoId,
                    date: comp.date,
                    completedAt: comp.completedAt,
                });
            }
        }
    });
}

/**
 * 전체 Completion 삭제
 * 
 * @returns {Promise<void>}
 */
export async function clearAllCompletions() {
    const db = getDatabase();
    await db.runAsync('DELETE FROM completions');
}

// ============================================================
// 통계
// ============================================================

/**
 * Completion 개수 조회
 */
export async function getCompletionCount() {
    const db = getDatabase();
    const result = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM completions WHERE deleted_at IS NULL'
    );
    return result?.count || 0;
}

/**
 * 날짜별 완료 개수 조회
 */
export async function getCompletionCountByDate(date) {
    const db = getDatabase();
    const result = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM completions WHERE deleted_at IS NULL AND date = ?',
        [date]
    );
    return result?.count || 0;
}

/**
 * 전체 Completion 조회 (Array 형식, 마이그레이션용)
 * 
 * @returns {Promise<Array>}
 */
export async function getAllCompletionsArray() {
    const db = getDatabase();

    const result = await db.getAllAsync('SELECT * FROM completions WHERE deleted_at IS NULL');

    return result.map(row => ({
        _id: row._id,
        key: row.key,
        todoId: row.todo_id,
        date: row.date,
        completedAt: row.completed_at,
    }));
}
