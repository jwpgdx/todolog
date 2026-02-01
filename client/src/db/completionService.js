/**
 * Completion Service - SQLite CRUD
 * 
 * Phase 3: Completion 데이터 관리
 */

import { getDatabase } from './database';

// ============================================================
// 조회
// ============================================================

/**
 * 날짜별 Completion 조회
 * 
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Object>} - { key: { todoId, date, completedAt } }
 */
export async function getCompletionsByDate(date) {
    const db = getDatabase();

    const result = await db.getAllAsync(
        'SELECT * FROM completions WHERE date = ?',
        [date]
    );

    // Map 형태로 변환 (기존 형식 호환)
    const map = {};
    result.forEach(row => {
        map[row.key] = {
            todoId: row.todo_id,
            date: row.date,
            completedAt: row.completed_at,
        };
    });

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
        'SELECT * FROM completions WHERE date LIKE ?',
        [pattern]
    );

    const map = {};
    result.forEach(row => {
        map[row.key] = {
            todoId: row.todo_id,
            date: row.date,
            completedAt: row.completed_at,
        };
    });

    return map;
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
        'SELECT * FROM completions WHERE date >= ? AND date <= ?',
        [startDate, endDate]
    );

    const map = {};
    result.forEach(row => {
        map[row.key] = {
            todoId: row.todo_id,
            date: row.date,
            completedAt: row.completed_at,
        };
    });

    return map;
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
        'SELECT * FROM completions WHERE todo_id = ? ORDER BY date ASC',
        [todoId]
    );

    return result.map(row => ({
        key: row.key,
        todoId: row.todo_id,
        date: row.date,
        completedAt: row.completed_at,
    }));
}

/**
 * 전체 Completion 조회 (디버그용)
 * 
 * @returns {Promise<Object>}
 */
export async function getAllCompletions() {
    const db = getDatabase();

    const result = await db.getAllAsync('SELECT * FROM completions');

    const map = {};
    result.forEach(row => {
        map[row.key] = {
            todoId: row.todo_id,
            date: row.date,
            completedAt: row.completed_at,
        };
    });

    return map;
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
    WHERE date LIKE ?
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
    const key = `${todoId}_${date || 'null'}`;

    const result = await db.getFirstAsync(
        'SELECT 1 FROM completions WHERE key = ?',
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
 * @returns {Promise<boolean>} - 새 완료 상태
 */
export async function toggleCompletion(todoId, date) {
    const db = getDatabase();
    const key = `${todoId}_${date || 'null'}`;

    const existing = await db.getFirstAsync(
        'SELECT * FROM completions WHERE key = ?',
        [key]
    );

    if (existing) {
        // 완료 → 미완료 (삭제)
        await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
        return false;
    } else {
        // 미완료 → 완료 (생성)
        await db.runAsync(
            'INSERT INTO completions (key, todo_id, date, completed_at) VALUES (?, ?, ?, ?)',
            [key, todoId, date, new Date().toISOString()]
        );
        return true;
    }
}

/**
 * Completion 생성
 * 
 * @param {string} todoId
 * @param {string|null} date
 * @returns {Promise<void>}
 */
export async function createCompletion(todoId, date) {
    const db = getDatabase();
    const key = `${todoId}_${date || 'null'}`;

    await db.runAsync(
        'INSERT OR REPLACE INTO completions (key, todo_id, date, completed_at) VALUES (?, ?, ?, ?)',
        [key, todoId, date, new Date().toISOString()]
    );
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
    const key = `${todoId}_${date || 'null'}`;

    await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
}

/**
 * 키로 Completion 삭제
 * 
 * @param {string} key
 * @returns {Promise<void>}
 */
export async function deleteCompletionByKey(key) {
    const db = getDatabase();
    await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
}

/**
 * Todo의 모든 Completion 삭제
 * 
 * @param {string} todoId
 * @returns {Promise<void>}
 */
export async function deleteCompletionsByTodoId(todoId) {
    const db = getDatabase();
    await db.runAsync('DELETE FROM completions WHERE todo_id = ?', [todoId]);
}

/**
 * 다중 Completion Upsert (동기화용)
 * 
 * @param {Object} completions - { key: { todoId, date, completedAt } }
 * @returns {Promise<void>}
 */
export async function upsertCompletions(completions) {
    const db = getDatabase();

    await db.withTransactionAsync(async () => {
        for (const [key, comp] of Object.entries(completions)) {
            await db.runAsync(
                'INSERT OR REPLACE INTO completions (key, todo_id, date, completed_at) VALUES (?, ?, ?, ?)',
                [key, comp.todoId, comp.date, comp.completedAt]
            );
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
        'SELECT COUNT(*) as count FROM completions'
    );
    return result?.count || 0;
}

/**
 * 날짜별 완료 개수 조회
 */
export async function getCompletionCountByDate(date) {
    const db = getDatabase();
    const result = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM completions WHERE date = ?',
        [date]
    );
    return result?.count || 0;
}
