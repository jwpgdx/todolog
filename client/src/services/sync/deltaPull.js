import { todoAPI, completionAPI } from '../../api/todos';
import { getCategories } from '../../api/categories';
import { ensureDatabase, withWriteTransaction } from '../db/database';
import { getAllCategories, upsertCategories, deleteCategory } from '../db/categoryService';
import { upsertTodos, deleteTodos } from '../db/todoService';
import { upsertCompletions, deleteCompletionsByKeys } from '../db/completionService';
import { getPendingChanges } from '../db/pendingService';

function isActivePending(change) {
  return change?.status === 'pending' || change?.status === 'failed';
}

function buildPendingBlockedError(count) {
  const error = new Error(`Delta pull blocked by ${count} active pending change(s)`);
  error.code = 'DELTA_PULL_PENDING_NOT_DRAINED';
  return error;
}

function validateDeltaPayload(name, payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error(`${name} delta payload is invalid`);
  }
  if (!Array.isArray(payload.updated) || !Array.isArray(payload.deleted)) {
    throw new Error(`${name} delta payload must include updated/deleted arrays`);
  }
  if (!payload.syncTime || Number.isNaN(Date.parse(payload.syncTime))) {
    throw new Error(`${name} delta payload has invalid syncTime`);
  }
}

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
      order: {
        custom: item?.order?.custom ?? 0,
        category: item?.order?.category ?? 0,
        favorite: item?.order?.favorite ?? null,
      },
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

function pickSafeSyncTime(values) {
  let minTs = null;

  for (const value of values) {
    if (!value) continue;
    const ts = Date.parse(value);
    if (Number.isNaN(ts)) continue;
    if (minTs == null || ts < minTs) {
      minTs = ts;
    }
  }

  return minTs != null ? new Date(minTs).toISOString() : null;
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

async function applyCategoryFullSnapshot(serverCategories, connection) {
  const categories = serverCategories;
  const localActive = await getAllCategories(connection);
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
    await upsertCategories(categories, connection);
  }

  const serverIds = new Set(categories.map(cat => String(cat?._id)).filter(Boolean));
  const toDelete = localActive
    .filter(cat => cat?._id && !serverIds.has(String(cat._id)))
    .map(cat => cat._id);

  for (const categoryId of toDelete) {
    await deleteCategory(categoryId, connection);
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

    // A backoff/deferred/unprocessed local intent must never be overwritten by pull.
    const pendingBeforeNetwork = (await getPendingChanges()).filter(isActivePending);
    if (pendingBeforeNetwork.length > 0) {
      throw buildPendingBlockedError(pendingBeforeNetwork.length);
    }

    // Fetch every remote surface before mutating local SQLite. This prevents a
    // later request failure from leaving a partially-applied pull behind.
    const serverCategories = await getCategories();
    if (!Array.isArray(serverCategories)) {
      throw new Error('Category full snapshot must be an array');
    }

    const todoResponse = await todoAPI.getDeltaSync(cursor);
    const todoPayload = todoResponse?.data || {};
    validateDeltaPayload('Todo', todoPayload);
    const todoUpdated = normalizeTodoUpdated(todoPayload.updated);
    const todoDeleted = normalizeTodoDeleted(todoPayload.deleted);

    const completionResponse = await completionAPI.getDeltaSync(cursor);
    const completionPayload = completionResponse?.data || {};
    validateDeltaPayload('Completion', completionPayload);
    const completionUpdated = normalizeCompletionUpdated(completionPayload.updated);
    const completionDeletedKeys = normalizeCompletionDeletedKeys(completionPayload.deleted);

    // Requests are sequential, so a later endpoint can have a later bounded
    // watermark. Commit the earliest one; later endpoints safely replay their
    // overlap on the next sync instead of making earlier-endpoint changes fall
    // into an unqueryable gap.
    const serverSyncTime = pickSafeSyncTime([todoPayload.syncTime, completionPayload.syncTime]);
    if (!serverSyncTime) {
      throw new Error('Delta pull did not produce a valid server sync time');
    }
    if (Date.parse(serverSyncTime) < cursorTs) {
      throw new Error(`Delta pull server sync time moved backwards: ${serverSyncTime}`);
    }

    const applyResult = await withWriteTransaction(async (transaction) => {
      // Re-check on the same exclusive native write connection used by apply.
      // A local mutation that appeared during the network window blocks the
      // pull; a mutation that starts after this transaction waits until apply
      // is complete and therefore cannot be overwritten by this response.
      const pendingBeforeApply = (await getPendingChanges(transaction)).filter(isActivePending);
      if (pendingBeforeApply.length > 0) {
        throw buildPendingBlockedError(pendingBeforeApply.length);
      }

      const categoryResult = await applyCategoryFullSnapshot(serverCategories, transaction);
      await upsertTodos(todoUpdated, transaction);
      await deleteTodos(todoDeleted, transaction);
      await upsertCompletions(completionUpdated, transaction);
      await deleteCompletionsByKeys(completionDeletedKeys, transaction);

      return { categoryResult };
    });

    const categoryResult = applyResult.categoryResult;
    console.log('📥 [runDeltaPull] category full pull:', categoryResult);
    console.log('📥 [runDeltaPull] todo delta:', {
      updated: todoUpdated.length,
      deleted: todoDeleted.length,
    });
    console.log('📥 [runDeltaPull] completion delta:', {
      updated: completionUpdated.length,
      deleted: completionDeletedKeys.length,
    });

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
