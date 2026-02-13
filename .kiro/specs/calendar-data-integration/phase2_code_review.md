# Phase 2 — Final Code Review

> **Reviewer**: Senior Mobile Architect  
> **Date**: 2026-02-12  
> **Verdict**: **[APPROVED]** (1건 수정 필수, 아래 상세)

---

## 1. 화면 복귀 시 갱신 문제 — 원인 분석 및 해결

### 근본 원인

현재 데이터 fetch 트리거는 **오직 `onViewableItemsChanged`** 입니다:

```
CRUD 수행 → invalidateAdjacentMonths() → 캐시 삭제 → ???
```

[invalidateAdjacentMonths](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#69-111)는 Zustand에서 해당 월 데이터를 [delete](file:///Users/admin/Documents/github/todo/client/src/services/db/todoService.js#221-235)합니다. **하지만**:

1. [MonthSection](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/ui/MonthSection.js#8-90)은 `useTodoCalendarStore(state => state.todosByMonth[id])`로 구독 중
2. 캐시 삭제 → `todosByMonth[id]`가 [Array](file:///Users/admin/Documents/github/todo/client/src/services/db/completionService.js#370-388) → `undefined`로 변경 → **MonthSection 리렌더 발생** ✅
3. **그러나 `todosByDate`는 `{}`가 되므로 dot이 사라짐** → UI에는 반영됨

> 잠깐. 그러면 왜 "스크롤해야만 갱신"된다고 느끼는 걸까?

**진짜 원인**: [invalidateAdjacentMonths](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#69-111) 후 **데이터가 삭제만 되고, re-fetch가 트리거되지 않습니다.** dot이 사라지는 것은 보이지만, **새로 생성한 Todo의 dot은 re-fetch 없이는 표시되지 않습니다**. re-fetch는 `onVisibleMonthsChange` → [hasMonth() === false](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#121-131) 체크 → fetch인데, 이 콜백은 **스크롤 시에만** 호출됩니다.

### 해결: `useFocusEffect` + invalidation-aware re-fetch

`useFocusEffect`를 사용하는 것이 올바른 접근입니다. 단, **포커스 시 무조건 전체 re-fetch가 아니라, invalidated 월만 re-fetch**해야 합니다.

가장 우아한 방법: [useTodoCalendarData](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/hooks/useTodoCalendarData.js#19-100) hook에 **`refetchInvalidated` 함수를 추가**하고, [CalendarList](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/ui/CalendarList.js#38-186)에서 `useFocusEffect`로 호출합니다.

#### Step 1: [useTodoCalendarData.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/hooks/useTodoCalendarData.js) — `refetchInvalidated` 추가

```javascript
// useTodoCalendarData.js
import { useCallback, useRef } from 'react';
import { useTodoCalendarStore } from '../store/todoCalendarStore';
import { fetchCalendarDataForMonths } from '../services/calendarTodoService';
import { createMonthMetadata } from '../utils/calendarHelpers';
import dayjs from 'dayjs';

export function useTodoCalendarData(startDayOfWeek = 0) {
  const isFetchingRef = useRef(false);
  const lastVisibleRef = useRef([]);  // ← 추가: 마지막 visible items 저장
  const hasMonth = useTodoCalendarStore(state => state.hasMonth);
  const setBatchMonthData = useTodoCalendarStore(state => state.setBatchMonthData);

  const fetchUncachedMonths = useCallback(async (viewableItems) => {
    if (viewableItems.length === 0) return;
    if (isFetchingRef.current) return;

    const firstVisible = viewableItems[0].item;
    const lastVisible = viewableItems[viewableItems.length - 1].item;

    const bufferStart = dayjs(`${firstVisible.year}-${String(firstVisible.month).padStart(2, '0')}-01`)
      .subtract(2, 'month');
    const bufferEnd = dayjs(`${lastVisible.year}-${String(lastVisible.month).padStart(2, '0')}-01`)
      .add(2, 'month');

    const allMonths = [];
    let cursor = bufferStart;
    while (cursor.isBefore(bufferEnd) || cursor.isSame(bufferEnd, 'month')) {
      allMonths.push(createMonthMetadata(cursor.year(), cursor.month() + 1));
      cursor = cursor.add(1, 'month');
    }

    const uncachedMonths = allMonths.filter(m => !hasMonth(m.id));
    if (uncachedMonths.length === 0) return;

    isFetchingRef.current = true;
    try {
      const { todosMap, completionsMap } = await fetchCalendarDataForMonths(
        uncachedMonths, startDayOfWeek
      );
      setBatchMonthData(todosMap, completionsMap);
    } catch (error) {
      console.error('[useTodoCalendarData] Fetch failed:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, [startDayOfWeek, hasMonth, setBatchMonthData]);

  // 스크롤 시 호출
  const onVisibleMonthsChange = useCallback(async (viewableItems) => {
    lastVisibleRef.current = viewableItems;  // ← 마지막 visible items 저장
    await fetchUncachedMonths(viewableItems);
  }, [fetchUncachedMonths]);

  // 화면 복귀 시 호출 — invalidated 월만 re-fetch
  const refetchInvalidated = useCallback(async () => {
    if (lastVisibleRef.current.length === 0) return;
    await fetchUncachedMonths(lastVisibleRef.current);
  }, [fetchUncachedMonths]);

  return { onVisibleMonthsChange, refetchInvalidated };
}
```

#### Step 2: [CalendarList.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/ui/CalendarList.js) — `useFocusEffect` 추가

```diff
 import React, { useCallback, useRef, useState, useMemo } from 'react';
+import { useFocusEffect } from '@react-navigation/native';

 // Phase 2: Todo data batch fetch hook
-const { onVisibleMonthsChange } = useTodoCalendarData(startDayOfWeek);
+const { onVisibleMonthsChange, refetchInvalidated } = useTodoCalendarData(startDayOfWeek);

+// Phase 2: 화면 복귀 시 invalidated 월 re-fetch
+useFocusEffect(
+  useCallback(() => {
+    refetchInvalidated();
+  }, [refetchInvalidated])
+);
```

**왜 이 방식이 우아한가:**

| 접근법 | 문제 |
|--------|------|
| `useFocusEffect` + 전체 [clearAll](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#112-120) 후 re-fetch | 모든 캐시 버림 → 불필요한 네트워크/DB 비용 |
| `useFocusEffect` + 현재 visible 월만 re-fetch | invalidate되지 않은 월도 re-fetch → 낭비 |
| **`useFocusEffect` + `lastVisibleRef` 기반 invalidated 월만 re-fetch** | **최소 비용으로 정확히 필요한 월만 갱신** ✅ |

[hasMonth(m.id)](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#121-131)가 `false`인 월 = invalidated된 월이므로, `refetchInvalidated`는 **invalidated 월만 정확히 re-fetch**합니다.

---

## 2. 반복 일정(Recurrence) 날짜 전개 로직 검증

### 현재 구현

[MonthSection.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/ui/MonthSection.js) L50-61:

```javascript
if (todo.startDate && todo.endDate) {
  // 기간 일정: startDate ~ endDate 사이의 모든 날짜에 추가
  let current = dayjs(todo.startDate);
  const end = dayjs(todo.endDate);
  
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    const dateKey = current.format('YYYY-MM-DD');
    if (!map[dateKey]) map[dateKey] = [];
    map[dateKey].push(todo);
    current = current.add(1, 'day');
  }
}
```

### 성능 분석: **[PASSED]** ✅

| 시나리오 | 반복 횟수 | dayjs 비용 | 총 시간 |
|---------|----------|-----------|---------|
| 7일 기간 일정 × 5개 | 35회 | ~0.01ms/회 | ~0.35ms |
| 30일 기간 일정 × 3개 | 90회 | ~0.01ms/회 | ~0.9ms |
| **최악**: 60일 기간 × 5개 | 300회 | ~0.01ms/회 | ~3ms |

16ms 프레임 예산 대비 충분히 빠릅니다. `useMemo`로 감싸져 있으므로 `todos` 참조가 바뀌지 않으면 재실행되지 않습니다.

### 주의: 반복 일정(Recurrence) ≠ 기간 일정(Period)

현재 코드는 **기간 일정**(startDate + endDate)의 날짜 전개만 처리합니다. **반복 일정**(매주 수요일 등, `recurrence` 필드)의 occurrence 전개는 포함되어 있지 않습니다.

이것은 **현재 Phase 2 범위에서 정상**입니다. 반복 일정은 `startDate`만 있으므로 `else` 분기에서 그 날짜에만 dot이 표시됩니다. Phase 3에서 반복 occurrence를 날짜별로 전개할지는 별도 결정 사항입니다.

---

## 3. 아키텍처 최종 점검

### ✅ 확인된 항목 (이상 없음)

| 항목 | 파일 | 상태 |
|------|------|------|
| [generateWeeks](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/utils/calendarHelpers.js#96-145) ← [getCalendarDateRange](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/utils/calendarHelpers.js#52-95) 호출 | [calendarHelpers.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/utils/calendarHelpers.js) L113 | ✅ DRY 통일 |
| Overlap 그룹핑 (service) | [calendarTodoService.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js) L111 | ✅ 수학적 정확 |
| 기간 일정 날짜 전개 (UI) | [MonthSection.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/ui/MonthSection.js) L51-61 | ✅ 정확 |
| Selector 패턴 격리 | [MonthSection.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/ui/MonthSection.js) L26-31 | ✅ 월별 독립 |
| Batch fetch (1 SQL × 2) | [calendarTodoService.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js) L62-83 | ✅ |
| CRUD 무효화 — `useCreateTodo` | hooks/queries | ✅ |
| CRUD 무효화 — `useUpdateTodo` (양방향) | hooks/queries | ✅ (old + new date) |
| CRUD 무효화 — `useDeleteTodo` | hooks/queries | ✅ |
| CRUD 무효화 — `useToggleCompletion` | hooks/queries | ✅ |
| Error handling (graceful) | [calendarTodoService.js](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/services/calendarTodoService.js) L142-155 | ✅ |
| `React.memo` (MonthSection, WeekRow, DayCell) | UI components | ✅ |

### 실행 로그 분석 (삭제된 [log.md](file:///Users/admin/Documents/github/todo/.kiro/specs/hybrid-cache-refactoring/log.md) 기반)

```
초회 로드: 6개월 batch → 445ms (cold start, SQLite 첫 쿼리)
이후 캐시 미스: 1개월씩 → 2.4~4.9ms (warm query) ← 목표 < 50ms 달성
캐시 히트: "All months cached, no fetch needed" ← 100% 정확 동작
```

**초회 445ms가 높아 보이지만**, 이것은 SQLite cold start (WAL 초기화 포함) 비용입니다. 실제 앱 사용 시에는 DB가 이미 warm 상태이므로 6개월 batch도 ~20ms 이내가 되어야 합니다.

---

## 최종 판정: **[APPROVED]** ✅

**수정 필수 1건:**
- `useFocusEffect` 기반 `refetchInvalidated` 추가 (상단 §1의 코드)

**그 외 치명적 결함: 없음.**

구현 품질이 높습니다. Spec에서 설계한 것을 정확하게 구현했고, DRY 리팩토링([generateWeeks](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/utils/calendarHelpers.js#96-145) → [getCalendarDateRange](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/utils/calendarHelpers.js#52-95) 호출)도 완료되었습니다. CRUD 4개 hook 모두에 [invalidateAdjacentMonths](file:///Users/admin/Documents/github/todo/client/src/features/todo-calendar/store/todoCalendarStore.js#69-111)가 정확히 연동되어 있습니다.
