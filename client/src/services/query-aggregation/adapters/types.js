/**
 * 화면어댑터 레이어 타입 계약 (JSDoc)
 * Spec owner: .kiro/specs/screen-adapter-layer/
 *
 * 목적:
 * - 공통 조회/집계 레이어(handoff DTO + meta) 입력 계약 고정
 * - 화면별 adapter 출력 계약(Phase A 기준) 명시
 */

/**
 * @typedef {Object} AdapterMeta
 * @property {boolean} isStale
 * @property {'sync_in_progress'|'sync_failed'|null} staleReason
 * @property {string|null} lastSyncTime
 */

/**
 * 공통 레이어 단일일자 결과(성공 케이스) 입력 계약
 * @typedef {Object} HandoffDateResult
 * @property {true} ok
 * @property {'date'} mode
 * @property {string} targetDate
 * @property {Array<AggregatedItem>} items
 * @property {AdapterMeta} meta
 * @property {{candidate:number,decided:number,aggregated:number}} stage
 * @property {{totalMs:number,candidateMs:number,decisionMs:number,aggregationMs:number}} elapsed
 * @property {{completionCandidates:number,invalidRecurrenceCount:number}} diagnostics
 */

/**
 * 공통 레이어 범위 결과(성공 케이스) 입력 계약
 * @typedef {Object} HandoffRangeResult
 * @property {true} ok
 * @property {'range'} mode
 * @property {{startDate:string,endDate:string}} range
 * @property {Record<string, Array<AggregatedItem>>} itemsByDate
 * @property {AdapterMeta} meta
 * @property {{candidate:number,decided:number,aggregated:number}} stage
 * @property {{totalMs:number,candidateMs:number,decisionMs:number,aggregationMs:number}} elapsed
 * @property {{completionCandidates:number,invalidRecurrenceCount:number}} diagnostics
 */

/**
 * 공통 레이어 집계 item 입력 계약
 * - Phase A에서는 호환 필드 passthrough를 허용한다.
 *
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
 * @property {string|null} [startDateTime]
 * @property {string|null} [endDateTime]
 * @property {string} [occurrenceDate]
 */

/**
 * TodoScreen adapter 출력 계약 (Phase A)
 * - day list 렌더에 필요한 필드 + 호환 필드 passthrough 허용
 *
 * @typedef {Object} TodoScreenItem
 * @property {string} _id
 * @property {string} todoId
 * @property {string} title
 * @property {boolean} completed
 * @property {string} completionKey
 * @property {string|null} completionId
 * @property {string|null} categoryId
 * @property {{_id:string|null,name:string|null,color:string|null,icon:string|null}|null} category
 * @property {string|null} date
 * @property {string|null} startDate
 * @property {string|null} endDate
 * @property {boolean} isAllDay
 * @property {string|null} startTime
 * @property {string|null} endTime
 * @property {string|null} startDateTime
 * @property {string|null} endDateTime
 * @property {boolean} isRecurring
 * @property {any} recurrence
 * @property {string|null} recurrenceEndDate
 * @property {string|null} memo
 * @property {string} [createdAt]
 * @property {string} [updatedAt]
 */

/**
 * TodoCalendar adapter 브릿지 출력 계약 (기존 store shape)
 *
 * @typedef {Object} TodoCalendarBridgeResult
 * @property {Record<string, Array<AggregatedItem>>} itemsByDate
 * @property {Record<string, {visibleLimit:number,totalCount:number,overflowCount:number}>} dayMetaByDate
 * @property {Record<string, Array<Object>>} todosByMonth
 * @property {Record<string, Record<string, Object>>} completionsByMonth
 */

/**
 * StripCalendar adapter 출력 계약
 *
 * @typedef {Object} StripDaySummary
 * @property {string} date
 * @property {boolean} hasTodo
 * @property {Array<string>} uniqueCategoryColors
 * @property {number} dotCount
 * @property {number} [maxDots]
 * @property {number} [overflowCount]
 */

/**
 * @typedef {Object} StripCalendarAdapterResult
 * @property {Record<string, StripDaySummary>} summariesByDate
 */
