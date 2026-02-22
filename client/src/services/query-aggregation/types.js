/**
 * 공통 조회/집계 레이어 공통 타입(JSDoc)
 * - 화면어댑터 이전 handoff DTO 계약
 * - stale-state 메타 계약
 */

/**
 * @typedef {Object} SyncStatusSnapshot
 * @property {boolean} isSyncing
 * @property {string|null} error
 * @property {string|null} lastSyncTime
 */

/**
 * @typedef {Object} QueryMeta
 * @property {boolean} isStale
 * @property {'sync_in_progress'|'sync_failed'|null} staleReason
 * @property {string|null} lastSyncTime
 */

/**
 * @typedef {Object} TodoCandidateRow
 * @property {string} _id
 * @property {string} title
 * @property {string|null} date
 * @property {string|null} startDate
 * @property {string|null} endDate
 * @property {boolean} isAllDay
 * @property {string|null} startTime
 * @property {string|null} endTime
 * @property {any} recurrence
 * @property {string|null} recurrenceEndDate
 * @property {string|null} categoryId
 * @property {string|null} memo
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {string|null} deletedAt
 * @property {{_id:string|null,name:string|null,color:string|null,icon:string|null}|null} category
 */

/**
 * @typedef {Object} CompletionCandidateRow
 * @property {string} _id
 * @property {string} key
 * @property {string} todoId
 * @property {string|null} date
 * @property {string} completedAt
 */

/**
 * @typedef {Object} AggregatedItem
 * @property {string} todoId
 * @property {string} _id
 * @property {string} title
 * @property {string|null} date
 * @property {string|null} startDate
 * @property {string|null} endDate
 * @property {boolean} isAllDay
 * @property {string|null} startTime
 * @property {string|null} endTime
 * @property {boolean} isRecurring
 * @property {any} recurrence
 * @property {string|null} recurrenceEndDate
 * @property {string|null} memo
 * @property {string|null} categoryId
 * @property {{_id:string|null,name:string|null,color:string|null,icon:string|null}|null} category
 * @property {string} completionKey
 * @property {boolean} completed
 * @property {string|null} completionId
 * @property {string} createdAt
 * @property {string} updatedAt
 */

