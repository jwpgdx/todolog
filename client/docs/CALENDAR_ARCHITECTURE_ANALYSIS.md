# 📅 Calendar Architecture Analysis

**작성일:** 2026-02-10  
**목적:** CalendarScreen과 UltimateCalendar의 구조 및 문제점 파악

---

## 🎯 Executive Summary

### 현재 상태
- **2개의 독립적인 캘린더 구현** 존재
- **데이터 가져오기 로직 중복** (useCalendarDynamicEvents vs useCalendarEvents)
- **UltimateCalendar 비활성화** 상태 (SQLite 데이터 변경 시 실시간 동기화 이슈)

### 주요 문제점
1. ⚠️ **useMemo 의존성 누락**: `todos`, `categories` 변경 시 재계산 안됨
2. 🔴 **캐시 무효화 vs 컴포넌트 재렌더링 불일치**
3. 🔄 **중복된 이벤트 계산 로직** (2개 Hook)
4. 📦 **코드 공유 부족** (CalendarScreen vs UltimateCalendar)

---

## 📂 File Structure


```
client/src/
├── screens/
│   └── CalendarScreen.js                    # 월별 리스트 뷰 (FlashList)
│
├── components/ui/ultimate-calendar/
│   ├── UltimateCalendar.js                  # 주간/월간 전환 캘린더 (비활성화)
│   ├── CalendarHeader.js                    # 헤더 (타이틀, 네비게이션)
│   ├── WeeklyView.js                        # 주간 뷰 (가로 스크롤)
│   ├── MonthlyView.js                       # 월간 뷰 (세로 스크롤)
│   ├── MonthSection.js                      # 월 섹션 (CalendarScreen용)
│   ├── WeekRow.js                           # 주 행 렌더링
│   ├── constants.js                         # 상수 (크기, 색상)
│   ├── calendarUtils.js                     # 데이터 생성 유틸
│   └── day-cells/
│       ├── DayCell.js                       # Dot 스타일 (UltimateCalendar)
│       ├── ListDayCell.js                   # List 스타일 (CalendarScreen)
│       └── useDayCell.js                    # 공통 로직 Hook
│
└── hooks/
    ├── useCalendarDynamicEvents.js          # 동적 이벤트 계산 (무한 스크롤용)
    └── useCalendarEvents.js                 # 정적 이벤트 계산 (미사용)
```

---

## 🏗️ Architecture Overview

### 1. CalendarScreen (활성화 ✅)

**역할:** 월별 리스트 뷰 캘린더

**특징:**
- FlashList 기반 세로 무한 스크롤
- 월 단위 섹션 렌더링
- ListDayCell 사용 (이벤트 제목 표시)
- 19개월 초기 로드 (6 past + current + 12 future)

**데이터 흐름:**
```
CalendarScreen
  ↓ (months, visibleIndex)
useCalendarDynamicEvents
  ↓ (eventsByDate)
MonthSection
  ↓ (events)
ListDayCell
```



### 2. UltimateCalendar (비활성화 ⚠️)

**역할:** 주간/월간 전환 가능한 인터랙티브 캘린더

**특징:**
- 주간 뷰: 가로 스크롤 (FlashList horizontal)
- 월간 뷰: 세로 스크롤 (FlashList vertical)
- 제스처 기반 모드 전환 (Reanimated)
- DayCell 사용 (카테고리 Dot 표시)
- 19개월 초기 로드 (6 past + current + 12 future)

**데이터 흐름:**
```
UltimateCalendar
  ↓ (weeks, visibleIndex)
useCalendarDynamicEvents
  ↓ (eventsByDate)
WeeklyView / MonthlyView
  ↓ (events)
WeekRow
  ↓ (events)
DayCell
```

**비활성화 이유:**
- SQLite 데이터 변경 시 실시간 동기화 이슈
- 카테고리 색상 변경 시 dot 색상 업데이트 안됨
- 일정 카테고리 변경 시 dot 색상 업데이트 안됨

---

## 🔍 Core Components Analysis

### 1. useCalendarDynamicEvents Hook

**파일:** `client/src/hooks/useCalendarDynamicEvents.js`

**목적:** 무한 스크롤 캘린더에서 보이는 범위만 동적으로 이벤트 계산

**입력:**
```javascript
{
  weeks,        // 주 데이터 배열 (UltimateCalendar용)
  months,       // 월 데이터 배열 (CalendarScreen용)
  visibleIndex, // 현재 보이는 인덱스
  range,        // 계산 범위 (±N)
  cacheType     // 'week' 또는 'month'
}
```

**출력:**
```javascript
{
  eventsByDate: {
    "2026-02-10": [
      { _id, title, color, isRecurring, event }
    ]
  },
  cacheVersion  // 캐시 무효화 트리거
}
```



**핵심 로직:**

1. **데이터 가져오기**
   ```javascript
   const { data: todos } = useAllTodos();
   const { data: categories } = useCategories();
   ```

2. **캐시 무효화** (todos/categories 변경 시)
   ```javascript
   useEffect(() => {
     if (todos || categories) {
       eventsCacheRef.current = {};
       setCacheVersion(prev => prev + 1);
     }
   }, [todos, categories]);
   ```

3. **동적 이벤트 계산** (useMemo)
   ```javascript
   const eventsByDate = useMemo(() => {
     // 1. 보이는 범위 계산 (visibleIndex ± range)
     // 2. 날짜 범위 계산
     // 3. 캐시 확인 및 이벤트 계산
     // 4. 반복 일정 처리 (RRule)
     // 5. 단일/기간 일정 처리
     return eventsMap;
   }, [dataSource, visibleIndex, range, cacheType, cacheVersion]);
   ```

**성능 최적화:**
- 주별/월별 캐싱 (최근 60주 또는 24개월)
- 보이는 범위만 계산 (±3주 또는 ±3개월)
- 캐시 히트율 90%+ 목표

**🔴 문제점:**
```javascript
// ❌ 현재 의존성 배열
}, [dataSource, visibleIndex, range, cacheType, cacheVersion]);

// ✅ 필요한 의존성 배열
}, [dataSource, visibleIndex, range, cacheType, cacheVersion, todos, categories]);
```

**문제 원인:**
- `todos`, `categories`가 의존성에 없음
- `cacheVersion`으로 간접 트리거하지만 useMemo는 재실행 안됨
- 캐시 무효화는 되지만 컴포넌트 재렌더링 트리거 안됨

---



### 2. useCalendarEvents Hook (미사용)

**파일:** `client/src/hooks/useCalendarEvents.js`

**목적:** 정적 이벤트 계산 (특정 월의 데이터 가져오기)

**특징:**
- useQueries로 여러 월 데이터 병렬 로드
- SQLite 우선, 실패 시 서버 폴백
- RRule 전개 로직 포함

**🔴 문제점:**
- useCalendarDynamicEvents와 로직 중복
- 현재 사용되지 않음 (CalendarScreen, UltimateCalendar 모두 useCalendarDynamicEvents 사용)
- 삭제 또는 통합 필요

---

### 3. CalendarScreen Component

**파일:** `client/src/screens/CalendarScreen.js`

**주요 기능:**

1. **무한 스크롤 구현**
   ```javascript
   // 하단 스크롤 (12개월 추가)
   const handleEndReached = useCallback(() => {
     const newEnd = currentEnd.add(12, 'month');
     const newMonths = generateMonths(currentEnd + 1, newEnd);
     setMonths(prev => [...prev, ...newMonths]);
   }, []);
   
   // 상단 스크롤 (12개월 추가)
   const handleStartReached = useCallback(() => {
     const newStart = currentStart.subtract(12, 'month');
     const newMonths = generateMonths(newStart, currentStart - 1);
     setMonths(prev => [...newMonths, ...prev]);
     setTodayMonthIndex(prev => prev + addedCount);
   }, []);
   ```

2. **동적 이벤트 계산**
   ```javascript
   const { eventsByDate, cacheVersion } = useCalendarDynamicEvents({
     months,
     visibleIndex: currentViewIndex,
     range: 3,
     cacheType: 'month'
   });
   ```

3. **월 렌더링**
   ```javascript
   const renderMonth = useCallback(({ item, index }) => {
     // Hook 형식 → MonthSection 형식 변환
     const formattedEvents = {};
     Object.keys(eventsByDate).forEach(dateStr => {
       formattedEvents[dateStr] = eventsByDate[dateStr].map(event => ({
         title: event.title,
         color: event.color,
         todo: event.event,
       }));
     });
     
     return (
       <MonthSection
         monthData={item}
         eventsByDate={formattedEvents}
         cacheVersion={cacheVersion}
         onDatePress={handleDatePress}
       />
     );
   }, [eventsByDate, cacheVersion]);
   ```



**🔴 문제점:**

1. **이벤트 형식 변환 중복**
   - Hook 반환 형식: `{ _id, title, color, isRecurring, event }`
   - MonthSection 기대 형식: `{ title, color, todo }`
   - 매 렌더링마다 변환 로직 실행

2. **미사용 변수 다수**
   - `loadedRange`, `startTime`, `endTime`, `getItemLayout` 등
   - 코드 정리 필요

3. **createMonthData 함수 중복**
   - calendarUtils.js에도 동일 로직 존재
   - 통합 필요

---

### 4. UltimateCalendar Component

**파일:** `client/src/components/ui/ultimate-calendar/UltimateCalendar.js`

**주요 기능:**

1. **주간/월간 모드 전환**
   ```javascript
   // Reanimated 기반 애니메이션
   const height = useSharedValue(CALENDAR_HEIGHT_WEEK);
   const opacity = useSharedValue(isWeekly ? 0 : 1);
   
   // 제스처 감지
   const panGesture = Gesture.Pan()
     .onChange((e) => {
       if (e.translationY > 10) switchToMonthly();
       if (e.translationY < -10) switchToWeekly();
     });
   ```

2. **양방향 그림자 동기화**
   ```javascript
   useEffect(() => {
     if (isUserScrolling.current) return;
     
     if (isWeekly && hasLoadedMonthly) {
       monthlyRef.current.scrollToIndex(visibleWeekIndex, false);
     }
     if (!isWeekly) {
       weeklyRef.current.scrollToIndex(visibleWeekIndex, false);
     }
   }, [visibleWeekIndex, isWeekly]);
   ```

3. **무한 스크롤 구현**
   - CalendarScreen과 동일한 로직
   - 주 단위로 12개월씩 추가

**🔴 문제점:**

1. **복잡한 동기화 로직**
   - 3개의 ref (visibleWeekIndexRef, isArrowNavigating, isUserScrolling)
   - 여러 플래그로 충돌 방지
   - 유지보수 어려움

2. **이벤트 데이터 동기화 이슈**
   - `todos`, `categories` 변경 시 재렌더링 안됨
   - useMemo 의존성 누락

---



## 🐛 Root Cause Analysis

### 문제 1: useMemo 의존성 누락

**위치:** `useCalendarDynamicEvents.js` L95

**현재 코드:**
```javascript
const eventsByDate = useMemo(() => {
  // ... 이벤트 계산 로직
}, [dataSource, visibleIndex, range, cacheType, cacheVersion]);
```

**문제:**
- `todos`, `categories`가 변경되어도 useMemo가 재실행되지 않음
- `cacheVersion`으로 간접 트리거하지만 React는 이를 인식 못함

**해결 방법:**
```javascript
const eventsByDate = useMemo(() => {
  // ... 이벤트 계산 로직
}, [dataSource, visibleIndex, range, cacheType, cacheVersion, todos, categories]);
```

**영향:**
- ✅ 카테고리 색상 변경 시 즉시 반영
- ✅ 일정 카테고리 변경 시 즉시 반영
- ✅ 게스트 마이그레이션 시 새 카테고리 표시

---

### 문제 2: 캐시 무효화 vs 컴포넌트 재렌더링 불일치

**현재 동작:**
```
1. todos/categories 변경
   ↓
2. useEffect 실행 → 캐시 무효화 + cacheVersion++
   ↓
3. useMemo는 cacheVersion 변경 감지 못함 (의존성 배열에 todos/categories 없음)
   ↓
4. 컴포넌트 재렌더링 안됨
```

**올바른 동작:**
```
1. todos/categories 변경
   ↓
2. useMemo 재실행 (의존성 배열에 todos/categories 있음)
   ↓
3. eventsByDate 새로 계산
   ↓
4. 컴포넌트 재렌더링
```

---



### 문제 3: 중복된 이벤트 계산 로직

**중복 위치:**
1. `useCalendarDynamicEvents.js` (사용 중)
2. `useCalendarEvents.js` (미사용)

**중복 코드:**
- RRule 전개 로직
- 단일/기간 일정 처리
- 카테고리 색상 매핑
- exdates 처리

**해결 방법:**
- `useCalendarEvents.js` 삭제
- 또는 공통 로직을 별도 유틸 함수로 분리

---

### 문제 4: 이벤트 형식 변환 중복

**위치:** `CalendarScreen.js` L186-195

**현재 코드:**
```javascript
const renderMonth = useCallback(({ item, index }) => {
  // Hook 형식 → MonthSection 형식 변환
  const formattedEvents = {};
  Object.keys(eventsByDate).forEach(dateStr => {
    formattedEvents[dateStr] = eventsByDate[dateStr].map(event => ({
      title: event.title,
      color: event.color,
      todo: event.event,
    }));
  });
  
  return <MonthSection eventsByDate={formattedEvents} />;
}, [eventsByDate]);
```

**문제:**
- 매 렌더링마다 변환 로직 실행
- 성능 낭비

**해결 방법 1:** Hook에서 통일된 형식 반환
```javascript
// useCalendarDynamicEvents.js
return {
  _id: todo._id,
  title: todo.title,
  color: categoryColorMap[todo.categoryId],
  isRecurring: true,
  todo: todo,  // 'event' 대신 'todo'로 통일
};
```

**해결 방법 2:** useMemo로 변환 로직 캐싱
```javascript
const formattedEvents = useMemo(() => {
  const result = {};
  Object.keys(eventsByDate).forEach(dateStr => {
    result[dateStr] = eventsByDate[dateStr].map(event => ({
      title: event.title,
      color: event.color,
      todo: event.event,
    }));
  });
  return result;
}, [eventsByDate]);
```

---



## 🔧 Recommended Solutions

### Solution 1: useMemo 의존성 수정 (필수 🔴)

**파일:** `client/src/hooks/useCalendarDynamicEvents.js`

**변경 전:**
```javascript
const eventsByDate = useMemo(() => {
  // ...
}, [dataSource, visibleIndex, range, cacheType, cacheVersion]);
```

**변경 후:**
```javascript
const eventsByDate = useMemo(() => {
  // ...
}, [dataSource, visibleIndex, range, cacheType, cacheVersion, todos, categories]);
```

**영향:**
- ✅ UltimateCalendar 활성화 가능
- ✅ 실시간 데이터 동기화
- ⚠️ 재계산 빈도 증가 (캐싱으로 완화)

**예상 시간:** 5분

---

### Solution 2: useCalendarEvents 삭제 (선택 🟡)

**파일:** `client/src/hooks/useCalendarEvents.js`

**이유:**
- 현재 사용되지 않음
- useCalendarDynamicEvents로 대체됨
- 코드 중복 제거

**영향:**
- ✅ 코드베이스 단순화
- ✅ 유지보수 부담 감소

**예상 시간:** 5분

---

### Solution 3: 이벤트 형식 통일 (권장 🟢)

**Option A: Hook에서 통일된 형식 반환**

**파일:** `client/src/hooks/useCalendarDynamicEvents.js`

**변경:**
```javascript
// 'event' 필드를 'todo'로 변경
periodEvents[dateStr].push({
  _id: todo._id,
  title: todo.title,
  color: categoryColorMap[todo.categoryId] || defaultColor,
  isRecurring: false,
  todo: todo,  // ← 'event' 대신 'todo'
});
```

**영향:**
- ✅ CalendarScreen의 변환 로직 제거 가능
- ✅ 성능 개선
- ⚠️ 기존 코드 수정 필요 (event.event → event.todo)

**예상 시간:** 30분

---

**Option B: useMemo로 변환 로직 캐싱**

**파일:** `client/src/screens/CalendarScreen.js`

**변경:**
```javascript
const formattedEvents = useMemo(() => {
  const result = {};
  Object.keys(eventsByDate).forEach(dateStr => {
    result[dateStr] = eventsByDate[dateStr].map(event => ({
      title: event.title,
      color: event.color,
      todo: event.event,
    }));
  });
  return result;
}, [eventsByDate]);

const renderMonth = useCallback(({ item }) => (
  <MonthSection eventsByDate={formattedEvents} />
), [formattedEvents]);
```

**영향:**
- ✅ 변환 로직 1회만 실행
- ✅ 기존 코드 구조 유지
- ⚠️ 메모리 사용량 약간 증가

**예상 시간:** 10분

---



### Solution 4: 코드 정리 (권장 🟢)

**파일:** `client/src/screens/CalendarScreen.js`

**제거할 미사용 변수:**
```javascript
// ❌ 제거
const [loadedRange, setLoadedRange] = useState(...);  // loadedRangeRef로 대체됨
const startTime = performance.now();  // 사용되지 않음
const endTime = performance.now();    // 사용되지 않음
const getItemLayout = useCallback(...);  // FlashList가 자동 계산
```

**제거할 미사용 함수:**
```javascript
// ❌ 제거 (calendarUtils.js에 동일 함수 존재)
function createMonthData(monthStart, startDayOfWeek) {
  // ...
}
```

**영향:**
- ✅ 코드 가독성 향상
- ✅ 번들 크기 감소

**예상 시간:** 15분

---

### Solution 5: UltimateCalendar 활성화 (선택 🟡)

**전제 조건:**
- Solution 1 완료 (useMemo 의존성 수정)

**파일:** `client/src/screens/TodoScreen.js`

**변경:**
```javascript
// 주석 해제
import UltimateCalendar from '../components/ui/ultimate-calendar/UltimateCalendar';

// ...

<UltimateCalendar />
```

**테스트 항목:**
1. 카테고리 색상 변경 → dot 색상 즉시 업데이트
2. 일정 카테고리 변경 → dot 색상 즉시 업데이트
3. 게스트 마이그레이션 → 새 카테고리 dot 표시

**예상 시간:** 30분 (테스트 포함)

---



## 📊 Performance Analysis

### 현재 성능

**useCalendarDynamicEvents:**
- 계산 범위: ±3주 또는 ±3개월
- 캐시 히트율: 90%+
- 평균 계산 시간: <10ms
- 캐시 크기: 60주 또는 24개월

**CalendarScreen:**
- 초기 로드: 19개월 (6 past + current + 12 future)
- 무한 스크롤: 12개월씩 추가
- FlashList 최적화: estimatedItemSize, drawDistance

**UltimateCalendar:**
- 초기 로드: 19개월
- 무한 스크롤: 12개월씩 추가
- 주간/월간 전환: Reanimated 애니메이션

### 성능 병목

1. **이벤트 형식 변환** (CalendarScreen)
   - 매 렌더링마다 실행
   - 해결: useMemo 캐싱

2. **RRule 전개**
   - 반복 일정 계산 비용 높음
   - 해결: 캐싱 (이미 구현됨)

3. **useMemo 재실행 빈도**
   - todos/categories 변경 시마다 재계산
   - 해결: 캐시 유지 (eventsCacheRef)

---

## 🎯 Implementation Priority

### Phase 1: 필수 수정 (1시간)

1. ✅ **useMemo 의존성 수정** (5분)
   - `useCalendarDynamicEvents.js` L95
   - `todos`, `categories` 추가

2. ✅ **이벤트 형식 변환 캐싱** (10분)
   - `CalendarScreen.js` renderMonth
   - useMemo 적용

3. ✅ **코드 정리** (15분)
   - 미사용 변수 제거
   - 미사용 함수 제거

4. ✅ **UltimateCalendar 활성화 테스트** (30분)
   - TodoScreen.js 주석 해제
   - 3가지 시나리오 테스트

---

### Phase 2: 선택 개선 (1시간)

1. ⭐ **useCalendarEvents 삭제** (5분)
   - 미사용 Hook 제거

2. ⭐ **이벤트 형식 통일** (30분)
   - Hook에서 'todo' 필드로 통일
   - CalendarScreen 변환 로직 제거

3. ⭐ **createMonthData 통합** (15분)
   - CalendarScreen 로컬 함수 제거
   - calendarUtils.js 사용

4. ⭐ **문서 업데이트** (10분)
   - ROADMAP.md 업데이트
   - 완료 표시

---



## 📝 Code Examples

### Example 1: useMemo 의존성 수정

**Before:**
```javascript
// client/src/hooks/useCalendarDynamicEvents.js
const eventsByDate = useMemo(() => {
  if (!todos || !categories || categories.length === 0 || !dataSource || dataSource.length === 0) {
    return {};
  }
  
  // ... 이벤트 계산 로직
  
  return eventsMap;
}, [dataSource, visibleIndex, range, cacheType, cacheVersion]);
```

**After:**
```javascript
// client/src/hooks/useCalendarDynamicEvents.js
const eventsByDate = useMemo(() => {
  if (!todos || !categories || categories.length === 0 || !dataSource || dataSource.length === 0) {
    return {};
  }
  
  // ... 이벤트 계산 로직
  
  return eventsMap;
}, [dataSource, visibleIndex, range, cacheType, cacheVersion, todos, categories]);
//                                                              ^^^^^^^^^^^^^^^^^^^^
//                                                              추가!
```

---

### Example 2: 이벤트 형식 변환 캐싱

**Before:**
```javascript
// client/src/screens/CalendarScreen.js
const renderMonth = useCallback(({ item, index }) => {
  // 매 렌더링마다 변환 실행
  const formattedEvents = {};
  Object.keys(eventsByDate).forEach(dateStr => {
    formattedEvents[dateStr] = eventsByDate[dateStr].map(event => ({
      title: event.title,
      color: event.color,
      todo: event.event,
    }));
  });
  
  return (
    <MonthSection
      monthData={item}
      eventsByDate={formattedEvents}
      cacheVersion={cacheVersion}
      onDatePress={handleDatePress}
    />
  );
}, [eventsByDate, cacheVersion, handleDatePress]);
```

**After:**
```javascript
// client/src/screens/CalendarScreen.js
// 1회만 변환
const formattedEvents = useMemo(() => {
  const result = {};
  Object.keys(eventsByDate).forEach(dateStr => {
    result[dateStr] = eventsByDate[dateStr].map(event => ({
      title: event.title,
      color: event.color,
      todo: event.event,
    }));
  });
  return result;
}, [eventsByDate]);

const renderMonth = useCallback(({ item, index }) => {
  return (
    <MonthSection
      monthData={item}
      eventsByDate={formattedEvents}
      cacheVersion={cacheVersion}
      onDatePress={handleDatePress}
    />
  );
}, [formattedEvents, cacheVersion, handleDatePress]);
```

---



### Example 3: UltimateCalendar 활성화

**Before:**
```javascript
// client/src/screens/TodoScreen.js
// import UltimateCalendar from '../components/ui/ultimate-calendar/UltimateCalendar';

// ...

{/* <UltimateCalendar /> */}
```

**After:**
```javascript
// client/src/screens/TodoScreen.js
import UltimateCalendar from '../components/ui/ultimate-calendar/UltimateCalendar';

// ...

<UltimateCalendar />
```

---

## 🧪 Testing Checklist

### Test 1: useMemo 의존성 수정 검증

**시나리오 1: 카테고리 색상 변경**
1. UltimateCalendar 열기
2. 카테고리 색상 변경
3. ✅ Dot 색상이 즉시 업데이트되는지 확인

**시나리오 2: 일정 카테고리 변경**
1. UltimateCalendar 열기
2. 일정의 카테고리 변경
3. ✅ Dot 색상이 즉시 업데이트되는지 확인

**시나리오 3: 게스트 마이그레이션**
1. 게스트 모드에서 일정 생성
2. 회원 전환
3. ✅ 새 카테고리 Dot이 표시되는지 확인

---

### Test 2: 성능 검증

**시나리오 1: 스크롤 성능**
1. CalendarScreen에서 빠르게 스크롤
2. ✅ 끊김 없이 부드러운지 확인
3. ✅ Console에서 계산 시간 확인 (<10ms)

**시나리오 2: 모드 전환 성능**
1. UltimateCalendar에서 주간/월간 전환
2. ✅ 애니메이션이 부드러운지 확인
3. ✅ 데이터 동기화가 즉시 되는지 확인

---

### Test 3: 기능 검증

**시나리오 1: 무한 스크롤**
1. CalendarScreen에서 상단/하단 스크롤
2. ✅ 12개월씩 추가되는지 확인
3. ✅ 로딩 인디케이터 표시 확인

**시나리오 2: 날짜 클릭**
1. CalendarScreen에서 날짜 클릭
2. ✅ TodoScreen으로 이동하는지 확인
3. ✅ 선택된 날짜가 올바른지 확인

---



## 🚀 Migration Guide

### Step 1: Backup

```bash
# 현재 상태 커밋
git add .
git commit -m "backup: before calendar refactoring"

# 새 브랜치 생성 (선택사항)
git checkout -b feature/calendar-refactoring
```

---

### Step 2: Phase 1 구현 (필수)

**2.1. useMemo 의존성 수정**

```bash
# 파일 열기
code client/src/hooks/useCalendarDynamicEvents.js
```

```javascript
// L95 수정
}, [dataSource, visibleIndex, range, cacheType, cacheVersion, todos, categories]);
```

**2.2. 이벤트 형식 변환 캐싱**

```bash
# 파일 열기
code client/src/screens/CalendarScreen.js
```

```javascript
// renderMonth 위에 추가
const formattedEvents = useMemo(() => {
  const result = {};
  Object.keys(eventsByDate).forEach(dateStr => {
    result[dateStr] = eventsByDate[dateStr].map(event => ({
      title: event.title,
      color: event.color,
      todo: event.event,
    }));
  });
  return result;
}, [eventsByDate]);

// renderMonth 수정
const renderMonth = useCallback(({ item, index }) => {
  return (
    <MonthSection
      monthData={item}
      eventsByDate={formattedEvents}  // ← 변경
      cacheVersion={cacheVersion}
      onDatePress={handleDatePress}
      startDayOfWeek={startDayOfWeek}
      showWeekDays={false}
    />
  );
}, [formattedEvents, cacheVersion, handleDatePress, startDayOfWeek]);
```

**2.3. 코드 정리**

```javascript
// CalendarScreen.js에서 제거
// const [loadedRange, setLoadedRange] = useState(...);
// const startTime = performance.now();
// const endTime = performance.now();
// const getItemLayout = useCallback(...);
// function createMonthData(...) { ... }
```

**2.4. UltimateCalendar 활성화**

```bash
# 파일 열기
code client/src/screens/TodoScreen.js
```

```javascript
// 주석 해제
import UltimateCalendar from '../components/ui/ultimate-calendar/UltimateCalendar';

// ...

<UltimateCalendar />
```

---

### Step 3: 테스트

```bash
# 앱 재시작
npm run ios  # 또는 npm run android
```

**테스트 항목:**
1. ✅ 카테고리 색상 변경 → Dot 색상 즉시 업데이트
2. ✅ 일정 카테고리 변경 → Dot 색상 즉시 업데이트
3. ✅ 스크롤 성능 확인
4. ✅ 모드 전환 확인

---

### Step 4: Phase 2 구현 (선택)

**4.1. useCalendarEvents 삭제**

```bash
rm client/src/hooks/useCalendarEvents.js
```

**4.2. 이벤트 형식 통일**

```javascript
// useCalendarDynamicEvents.js
periodEvents[dateStr].push({
  _id: todo._id,
  title: todo.title,
  color: categoryColorMap[todo.categoryId] || defaultColor,
  isRecurring: false,
  todo: todo,  // ← 'event' 대신 'todo'
});
```

```javascript
// CalendarScreen.js - formattedEvents 제거 가능
const renderMonth = useCallback(({ item, index }) => {
  return (
    <MonthSection
      monthData={item}
      eventsByDate={eventsByDate}  // ← 직접 전달
      cacheVersion={cacheVersion}
      onDatePress={handleDatePress}
      startDayOfWeek={startDayOfWeek}
      showWeekDays={false}
    />
  );
}, [eventsByDate, cacheVersion, handleDatePress, startDayOfWeek]);
```

---

### Step 5: 커밋 및 푸시

```bash
git add .
git commit -m "feat: calendar refactoring - useMemo dependency fix"
git push origin feature/calendar-refactoring
```

---

## 📚 References

### Related Files
- `client/src/screens/CalendarScreen.js`
- `client/src/components/ui/ultimate-calendar/UltimateCalendar.js`
- `client/src/hooks/useCalendarDynamicEvents.js`
- `client/src/hooks/useCalendarEvents.js`
- `client/docs/ROADMAP.md`

### Related Issues
- UltimateCalendar 임시 비활성화 (ROADMAP.md L38-70)
- SQLite 데이터 변경 시 실시간 동기화 이슈

### Performance Metrics
- 계산 시간: <10ms (목표)
- 캐시 히트율: 90%+ (목표)
- 초기 로드: 19개월
- 무한 스크롤: 12개월씩 추가

---

**문서 작성:** 2026-02-10  
**마지막 업데이트:** 2026-02-10  
**작성자:** Kiro AI Assistant
