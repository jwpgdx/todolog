/**
 * Sync Error Policy
 * - Pending Push 단계에서 사용하는 공통 에러 분류/재시도 정책 모듈
 * - Task 6: error classification + backoff + max retry policy
 */

export const RETRY_SCHEDULE_MS = [30 * 1000, 2 * 60 * 1000, 10 * 60 * 1000];
export const MAX_RETRY_COUNT = RETRY_SCHEDULE_MS.length; // 3회 재시도 허용, 4회차부터 dead_letter

const DELETE_PENDING_TYPES = new Set(['deleteTodo', 'deleteCategory', 'deleteCompletion']);

function isDeleteType(type) {
  return DELETE_PENDING_TYPES.has(type);
}

function getHttpStatus(error) {
  return error?.response?.status ?? null;
}

function getErrorCode(error) {
  return error?.code ?? null;
}

function getErrorMessage(error) {
  return error?.message || 'Unknown sync error';
}

function isNetworkLikeError(error) {
  const code = getErrorCode(error);
  const message = getErrorMessage(error).toLowerCase();

  if (!error?.response) return true; // axios에서 response 없음 = 네트워크 계열

  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ETIMEDOUT') {
    return true;
  }

  return (
    message.includes('network error') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('socket hang up')
  );
}

/**
 * 에러를 정책 기준으로 분류한다.
 *
 * @param {Object} params
 * @param {Error} params.error
 * @param {string} params.pendingType - ex) createTodo, deleteCompletion ...
 * @returns {{
 *  category: 'network'|'server_5xx'|'validation_4xx'|'delete_404'|'unknown',
 *  retryable: boolean,
 *  successEquivalent: boolean,
 *  reasonCode: string,
 *  status: number|null,
 *  message: string
 * }}
 */
export function classifySyncError({ error, pendingType }) {
  const status = getHttpStatus(error);
  const message = getErrorMessage(error);

  if (error?.syncNonRetryable === true) {
    return {
      category: 'validation_4xx',
      retryable: false,
      successEquivalent: false,
      reasonCode: error.reasonCode || 'non_retryable_local_validation',
      status,
      message,
    };
  }

  // 1) network/offline/timeout -> retryable
  if (isNetworkLikeError(error)) {
    return {
      category: 'network',
      retryable: true,
      successEquivalent: false,
      reasonCode: 'network_or_timeout',
      status,
      message,
    };
  }

  // 2) 5xx -> retryable
  if (typeof status === 'number' && status >= 500) {
    return {
      category: 'server_5xx',
      retryable: true,
      successEquivalent: false,
      reasonCode: 'server_5xx',
      status,
      message,
    };
  }

  // 3) 404 delete -> endpoint policy
  if (status === 404 && isDeleteType(pendingType)) {
    // completion delete의 not-found는 success-equivalent 정책
    if (pendingType === 'deleteCompletion') {
      return {
        category: 'delete_404',
        retryable: false,
        successEquivalent: true,
        reasonCode: 'completion_delete_not_found_success_equivalent',
        status,
        message,
      };
    }

    // todo/category delete의 404는 unknown id로 보고 non-retry
    return {
      category: 'delete_404',
      retryable: false,
      successEquivalent: false,
      reasonCode: 'delete_not_found_unknown_id',
      status,
      message,
    };
  }

  // 4) 4xx validation -> non-retry (dead-letter)
  if (typeof status === 'number' && status >= 400 && status < 500) {
    return {
      category: 'validation_4xx',
      retryable: false,
      successEquivalent: false,
      reasonCode: 'validation_4xx',
      status,
      message,
    };
  }

  // fallback: 분류 불가 에러는 retryable로 취급(최대 재시도로 안전장치)
  return {
    category: 'unknown',
    retryable: true,
    successEquivalent: false,
    reasonCode: 'unknown_retryable',
    status,
    message,
  };
}

/**
 * retryCount(다음 시도 번호) 기준 백오프(ms) 계산
 * - retryCount=1 -> 30s
 * - retryCount=2 -> 2m
 * - retryCount=3 -> 10m
 * - retryCount>=4 -> null (dead_letter 대상)
 */
export function getBackoffMsForRetryCount(retryCount) {
  if (retryCount <= 0) return 0;
  if (retryCount > MAX_RETRY_COUNT) return null;
  return RETRY_SCHEDULE_MS[retryCount - 1];
}

export function getNextRetryAtIso(retryCount, nowMs = Date.now()) {
  const backoffMs = getBackoffMsForRetryCount(retryCount);
  if (backoffMs == null) return null;
  return new Date(nowMs + backoffMs).toISOString();
}

/**
 * 분류 결과 + 현재 retryCount를 기반으로 pending 처리 액션을 결정한다.
 *
 * @param {Object} params
 * @param {number} params.retryCount - 현재 누적 retry_count
 * @param {ReturnType<typeof classifySyncError>} params.classification
 * @param {number} [params.nowMs]
 * @returns {{
 *  action: 'remove'|'retry'|'dead_letter',
 *  nextRetryCount: number,
 *  nextRetryAt: string|null,
 *  lastError: string,
 *  reasonCode: string,
 *  classificationCategory: string
 * }}
 */
export function decidePendingFailureAction({ retryCount = 0, classification, nowMs = Date.now() }) {
  const safeRetryCount = Number.isFinite(retryCount) ? retryCount : 0;
  const lastError = classification?.message || 'Unknown sync error';
  const reasonCode = classification?.reasonCode || 'unknown';
  const classificationCategory = classification?.category || 'unknown';

  // success-equivalent: pending 제거
  if (classification?.successEquivalent) {
    return {
      action: 'remove',
      nextRetryCount: safeRetryCount,
      nextRetryAt: null,
      lastError,
      reasonCode,
      classificationCategory,
    };
  }

  // non-retryable: 즉시 dead_letter
  if (!classification?.retryable) {
    return {
      action: 'dead_letter',
      nextRetryCount: safeRetryCount,
      nextRetryAt: null,
      lastError,
      reasonCode,
      classificationCategory,
    };
  }

  // retryable: 백오프 스케줄 계산
  const nextRetryCount = safeRetryCount + 1;
  const nextRetryAt = getNextRetryAtIso(nextRetryCount, nowMs);

  if (!nextRetryAt) {
    return {
      action: 'dead_letter',
      nextRetryCount,
      nextRetryAt: null,
      lastError,
      reasonCode: 'max_retry_exceeded',
      classificationCategory,
    };
  }

  return {
    action: 'retry',
    nextRetryCount,
    nextRetryAt,
    lastError,
    reasonCode,
    classificationCategory,
  };
}
