# 🛠️ [기술 명세서] UltimateCalendar 이벤트 색상 동기화 및 성능 최적화

## 1. 📋 개요 (Overview)

UltimateCalendar 및 CalendarScreen에서 발생하는 **"이벤트 색상 표시 오류(회색 점 간헐적 노출)"** 문제를 해결하고, 렌더링 성능 및 안정성을 강화하기 위한 리팩토링 요청입니다.

* **대상 파일:** `client/src/hooks/useCalendarDynamicEvents.js` (핵심), `DayCell.js` (선택적 최적화)
* **목표:** 초기 로딩 시 회색(#808080) 점이 깜빡이는 현상(Flickering)을 제거하고, 카테고리 색상이 완벽하게 로드된 후에만 화면을 렌더링하도록 변경합니다.

---

## 2. 🚨 문제 정의 (Problem Statement)

### 현상

* 앱 진입 시 `Todos` 데이터는 로드되었으나 `Categories` 데이터가 비동기적으로 늦게 로드되는 시점이 발생.
* 이 짧은 순간(Race Condition) 동안 이벤트의 색상이 매핑되지 않아 `fallback color`인 **회색(#808080)**으로 렌더링됨.
* 0.x초 후 카테고리가 로드되면 색상이 다시 입혀지는 깜빡임 현상 발생.

### 원인 분석

1. **비동기 타이밍 불일치:** `useCalendarDynamicEvents` Hook이 `Categories`가 준비되지 않은 상태에서도 계산을 수행하고 값을 리턴함.
2. **델타 동기화 환경:** 서버 사이드 Join(populate)을 사용할 수 없는 환경이라 클라이언트 사이드 매핑이 필수적임.

---

## 3. 🏗️ 아키텍처 및 요구사항 (Requirements)

### 공유 아키텍처

* **`TodoScreen` (주간 뷰):** 점(Dot) 형태로 표시. (중복 색상 제거 필요)
* **`CalendarScreen` (월간 뷰):** 띠(Line) 형태로 표시. (모든 일정 데이터 필요)
* **공통 엔진:** 두 화면 모두 `useCalendarDynamicEvents.js` Hook을 공유하여 사용함.

### 핵심 요구사항

1. **Wait for Data (안정성):** `Todos`와 `Categories`가 모두 완벽하게 로드되기 전에는 빈 객체(`{}`)를 반환하여 회색 점 노출을 원천 차단할 것.
2. **Pre-Calculation (성능):** Hook 내부에서 `Categories`를 순회하여 `ColorMap`을 미리 생성하고, 이벤트 객체에 `color` 속성을 주입해서 반환할 것.
3. **Data Integrity (호환성):** 월간 뷰(CalendarScreen)의 라인 표시를 위해, Hook은 단순화된 데이터가 아닌 **모든 필드(`startDate`, `endDate`, `title` 등)가 포함된 원본 객체**를 반환해야 함.
4. **No Over-engineering:** 복잡한 로직 대신, Hook에서의 데이터 정제에 집중할 것.

---

## 4. 💻 구현 가이드 (Implementation Guide)

### Step 1. `useCalendarDynamicEvents.js` 수정 (핵심)

이 Hook을 수정하여 데이터 동기화 및 색상 주입을 처리합니다.

**변경 로직:**

1. `todos`, `categories`가 유효한지 체크하는 **Guard Clause** 강화.
2. `categoryColorMap` (ID -> Color) 해시맵 생성.
3. 이벤트 생성 루프 내에서 `categoryColorMap`을 조회하여 `color` 필드를 확정적으로 주입.

```javascript
// client/src/hooks/useCalendarDynamicEvents.js

import { useMemo, useRef, useState, useEffect } from 'react';
import { useAllTodos } from './queries/useAllTodos';
import { useCategories } from './queries/useCategories';
import dayjs from 'dayjs';
import { isDateInRRule } from '../utils/routineUtils';

export function useCalendarDynamicEvents({ 
  weeks, 
  months,
  visibleIndex, 
  range = 3, 
  cacheType = 'week' 
}) {
  const dataSource = cacheType === 'month' ? months : weeks;
  
  // 1. 데이터 가져오기
  const { data: todos } = useAllTodos();
  const { data: categories } = useCategories();
  
  // 2. 캐시 관리
  const eventsCacheRef = useRef({});
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // 3. 데이터 변경 감지 (캐시 무효화)
  useEffect(() => {
    if (todos || categories) {
      eventsCacheRef.current = {};
      setCacheVersion(prev => prev + 1);
    }
  }, [todos, categories]);
  
  // 4. 동적 이벤트 계산
  const eventsByDate = useMemo(() => {
    // ✋ [Critical] 데이터 완전 로딩 대기
    // 카테고리가 없으면 렌더링을 보류하여 '회색 점' 노출을 방지함
    if (!todos || !categories || categories.length === 0 || !dataSource || dataSource.length === 0) {
      return {};
    }
    
    // ⚡ [Optimization] 색상 맵 미리 생성 (O(N))
    const categoryColorMap = {};
    categories.forEach(c => categoryColorMap[c._id] = c.color);

    // 보이는 범위 계산
    const startIdx = Math.max(0, visibleIndex - range);
    const endIdx = Math.min(dataSource.length - 1, visibleIndex + range);
    
    // 캐시 키 결정 로직
    let cacheKeyGetter;
    if (cacheType === 'month') {
      cacheKeyGetter = (item) => item.monthKey;
    } else {
      cacheKeyGetter = (item) => item[0].dateString;
    }
    
    const eventsMap = {};

    for (let i = startIdx; i <= endIdx; i++) {
      const item = dataSource[i];
      if (!item) continue;
      
      const cacheKey = cacheKeyGetter(item);
      
      // Cache Hit
      if (eventsCacheRef.current[cacheKey]) {
        Object.assign(eventsMap, eventsCacheRef.current[cacheKey]);
        continue;
      }
      
      // Cache Miss - 계산 시작
      const periodEvents = {};
      let periodStart, periodEnd;
      
      if (cacheType === 'month') {
        periodStart = dayjs(item.monthKey).startOf('month');
        periodEnd = periodStart.endOf('month');
      } else {
        periodStart = dayjs(item[0].dateString);
        periodEnd = dayjs(item[6].dateString);
      }
      
      todos.forEach(todo => {
        if (!todo.startDate) return;

        // 🎨 [Injection] 색상 확정 주입
        // fallback '#ccc'는 예비용이며, 위에서 categories 체크를 했으므로 실제로는 거의 발생 안 함
        const eventColor = categoryColorMap[todo.categoryId] || '#ccc';

        // 📦 [Packaging] 전체 데이터 보존 (CalendarScreen 호환성 유지)
        const eventData = {
            _id: todo._id,
            title: todo.title,
            color: eventColor, // ✅ 확정된 색상
            isRecurring: !!todo.recurrence,
            startDate: todo.startDate,
            endDate: todo.endDate,
            categoryId: todo.categoryId,
            event: todo, // 원본 참조
            // ... 필요한 기타 필드
        };

        // 반복 일정 및 단일 일정 계산 로직 (기존 로직 유지)
        // 조건이 맞을 경우:
        // if (!periodEvents[dateStr]) periodEvents[dateStr] = [];
        // periodEvents[dateStr].push(eventData); 
        
        // (AI Note: 여기에 기존 RRule 및 날짜 범위 체크 로직을 그대로 사용하되, push 할 때 위 eventData 객체를 사용하세요.)
        
        // --- [AI 구현 시 주의] 기존 로직 삽입 구간 시작 ---
        if (todo.recurrence) {
            const rruleString = Array.isArray(todo.recurrence) ? todo.recurrence[0] : todo.recurrence;
            if (!rruleString) return;
            const todoStartDate = new Date(todo.startDate);
            const todoEndDate = todo.recurrenceEndDate ? new Date(todo.recurrenceEndDate) : null;
            
            let loopDate = periodStart.clone();
            while (loopDate.isBefore(periodEnd) || loopDate.isSame(periodEnd, 'day')) {
              const dateStr = loopDate.format('YYYY-MM-DD');
              const isExcluded = todo.exdates?.some(exdate => {
                const exdateStr = typeof exdate === 'string' ? exdate.split('T')[0] : dayjs(exdate).format('YYYY-MM-DD');
                return exdateStr === dateStr;
              });
              
              if (!isExcluded && isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
                if (!periodEvents[dateStr]) periodEvents[dateStr] = [];
                periodEvents[dateStr].push(eventData);
              }
              loopDate = loopDate.add(1, 'day');
            }
        } else {
            const start = dayjs(todo.startDate);
            const end = todo.endDate ? dayjs(todo.endDate) : start;
            let current = start.clone();
            while (current.isBefore(end) || current.isSame(periodEnd, 'day')) { // Loop condition simplified
                if ((current.isAfter(periodStart) || current.isSame(periodStart, 'day')) &&
                    (current.isBefore(periodEnd) || current.isSame(periodEnd, 'day'))) {
                    const dateStr = current.format('YYYY-MM-DD');
                    if (!periodEvents[dateStr]) periodEvents[dateStr] = [];
                    periodEvents[dateStr].push(eventData);
                }
                current = current.add(1, 'day');
            }
        }
        // --- [AI 구현 시 주의] 기존 로직 삽입 구간 끝 ---
      });
      
      eventsCacheRef.current[cacheKey] = periodEvents;
      Object.assign(eventsMap, periodEvents);
    }
    
    // 캐시 정리 (GC)
    const maxCacheSize = cacheType === 'month' ? 24 : 40;
    const cacheKeys = Object.keys(eventsCacheRef.current);
    if (cacheKeys.length > maxCacheSize) {
      const sortedKeys = cacheKeys.sort();
      const keysToDelete = sortedKeys.slice(0, cacheKeys.length - maxCacheSize);
      keysToDelete.forEach(key => delete eventsCacheRef.current[key]);
    }
    
    return eventsMap;
  }, [todos, categories, dataSource, visibleIndex, range, cacheType, cacheVersion]);
  
  return eventsByDate;
}

```

### Step 2. `DayCell.js` 최적화 (권장)

Hook에서 넘어오는 데이터는 중복을 포함한 전체 리스트입니다. `DayCell`에서 **화면 표시용(Dot)**으로만 데이터를 정제합니다.

```javascript
// client/src/components/.../DayCell.js

// ... imports

const DayCell = ({ events }) => {
  // ⚡ Hook에서 이미 올바른 color를 담아 보냈으므로, 여기선 단순 추출 및 중복 제거만 수행
  const dotColors = useMemo(() => {
    if (!events || events.length === 0) return [];
    
    // 1. 색상 추출
    const colors = events.map(e => e.color);
    
    // 2. 중복 제거 (Set) 및 최대 3개 제한
    // (Set 연산은 매우 빠르므로 렌더링 성능에 영향 없음)
    return [...new Set(colors)].slice(0, 3);
  }, [events]);

  return (
    <View style={styles.container}>
      {/* 날짜 표시 등 기존 코드 */}
      
      {/* 점 표시 영역 */}
      <View style={styles.dotsRow}>
        {dotColors.map((color, index) => (
          <View key={index} style={[styles.dot, { backgroundColor: color }]} />
        ))}
      </View>
    </View>
  );
};

```

---

## 5. ✅ 검증 포인트 (Verification)

코드 수정 후 다음 사항을 확인하십시오.

1. **초기 로딩:** 앱 실행 시 "회색 점"이 아주 잠깐이라도 보이는가? (보이면 안 됨. 아예 안 보이다가 컬러 점이 떠야 함)
2. **데이터 무결성:** CalendarScreen(월간 뷰) 진입 시 일정의 띠(라인)가 정상적으로 표시되는가? (Hook이 전체 객체를 반환하는지 확인)
3. **반응성:** 카테고리 색상을 설정에서 변경했을 때, 캘린더의 점 색상도 즉시 반영되는가? (`useEffect`의 `categories` 의존성 확인)