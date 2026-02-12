# Design Document: Infinite Scroll Calendar

## Overview

Infinite Scroll Calendar는 React Native + FlashList 기반의 고성능 월간 캘린더 컴포넌트입니다. 기존 UltimateCalendar의 성능 문제를 해결하기 위해 다음 세 가지 핵심 원칙을 적용합니다:

1. **State 경량화 (Strict Primitive State)**: Global State에는 `{year, month, id}` 메타데이터만 저장하고, weeks/days는 컴포넌트 내부에서 useMemo로 동기 생성
2. **동기 처리 (No setTimeout)**: 모든 데이터 생성을 동기 처리하여 race condition 제거
3. **6주 고정 높이 (Fixed 6 Rows)**: 모든 월을 6주(420px)로 고정하여 FlashList estimatedItemSize 정확도 100% 달성

### Architecture Diagram

```mermaid
graph TB
    subgraph "UI Layer"
        Screen[TodoCalendarScreen]
        List[CalendarList]
        Month[MonthSection]
        Week[WeekRow]
        Day[DayCell]
    end
    
    subgraph "State Layer"
        Hook[useInfiniteCalendar]
        Store[Zustand Store]
    end
    
    subgraph "Utils Layer"
        Helpers[calendarHelpers]
    end
    
    Screen --> List
    List --> Hook
    Hook --> Store
    List --> Month
    Month --> Week
    Week --> Day
    Month --> Helpers
    Hook --> Helpers
    
    style Store fill:#e1f5ff
    style Hook fill:#fff4e1
    style Helpers fill:#f0f0f0


## Components and Interfaces

### 1. TodoCalendarScreen (Screen Component)

**책임**: 캘린더 화면의 최상위 컨테이너

**Props**: None (Navigation props from React Navigation)

**State**: None (모든 상태는 useInfiniteCalendar hook에서 관리)

**주요 기능**:
- CalendarList 컴포넌트 렌더링
- Navigation 설정 (헤더, 뒤로가기 버튼)

```javascript
// TodoCalendarScreen.js
export default function TodoCalendarScreen() {
  return (
    <View style={styles.container}>
      <CalendarList />
    </View>
  );
}
```

---

### 2. CalendarList (Container Component)

**책임**: FlashList 컨테이너 및 무한 스크롤 로직 통합

**Props**: None

**Hooks**:
- `useInfiniteCalendar()`: 월 메타데이터 배열 및 스크롤 핸들러 제공
- `authStore` (Phase 1.5): 설정값 구독 (startDayOfWeek, language)

**주요 기능**:
- FlashList 설정 (estimatedItemSize: 정확한 높이 계산)
- 스크롤 이벤트 처리 (onEndReached, onViewableItemsChanged)
- MonthSection 렌더링
- 고정 헤더 (Phase 1.5): 현재 보고 있는 월 표시 + 요일 헤더

**높이 계산**:
```javascript
const FIXED_HEADER_HEIGHT = 80;    // 고정 헤더 (월 타이틀 + 요일 헤더) [Phase 1.5]
const TITLE_HEIGHT = 30;           // 월 타이틀
const WEEK_ROW_HEIGHT = 70;        // 주 행 높이
const MONTH_HEIGHT = TITLE_HEIGHT + (6 * WEEK_ROW_HEIGHT);
// → 450px (정확한 높이)
```

```javascript
// CalendarList.js (Phase 1.5 업데이트)
const MONTH_HEIGHT = 450;  // 30 + (6 × 70)
const FIXED_HEADER_HEIGHT = 80;

export default function CalendarList() {
  const {
    months,
    handleEndReached,
    handleStartReached,
    initialScrollIndex
  } = useInfiniteCalendar();

  // Phase 1.5: authStore에서 설정값 구독 (Selector 패턴)
  const startDayOfWeek = authStore((state) => state.settings?.startDayOfWeek ?? 0);
  const language = authStore((state) => state.settings?.language ?? 'ko');

  // Phase 1.5: 현재 보고 있는 월 추적
  const [currentVisibleMonth, setCurrentVisibleMonth] = useState(months[initialScrollIndex]);

  const renderMonth = useCallback(({ item }) => (
    <MonthSection 
      monthMetadata={item} 
      startDayOfWeek={startDayOfWeek}
      language={language}
    />
  ), [startDayOfWeek, language]);

  // Phase 1.5: 요일 헤더 동적 생성
  const weekdayNames = useMemo(() => 
    getWeekdayNames(language, startDayOfWeek), 
    [language, startDayOfWeek]
  );

  // Phase 1.5: 월 타이틀 동적 생성
  const currentMonthTitle = useMemo(() => 
    formatMonthTitle(currentVisibleMonth.year, currentVisibleMonth.month, language),
    [currentVisibleMonth, language]
  );

  // ✅ onViewableItemsChanged로 상단 스크롤 감지 + 현재 월 추적
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) {
      const firstIdx = viewableItems[0].index;
      
      // Phase 1.5: 현재 보고 있는 월 업데이트
      setCurrentVisibleMonth(months[firstIdx]);
      
      // 상단 3개월 이내 도달 시 과거 데이터 로드
      if (firstIdx <= 3) {
        handleStartReached();
      }
    }
  }, [months, handleStartReached]);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 30
  }).current;

  return (
    <View style={styles.container}>
      {/* Phase 1.5: 고정 헤더 */}
      <View style={styles.fixedHeader}>
        <Text style={styles.fixedMonthTitle}>{currentMonthTitle}</Text>
        <View style={styles.weekdayHeader}>
          {weekdayNames.map((day, idx) => (
            <Text key={idx} style={styles.weekdayText}>{day}</Text>
          ))}
        </View>
      </View>

      <FlashList
        data={months}
        renderItem={renderMonth}
        keyExtractor={(item) => item.id}
        estimatedItemSize={MONTH_HEIGHT}
        initialScrollIndex={initialScrollIndex}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.2}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        onScrollToIndexFailed={(info) => {
          console.warn('Scroll to index failed:', info);
          flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false
          });
        }}
      />
    </View>
  );
}
```

**Phase 1.5 버그 수정**:
- `MainTabs.js`에서 CalendarTest 탭 제거: CalendarTest 탭이 백그라운드에서 항상 마운트되어 있어 무한 루프 발생
- FlashList의 `extraData` prop 제거: 설정 변경 시 `renderMonth` 함수의 의존성 배열이 자동으로 리렌더링 트리거

---

### 3. useInfiniteCalendar (Custom Hook)

**책임**: 월 메타데이터 배열 관리 및 무한 스크롤 로직

**Return Value**:
```javascript
{
  months: Array<MonthMetadata>,  // [{year: 2025, month: 1, id: '2025-01'}, ...]
  handleEndReached: () => void,
  handleStartReached: () => void,
  initialScrollIndex: number
}
```

**State (Zustand Store)**:
```javascript
{
  months: Array<MonthMetadata>,  // Primitive only
  isLoadingRef: { current: boolean }
}
```

**주요 로직**:
- 초기화: 현재 월 ±2개월 (총 5개월) 생성
- 하단 스크롤: 6개월 추가 (동기 처리)
- 상단 스크롤: 6개월 추가 (동기 처리)
- 메모리 관리: 100개월 초과 시 최근 50개월만 유지

```javascript
// useInfiniteCalendar.js
export function useInfiniteCalendar() {
  const { months, addFutureMonths, addPastMonths } = useCalendarStore();
  const isLoadingRef = useRef(false);

  const handleEndReached = useCallback(() => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    
    const startTime = performance.now();
    addFutureMonths(6);  // 동기 처리
    const endTime = performance.now();
    console.log(`Added 6 future months in ${endTime - startTime}ms`);
    
    isLoadingRef.current = false;
  }, [addFutureMonths]);

  // ... similar for handleStartReached

  return { months, handleEndReached, handleStartReached, initialScrollIndex: 2 };
}
```

---

### 4. MonthSection (Presentation Component)

**책임**: 월 단위 렌더링 (weeks 배열 생성)

**Props**:
```javascript
{
  monthMetadata: { year: number, month: number, id: string },
  startDayOfWeek: number,  // Phase 1.5: 0 (일요일) or 1 (월요일)
  language: string         // Phase 1.5: 'ko' or 'en'
}
```

**Computed State (useMemo)**:
- `weeks`: Array<Array<DayObject>> (6주 × 7일 = 42개 날짜)
- `monthTitle`: string (예: "2025년 1월" 또는 "January 2025")

**주요 기능**:
- monthMetadata로부터 weeks 배열 동기 생성 (useMemo)
- Phase 1.5: startDayOfWeek 기반 주 시작일 계산
- Phase 1.5: language 기반 월 타이틀 포맷팅
- 6주 고정 (부족한 주는 빈 셀로 패딩)
- WeekRow 컴포넌트 렌더링

```javascript
// MonthSection.js (Phase 1.5 업데이트)
export default function MonthSection({ monthMetadata, startDayOfWeek = 0, language = 'ko' }) {
  const weeks = useMemo(() => {
    return generateWeeks(monthMetadata.year, monthMetadata.month, startDayOfWeek);
  }, [monthMetadata.year, monthMetadata.month, startDayOfWeek]);

  const monthTitle = useMemo(() => {
    return formatMonthTitle(monthMetadata.year, monthMetadata.month, language);
  }, [monthMetadata.year, monthMetadata.month, language]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{monthTitle}</Text>
      {weeks.map((week, idx) => (
        <WeekRow key={idx} week={week} />
      ))}
    </View>
  );
}
```

---

### 5. WeekRow (Presentation Component)

**책임**: 주 단위 행 렌더링 (7개 DayCell)

**Props**:
```javascript
{
  week: Array<DayObject>  // 7개 날짜
}
```

**주요 기능**:
- 7개 DayCell 컴포넌트 렌더링
- Flexbox 레이아웃 (flexDirection: 'row')

```javascript
// WeekRow.js
export default function WeekRow({ week }) {
  return (
    <View style={styles.row}>
      {week.map((day) => (
        <DayCell key={day.dateString} day={day} />
      ))}
    </View>
  );
}
```

---

### 6. DayCell (Presentation Component)

**책임**: 개별 날짜 셀 렌더링

**Props**:
```javascript
{
  day: {
    date: number,           // 1~31
    isCurrentMonth: boolean,
    isToday: boolean
  }
}
```

**주요 기능**:
- 날짜 숫자 표시
- 스타일링 (현재 월 여부, 오늘 날짜)
- Phase 1.5: 이전/다음 월 날짜는 완전히 숨김 (빈 공간)

```javascript
// DayCell.js (Phase 1.5 업데이트)
export default function DayCell({ day }) {
  // Phase 1.5: 다른 월 날짜는 빈 공간으로 표시
  if (!day.isCurrentMonth) {
    return <View style={styles.cell} />;
  }

  return (
    <View style={styles.cell}>
      <Text style={styles.dateText}>{day.date}</Text>
    </View>
  );
}

// ✅ React key는 dateString 사용
// <DayCell key={day.dateString} day={day} />

const styles = StyleSheet.create({
  cell: {
    width: SCREEN_WIDTH / 7,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 16,
    color: '#333',
  },
});
```

---

### 7. calendarHelpers (Utility Module)

**책임**: 날짜 계산 순수 함수 제공

**Functions**:

```javascript
// calendarHelpers.js

/**
 * 특정 월의 6주 고정 weeks 배열 생성
 * @param {number} year - 연도 (예: 2025)
 * @param {number} month - 월 (1~12)
 * @param {number} startDayOfWeek - 시작 요일 (0: 일요일, 1: 월요일) [Phase 1.5]
 * @returns {Array<Array<DayObject>>} - 6주 × 7일 배열
 */
export function generateWeeks(year, month, startDayOfWeek = 0) {
  const firstDay = dayjs(`${year}-${month}-01`);
  const lastDay = firstDay.endOf('month');
  
  // 첫 주 시작일 (startDayOfWeek 기준)
  const startDay = firstDay.day(startDayOfWeek);  // 이전 주 시작 요일
  
  const weeks = [];
  let currentDay = startDay;
  
  // 6주 고정 생성
  for (let week = 0; week < 6; week++) {
    const weekDays = [];
    for (let day = 0; day < 7; day++) {
      weekDays.push({
        date: currentDay.date(),
        dateString: currentDay.format('YYYY-MM-DD'),  // ✅ unique key
        isCurrentMonth: currentDay.month() === month - 1,
        isToday: currentDay.isSame(dayjs(), 'day'),
      });
      currentDay = currentDay.add(1, 'day');
    }
    weeks.push(weekDays);
  }
  
  return weeks;
}

/**
 * 요일 이름 배열 생성 (언어 및 시작 요일 기반) [Phase 1.5]
 * @param {string} language - 언어 코드 ('ko', 'en')
 * @param {number} startDayOfWeek - 시작 요일 (0: 일요일, 1: 월요일)
 * @returns {Array<string>} - 요일 이름 배열 (7개)
 */
export function getWeekdayNames(language = 'ko', startDayOfWeek = 0) {
  const weekdays = language === 'ko' 
    ? ['일', '월', '화', '수', '목', '금', '토']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  
  if (startDayOfWeek === 1) {
    // 월요일 시작: [월, 화, 수, 목, 금, 토, 일]
    return [...weekdays.slice(1), weekdays[0]];
  }
  
  return weekdays;  // 일요일 시작
}

/**
 * 월 타이틀 포맷팅 (언어 기반) [Phase 1.5]
 * @param {number} year - 연도
 * @param {number} month - 월 (1~12)
 * @param {string} language - 언어 코드 ('ko', 'en')
 * @returns {string} - 포맷된 월 타이틀
 */
export function formatMonthTitle(year, month, language = 'ko') {
  if (language === 'ko') {
    return `${year}년 ${month}월`;
  }
  
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  
  return `${monthNames[month - 1]} ${year}`;
}

/**
 * 월 메타데이터 생성
 * @param {number} year
 * @param {number} month
 * @returns {MonthMetadata}
 */
export function createMonthMetadata(year, month) {
  return {
    year,
    month,
    id: `${year}-${String(month).padStart(2, '0')}`,
  };
}

/**
 * dayjs 객체로부터 MonthMetadata 생성 (안전한 래퍼)
 * @param {Dayjs} dayjsObj - dayjs 인스턴스
 * @returns {MonthMetadata}
 * @note dayjs.month()는 0-indexed (0=1월, 11=12월)이므로 +1 필요
 */
export function createMonthMetadataFromDayjs(dayjsObj) {
  const year = dayjsObj.year();
  const month = dayjsObj.month() + 1;  // 0-indexed → 1-indexed
  return createMonthMetadata(year, month);
}

/**
 * 미래 N개월 메타데이터 배열 생성
 * @param {MonthMetadata} lastMonth
 * @param {number} count
 * @returns {Array<MonthMetadata>}
 */
export function generateFutureMonths(lastMonth, count) {
  const result = [];
  let current = dayjs(`${lastMonth.year}-${lastMonth.month}-01`);
  
  for (let i = 0; i < count; i++) {
    current = current.add(1, 'month');
    result.push(createMonthMetadataFromDayjs(current));
  }
  
  return result;
}

/**
 * 과거 N개월 메타데이터 배열 생성
 * @param {MonthMetadata} firstMonth
 * @param {number} count
 * @returns {Array<MonthMetadata>}
 */
export function generatePastMonths(firstMonth, count) {
  const result = [];
  let current = dayjs(`${firstMonth.year}-${firstMonth.month}-01`);
  
  for (let i = 0; i < count; i++) {
    current = current.subtract(1, 'month');
    result.unshift(createMonthMetadataFromDayjs(current));
  }
  
  return result;
}
```

---

## Data Models

### MonthMetadata (Primitive State)

```javascript
{
  year: number,      // 2025
  month: number,     // 1~12
  id: string         // "2025-01" (unique key)
}
```

**특징**:
- Date/Day.js 객체 없음 (Primitive only)
- 직렬화 가능 (JSON.stringify 가능)
- 메모리 효율적 (~24 bytes per month)

---

### DayObject (Computed State)

```javascript
{
  date: number,           // 1~31
  dateString: string,     // "2025-01-28" (unique key)
  isCurrentMonth: boolean,
  isToday: boolean
}
```

**특징**:
- MonthSection 컴포넌트에서 useMemo로 생성
- Global State에 저장하지 않음
- 렌더링 시점에만 존재
- `dateString`은 React key로 사용 (date만으로는 이전/다음 월과 중복 가능)

---

### WeekData (Computed State)

```javascript
Array<DayObject>  // 7개 날짜
```

**특징**:
- MonthSection 컴포넌트에서 useMemo로 생성
- 6주 고정 (총 42개 DayObject)

---

## Architecture Decisions

### 1. State 경량화 전략

**문제**: 기존 UltimateCalendar는 weeks 배열을 State에 저장하여 100개월 누적 시 메모리 폭발

**해결책**: Global State에는 메타데이터만 저장, weeks는 컴포넌트에서 동기 생성

**근거**:
- MonthMetadata: 24 bytes × 100개월 = 2.4KB
- Weeks 배열: ~10KB × 100개월 = 1MB (기존 방식)
- 동기 생성 비용: 1ms 이하 (useMemo 캐싱)

---

### 2. 동기 처리 (No setTimeout)

**문제**: 기존 코드는 setTimeout으로 비동기 생성 → race condition 발생

**해결책**: 모든 데이터 생성을 동기 처리 + isLoadingRef로 중복 방지

**근거**:
- 메타데이터 생성: 1ms 이하 (6개월 기준)
- setTimeout 제거로 race condition 완전 제거
- 코드 복잡도 감소

---

### 3. 6주 고정 레이아웃

**문제**: 월마다 주 수가 다르면 FlashList estimatedItemSize 부정확 → 스크롤 점프

**해결책**: 모든 월을 6주(420px)로 고정, 부족한 주는 빈 셀로 패딩

**근거**:
- Gregorian 달력: 최대 6주 (5주 또는 6주)
- estimatedItemSize 정확도 100% 달성
- maintainVisibleContentPosition 오차 제로

---

### 4. FlashList vs FlatList

**선택**: FlashList

**근거**:
- 100개월 렌더링 시 FlatList 대비 10배 빠름
- Recycling 메커니즘으로 메모리 효율적
- maintainVisibleContentPosition 지원 (상단 스크롤 안정성)

---

### 5. Zustand vs React Query

**선택**: Zustand (캘린더 State 관리)

**근거**:
- 캘린더는 서버 데이터 없음 (클라이언트 전용)
- React Query는 서버 동기화용 (불필요)
- Zustand는 경량 State 관리에 최적

---

## Error Handling

### 1. 날짜 계산 오류

**시나리오**: dayjs 계산 오류 (잘못된 year/month)

**처리**:
```javascript
export function generateWeeks(year, month) {
  try {
    const firstDay = dayjs(`${year}-${month}-01`);
    if (!firstDay.isValid()) {
      console.error(`Invalid date: ${year}-${month}`);
      return generateEmptyWeeks();  // 빈 6주 반환
    }
    // ... 정상 로직
  } catch (error) {
    console.error('generateWeeks error:', error);
    return generateEmptyWeeks();
  }
}
```

---

### 2. FlashList 스크롤 오류

**시나리오**: initialScrollIndex가 범위 초과

**처리**:
```javascript
<FlashList
  initialScrollIndex={Math.min(initialScrollIndex, months.length - 1)}
  onScrollToIndexFailed={(info) => {
    console.warn('Scroll to index failed:', info);
    // Fallback: offset 기반 스크롤
    flatListRef.current?.scrollToOffset({
      offset: info.averageItemLength * info.index,
      animated: false
    });
  }}
/>
```

---

### 3. 메모리 제한 초과

**시나리오**: 100개월 초과 누적

**처리**:
```javascript
function addFutureMonths(count) {
  const newMonths = generateFutureMonths(lastMonth, count);
  
  set((state) => {
    const updated = [...state.months, ...newMonths];
    
    // 100개월 초과 시 최근 50개월만 유지
    if (updated.length > 100) {
      console.warn('Memory limit exceeded, trimming to 50 months');
      return { months: updated.slice(-50) };
    }
    
    return { months: updated };
  });
}
```

**Phase 2 개선 사항**:
- 현재 visible index를 기준으로 앞뒤 25개월씩 유지
- 사용자가 과거로 스크롤 중일 때 현재 보고 있는 월이 잘리지 않도록 보장
- Phase 1에서는 100개월까지 스크롤하는 경우가 드물므로 단순 구현 유지

---

### 4. 중복 로딩 방지

**시나리오**: 빠른 스크롤로 여러 번 onEndReached 호출

**처리**:
```javascript
const isLoadingRef = useRef(false);

const handleEndReached = useCallback(() => {
  if (isLoadingRef.current) {
    console.log('Already loading, skipping');
    return;
  }
  
  isLoadingRef.current = true;
  addFutureMonths(6);
  isLoadingRef.current = false;
}, [addFutureMonths]);
```

---

## Testing Strategy

### Unit Tests

Phase 1에서는 자동화된 테스트 프레임워크가 없으므로, 수동 테스트 화면을 통해 검증합니다.

**테스트 항목**:
1. `generateWeeks()` 함수 정확성
   - 2025년 1월: 6주 생성 확인
   - 2025년 2월: 6주 생성 확인 (28일)
   - 첫 주에 이전 월 날짜 포함 확인
   - 마지막 주에 다음 월 날짜 포함 확인

2. `createMonthMetadata()` 함수
   - year, month, id 필드 확인
   - id 형식: "YYYY-MM"

3. `generateFutureMonths()` / `generatePastMonths()`
   - 6개월 생성 확인
   - 연도 넘김 처리 (12월 → 1월)

**수동 테스트 방법**:
```javascript
// client/src/test/CalendarHelpersTest.js
import { generateWeeks, createMonthMetadata } from '../features/todo-calendar/utils/calendarHelpers';

export default function CalendarHelpersTest() {
  const testGenerateWeeks = () => {
    const weeks = generateWeeks(2025, 1);
    console.log('2025년 1월 weeks:', weeks);
    console.assert(weeks.length === 6, 'Should have 6 weeks');
    console.assert(weeks[0].length === 7, 'Each week should have 7 days');
  };

  return (
    <View>
      <Button title="Test generateWeeks" onPress={testGenerateWeeks} />
    </View>
  );
}
```

---

### Integration Tests

**테스트 시나리오**:

1. **초기 로딩 성능**
   - Settings → "무한 스크롤 캘린더 테스트" 클릭
   - 0.1초 이내 렌더링 확인
   - Expo Performance Monitor: 60fps 확인

2. **하단 무한 스크롤**
   - 빠르게 아래로 스크롤 (10개월)
   - 끊김 없이 미래 달력 생성 확인
   - 60fps 유지 확인

3. **상단 무한 스크롤**
   - 빠르게 위로 스크롤 (10개월)
   - 화면 점프 없음 확인
   - 60fps 유지 확인

4. **100개월 누적 테스트**
   - 빠르게 스크롤하여 100개월 누적
   - React DevTools → State 크기 < 10KB 확인
   - 메모리 사용량 확인

5. **날짜 표시 정확성**
   - 2025년 1월 1일 (수요일) 확인
   - 이전 월 날짜 opacity 30% 확인
   - 요일 헤더 (일~토) 확인

**테스트 진입점**:
```javascript
// client/src/screens/SettingsScreen.js
<Button
  title="무한 스크롤 캘린더 테스트"
  onPress={() => navigation.navigate('TodoCalendar')}
/>
```

---

### Performance Benchmarks

**측정 방법**:
```javascript
// useInfiniteCalendar.js
const handleEndReached = useCallback(() => {
  const startTime = performance.now();
  addFutureMonths(6);
  const endTime = performance.now();
  console.log(`Added 6 months in ${endTime - startTime}ms`);
}, [addFutureMonths]);
```

**목표 수치**:
| Metric | Target | Actual |
|--------|--------|--------|
| 초기 로딩 | < 100ms | TBD |
| 6개월 추가 | < 5ms | TBD |
| 스크롤 FPS | 60fps | TBD |
| State 크기 (100개월) | < 10KB | TBD |

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Append 6 Future Months

*For any* existing month array and last month metadata, when appending future months, the resulting array should contain exactly 6 additional months in chronological order.

**Validates: Requirements 1.2**

---

### Property 2: Prepend 6 Past Months

*For any* existing month array and first month metadata, when prepending past months, the resulting array should contain exactly 6 additional months in reverse chronological order at the beginning.

**Validates: Requirements 1.3**

---

### Property 3: Memory Limit Enforcement

*For any* month array exceeding 100 months, the system should retain only the most recent 50 months.

**Validates: Requirements 1.5**

---

### Property 4: Primitive State Only

*For any* State_Store snapshot, all values in the months array should be primitive types (number, string, boolean) with no Date or Day.js objects.

**Validates: Requirements 2.1, 2.2**

---

### Property 5: State Size Limit

*For any* State_Store containing 100 months, the serialized size (JSON.stringify) should be less than 10KB.

**Validates: Requirements 2.3**

---

### Property 6: Fixed 6 Weeks Per Month

*For any* year and month (1~12), the generateWeeks function should return exactly 6 weeks (array length 6).

**Validates: Requirements 3.1, 3.2**

---

### Property 7: Metadata Generation Performance

*For any* single month metadata creation, the execution time should be less than 1ms.

**Validates: Requirements 5.1**

---

### Property 8: Initial Generation Performance

*For any* initial 5-month generation, the total execution time should be less than 10ms.

**Validates: Requirements 6.3**

---

### Property 9: Append Performance

*For any* 6-month append operation, the execution time should be less than 5ms.

**Validates: Requirements 7.2**

---

### Property 10: Prepend Performance

*For any* 6-month prepend operation, the execution time should be less than 5ms.

**Validates: Requirements 7.3**

---

### Property 11: Week Row Cell Count

*For any* week array, the WeekRow component should render exactly 7 DayCell components.

**Validates: Requirements 9.3**

---

### Property 12: Pure Function Guarantee

*For any* calendarHelpers function and identical inputs, calling the function multiple times should produce identical outputs (referential transparency).

**Validates: Requirements 9.5**

---

### Property 13: Total Day Count

*For any* year and month (1~12), the generateWeeks function should return exactly 42 Day_Object instances (6 weeks × 7 days).

**Validates: Requirements 10.5**

---

### Property 14: Month Boundary Correctness

*For any* month that does not start on Sunday, the first week should include dates from the previous month with isCurrentMonth: false.

**Validates: Requirements 10.1**

---

### Property 15: Month Boundary Correctness (End)

*For any* month that does not end on Saturday, the last week should include dates from the next month with isCurrentMonth: false.

**Validates: Requirements 10.2**

---

## Implementation Notes

### Phase 1 Scope

이 디자인 문서는 Phase 1 범위를 다룹니다:
- ✅ 무한 스크롤 캘린더 UI 구현
- ✅ 날짜 표시 및 스타일링
- ✅ 성능 최적화 (State 경량화, 6주 고정)
- ✅ 테스트 진입점
- ✅ `isToday` 필드 생성 (시각적 하이라이트는 Phase 2)

### Phase 1.5 Scope (Settings Integration)

Phase 1과 Phase 2 사이에 추가된 설정 연동 작업:
- ✅ `startDayOfWeek` 설정 지원 (0: 일요일, 1: 월요일)
- ✅ `language` 설정 지원 (ko, en)
- ✅ authStore 직접 구독 (Selector 패턴)
- ✅ 동적 요일 헤더 생성
- ✅ 언어별 월 타이틀 포맷팅
- ✅ 고정 헤더 (현재 보고 있는 월 표시)
- ✅ 무한 루프 버그 수정 (CalendarTest 탭 제거)

**주요 변경 사항**:
1. `calendarHelpers.js`에 `getWeekdayNames()`, `formatMonthTitle()` 함수 추가
2. `generateWeeks()` 함수에 `startDayOfWeek` 파라미터 추가
3. `CalendarList.js`에서 authStore 구독 및 고정 헤더 추가
4. `MonthSection.js`에 `startDayOfWeek`, `language` props 추가
5. `MainTabs.js`에서 CalendarTest 탭 제거 (무한 루프 원인)

Phase 2 (향후):
- ❌ Todo 데이터 연동 (SQLite 조회)
- ❌ 완료 표시 (점/체크마크)
- ❌ 날짜 클릭 이벤트
- ❌ 오늘 날짜 시각적 하이라이트 (배경색, 테두리)

**Note**: Phase 1에서는 `isToday` 필드를 DayObject에 포함하지만, 시각적 하이라이트(배경색, 테두리 등)는 구현하지 않습니다. 이는 Phase 2에서 Todo 데이터와 함께 구현됩니다.

---

### Directory Structure

```
client/src/features/todo-calendar/
├── index.js                      # Public API export
├── TodoCalendarScreen.js         # Screen component
├── hooks/
│   └── useInfiniteCalendar.js    # Infinite scroll logic
├── ui/
│   ├── CalendarList.js           # FlashList container
│   ├── MonthSection.js           # Month rendering
│   ├── WeekRow.js                # Week row
│   └── DayCell.js                # Day cell
├── utils/
│   └── calendarHelpers.js        # Date calculation utilities
└── store/
    └── calendarStore.js          # Zustand store
```

---

### Navigation Setup

```javascript
// client/src/navigation/AppNavigator.js
import TodoCalendarScreen from '../features/todo-calendar/TodoCalendarScreen';

<Stack.Screen
  name="TodoCalendar"
  component={TodoCalendarScreen}
  options={{
    title: '무한 스크롤 캘린더',
    headerShown: true,
  }}
/>
```

---

### Settings Screen Integration

```javascript
// client/src/screens/SettingsScreen.js
<TouchableOpacity
  style={styles.testButton}
  onPress={() => navigation.navigate('TodoCalendar')}
>
  <Text style={styles.testButtonText}>무한 스크롤 캘린더 테스트</Text>
</TouchableOpacity>
```

---

### Performance Monitoring

```javascript
// useInfiniteCalendar.js
const handleEndReached = useCallback(() => {
  if (isLoadingRef.current) return;
  isLoadingRef.current = true;
  
  const startTime = performance.now();
  addFutureMonths(6);
  const endTime = performance.now();
  
  console.log(`[Performance] Added 6 future months in ${endTime - startTime}ms`);
  
  isLoadingRef.current = false;
}, [addFutureMonths]);
```

---

### React DevTools State Inspection

```javascript
// calendarStore.js
export const useCalendarStore = create((set, get) => ({
  months: [],
  
  // Debug helper
  getStateSize: () => {
    const state = get();
    const serialized = JSON.stringify(state.months);
    const sizeKB = (serialized.length / 1024).toFixed(2);
    console.log(`[State Size] ${state.months.length} months = ${sizeKB} KB`);
    return sizeKB;
  },
}));
```

---

## References

- [FlashList Documentation](https://shopify.github.io/flash-list/)
- [Day.js Documentation](https://day.js.org/)
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [React Navigation Documentation](https://reactnavigation.org/)
- [Expo Performance Monitor](https://docs.expo.dev/debugging/runtime-issues/#performance-monitor)
