/**
 * Todo Service - SQLite CRUD
 * 
 * Phase 2: Todo 데이터 관리
 */

import { getDatabase } from './database';

export const ORDER_STEP = 1024;

function toFiniteNumber(value, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function getOrderValue(todo, lane, { nullable = false, fallback = 0 } = {}) {
  const nested = todo?.order;
  const rawValue =
    nested && typeof nested === 'object' && !Array.isArray(nested)
      ? nested[lane]
      : todo?.[`${lane}Order`];

  if (rawValue == null) {
    return nullable ? null : fallback;
  }

  return toFiniteNumber(rawValue, fallback);
}

async function getMaxOrderValue(sql, params = []) {
  const db = getDatabase();
  const result = await db.getFirstAsync(sql, params);
  return toFiniteNumber(result?.max_order, 0);
}

export async function getNextCustomOrder() {
  const maxOrder = await getMaxOrderValue(
    `SELECT MAX(custom_order) as max_order
     FROM todos
     WHERE deleted_at IS NULL`
  );
  return maxOrder + ORDER_STEP;
}

export async function getNextCategoryOrder(categoryId) {
  const maxOrder = await getMaxOrderValue(
    `SELECT MAX(category_order) as max_order
     FROM todos
     WHERE deleted_at IS NULL AND category_id = ?`,
    [categoryId]
  );
  return maxOrder + ORDER_STEP;
}

export async function getNextFavoriteOrder() {
  const maxOrder = await getMaxOrderValue(
    `SELECT MAX(favorite_order) as max_order
     FROM todos
     WHERE deleted_at IS NULL AND favorite_order IS NOT NULL`
  );
  return maxOrder + ORDER_STEP;
}

export async function buildNewTodoOrders({ categoryId, isFavorite = false }) {
  const [custom, category, favorite] = await Promise.all([
    getNextCustomOrder(),
    getNextCategoryOrder(categoryId),
    isFavorite ? getNextFavoriteOrder() : Promise.resolve(null),
  ]);

  return { custom, category, favorite };
}

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
      OR (
        t.recurrence IS NOT NULL
        AND t.start_date <= ?
        AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)
      )
    )
    AND t.deleted_at IS NULL
    ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
  `, [date, date, date, date, date]);

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
      OR (
        t.recurrence IS NOT NULL
        AND t.start_date <= ?
        AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)
      )
    )
    AND t.deleted_at IS NULL
    ORDER BY t.date ASC, t.is_all_day DESC, t.start_time ASC
  `, [startDate, endDate, endDate, startDate, endDate, startDate]);

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
    ORDER BY t.custom_order ASC, t.created_at ASC, t._id ASC
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
    ORDER BY t.category_order ASC, t.created_at ASC, t._id ASC
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

  // ⚠️ INSERT OR REPLACE는 내부적으로 DELETE + INSERT로 동작하여
  // FOREIGN KEY ON DELETE CASCADE가 트리거되어 completions가 삭제됨
  // → INSERT ... ON CONFLICT DO UPDATE 사용 (진정한 UPSERT)
  await db.runAsync(`
    INSERT INTO todos 
    (_id, title, date, start_date, end_date, recurrence, recurrence_end_date,
     category_id, custom_order, category_order, favorite_order,
     is_all_day, start_time, end_time, color, memo,
     created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(_id) DO UPDATE SET
      title = excluded.title,
      date = excluded.date,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      recurrence = excluded.recurrence,
      recurrence_end_date = excluded.recurrence_end_date,
      category_id = excluded.category_id,
      custom_order = excluded.custom_order,
      category_order = excluded.category_order,
      favorite_order = excluded.favorite_order,
      is_all_day = excluded.is_all_day,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      color = excluded.color,
      memo = excluded.memo,
      updated_at = excluded.updated_at,
      deleted_at = excluded.deleted_at
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
      // ⚠️ INSERT OR REPLACE 대신 ON CONFLICT DO UPDATE 사용 (CASCADE DELETE 방지)
      await db.runAsync(`
        INSERT INTO todos 
        (_id, title, date, start_date, end_date, recurrence, recurrence_end_date,
         category_id, custom_order, category_order, favorite_order,
         is_all_day, start_time, end_time, color, memo,
         created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(_id) DO UPDATE SET
          title = excluded.title,
          date = excluded.date,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          recurrence = excluded.recurrence,
          recurrence_end_date = excluded.recurrence_end_date,
          category_id = excluded.category_id,
          custom_order = excluded.custom_order,
          category_order = excluded.category_order,
          favorite_order = excluded.favorite_order,
          is_all_day = excluded.is_all_day,
          start_time = excluded.start_time,
          end_time = excluded.end_time,
          color = excluded.color,
          memo = excluded.memo,
          updated_at = excluded.updated_at,
          deleted_at = excluded.deleted_at
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
  const now = new Date().toISOString();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE todos SET deleted_at = ?, updated_at = ? WHERE _id = ?',
      [now, now, id]
    );

    await db.runAsync(
      'UPDATE completions SET deleted_at = ? WHERE todo_id = ? AND deleted_at IS NULL',
      [now, id]
    );
  });
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

      await db.runAsync(
        'UPDATE completions SET deleted_at = ? WHERE todo_id = ? AND deleted_at IS NULL',
        [now, id]
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
  const order = {
    custom: toFiniteNumber(row.custom_order, 0),
    category: toFiniteNumber(row.category_order, 0),
    favorite: row.favorite_order == null ? null : toFiniteNumber(row.favorite_order, 0),
  };

  return {
    _id: row._id,
    title: row.title,
    date: row.date,
    startDate: row.start_date,
    endDate: row.end_date,
    recurrenceEndDate: row.recurrence_end_date,
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
    customOrder: order.custom,
    categoryOrder: order.category,
    favoriteOrder: order.favorite,
    isFavorite: order.favorite != null,
    order,
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
  const customOrder = getOrderValue(todo, 'custom', { fallback: 0 });
  const categoryOrder = getOrderValue(todo, 'category', { fallback: 0 });
  const favoriteOrder = getOrderValue(todo, 'favorite', { nullable: true });

  return [
    todo._id,
    todo.title,
    todo.date || null,
    todo.startDate || null,
    todo.endDate || null,
    todo.recurrence ? JSON.stringify(todo.recurrence) : null,
    todo.recurrenceEndDate || null,
    // categoryId가 객체일 수 있음 (이전 버그 대응)
    typeof todo.categoryId === 'object' ? todo.categoryId?._id : todo.categoryId,
    customOrder,
    categoryOrder,
    favoriteOrder,
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
      OR (
        recurrence IS NOT NULL
        AND start_date <= ?
        AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)
      )
    )
    AND deleted_at IS NULL
  `, [date, date, date, date, date]);
  return result?.count || 0;
}
