/**
 * Category Service - SQLite CRUD
 * 
 * Category 데이터 관리
 */

import { getDatabase } from './database';

// ============================================================
// 조회
// ============================================================

/**
 * 모든 Categories 조회
 * 
 * @returns {Promise<Array>}
 */
export async function getAllCategories() {
    const db = getDatabase();

    const result = await db.getAllAsync(`
    SELECT * FROM categories 
    WHERE deleted_at IS NULL
    ORDER BY order_index ASC, created_at ASC
  `);

    return result.map(deserializeCategory);
}

/**
 * 단일 Category 조회
 * 
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
export async function getCategoryById(id) {
    const db = getDatabase();

    const result = await db.getFirstAsync(
        'SELECT * FROM categories WHERE _id = ?',
        [id]
    );

    return result ? deserializeCategory(result) : null;
}

/**
 * 이름으로 Category 조회
 * 
 * @param {string} name
 * @returns {Promise<Object|null>}
 */
export async function getCategoryByName(name) {
    const db = getDatabase();

    const result = await db.getFirstAsync(
        'SELECT * FROM categories WHERE name = ? AND deleted_at IS NULL',
        [name]
    );

    return result ? deserializeCategory(result) : null;
}

// ============================================================
// 쓰기
// ============================================================

/**
 * Category 삽입/업데이트 (Upsert)
 * 
 * @param {Object} category
 * @returns {Promise<void>}
 */
export async function upsertCategory(category) {
    const db = getDatabase();

    await db.runAsync(`
    INSERT OR REPLACE INTO categories 
    (_id, name, color, icon, order_index, created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
        category._id,
        category.name,
        category.color || null,
        category.icon || null,
        category.order || category.order_index || 0,
        category.createdAt || category.created_at || new Date().toISOString(),
        category.updatedAt || category.updated_at || new Date().toISOString(),
        category.deletedAt || category.deleted_at || null,
    ]);
}

/**
 * 다중 Category 삽입 (트랜잭션)
 * 
 * @param {Array} categories
 * @returns {Promise<void>}
 */
export async function upsertCategories(categories) {
    const db = getDatabase();

    await db.withTransactionAsync(async () => {
        for (const cat of categories) {
            await db.runAsync(`
        INSERT OR REPLACE INTO categories 
        (_id, name, color, icon, order_index, created_at, updated_at, deleted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
                cat._id,
                cat.name,
                cat.color || null,
                cat.icon || null,
                cat.order || cat.order_index || 0,
                cat.createdAt || cat.created_at || new Date().toISOString(),
                cat.updatedAt || cat.updated_at || new Date().toISOString(),
                cat.deletedAt || cat.deleted_at || null,
            ]);
        }
    });
}

/**
 * Category Soft Delete
 * 
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteCategory(id) {
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.runAsync(
        'UPDATE categories SET deleted_at = ?, updated_at = ? WHERE _id = ?',
        [now, now, id]
    );
}

/**
 * Category Hard Delete
 * 
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function hardDeleteCategory(id) {
    const db = getDatabase();
    await db.runAsync('DELETE FROM categories WHERE _id = ?', [id]);
}

/**
 * Category 순서 업데이트
 * 
 * @param {Array<{_id: string, order: number}>} orders
 * @returns {Promise<void>}
 */
export async function updateCategoryOrders(orders) {
    const db = getDatabase();
    const now = new Date().toISOString();

    await db.withTransactionAsync(async () => {
        for (const { _id, order } of orders) {
            await db.runAsync(
                'UPDATE categories SET order_index = ?, updated_at = ? WHERE _id = ?',
                [order, now, _id]
            );
        }
    });
}

// ============================================================
// 통계
// ============================================================

/**
 * Category 개수 조회
 */
export async function getCategoryCount() {
    const db = getDatabase();
    const result = await db.getFirstAsync(
        'SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL'
    );
    return result?.count || 0;
}

/**
 * Category별 Todo 개수 조회
 */
export async function getCategoryTodoCounts() {
    const db = getDatabase();

    const result = await db.getAllAsync(`
    SELECT 
      c._id,
      c.name,
      c.color,
      COUNT(t._id) as todo_count
    FROM categories c
    LEFT JOIN todos t ON c._id = t.category_id AND t.deleted_at IS NULL
    WHERE c.deleted_at IS NULL
    GROUP BY c._id
    ORDER BY c.order_index ASC
  `);

    return result.map(row => ({
        _id: row._id,
        name: row.name,
        color: row.color,
        todoCount: row.todo_count,
    }));
}

// ============================================================
// 직렬화/역직렬화
// ============================================================

function deserializeCategory(row) {
    return {
        _id: row._id,
        name: row.name,
        color: row.color,
        icon: row.icon,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        deletedAt: row.deleted_at,
    };
}
