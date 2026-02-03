/**
 * Todo Service - SQLite CRUD
 * 
 * Phase 2: Todo 데이터 관리
 */

import { getDatabase } from './database';

// ============================================================
// 조회
// ============================================================

/**
 * 날짜별 Todo 조회 (메인 화면용)
 * - 단일 일정 (date = targetDate)
 * - 기간 일정 (startDate <= targetDate <= endDate)
 * - 반복 일정 (recurrence 있음)
 * 
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
export async function getTodosByDate(date) {
  const db = getDatabase();

  const result = await db.getAllAsync(`
    SELECT 
      t.*,
      c.name as category_name, 
      c.color as category_color,
      c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE (
      t.date = ?
      OR (t.start_date <= ? AND t.end_date >= ?)
      OR (t.recurrence IS NOT NULL AND t.start_date <= ?)
    )
    AND t.deleted_at IS NULL
    ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
  `, [date, date, date, date]);

  return result.map(deserializeTodo);
}

/**
 * 월별 Todo 조회 (캘린더용)
 * 
 * @param {number} year
 * @param {number} month
 * @returns {Promise<Array>}
 */
export async function getTodosByMonth(year, month) {
  const db = getDatabase();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const result = await db.getAllAsync(`
    SELECT 
      t.*,
      c.name as category_name, 
      c.color as category_color,
      c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE (
      (t.date >= ? AND t.date <= ?)
      OR (t.start_date <= ? AND t.end_date >= ?)
      OR (t.recurrence IS NOT NULL AND t.start_date <= ?)
    )
    AND t.deleted_at IS NULL
    ORDER BY t.date ASC, t.is_all_day DESC, t.start_time ASC
  `, [startDate, endDate, endDate, startDate, endDate]);

  return result.map(deserializeTodo);
}

/**
 * 단일 Todo 조회
 * 
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getTodoById(id) {
  const db = getDatabase();

  const result = await db.getFirstAsync(`
    SELECT 
      t.*,
      c.name as category_name, 
      c.color as category_color,
      c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE t._id = ?
  `, [id]);

  return result ? deserializeTodo(result) : null;
}

/**
 * 전체 Todo 조회 (마이그레이션/디버그용)
 * 
 * @returns {Promise<Array>}
 */
export async function getAllTodos() {
  const db = getDatabase();

  const result = await db.getAllAsync(`
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE t.deleted_at IS NULL
    ORDER BY t.date ASC, t.created_at ASC
  `);

  return result.map(deserializeTodo);
}

/**
 * 카테고리별 Todo 조회
 * 
 * @param {string} categoryId
 * @returns {Promise<Array>}
 */
export async function getTodosByCategory(categoryId) {
  const db = getDatabase();

  const result = await db.getAllAsync(`
    SELECT 
      t.*,
      c.name as category_name, 
      c.color as category_color,
      c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE t.category_id = ?
    AND t.deleted_at IS NULL
    ORDER BY t.date ASC, t.created_at ASC
  `, [categoryId]);

  return result.map(deserializeTodo);
}

// ============================================================
// 쓰기
// ============================================================

/**
 * Todo 삽입/업데이트 (Upsert)
 * 
 * @param {Object} todo
 * @returns {Promise<void>}
 */
export async function upsertTodo(todo) {
  const db = getDatabase();

  await db.runAsync(`
    INSERT OR REPLACE INTO todos 
    (_id, title, date, start_date, end_date, recurrence, 
     category_id, is_all_day, start_time, end_time, color, memo,
     created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, serializeTodoForInsert(todo));
}

/**
 * 다중 Todo 삽입 (트랜잭션)
 * 
 * @param {Array} todos
 * @returns {Promise<void>}
 */
export async function upsertTodos(todos) {
  const db = getDatabase();

  await db.withTransactionAsync(async () => {
    for (const todo of todos) {
      await db.runAsync(`
        INSERT OR REPLACE INTO todos 
        (_id, title, date, start_date, end_date, recurrence, 
         category_id, is_all_day, start_time, end_time, color, memo,
         created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, serializeTodoForInsert(todo));
    }
  });
}

/**
 * Todo Soft Delete
 * 
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteTodo(id) {
  const db = getDatabase();

  await db.runAsync(
    'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE _id = ?',
    [new Date().toISOString(), new Date().toISOString(), id]
  );
}

/**
 * 다중 Todo Soft Delete
 * 
 * @param {Array<string>} ids
 * @returns {Promise<void>}
 */
export async function deleteTodos(ids) {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    for (const id of ids) {
      await db.runAsync(
        'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE _id = ?',
        [now, now, id]
      );
    }
  });
}

/**
 * Todo Hard Delete (완전 삭제)
 * 
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function hardDeleteTodo(id) {
  const db = getDatabase();
  await db.runAsync('DELETE FROM todos WHERE _id = ?', [id]);
}

// ============================================================
// 직렬화/역직렬화
// ============================================================

/**
 * DB row → Todo 객체
 */
function deserializeTodo(row) {
  return {
    _id: row._id,
    title: row.title,
    date: row.date,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrence: row.recurrence ? JSON.parse(row.recurrence) : null,
    categoryId: row.category_id,
    isAllDay: row.is_all_day === 1,
    startTime: row.start_time,
    endTime: row.end_time,
    color: row.color,
    memo: row.memo,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    // JOIN된 카테고리 정보
    category: row.category_name ? {
      _id: row.category_id,
      name: row.category_name,
      color: row.category_color,
      icon: row.category_icon,
    } : null,
  };
}

/**
 * Todo 객체 → DB params
 */
function serializeTodoForInsert(todo) {
  return [
    todo._id,
    todo.title,
    todo.date || null,
    todo.startDate || null,
    todo.endDate || null,
    todo.recurrence ? JSON.stringify(todo.recurrence) : null,
    // categoryId가 객체일 수 있음 (이전 버그 대응)
    typeof todo.categoryId === 'object' ? todo.categoryId?._id : todo.categoryId,
    todo.isAllDay ? 1 : 0,
    todo.startTime || null,
    todo.endTime || null,
    todo.color || null,
    todo.memo || null,
    todo.createdAt || new Date().toISOString(),
    todo.updatedAt || new Date().toISOString(),
    todo.deletedAt || null,
  ];
}

// ============================================================
// 통계/디버그
// ============================================================

/**
 * Todo 개수 조회
 */
export async function getTodoCount() {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM todos WHERE deleted_at IS NULL'
  );
  return result?.count || 0;
}

/**
 * 날짜별 Todo 개수 조회
 */
export async function getTodoCountByDate(date) {
  const db = getDatabase();
  const result = await db.getFirstAsync(`
    SELECT COUNT(*) as count FROM todos 
    WHERE (
      date = ?
      OR (start_date <= ? AND end_date >= ?)
      OR (recurrence IS NOT NULL AND start_date <= ?)
    )
    AND deleted_at IS NULL
  `, [date, date, date, date]);
  return result?.count || 0;
}
