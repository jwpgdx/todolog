import { todoAPI, completionAPI } from '../../api/todos';
import { getCategories } from '../../api/categories';
import { ensureDatabase } from '../db/database';
import { getAllCategories, upsertCategories, deleteCategory } from '../db/categoryService';
import { upsertTodos, deleteTodos } from '../db/todoService';
import { upsertCompletions, deleteCompletionsByKeys } from '../db/completionService';

function normalizeTodoDeleted(deleted) {
  const source = Array.isArray(deleted) ? deleted : [];
  const seen = new Set();
  const result = [];

  for (const item of source) {
    const id = typeof item === 'string' ? item : item?._id;
    if (!id) continue;
    const value = String(id);
    if (seen.has(value)) continue;
    seen.add(value);
    result.push(value);
  }

  return result;
}

function normalizeTodoUpdated(updated) {
  const source = Array.isArray(updated) ? updated : [];

  return source
    .filter(item => item && item._id)
    .map(item => ({
      _id: String(item._id),
      title: item.title || '',
      memo: item.memo || '',
      categoryId: item.categoryId || null,
      date: item.date || item.startDate || null,
      startDate: item.startDate || item.date || null,
      startTime: item.startTime ?? null,
      endDate: item.endDate || item.date || item.startDate || null,
      endTime: item.endTime ?? null,
      isAllDay: Boolean(item.isAllDay),
      recurrence: item.recurrence ?? null,
      recurrenceEndDate: item.recurrenceEndDate ?? null,
      color: item.color || null,
      createdAt: item.createdAt || item.updatedAt || new Date().toISOString(),
      updatedAt: item.updatedAt || new Date().toISOString(),
      deletedAt: null,
    }));
}

function normalizeCompletionUpdated(updated) {
  const source = Array.isArray(updated) ? updated : [];

  return source
    .filter(item => item && item._id && item.todoId)
    .map(item => ({
      _id: String(item._id),
      todoId: String(item.todoId),
      date: item.date ?? null,
      completedAt: item.completedAt || item.updatedAt || new Date().toISOString(),
      updatedAt: item.updatedAt || null,
    }));
}

function normalizeCompletionDeletedKeys(deleted) {
  const source = Array.isArray(deleted) ? deleted : [];
  const seen = new Set();
  const result = [];

  for (const item of source) {
    if (!item) continue;

    const key =
      typeof item === 'string'
        ? null
        : item.key || (item.todoId ? `${item.todoId}_${item.date || 'null'}` : null);

    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(key);
  }

  return result;
}

function pickLatestSyncTime(values) {
  let maxTs = null;

  for (const value of values) {
    if (!value) continue;
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) continue;
    if (maxTs == null || ts > maxTs) {
      maxTs = ts;
    }
  }

  return maxTs != null ? new Date(maxTs).toISOString() : null;
}

function normalizeCategoryComparable(category) {
  if (!category?._id) return null;
  return {
    _id: String(category._id),
    name: category.name || '',
    color: category.color || null,
    icon: category.icon || null,
    order: category.order ?? category.order_index ?? 0,
    systemKey: category.systemKey || category.system_key || null,
    updatedAt: category.updatedAt || category.updated_at || null,
  };
}

async function applyCategoryFullSnapshot(serverCategories) {
  const categories = Array.isArray(serverCategories) ? serverCategories : [];
  const localActive = await getAllCategories();
  const localMap = new Map(
    localActive
      .map(normalizeCategoryComparable)
      .filter(Boolean)
      .map(category => [category._id, category])
  );
  let updated = 0;

  for (const rawCategory of categories) {
    const normalized = normalizeCategoryComparable(rawCategory);
    if (!normalized) continue;

    const local = localMap.get(normalized._id);
    if (!local) {
      updated += 1;
      continue;
    }

    const same =
      local.name === normalized.name &&
      local.color === normalized.color &&
      local.icon === normalized.icon &&
      local.order === normalized.order &&
      local.systemKey === normalized.systemKey &&
      local.updatedAt === normalized.updatedAt;

    if (!same) {
      updated += 1;
    }
  }

  if (categories.length > 0) {
    await upsertCategories(categories);
  }

  const serverIds = new Set(categories.map(cat => String(cat?._id)).filter(Boolean));
  const toDelete = localActive
    .filter(cat => cat?._id && !serverIds.has(String(cat._id)))
    .map(cat => cat._id);

  for (const categoryId of toDelete) {
    await deleteCategory(categoryId);
  }

  return {
    pulled: categories.length,
    updated,
    deleted: toDelete.length,
    changed: updated > 0 || toDelete.length > 0,
    softDeleted: toDelete.length,
  };
}

function buildFailureResult(message) {
  return {
    ok: false,
    categories: { pulled: 0, updated: 0, deleted: 0, changed: false },
    todos: { updated: 0, deleted: 0 },
    completions: { updated: 0, deleted: 0 },
    serverSyncTime: null,
    lastError: message,
  };
}

/**
 * Delta Pull 실행
 *
 * 순서:
 * 1) category full pull
 * 2) todo delta pull
 * 3) completion delta pull
 * 4) local upsert/deletion apply
 */
export async function runDeltaPull(options = {}) {
  const cursor = options.cursor || options.lastSyncTime || null;

  if (!cursor) {
    return buildFailureResult('cursor(lastSyncTime) is required');
  }

  const cursorTs = Date.parse(cursor);
  if (Number.isNaN(cursorTs)) {
    return buildFailureResult(`invalid cursor(lastSyncTime): ${cursor}`);
  }

  try {
    await ensureDatabase();
    console.log('🔄 [runDeltaPull] 시작:', { cursor });

    // 1) Category full pull
    const serverCategories = await getCategories();
    const categoryResult = await applyCategoryFullSnapshot(serverCategories);
    console.log('📥 [runDeltaPull] category full pull:', categoryResult);

    // 2) Todo delta pull
    const todoResponse = await todoAPI.getDeltaSync(cursor);
    const todoPayload = todoResponse?.data || {};
    const todoUpdated = normalizeTodoUpdated(todoPayload.updated);
    const todoDeleted = normalizeTodoDeleted(todoPayload.deleted);

    if (todoUpdated.length > 0) {
      await upsertTodos(todoUpdated);
    }
    if (todoDeleted.length > 0) {
      await deleteTodos(todoDeleted);
    }

    console.log('📥 [runDeltaPull] todo delta:', {
      updated: todoUpdated.length,
      deleted: todoDeleted.length,
    });

    // 3) Completion delta pull
    const completionResponse = await completionAPI.getDeltaSync(cursor);
    const completionPayload = completionResponse?.data || {};
    const completionUpdated = normalizeCompletionUpdated(completionPayload.updated);
    const completionDeletedKeys = normalizeCompletionDeletedKeys(completionPayload.deleted);

    if (completionUpdated.length > 0) {
      await upsertCompletions(completionUpdated);
    }
    if (completionDeletedKeys.length > 0) {
      await deleteCompletionsByKeys(completionDeletedKeys);
    }

    console.log('📥 [runDeltaPull] completion delta:', {
      updated: completionUpdated.length,
      deleted: completionDeletedKeys.length,
    });

    const serverSyncTime =
      pickLatestSyncTime([todoPayload.syncTime, completionPayload.syncTime]) ||
      new Date().toISOString();

    return {
      ok: true,
      categories: {
        pulled: categoryResult.pulled,
        updated: categoryResult.updated,
        deleted: categoryResult.deleted,
        changed: categoryResult.changed,
      },
      todos: { updated: todoUpdated.length, deleted: todoDeleted.length },
      completions: { updated: completionUpdated.length, deleted: completionDeletedKeys.length },
      serverSyncTime,
      lastError: null,
    };
  } catch (error) {
    console.error('❌ [runDeltaPull] 실패:', error);
    return buildFailureResult(error?.message || 'delta pull failed');
  }
}
