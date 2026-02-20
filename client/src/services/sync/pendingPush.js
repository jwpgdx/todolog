import { todoAPI, completionAPI } from '../../api/todos';
import {
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
} from '../../api/categories';
import { ensureDatabase } from '../db/database';
import {
  getPendingChanges,
  getPendingReady,
  removePendingChanges,
  markPendingRetry,
  markPendingDeadLetter,
} from '../db/pendingService';
import { classifySyncError, decidePendingFailureAction } from './syncErrorPolicy';

const LEGACY_TYPE_ALIAS = {
  create: 'createTodo',
  update: 'updateTodo',
  delete: 'deleteTodo',
};

const CREATE_TYPE_BY_KIND = {
  todo: 'createTodo',
  category: 'createCategory',
  completion: 'createCompletion',
};

function normalizePendingType(type) {
  return LEGACY_TYPE_ALIAS[type] || type;
}

function parseCreatedAt(value) {
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function buildNonRetryableError(message, reasonCode = 'non_retryable_local_validation') {
  const error = new Error(message);
  error.syncNonRetryable = true;
  error.reasonCode = reasonCode;
  return error;
}

function getCompletionDate(change) {
  if (change?.data && Object.prototype.hasOwnProperty.call(change.data, 'date')) {
    return change.data.date;
  }
  if (Object.prototype.hasOwnProperty.call(change, 'date')) {
    return change.date;
  }
  return null;
}

function inferIsRecurring(change) {
  if (change?.data && Object.prototype.hasOwnProperty.call(change.data, 'isRecurring')) {
    return change.data.isRecurring;
  }
  // 구버전 pending에서 isRecurring 누락 시 date 존재 여부로 보수 추론
  return getCompletionDate(change) != null;
}

function getKindAndEntityKey(change) {
  const type = normalizePendingType(change.type);
  const data = change.data || {};

  if (type.includes('Todo')) {
    return {
      kind: 'todo',
      entityKey: change.entityId || data._id || data.id || null,
    };
  }

  if (type.includes('Category')) {
    return {
      kind: 'category',
      entityKey: change.entityId || data._id || data.id || null,
    };
  }

  if (type.includes('Completion')) {
    const todoId = data.todoId || data._id || change.todoId || null;
    const date = getCompletionDate(change);
    const keyFromData = todoId ? `${todoId}_${date || 'null'}` : null;
    return {
      kind: 'completion',
      entityKey: keyFromData || change.entityId,
    };
  }

  return { kind: null, entityKey: null };
}

function shouldDeferByPriorCreate({ current, allPending, successfulIds }) {
  const currentType = normalizePendingType(current.type);
  const isDependentType = currentType.startsWith('update') || currentType.startsWith('delete');
  if (!isDependentType) return false;

  const { kind, entityKey } = getKindAndEntityKey(current);
  if (!kind || !entityKey) return false;

  const requiredCreateType = CREATE_TYPE_BY_KIND[kind];
  const currentCreatedAt = parseCreatedAt(current.createdAt);

  for (const candidate of allPending) {
    if (candidate.id === current.id) continue;
    if (successfulIds.has(candidate.id)) continue; // 이번 run에서 성공 처리됨
    if (candidate.status === 'dead_letter') continue;

    const candidateType = normalizePendingType(candidate.type);
    if (candidateType !== requiredCreateType) continue;

    const candidateCreatedAt = parseCreatedAt(candidate.createdAt);
    if (candidateCreatedAt >= currentCreatedAt) continue;

    const candidateKey = getKindAndEntityKey(candidate).entityKey;
    if (!candidateKey || candidateKey !== entityKey) continue;

    return true;
  }

  return false;
}

async function applyPendingChange(change) {
  const type = normalizePendingType(change.type);
  const data = change.data || {};

  switch (type) {
    case 'createTodo': {
      const payload = { ...data };
      if (!payload._id) payload._id = change.entityId || null;
      if (!payload._id) {
        throw buildNonRetryableError('createTodo payload missing _id', 'create_todo_missing_id');
      }
      await todoAPI.createTodo(payload);
      return;
    }
    case 'updateTodo': {
      const id = change.entityId;
      if (!id) {
        throw buildNonRetryableError('updateTodo payload missing entityId', 'update_todo_missing_id');
      }
      await todoAPI.updateTodo(id, data);
      return;
    }
    case 'deleteTodo': {
      const id = change.entityId;
      if (!id) {
        throw buildNonRetryableError('deleteTodo payload missing entityId', 'delete_todo_missing_id');
      }
      await todoAPI.deleteTodo(id);
      return;
    }
    case 'createCategory': {
      const payload = { ...data };
      if (!payload._id) payload._id = change.entityId || null;
      if (!payload._id) {
        throw buildNonRetryableError('createCategory payload missing _id', 'create_category_missing_id');
      }
      await apiCreateCategory(payload);
      return;
    }
    case 'updateCategory': {
      const id = change.entityId;
      if (!id) {
        throw buildNonRetryableError('updateCategory payload missing entityId', 'update_category_missing_id');
      }
      await apiUpdateCategory({ id, data });
      return;
    }
    case 'deleteCategory': {
      const id = change.entityId;
      if (!id) {
        throw buildNonRetryableError('deleteCategory payload missing entityId', 'delete_category_missing_id');
      }
      await apiDeleteCategory(id);
      return;
    }
    case 'createCompletion': {
      const todoId = data.todoId || change.todoId || null;
      if (!todoId) {
        throw buildNonRetryableError('createCompletion payload missing todoId', 'create_completion_missing_todo_id');
      }

      const date = getCompletionDate(change);
      const isRecurring = inferIsRecurring(change);

      const payload = {
        _id: data._id || null,
        todoId,
        date: date || null,
        isRecurring,
      };

      // 구버전 pending 호환: entityId가 completion UUID였던 시점 데이터 복구
      if (!payload._id && change.entityId && !String(change.entityId).includes('_')) {
        payload._id = change.entityId;
      }

      if (!payload._id) {
        throw buildNonRetryableError('createCompletion payload missing _id', 'create_completion_missing_id');
      }

      await completionAPI.createCompletion(payload);
      return;
    }
    case 'deleteCompletion': {
      const todoId = data.todoId || change.todoId || null;
      if (!todoId) {
        throw buildNonRetryableError('deleteCompletion payload missing todoId', 'delete_completion_missing_todo_id');
      }

      const date = getCompletionDate(change);
      const isRecurring = inferIsRecurring(change);

      await completionAPI.deleteCompletion({
        todoId,
        date: date || null,
        isRecurring,
      });
      return;
    }
    default:
      throw buildNonRetryableError(`Unsupported pending type: ${change.type}`, 'unsupported_pending_type');
  }
}

function stringifyFailureMessage({ classification, decision, error }) {
  const reason = decision?.reasonCode || classification?.reasonCode || 'unknown';
  const status = classification?.status ? `status=${classification.status}` : 'status=n/a';
  const message = error?.message || classification?.message || 'Unknown sync error';
  return `[${reason}] ${status} ${message}`;
}

/**
 * Pending Push 실행
 *
 * @param {Object} [options]
 * @param {number} [options.maxItems=200] - 이번 run에서 처리할 ready queue 최대 개수
 * @returns {Promise<{
 *  ok: boolean,
 *  processed: number,
 *  succeeded: number,
 *  failed: number,
 *  deadLetter: number,
 *  deferred: number,
 *  removed: number,
 *  ready: number,
 *  blockingFailure: boolean,
 *  lastError: string|null
 * }>}
 */
export async function runPendingPush(options = {}) {
  const { maxItems = 200 } = options;

  await ensureDatabase();

  const allPending = await getPendingChanges();
  const readyPending = await getPendingReady();
  const queue = readyPending.slice(0, Math.max(0, maxItems));

  const idsToRemove = [];
  const successfulIds = new Set();

  let processed = 0;
  let succeeded = 0;
  let failed = 0;
  let deadLetter = 0;
  let deferred = 0;
  let blockingFailure = false;
  let lastError = null;

  for (const pending of queue) {
    const normalizedType = normalizePendingType(pending.type);
    const current = { ...pending, type: normalizedType };

    if (shouldDeferByPriorCreate({ current, allPending, successfulIds })) {
      deferred += 1;
      continue;
    }

    processed += 1;

    try {
      await applyPendingChange(current);
      idsToRemove.push(current.id);
      successfulIds.add(current.id);
      succeeded += 1;
    } catch (error) {
      const classification = classifySyncError({
        error,
        pendingType: normalizedType,
      });

      const decision = decidePendingFailureAction({
        retryCount: current.retryCount || 0,
        classification,
      });

      const failureMessage = stringifyFailureMessage({ classification, decision, error });

      if (decision.action === 'remove') {
        idsToRemove.push(current.id);
        successfulIds.add(current.id);
        succeeded += 1;
        continue;
      }

      if (decision.action === 'dead_letter') {
        await markPendingDeadLetter(current.id, { lastError: failureMessage });
        failed += 1;
        deadLetter += 1;
        lastError = failureMessage;
        continue;
      }

      await markPendingRetry(current.id, {
        lastError: failureMessage,
        nextRetryAt: decision.nextRetryAt,
        incrementRetryCount: true,
      });

      failed += 1;
      blockingFailure = true;
      lastError = failureMessage;
      break;
    }
  }

  if (idsToRemove.length > 0) {
    await removePendingChanges(idsToRemove);
  }

  return {
    ok: !blockingFailure,
    processed,
    succeeded,
    failed,
    deadLetter,
    deferred,
    removed: idsToRemove.length,
    ready: queue.length,
    blockingFailure,
    lastError,
  };
}
