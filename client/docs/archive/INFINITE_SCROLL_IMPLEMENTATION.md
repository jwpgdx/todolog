# 무한 스크롤 + 동적 이벤트 구현 가이드

## 📐 아키텍처

### 레이어 구조
```
┌─────────────────────────────────────┐
│  UI Layer (FlashList)               │
│  - 화면에 보이는 월만 렌더링         │
│  - onViewableItemsChanged 감지      │
└─────────────────────────────────────┘
           ↓ ↑
┌─────────────────────────────────────┐
│  Data Layer (useState)              │
│  - months: 생성된 달력 데이터        │
│  - loadedRange: 생성된 범위 추적     │
└─────────────────────────────────────┘
           ↓ ↑
┌─────────────────────────────────────┐
│  Event Layer (useMemo)              │
│  - visibleRange: 보이는 범위 추적    │
│  - eventsByDate: 동적 이벤트 계산    │
└─────────────────────────────────────┘
           ↓ ↑
┌─────────────────────────────────────┐
│  Cache Layer (React Query)          │
│  - todos: 전체 할일 캐시             │
│  - categories: 카테고리 캐시         │
└─────────────────────────────────────┘
```

---

## 🔧 Phase 1: CalendarScreen 구현

### Step 1.1: 상태 관리 추가

```javascript
// CalendarScreen.js
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';

export default function CalendarScreen() {
    // 기존 코드
    const { data: todos } = useAllTodos();
    const { data: categories } = useCategories();
    
    // ✅ 새로운 상태 추가
    const [months, setMonths] = useState([]);
    const [loadedRange, setLoadedRange] = useState({
        start: dayjs().subtract(6, 'month'),
        end: dayjs().add(12, 'month')
    });
    const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    
    // 기존 useMemo 제거
    // const { months, todayMonthIndex } = useMemo(() =>
    //     generateMonthlyData(12, 24, startDayOfWeek),
    //     [startDayOfWeek]
    // );
}
```

### Step 1.2: 초기 데이터 생성

```javascript
// 초기 19개월 생성
useEffect(() => {
    const initialMonths = [];
    let currentMonth = loadedRange.start.clone();
    let todayIndex = 0;
    let currentIndex = 0;
    
    while (currentMonth.isBefore(loadedRange.end) || currentMonth.isSame(loadedRange.end, 'month')) {
        const monthData = createMonthData(currentMonth, startDayOfWeek);
        
        // 오늘이 포함된 월 인덱스 저장
        if (currentMonth.isSame(dayjs(), 'month')) {
            todayIndex = currentIndex;
        }
        
        initialMonths.push(monthData);
        currentMonth = currentMonth.add(1, 'month');
        currentIndex++;
    }
    
    setMonths(initialMonths);
    setCurrentViewIndex(todayIndex);
}, [startDayOfWeek]);

// 월 데이터 생성 헬퍼 함수
function createMonthData(monthStart, startDayOfWeek) {
    const monthKey = monthStart.format('YYYY-MM');
    const title = monthStart.format('YYYY년 M월');
    const targetDayIndex = startDayOfWeek === 'monday' ? 1 : 0;
    
    // 주 생성 로직 (기존 generateMonthlyData와 동일)
    const diff = (monthStart.day() + 7 - targetDayIndex) % 7;
    let weekStart = monthStart.subtract(diff, 'day');
    const monthEnd = monthStart.endOf('month');
    
    const weeks = [];
    while (weekStart.isBefore(monthEnd) || weekStart.isSame(monthEnd, 'day')) {
        const week = [];
        for (let d = 0; d < 7; d++) {
            const date = weekStart.add(d, 'day');
            week.push({
                dateObj: date,
                dateString: date.format('YYYY-MM-DD'),
                text: date.date(),
                dayOfWeek: date.day(),
                monthIndex: date.month(),
                isToday: date.isSame(dayjs(), 'day'),
                isFirstDay: date.date() === 1,
                isSunday: date.day() === 0,
                isSaturday: date.day() === 6,
                isCurrentMonth: date.month() === monthStart.month(),
            });
        }
        weeks.push(week);
        weekStart = weekStart.add(7, 'day');
    }
    
    return { monthKey, title, weeks };
}
```

### Step 1.3: 무한 스크롤 구현

```javascript
// 아래로 스크롤 (미래 방향)
const handleEndReached = useCallback(() => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    // 현재 끝에서 12개월 추가
    const currentEnd = loadedRange.end;
    const newEnd = currentEnd.add(12, 'month');
    
    const newMonths = [];
    let currentMonth = currentEnd.add(1, 'month');
    
    while (currentMonth.isBefore(newEnd) || currentMonth.isSame(newEnd, 'month')) {
        newMonths.push(createMonthData(currentMonth, startDayOfWeek));
        currentMonth = currentMonth.add(1, 'month');
    }
    
    setMonths(prev => [...prev, ...newMonths]);
    setLoadedRange(prev => ({ ...prev, end: newEnd }));
    setIsLoadingMore(false);
    
    console.log(`📅 [무한스크롤] 12개월 추가: ${currentEnd.format('YYYY-MM')} ~ ${newEnd.format('YYYY-MM')}`);
}, [loadedRange, isLoadingMore, startDayOfWeek]);

// FlashList에 적용
<FlashList
    ref={flatListRef}
    data={months}
    renderItem={renderMonth}
    keyExtractor={(item) => item.monthKey}
    estimatedItemSize={400}
    initialScrollIndex={currentViewIndex}
    showsVerticalScrollIndicator={false}
    
    // ✅ 무한 스크롤 추가
    onEndReached={handleEndReached}
    onEndReachedThreshold={0.5}  // 50% 남았을 때 트리거
    
    onViewableItemsChanged={onViewableItemsChanged}
    viewabilityConfig={viewabilityConfig}
    onScrollToIndexFailed={handleScrollToIndexFailed}
/>
```

### Step 1.4: 동적 이벤트 계산

```javascript
// 보이는 범위 추적
const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
        const firstIdx = viewableItems[0].index;
        const lastIdx = viewableItems[viewableItems.length - 1].index;
        
        setCurrentViewIndex(firstIdx);
        setVisibleRange({ start: firstIdx, end: lastIdx });
    }
}).current;

// 동적 이벤트 계산 (보이는 범위 ±3개월만)
const eventsByDate = useMemo(() => {
    if (!todos || !categories || months.length === 0) return {};
    
    // 보이는 범위 확장 (±3개월)
    const startIdx = Math.max(0, visibleRange.start - 3);
    const endIdx = Math.min(months.length - 1, visibleRange.end + 3);
    
    const startMonth = months[startIdx];
    const endMonth = months[endIdx];
    
    if (!startMonth || !endMonth) return {};
    
    const rangeStart = dayjs(startMonth.monthKey).startOf('month');
    const rangeEnd = dayjs(endMonth.monthKey).endOf('month');
    
    console.log(`🎯 [이벤트계산] 범위: ${rangeStart.format('YYYY-MM')} ~ ${rangeEnd.format('YYYY-MM')}`);
    
    // 기존 이벤트 계산 로직 재사용 (범위만 제한)
    return calculateEventsInRange(todos, categories, rangeStart, rangeEnd);
}, [todos, categories, months, visibleRange]);

// 이벤트 계산 헬퍼 함수
function calculateEventsInRange(todos, categories, rangeStart, rangeEnd) {
    const categoryColorMap = {};
    categories.forEach(c => categoryColorMap[c._id] = c.color);
    
    const eventsMap = {};
    
    todos.forEach(todo => {
        if (!todo.startDate) return;
        
        // 반복 일정
        if (todo.recurrence) {
            const rruleString = todo.recurrence?.[0];
            if (!rruleString) return;
            
            const todoStartDate = new Date(todo.startDate);
            const todoEndDate = todo.recurrenceEndDate ? new Date(todo.recurrenceEndDate) : null;
            
            // ✅ 제한된 범위만 체크
            let loopDate = rangeStart.clone();
            while (loopDate.isBefore(rangeEnd) || loopDate.isSame(rangeEnd, 'day')) {
                if (isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
                    const dateStr = loopDate.format('YYYY-MM-DD');
                    if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                    eventsMap[dateStr].push({
                        title: todo.title,
                        color: categoryColorMap[todo.categoryId] || '#ccc',
                        todo,
                    });
                }
                loopDate = loopDate.add(1, 'day');
            }
        } else {
            // 단일 일정 (기존 로직)
            const start = dayjs(todo.startDate);
            const end = todo.endDate ? dayjs(todo.endDate) : start;
            
            let current = start.clone();
            while (current.isBefore(end) || current.isSame(end, 'day')) {
                // ✅ 범위 체크 추가
                if (current.isAfter(rangeStart) && current.isBefore(rangeEnd)) {
                    const dateStr = current.format('YYYY-MM-DD');
                    if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                    eventsMap[dateStr].push({
                        title: todo.title,
                        color: categoryColorMap[todo.categoryId] || '#ccc',
                        todo,
                    });
                }
                current = current.add(1, 'day');
            }
        }
    });
    
    return eventsMap;
}
```

---

## 🔧 Phase 2: UltimateCalendar 구현

### Step 2.1: 상태 관리 추가

```javascript
// UltimateCalendar.js
export default function UltimateCalendar({ eventsByDate = {} }) {
    // 기존 코드
    const today = useMemo(() => dayjs(), []);
    const { currentDate } = useDateStore();
    
    // ✅ 새로운 상태 추가
    const [weeks, setWeeks] = useState([]);
    const [loadedRange, setLoadedRange] = useState({
        start: today.subtract(6, 'month'),
        end: today.add(12, 'month')
    });
    
    // 기존 useMemo 제거
    // const { weeks, todayWeekIndex } = useMemo(() =>
    //     generateCalendarData(today, startDayOfWeek),
    //     [today, startDayOfWeek]
    // );
}
```

### Step 2.2: 초기 데이터 생성

```javascript
// 초기 주 데이터 생성
useEffect(() => {
    const initialWeeks = generateWeeksInRange(
        loadedRange.start,
        loadedRange.end,
        startDayOfWeek
    );
    setWeeks(initialWeeks);
}, [startDayOfWeek]);

// 주 생성 헬퍼 함수
function generateWeeksInRange(rangeStart, rangeEnd, startDayOfWeek) {
    const targetDayIndex = startDayOfWeek === 'monday' ? 1 : 0;
    const monthStart = rangeStart.startOf('month');
    
    const diff = (monthStart.day() + 7 - targetDayIndex) % 7;
    const start = monthStart.subtract(diff, 'day');
    
    const weeksArray = [];
    let currentDate = start;
    
    while (currentDate.isBefore(rangeEnd) || currentDate.isSame(rangeEnd, 'day')) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = currentDate.add(i, 'day');
            week.push({
                dateObj: date,
                dateString: date.format('YYYY-MM-DD'),
                text: date.date(),
                dayOfWeek: date.day(),
                monthIndex: date.month(),
                isToday: date.isSame(dayjs(), 'day'),
                isFirstDay: date.date() === 1,
                isSunday: date.day() === 0,
                isSaturday: date.day() === 6,
            });
        }
        weeksArray.push(week);
        currentDate = currentDate.add(7, 'day');
    }
    
    return weeksArray;
}
```

### Step 2.3: MonthlyView 무한 스크롤

```javascript
// MonthlyView.js
const MonthlyView = forwardRef(({ 
    weeks, 
    onDatePress, 
    onVisibleWeeksChange, 
    initialIndex,
    eventsByDate,
    onLoadMore  // ✅ 새로 추가
}, ref) => {
    const listRef = useRef(null);
    
    // ✅ 무한 스크롤 핸들러
    const handleEndReached = useCallback(() => {
        if (onLoadMore) {
            onLoadMore('forward');
        }
    }, [onLoadMore]);
    
    return (
        <View style={{ height: '100%', width: SCREEN_WIDTH }}>
            <FlashList
                ref={listRef}
                data={weeks}
                renderItem={renderItem}
                keyExtractor={(item, index) => `month-week-${index}`}
                estimatedItemSize={CELL_HEIGHT}
                initialScrollIndex={initialIndex}
                showsVerticalScrollIndicator={false}
                
                // ✅ 무한 스크롤 추가
                onEndReached={handleEndReached}
                onEndReachedThreshold={0.5}
                
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={viewabilityConfig}
                removeClippedSubviews={false}
            />
        </View>
    );
});
```

### Step 2.4: 부모에서 데이터 추가

```javascript
// UltimateCalendar.js
const handleLoadMore = useCallback((direction) => {
    if (direction === 'forward') {
        const currentEnd = loadedRange.end;
        const newEnd = currentEnd.add(12, 'month');
        
        const newWeeks = generateWeeksInRange(
            currentEnd.add(1, 'day'),
            newEnd,
            startDayOfWeek
        );
        
        setWeeks(prev => [...prev, ...newWeeks]);
        setLoadedRange(prev => ({ ...prev, end: newEnd }));
        
        console.log(`📅 [UltimateCalendar] 12개월 추가: ${currentEnd.format('YYYY-MM')} ~ ${newEnd.format('YYYY-MM')}`);
    }
}, [loadedRange, startDayOfWeek]);

// MonthlyView에 전달
<MonthlyView
    ref={monthlyRef}
    weeks={weeks}
    onDatePress={handleDatePress}
    onVisibleWeeksChange={handleVisibleWeeksChange}
    initialIndex={currentWeekIndex}
    eventsByDate={eventsByDate}
    onLoadMore={handleLoadMore}  // ✅ 추가
/>
```

---

## 📊 성능 최적화 팁

### 1. 메모이제이션
```javascript
// 날짜 객체 재사용
const dateCache = useRef(new Map());

function getCachedDate(dateString) {
    if (dateCache.current.has(dateString)) {
        return dateCache.current.get(dateString);
    }
    
    const dateObj = dayjs(dateString);
    dateCache.current.set(dateString, dateObj);
    return dateObj;
}
```

### 2. 디바운싱
```javascript
// 이벤트 계산 디바운스
const debouncedVisibleRange = useDebounce(visibleRange, 300);

const eventsByDate = useMemo(() => {
    // debouncedVisibleRange 사용
}, [todos, categories, months, debouncedVisibleRange]);
```

### 3. 로딩 인디케이터
```javascript
// 무한 스크롤 로딩 표시
{isLoadingMore && (
    <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color="#999" />
        <Text style={styles.loadingText}>더 불러오는 중...</Text>
    </View>
)}
```

---

## 🧪 테스트 체크리스트

### CalendarScreen
- [ ] 초기 로딩: 19개월 생성 확인
- [ ] 아래 스크롤: 12개월 추가 확인
- [ ] 이벤트 계산: 7개월 범위만 확인
- [ ] 성능: 60fps 유지 확인
- [ ] 메모리: 증가량 확인

### UltimateCalendar
- [ ] 초기 로딩: 19개월 생성 확인
- [ ] MonthlyView: 무한 스크롤 확인
- [ ] WeeklyView: 무한 스크롤 확인
- [ ] 모드 전환: 동기화 확인
- [ ] 이벤트: 표시 확인

---

## 🎯 예상 결과

### 초기 로딩
```
기존: 72개월 + 36개월 이벤트 = 느림
새로: 19개월 + 7개월 이벤트 = 빠름
개선: 73% 빠름
```

### 메모리
```
기존: 72개월 + 1,095일 이벤트
새로: 19개월 + 210일 이벤트
개선: 80% 감소
```

### 스크롤
```
기존: 2030년에서 멈춤
새로: 무한 (2050년+)
개선: 무제한
```

---

## 다음 단계

1. CalendarScreen Phase 1.3 구현
2. CalendarScreen Phase 1.2 구현
3. UltimateCalendar Phase 2 구현
4. 성능 테스트 및 최적화

시작할까요? 🚀
