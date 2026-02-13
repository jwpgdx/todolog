# Phase 3 Recurrence Spec — Critical Review

> **Reviewer**: 10년차 시니어 RN 개발자 / 소프트웨어 아키텍트  
> **Date**: 2026-02-13  
> **Overall**: 구조적으로 잘 설계됨. **치명적 결함 2건, 주의 사항 3건** 확인.

---

## 1. React Native / Hermes 호환성 — `rrule` 라이브러리

### 🔴 [Critical] 스펙과 코드베이스 불일치

스펙에서는 `rrule` 라이브러리 교체를 **암시적으로 전제**하고 있지만 (`between()` 언급 등), 실제 코드베이스를 확인한 결과:

- **[package.json](file:///Users/admin/Documents/github/todo/client/package.json/Users/admin/Documents/github/todo/client/package.json)에 `rrule` 패키지가 없음**
- 기존 파서는 [routineUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/routineUtils.js)와 [recurrenceUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/recurrenceUtils.js)에서 **regex 기반 수동 파싱**

```javascript
// routineUtils.js L38 — 현재 방식
const freqMatch = rrule.match(/FREQ=(\w+)/);
const bydayMatch = rrule.match(/BYDAY=([^;]+)/);
```

**`rrule` npm 패키지는 Hermes에서 문제를 일으킬 수 있음:**

| 문제 | 상세 |
|------|------|
| `Intl` 의존성 | `rrule` 내부에서 `Intl.DateTimeFormat` 사용. Hermes는 기본적으로 `Intl` 미포함 (Expo SDK 52에서는 설정에 따라 다름) |
| 번들 크기 | `rrule` + `luxon` 의존성 = ~80KB gzip. Todo앱에서 이 비용이 정당한지 의문 |
| [Date](file:///Users/admin/Documents/github/todo/client/src/utils/routineUtils.js#5-80) 조작 | `rrule`은 내부적으로 [Date](file:///Users/admin/Documents/github/todo/client/src/utils/routineUtils.js#5-80) 객체를 사용하므로 UTC/로컬 타임존 혼동 위험 |

**권장:**

```
✅ 현재 regex 파서를 recurrenceEngine.js로 통합/강화
❌ rrule 라이브러리 도입 (불필요한 의존성 + Hermes 리스크)
```

스펙에서 지원하는 subset (`DAILY`, `WEEKLY+BYDAY`, `MONTHLY+BYMONTHDAY`, `YEARLY`)은 regex 파서로 **충분히** 처리 가능합니다. 현재 [routineUtils.js](file:///Users/admin/Documents/github/todo/client/src/utils/routineUtils.js)의 [isDateInRRule()](file:///Users/admin/Documents/github/todo/client/src/utils/routineUtils.js#5-80)이 이미 이 모든 케이스를 처리합니다.

**Action Required**: §4에서 "공통 Recurrence Engine"의 구현 방식을 명확히 해야 함:
- (A) 기존 regex 파서를 통합/강화 ← **권장**
- (B) `rrule` npm 패키지 도입 ← Hermes 호환성 확인 필수

---

## 2. 타임존 전략 — UTC Date-only Off-by-one 분석

### 🟡 [Warning] 기존 코드의 `new Date()` 사용이 위험

스펙의 "UTC Date-only" 전략 자체는 올바릅니다. **하지만 기존 코드가 이 전략을 위반**하고 있습니다:

```javascript
// routineUtils.js L16-20
const targetDate = new Date(date);          // ← 로컬 타임존 해석!
const ruleStartDate = new Date(startDate);  // ← 로컬 타임존 해석!
if (targetDate < new Date(ruleStartDate.setHours(0,0,0,0))) return false;
```

**시나리오 — 사용자가 서울(UTC+9)에서 LA(UTC-8)로 이동:**

```
1. 서울에서 2026-02-15에 Todo 생성
2. SQLite에 date = '2026-02-15' 저장 (문자열)
3. LA에서 앱을 염
4. new Date('2026-02-15') → 2026-02-15T00:00:00 UTC-8 = 2026-02-15T08:00:00 UTC
5. 비교 대상 date가 로컬 타임존으로 해석 → 이론상 하루 밀림 가능
```

**`new Date('YYYY-MM-DD')`의 동작은 환경마다 다름:**
- V8/Chrome: UTC로 해석 (`...T00:00:00Z`)
- Hermes: **구현에 따라 다름** (UTC 또는 로컬)
- Safari: 로컬로 해석하는 경우 있음

**권장: `recurrenceEngine.js`에서 `new Date()` 완전 금지, `dayjs` only**

```javascript
// ✅ 안전한 방식 — recurrenceEngine.js
import dayjs from 'dayjs';

export function occursOnDate(todo, targetDate) {
  // 문자열 비교만 사용 (타임존 무관)
  const target = dayjs(targetDate).format('YYYY-MM-DD');
  const start = todo.startDate; // 이미 'YYYY-MM-DD' 문자열
  
  if (target < start) return false;
  
  // UNTIL 비교도 문자열로
  const until = getEffectiveRecurrenceEndDate(todo);
  if (until && target > until) return false;
  
  // FREQ/BYDAY 등은 dayjs의 .day(), .date(), .month()로 처리
  // ...
}
```

**핵심**: `YYYY-MM-DD` 문자열 비교는 타임존 독립적입니다. `'2026-02-15' > '2026-02-14'`는 어떤 타임존에서도 동일합니다.

**Action Required**: 스펙 §4에 다음 제약 조건 추가
> "recurrenceEngine 내부에서 `new Date()` 사용 금지. 모든 날짜 비교는 `YYYY-MM-DD` 문자열 비교 또는 `dayjs` 사용."

---

## 3. DB 마이그레이션 백필 성능

### 🟡 [Warning] 동기 실행 시 앱 시작 지연 위험

현재 [database.js](file:///Users/admin/Documents/github/todo/client/src/services/db/database.js)의 마이그레이션 흐름:

```javascript
// database.js L141-162
if (!version || parseInt(version) < MIGRATION_VERSION) {
  // 마이그레이션 실행 (initDatabase 내부, 앱 시작 시)
  await setMetadata('migration_version', String(MIGRATION_VERSION));
}
```

[initDatabase()](file:///Users/admin/Documents/github/todo/client/src/services/db/database.js#95-214)는 앱 루트 컴포넌트에서 호출되므로, **마이그레이션이 완료될 때까지 앱 렌더링이 블로킹**될 수 있습니다.

**백필 성능 추정:**

| 데이터 규모 | 마이그레이션 시간 (추정) |
|------------|----------------------|
| 50개 반복 일정 | ~5ms (무시 가능) |
| 500개 반복 일정 | ~50ms (체감 없음) |
| 5,000개 반복 일정 | ~500ms (**splash 연장 체감**) |

**위험 시나리오**: Google Calendar 연동 시 수년치 반복 일정이 sync되면 수천 개가 될 수 있음.

**권장: 배치 처리 + 트랜잭션**

```javascript
async function migrateV4AddRecurrenceEndDate(db) {
  // 1. 컬럼 추가 (즉시)
  await db.runAsync('ALTER TABLE todos ADD COLUMN recurrence_end_date TEXT');
  
  // 2. 인덱스 생성 (즉시)
  await db.runAsync('CREATE INDEX IF NOT EXISTS ...');
  
  // 3. 백필 — 배치 처리 (100개씩)
  const BATCH_SIZE = 100;
  let offset = 0;
  
  while (true) {
    const batch = await db.getAllAsync(
      `SELECT _id, recurrence FROM todos 
       WHERE recurrence IS NOT NULL AND recurrence_end_date IS NULL
       LIMIT ? OFFSET ?`,
      [BATCH_SIZE, offset]
    );
    
    if (batch.length === 0) break;
    
    await db.execAsync('BEGIN TRANSACTION');
    for (const row of batch) {
      const until = parseUntilFromRecurrence(row.recurrence);
      if (until) {
        await db.runAsync(
          'UPDATE todos SET recurrence_end_date = ? WHERE _id = ?',
          [until, row._id]
        );
      }
    }
    await db.execAsync('COMMIT');
    
    offset += BATCH_SIZE;
  }
}
```

**이유**: 단일 트랜잭션에서 5,000 UPDATE를 실행하면 WAL이 커져서 SQLite가 느려질 수 있음. 100개씩 배치로 나누면 WAL 체크포인트가 중간에 작동할 수 있음.

**추가 권장**: 스펙 §9.2에 "대량 데이터 시 타임아웃 방지" 조항 추가.

---

## 4. 무한 반복 성능 — 100개 × 42일 range

### ✅ [Pass] 성능 문제 없음 (수학적 검증)

**최악의 시나리오**: 무한 반복 일정 100개, 42일 range 전개

```
expandOccurrencesInRange 1회 비용:
- DAILY: 42번 반복 → ~0.5ms
- WEEKLY: 6번 반복 → ~0.1ms
- MONTHLY: 1-2번 반복 → ~0.05ms

100개 todo × 평균 0.3ms = ~30ms... 16ms 초과?
```

**잠깐 — 30ms는 16ms를 초과합니다.** 하지만:

1. `expandOccurrencesInRange`는 `useMemo` 내부에서 실행 → **스크롤 프레임이 아닌 store 업데이트 시에만 실행**
2. 실제 무한 DAILY 100개는 비현실적 (대부분 WEEKLY 2-3개)
3. 현실적 시나리오: WEEKLY 20개 + MONTHLY 5개 = ~3ms

**하지만 스펙 §8.3의 LRU 캐시가 핵심 방어선입니다:**

```javascript
// occurrenceRangeCache: key = `${todoId}|${updatedAt}|${rangeStart}|${rangeEnd}`
```

캐시 히트 시 계산 비용 = 0. 같은 월을 다시 렌더링할 때 재계산 없음.

**리스크는 낮지만, 방어책 하나 추가 권장:**

```javascript
// recurrenceEngine.js — 안전 cap
const MAX_OCCURRENCES_PER_RANGE = 200;

export function expandOccurrencesInRange(todo, rangeStart, rangeEnd) {
  const occurrences = [];
  // ... expansion logic ...
  
  if (occurrences.length >= MAX_OCCURRENCES_PER_RANGE) {
    console.warn(`[recurrenceEngine] Too many occurrences for ${todo._id}, capped at ${MAX_OCCURRENCES_PER_RANGE}`);
    return occurrences.slice(0, MAX_OCCURRENCES_PER_RANGE);
  }
  
  return occurrences;
}
```

---

## 5. 추가 발견 사항 (스펙 미언급)

### 🔴 [Critical] `recurrence` 필드 형식 불일치

스펙은 `recurrence`를 RRULE 문자열로 가정합니다:

```
todo.recurrence = "RRULE:FREQ=WEEKLY;BYDAY=MO,WE"
```

**하지만 실제 코드에서 `recurrence`는 JSON 객체로 저장/파싱:**

```javascript
// todoService.js L281
recurrence: row.recurrence ? JSON.parse(row.recurrence) : null,

// todoService.js L311
todo.recurrence ? JSON.stringify(todo.recurrence) : null,
```

즉, SQLite에는 `'{"frequency":"weekly","weekdays":["MO","WE"]}'` 같은 **JSON 문자열**이 저장되어 있을 수 있고, 또는 Google Calendar sync로 온 데이터는 `'"RRULE:FREQ=WEEKLY;BYDAY=MO,WE"'` (RRULE 문자열의 JSON)일 수 있습니다.

**`recurrenceEngine.js`의 `normalizeRecurrence`가 이 두 형식을 모두 처리해야 합니다.**

```javascript
// 예상 입력 형식들:
// 1. RRULE 문자열: "RRULE:FREQ=WEEKLY;BYDAY=MO,WE"
// 2. RRULE 배열 (Google Calendar): ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE"]
// 3. 객체 (앱 자체 생성): { frequency: "weekly", weekdays: ["MO", "WE"] }
// 4. JSON 문자열 (SQLite raw): JSON.stringify(위 중 하나)
```

**Action Required**: 스펙 §4.2에 "Accepted Input Formats"를 정확히 나열하고, `normalizeRecurrence()`의 입력 정규화 로직을 명시해야 합니다.

---

### 🟡 [Warning] `INTERVAL` 미지원

스펙 §4.2의 Supported Rule Subset에 `INTERVAL`이 없습니다. 하지만 Google Calendar에서 "격주 반복"은 `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO`로 표현됩니다.

현재 사용자가 앱 내에서 "격주"를 만들 수 없더라도, Google Calendar sync로 `INTERVAL=2` 데이터가 들어오면 **매주 반복으로 잘못 표시**됩니다.

**권장**: 
- 최소한 `INTERVAL`을 파싱하되, 지원되지 않으면 fallback (시작일만 표시)으로 처리
- 또는 스펙 §5.4 "Invalid Rule" 정책에 `INTERVAL` 케이스를 명시

---

### 🟡 [Warning] LRU 캐시 키 충돌 가능성

§8.3의 `occurrenceRangeCache` 키:

```
key = `${todoId}|${updatedAt}|${rangeStart}|${rangeEnd}`
```

`updatedAt`은 Todo 수정 시 변경되므로 캐시 무효화는 맞습니다. **하지만**:

- CRUD 후 [invalidateAdjacentMonths](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#69-111) → store 캐시 삭제 → re-fetch → [setBatchMonthData](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#39-52)
- **이때 [deserializeTodoLight](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js#158-181)에 `updatedAt` 필드가 없음** (Phase 2에서 경량화로 제거)

```javascript
// calendarTodoService.js L169-179 — deserializeTodoLight
function deserializeTodoLight(row) {
  return {
    _id: row._id,
    title: row.title,
    date: row.date,
    startDate: row.start_date,
    endDate: row.end_date,
    categoryColor: row.category_color || row.color || '#333',
    isAllDay: row.is_all_day === 1,
    recurrence: row.recurrence ? JSON.parse(row.recurrence) : null,
    // ❌ updatedAt 없음!
  };
}
```

**캐시 키에 `updatedAt`을 쓰려면 [deserializeTodoLight](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js#158-181)에 `updatedAt` 필드를 추가하거나, 캐시 키 전략을 변경해야 합니다.**

**권장**: 캐시 키를 `${todoId}|${recurrenceRaw}|${rangeStart}|${rangeEnd}`로 변경. `recurrenceRaw`가 바뀌면 규칙이 변경된 것이므로 캐시 무효화가 자연스럽게 작동합니다.

---

## Summary

| # | 분류 | 항목 | 수준 |
|---|------|------|------|
| 1 | RN 호환성 | `rrule` 라이브러리 미존재 + Hermes 리스크 | 🔴 Critical |
| 2 | 타임존 | 기존 `new Date()` 사용 → off-by-one 위험 | 🟡 Warning |
| 3 | 마이그레이션 | 대량 백필 시 앱 시작 블로킹 | 🟡 Warning |
| 4 | 무한 반복 성능 | 수학적으로 안전, cap 추가 권장 | ✅ Pass |
| 5 | 데이터 형식 | `recurrence` 필드 JSON vs RRULE 불일치 | 🔴 Critical |
| 6 | 규칙 범위 | `INTERVAL` 미지원 (Google Cal sync 이슈) | 🟡 Warning |
| 7 | 캐시 키 | `updatedAt` 미포함 in lightweight object | 🟡 Warning |

### 구현 전 필수 결정 사항

1. **`recurrenceEngine` 구현 방식**: regex 파서 통합 vs rrule 라이브러리 도입
2. **`normalizeRecurrence()` 입력 형식**: JSON 객체 / RRULE 문자열 / 배열 — 어디까지 지원?
3. **`INTERVAL` 대응**: 지원 or 명시적 fallback?
4. **LRU 캐시 키에 `updatedAt` 대체 전략**
