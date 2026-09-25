import { ensureDatabase, getDatabase } from './database';
import { addPendingChangeOnConnection } from './pendingService';
import { ORDER_STEP } from './todoService';

function normalizeOrderedTodoIds(todoIds = []) {
  const seen = new Set();
  const normalized = [];

  (Array.isArray(todoIds) ? todoIds : []).forEach((value) => {
    const todoId = typeof value === 'string' ? value.trim() : '';
    if (!todoId || seen.has(todoId)) {
      return;
    }

    seen.add(todoId);
    normalized.push(todoId);
  });

  return normalized;
}

function isTodoValidForOriginScope(row, originScope) {
  if (!originScope?.screen) {
    return true;
  }

  switch (originScope.screen) {
    case 'allTodos':
      return true;
    case 'favorites':
      return row.favorite_order != null;
    case 'category':
      return Boolean(originScope.categoryId) && row.category_id === originScope.categoryId;
    default:
      return false;
  }
}

function toOrderNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export async function moveTodosToCategoryBatch({
  selectedTodoIds,
  orderedTodoIds,
  targetCategoryId,
  originScope = null,
} = {}) {
  const requestedTodoIds = normalizeOrderedTodoIds(selectedTodoIds);
  const screenOrderedTodoIds = normalizeOrderedTodoIds(orderedTodoIds);
  if (!targetCategoryId || requestedTodoIds.length === 0) {
    throw new Error('bulk move request is missing target category or todo ids');
  }
  if (requestedTodoIds.length > 1 && !originScope?.screen) {
    throw new Error('bulk move request is missing origin selection scope');
  }

  await ensureDatabase();
  const db = getDatabase();
  let result = null;

  await db.withExclusiveTransactionAsync(async (txn) => {
    const targetCategory = await txn.getFirstAsync(
      `SELECT _id
       FROM categories
       WHERE _id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [targetCategoryId]
    );

    if (!targetCategory) {
      result = {
        status: 'target_invalid',
        targetCategoryId,
      };
      return;
    }

    const placeholders = requestedTodoIds.map(() => '?').join(', ');
    const rows = await txn.getAllAsync(
      `SELECT
         _id,
         category_id,
         custom_order,
         category_order,
         favorite_order,
         deleted_at
       FROM todos
       WHERE _id IN (${placeholders})`,
      requestedTodoIds
    );
    const rowById = new Map((rows || []).map((row) => [row._id, row]));
    const invalidTodoIds = [];
    const validTodoIds = [];

    requestedTodoIds.forEach((todoId) => {
      const row = rowById.get(todoId);
      if (
        !row ||
        row.deleted_at != null ||
        !isTodoValidForOriginScope(row, originScope)
      ) {
        invalidTodoIds.push(todoId);
        return;
      }

      validTodoIds.push(todoId);
    });

    if (invalidTodoIds.length > 0) {
      result = {
        status: 'selection_stale',
        invalidTodoIds,
        validTodoIds,
      };
      return;
    }

    const requestedIdSet = new Set(requestedTodoIds);
    const screenOrderedIdSet = new Set(screenOrderedTodoIds);
    const hasUnexpectedOrderedId = screenOrderedTodoIds.some(
      (todoId) => !requestedIdSet.has(todoId)
    );
    const unresolvedTodoIds = requestedTodoIds.filter(
      (todoId) => !screenOrderedIdSet.has(todoId)
    );

    if (
      hasUnexpectedOrderedId ||
      screenOrderedTodoIds.length !== requestedTodoIds.length ||
      unresolvedTodoIds.length > 0
    ) {
      result = {
        status: 'selection_order_unresolved',
        unresolvedTodoIds,
      };
      return;
    }

    const movingTodoIds = screenOrderedTodoIds.filter(
      (todoId) => rowById.get(todoId)?.category_id !== targetCategoryId
    );
    const noOpTodoIds = screenOrderedTodoIds.filter(
      (todoId) => rowById.get(todoId)?.category_id === targetCategoryId
    );

    if (movingTodoIds.length === 0) {
      result = {
        status: 'success',
        movedTodoIds: [],
        noOpTodoIds,
      };
      return;
    }

    const targetOrderRow = await txn.getFirstAsync(
      `SELECT COALESCE(MAX(category_order), 0) AS max_order
       FROM todos
       WHERE deleted_at IS NULL AND category_id = ?`,
      [targetCategoryId]
    );
    const targetMaxOrder = toOrderNumber(targetOrderRow?.max_order);
    const now = new Date().toISOString();
    const movedTodoIds = [];

    for (let index = 0; index < movingTodoIds.length; index += 1) {
      const todoId = movingTodoIds[index];
      const row = rowById.get(todoId);
      const nextCategoryOrder = targetMaxOrder + (index + 1) * ORDER_STEP;
      const updateResult = await txn.runAsync(
        `UPDATE todos
         SET category_id = ?, category_order = ?, updated_at = ?
         WHERE _id = ? AND deleted_at IS NULL`,
        [targetCategoryId, nextCategoryOrder, now, todoId]
      );

      if (typeof updateResult?.changes === 'number' && updateResult.changes !== 1) {
        throw new Error(`bulk move lost todo during transaction: ${todoId}`);
      }

      await addPendingChangeOnConnection(txn, {
        type: 'updateTodo',
        entityId: todoId,
        data: {
          categoryId: targetCategoryId,
          order: {
            custom: toOrderNumber(row.custom_order),
            category: nextCategoryOrder,
            favorite: row.favorite_order == null ? null : toOrderNumber(row.favorite_order),
          },
        },
      });
      movedTodoIds.push(todoId);
    }

    result = {
      status: 'success',
      movedTodoIds,
      noOpTodoIds,
    };
  });

  if (!result) {
    throw new Error('bulk move transaction completed without a result');
  }

  return result;
}
