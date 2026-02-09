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
        'SELECT * FROM completions WHERE date = ? OR date IS NULL',
        [date]
    );
    const endQuery = performance.now();

    console.log(`🔍 [DEBUG] 쿼리 결과: ${result.length}개 (date=${JSON.stringify(date)} OR date IS NULL)`);

    // Map 형태로 변환 (기존 형식 호환)
    const map = {};
    result.forEach(row => {
        map[row.key] = {
            _id: row._id,
            todoId: row.todo_id,
            date: row.date,
            completedAt: row.completed_at,
        };
    });
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
        'SELECT * FROM completions WHERE date LIKE ?',
        [pattern]
    );

    const map = {};
    result.forEach(row => {
        map[row.key] = {
            _id: row._id,
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
            _id: row._id,
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
        _id: row._id,
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
            _id: row._id,
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
 * @param {string} completionId - UUID (클라이언트 생성)
 * @returns {Promise<boolean>} - 새 완료 상태
 */
export async function toggleCompletion(todoId, date, completionId) {
    const db = getDatabase();
    const key = `${todoId}_${date || 'null'}`;

    console.log(`🔄 [toggleCompletion] 시작: key=${key}, date=${JSON.stringify(date)}`);

    const existing = await db.getFirstAsync(
        'SELECT * FROM completions WHERE key = ?',
        [key]
    );

    console.log(`🔄 [toggleCompletion] 기존 데이터:`, existing ? `있음 (${existing.key})` : '없음');

    if (existing) {
        // 완료 → 미완료 (삭제)
        await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
        console.log(`🔄 [toggleCompletion] 삭제 완료 → 미완료 상태로 전환`);

        // 삭제 후 확인
        const afterDelete = await db.getAllAsync('SELECT key, date FROM completions WHERE todo_id = ?', [todoId]);
        console.log(`🔄 [toggleCompletion] 삭제 후 해당 todo의 completions:`, afterDelete);

        return false;
    } else {
        // 미완료 → 완료 (생성)
        await db.runAsync(
            'INSERT INTO completions (_id, key, todo_id, date, completed_at) VALUES (?, ?, ?, ?, ?)',
            [completionId, key, todoId, date, new Date().toISOString()]
        );
        console.log(`🔄 [toggleCompletion] 생성 완료 → 완료 상태로 전환`);
        return true;
    }
}

/**
 * Completion 생성
 * 
 * @param {string} todoId
 * @param {string|null} date
 * @param {string} completionId - UUID (클라이언트 생성)
 * @returns {Promise<void>}
 */
export async function createCompletion(todoId, date, completionId) {
    const db = getDatabase();
    const key = `${todoId}_${date || 'null'}`;

    await db.runAsync(
        'INSERT OR REPLACE INTO completions (_id, key, todo_id, date, completed_at) VALUES (?, ?, ?, ?, ?)',
        [completionId, key, todoId, date, new Date().toISOString()]
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
 * @param {Array} completions - [{ _id, todoId, date, completedAt }]
 * @returns {Promise<void>}
 */
export async function upsertCompletions(completions) {
    const db = getDatabase();

    await db.withTransactionAsync(async () => {
        for (const comp of completions) {
            const key = `${comp.todoId}_${comp.date || 'null'}`;
            await db.runAsync(
                'INSERT OR REPLACE INTO completions (_id, key, todo_id, date, completed_at) VALUES (?, ?, ?, ?, ?)',
                [comp._id, key, comp.todoId, comp.date, comp.completedAt]
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

/**
 * 전체 Completion 조회 (Array 형식, 마이그레이션용)
 * 
 * @returns {Promise<Array>}
 */
export async function getAllCompletionsArray() {
    const db = getDatabase();

    const result = await db.getAllAsync('SELECT * FROM completions');

    return result.map(row => ({
        _id: row._id,
        key: row.key,
        todoId: row.todo_id,
        date: row.date,
        completedAt: row.completed_at,
    }));
}
