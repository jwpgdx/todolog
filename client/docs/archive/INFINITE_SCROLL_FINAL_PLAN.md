# 무한 스크롤 최종 구현 계획서

**작성일**: 2026-01-29  
**상태**: 구현 준비 완료  
**예상 소요 시간**: 5-8시간

---

## 📊 현재 상태 분석 (재확인 완료)

### 1. 캐시 구조 (명확히 정리됨)

```javascript
// Vue3 비유
const todoStore = useTodoStore();
todoStore.allTodos = [...]; // 전체 할일 (원본)

// React Query 실제 구조
['todos', 'all'] = [...]; // 전체 할일 (원본) - 단일 캐시

// 각 화면이 필터링
- TodoScreen: useTodos(date) → 날짜별 필터링
- CalendarScreen: useAllTodos() → 전체 가져와서 자체 계산
- UltimateCalendar: useCalendarEvents(year, month) → 월별 필터링
```

**핵심**:
- ✅ 원본 캐시 1개: `['todos', 'all']`
- ✅ React Query가 필터링 결과 자동 캐싱
- ✅ 각 화면이 독립적으로 이벤트 계산

---

### 2. 현재 코드 상태

#### CalendarScreen.js
```javascript
// 정적 데이터 생성 (useMemo)
const { months, todayMonthIndex } = useMemo(() =>
    generateMonthlyData(12, 24, startDayOfWeek),
    [startDayOfWeek]
);

// 정적 이벤트 계산 (useMemo)
const eventsByDate = useMemo(() => {
    // 36개월 범위 전체 계산
    const rangeStart = dayjs().subtract(12, 'month');
    const rangeEnd = dayjs().add(24, 'month');
    // ...
}, [todos, categories]);
```

**문제점**:
- ❌ 72개월 범위 (2024-01 ~ 2030-01)에서 멈춤
- ❌ 36개월 범위 이벤트 계산 (느림)
- ❌ 스크롤해도 새 데이터 추가 안 됨

#### UltimateCalendar.js
```javascript
// 정적 데이터 생성 (useMemo)
const { weeks, todayWeekIndex } = useMemo(() =>
    generateCalendarData(today, startDayOfWeek),
    [today, startDayOfWeek]
);

// TodoScreen에서 이벤트 전달
const { eventsByDate } = useCalendarEvents(currentYear, currentMonth);
```

**문제점**:
- ❌ 36개월 범위 (2023-07 ~ 2029-01)에서 멈춤
- ❌ 스크롤해도 새 데이터 추가 안 됨
- ✅ 이벤트는 이미 최적화됨 (현재 월 ±1개월)

---

## 🎯 구현 목표

### 목표 1: 무한 스크롤
- CalendarScreen: 2050년까지 스크롤 가능
- UltimateCalendar: 2050년까지 스크롤 가능
- 스크롤 끝에 도달하면 자동으로 12개월 추가

### 목표 2: 동적 이벤트 로딩
- CalendarScreen: 보이는 월 ±3개월만 계산
- UltimateCalendar: 이미 최적화됨 (변경 불필요)

### 목표 3: 성능 최적화
- 초기 로딩: 19개월 (6 past + current + 12 future)
- 이벤트 계산: 7개월 범위 (±3개월)
- 스크롤 시 버벅임 없음

---

## 📐 구현 전략

### 전략: 하이브리드 방식 (정적 초기 + 동적 확장)

**장점**:
- ✅ 구현 간단 (기존 코드 최소 수정)
- ✅ 초기 로딩 빠름 (19개월만)
- ✅ 무한 스크롤 가능
- ✅ 성능 우수 (80% 개선)

**구조**:
```
초기: 19개월 생성 (6 past + current + 12 future)
  ↓
스크롤 끝 감지 (onEndReached)
  ↓
12개월 추가 (동적)
  ↓
이벤트 재계산 (보이는 범위 ±3개월만)
```

---

## 🚀 구현 단계

### Phase 0: DebugScreen 테스트 (완료 ✅)

**상태**: 이미 구현 및 테스트 완료

**테스트 결과**:
```
✅ 초기 생성: 19개월 (0.30ms)
✅ 무한 스크롤: 12개월 추가 (0.30-0.50ms)
✅ 정적 이벤트: 36개월 (31.10ms)
✅ 동적 이벤트: 7개월 (6.20ms)
✅ 성능 개선: 85.8% 빠름 (7배 속도 향상)
✅ 스크롤 시뮬레이션: 11.30ms
```

**결론**: 로직 검증 완료, 실제 적용 준비됨

---

### Phase 1: CalendarScreen 구현 (우선순위 1)

#### Step 1.1: 상태 관리 변경 (useMemo → useState)

**변경 전**:
```javascript
const { months, todayMonthIndex } = useMemo(() =>
    generateMonthlyData(12, 24, startDayOfWeek),
    [startDayOfWeek]
);
```

**변경 후**:
```javascript
const [months, setMonths] = useState([]);
const [loadedRange, setLoadedRange] = useState({
    start: dayjs().subtract(6, 'month'),
    end: dayjs().add(12, 'month')
});
const [isLoadingMore, setIsLoadingMore] = useState(false);

// 초기 데이터 생성
useEffect(() => {
    const initialMonths = generateMonthsInRange(
        loadedRange.start,
        loadedRange.end,
        startDayOfWeek
    );
    setMonths(initialMonths);
}, [startDayOfWeek]);
```

**예상 소요 시간**: 30분

---

#### Step 1.2: 무한 스크롤 구현 (onEndReached)

**추가 코드**:
```javascript
const handleEndReached = useCallback(() => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    // 현재 끝에서 12개월 추가
    const currentEnd = loadedRange.end;
    const newEnd = currentEnd.add(12, 'month');
    
    const newMonths = generateMonthsInRange(
        currentEnd.add(1, 'month'),
        newEnd,
        startDayOfWeek
    );
    
    setMonths(prev => [...prev, ...newMonths]);
    setLoadedRange(prev => ({ ...prev, end: newEnd }));
    setIsLoadingMore(false);
    
    console.log(`📅 [무한스크롤] 12개월 추가: ${currentEnd.format('YYYY-MM')} ~ ${newEnd.format('YYYY-MM')}`);
}, [loadedRange, isLoadingMore, startDayOfWeek]);

// FlashList에 적용
<FlashList
    onEndReached={handleEndReached}
    onEndReachedThreshold={0.5}
    // ...
/>
```

**예상 소요 시간**: 1시간

---

#### Step 1.3: 동적 이벤트 계산 (보이는 범위 ±3개월)

**변경 전**:
```javascript
const eventsByDate = useMemo(() => {
    // 36개월 범위 전체 계산
    const rangeStart = dayjs().subtract(12, 'month');
    const rangeEnd = dayjs().add(24, 'month');
    // ...
}, [todos, categories]);
```

**변경 후**:
```javascript
const [visibleRange, setVisibleRange] = useState({ start: 0, end: 0 });

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
```

**예상 소요 시간**: 2시간

---

#### Step 1.4: 헬퍼 함수 추가

```javascript
// 월 데이터 생성 헬퍼
function generateMonthsInRange(rangeStart, rangeEnd, startDayOfWeek) {
    const months = [];
    let current = rangeStart.clone();
    
    while (current.isBefore(rangeEnd) || current.isSame(rangeEnd, 'month')) {
        months.push(createMonthData(current, startDayOfWeek));
        current = current.add(1, 'month');
    }
    
    return months;
}

// 단일 월 데이터 생성
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

// 이벤트 계산 헬퍼
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
            
            // 제한된 범위만 체크
            let loopDate = rangeStart.clone();
            while (loopDate.isBefore(rangeEnd)) {
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
            // 단일 일정
            const start = dayjs(todo.startDate);
            const end = todo.endDate ? dayjs(todo.endDate) : start;
            
            let current = start.clone();
            while (current.isBefore(end) || current.isSame(end, 'day')) {
                // 범위 체크
                if ((current.isAfter(rangeStart) || current.isSame(rangeStart, 'day')) &&
                    (current.isBefore(rangeEnd) || current.isSame(rangeEnd, 'day'))) {
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

**예상 소요 시간**: 30분

---

### Phase 2: UltimateCalendar 구현 (우선순위 2)

#### Step 2.1: 상태 관리 변경

**변경 전**:
```javascript
const { weeks, todayWeekIndex } = useMemo(() =>
    generateCalendarData(today, startDayOfWeek),
    [today, startDayOfWeek]
);
```

**변경 후**:
```javascript
const [weeks, setWeeks] = useState([]);
const [loadedRange, setLoadedRange] = useState({
    start: today.subtract(6, 'month'),
    end: today.add(12, 'month')
});

useEffect(() => {
    const initialWeeks = generateWeeksInRange(
        loadedRange.start,
        loadedRange.end,
        startDayOfWeek
    );
    setWeeks(initialWeeks);
}, [startDayOfWeek]);
```

**예상 소요 시간**: 30분

---

#### Step 2.2: MonthlyView 무한 스크롤

**MonthlyView.js 수정**:
```javascript
const MonthlyView = forwardRef(({ 
    weeks, 
    onDatePress, 
    onVisibleWeeksChange, 
    initialIndex,
    eventsByDate,
    onLoadMore  // 새로 추가
}, ref) => {
    const handleEndReached = useCallback(() => {
        if (onLoadMore) {
            onLoadMore('forward');
        }
    }, [onLoadMore]);
    
    return (
        <FlashList
            onEndReached={handleEndReached}
            onEndReachedThreshold={0.5}
            // ...
        />
    );
});
```

**UltimateCalendar.js 수정**:
```javascript
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
        
        console.log(`📅 [UltimateCalendar] 12개월 추가`);
    }
}, [loadedRange, startDayOfWeek]);

<MonthlyView
    onLoadMore={handleLoadMore}
    // ...
/>
```

**예상 소요 시간**: 1.5시간

---

#### Step 2.3: WeeklyView 무한 스크롤 (동일 패턴)

**예상 소요 시간**: 1시간

---

### Phase 3: 테스트 및 최적화 (우선순위 3)

#### Step 3.1: 실제 사용 테스트

**테스트 항목**:
- [ ] CalendarScreen: 2030년까지 스크롤
- [ ] CalendarScreen: 이벤트 정상 표시
- [ ] CalendarScreen: 성능 확인 (60fps)
- [ ] UltimateCalendar: 2030년까지 스크롤
- [ ] UltimateCalendar: 모드 전환 정상
- [ ] UltimateCalendar: 이벤트 정상 표시

**예상 소요 시간**: 1시간

---

#### Step 3.2: 성능 최적화 (필요시)

**최적화 항목**:
- [ ] 날짜 객체 캐싱
- [ ] RRule 결과 캐싱
- [ ] FlashList 설정 튜닝
- [ ] 메모리 프로파일링

**예상 소요 시간**: 1시간 (필요시)

---

## 📊 예상 성능 개선

### CalendarScreen

| 항목 | 현재 | 개선 후 | 개선율 |
|------|------|---------|--------|
| 초기 로딩 | 72개월 | 19개월 | **73% 감소** |
| 이벤트 계산 | 36개월 (1,095일) | 7개월 (210일) | **80% 감소** |
| 스크롤 범위 | 2030년까지 | 무제한 | **무한** |
| 초기 시간 | ~300ms | ~50ms | **83% 빠름** |

### UltimateCalendar

| 항목 | 현재 | 개선 후 | 개선율 |
|------|------|---------|--------|
| 초기 로딩 | 36개월 | 19개월 | **47% 감소** |
| 이벤트 계산 | 3개월 | 3개월 | 동일 (이미 최적화됨) |
| 스크롤 범위 | 2029년까지 | 무제한 | **무한** |

---

## ✅ 구현 체크리스트

### Phase 1: CalendarScreen (필수)
- [ ] 1.1 useState로 months 관리 (30분)
- [ ] 1.2 onEndReached 구현 (1시간)
- [ ] 1.3 동적 이벤트 계산 (2시간)
- [ ] 1.4 헬퍼 함수 추가 (30분)
- [ ] 1.5 테스트 (30분)

**예상 소요 시간**: 4.5시간

### Phase 2: UltimateCalendar (선택)
- [ ] 2.1 useState로 weeks 관리 (30분)
- [ ] 2.2 MonthlyView onEndReached (1.5시간)
- [ ] 2.3 WeeklyView onEndReached (1시간)
- [ ] 2.4 테스트 (30분)

**예상 소요 시간**: 3.5시간

### Phase 3: 최적화 (나중에)
- [ ] 3.1 성능 테스트 (30분)
- [ ] 3.2 최적화 적용 (1시간)

**예상 소요 시간**: 1.5시간

**총 예상 시간**: 9.5시간 (Phase 1+2+3)  
**최소 필수 시간**: 4.5시간 (Phase 1만)

---

## 🎯 권장 구현 순서

### 옵션 A: 최소 구현 (4.5시간)
```
1. Phase 1: CalendarScreen만 구현
   - 가장 큰 성능 개선 (80%)
   - 사용자가 가장 많이 사용하는 화면
   - 무한 스크롤 필수
```

### 옵션 B: 완전 구현 (8시간)
```
1. Phase 1: CalendarScreen (4.5시간)
2. Phase 2: UltimateCalendar (3.5시간)
   - 일관성 유지
   - 모든 화면에서 무한 스크롤
```

### 옵션 C: 완벽 구현 (9.5시간)
```
1. Phase 1: CalendarScreen (4.5시간)
2. Phase 2: UltimateCalendar (3.5시간)
3. Phase 3: 최적화 (1.5시간)
   - 캐싱, 튜닝
   - 완벽한 성능
```

---

## 🚀 시작 준비 완료

### 준비 사항
- ✅ DebugScreen 테스트 완료
- ✅ 로직 검증 완료
- ✅ 성능 개선 확인 (85.8%)
- ✅ 문서 작성 완료
- ✅ 캐시 구조 명확화

### 다음 단계
1. 옵션 선택 (A, B, C 중 하나)
2. Phase 1 시작 (CalendarScreen)
3. 단계별 구현 및 테스트

---

## 💡 최종 권장사항

**추천**: 옵션 B (완전 구현, 8시간)

**이유**:
1. CalendarScreen + UltimateCalendar 모두 무한 스크롤 필요
2. 일관성 있는 사용자 경험
3. 구글/애플 캘린더 수준
4. 8시간이면 충분히 가능

**시작할까요?** 🚀
