# 캘린더 무한 스크롤 + 동적 이벤트 로딩 구현 계획

## 📋 현재 상황 분석

### 1. UltimateCalendar (TodoScreen)
**위치**: `components/ui/ultimate-calendar/UltimateCalendar.js`

**현재 구조**:
```javascript
// 앱 시작 시 36개월 데이터 생성 (정적)
const { weeks, todayWeekIndex } = useMemo(() =>
    generateCalendarData(today, startDayOfWeek),
    [today, startDayOfWeek]
);
```

**문제점**:
- ✅ 36개월 범위 (2023-07 ~ 2029-01) - 이미 수정됨
- ❌ 스크롤해도 새 데이터 추가 안 됨
- ❌ 2029년 이후 스크롤 불가
- ⚠️ 메모리: 약 380주 × 7일 = 2,660개 날짜 객체 (괜찮음)

**이벤트 로딩**:
```javascript
// TodoScreen.js에서 전달
const { eventsByDate } = useCalendarEvents(currentYear, currentMonth);
```
- ✅ 현재 월 ±1개월만 로딩 (효율적)
- ✅ Cache-First 전략 적용
- ✅ 백그라운드 업데이트

---

### 2. CalendarScreen (전체 캘린더 화면)
**위치**: `screens/CalendarScreen.js`

**현재 구조**:
```javascript
// 앱 시작 시 24/48개월 데이터 생성 (정적)
const { months, todayMonthIndex } = useMemo(() =>
    generateMonthlyData(24, 48, startDayOfWeek),
    [startDayOfWeek]
);
```

**문제점**:
- ✅ 72개월 범위 (2024-01 ~ 2030-01) - 이미 수정됨
- ❌ 스크롤해도 새 데이터 추가 안 됨
- ❌ 2030년 이후 스크롤 불가
- ⚠️ 메모리: 72개월 × 평균 5주 = 360개 월 객체 (괜찮음)

**이벤트 로딩 (심각한 문제)**:
```javascript
// 모든 반복 일정을 12/24개월 범위로 전개
const rangeStart = dayjs().subtract(12, 'month').startOf('month');
const rangeEnd = dayjs().add(24, 'month').endOf('month');

// 매일 반복 일정 = 1,095일 체크 (3년)
// 매주 반복 일정 = 156주 체크
// 매월 반복 일정 = 36개월 체크
```

**성능 문제**:
- ❌ 반복 일정 10개 × 1,095일 = 10,950번 날짜 체크
- ❌ 스크롤 시 재계산 안 됨 (정적)
- ❌ 범위 확장하면 계산량 폭증

---

## 🎯 최종 목표

### 목표 1: 무한 스크롤
- UltimateCalendar: 2050년까지 스크롤 가능
- CalendarScreen: 2050년까지 스크롤 가능
- 스크롤 끝에 도달하면 자동으로 다음 데이터 생성

### 목표 2: 동적 이벤트 로딩
- 현재 보이는 월 ±3개월만 이벤트 계산
- 스크롤 시 동적으로 재계산
- 반복 일정 계산량 최소화

### 목표 3: 성능 최적화
- 초기 로딩: 1초 이내
- 스크롤 시 버벅임 없음
- 메모리 사용량 최소화

---

## 📐 구현 전략

### 전략 A: 하이브리드 (추천) ⭐
**개념**: 정적 범위 + 동적 확장

**UltimateCalendar**:
1. 초기: 36개월 데이터 생성 (현재 유지)
2. 스크롤 끝 감지: `onEndReached` 사용
3. 추가 생성: 12개월씩 추가
4. 이벤트: 현재 보이는 주 ±2주만 표시

**CalendarScreen**:
1. 초기: 24/48개월 데이터 생성 (현재 유지)
2. 스크롤 끝 감지: `onEndReached` 사용
3. 추가 생성: 12개월씩 추가
4. 이벤트: 현재 보이는 월 ±3개월만 계산

**장점**:
- ✅ 구현 간단 (기존 코드 최소 수정)
- ✅ 초기 로딩 빠름
- ✅ 무한 스크롤 가능
- ✅ 성능 우수

**단점**:
- ⚠️ 메모리 사용량 증가 (하지만 문제 없음)

---

### 전략 B: 완전 동적 (복잡)
**개념**: 필요한 데이터만 생성

**구조**:
1. 초기: 현재 월 ±6개월만 생성
2. 스크롤: 보이는 범위 추적
3. 동적 생성: 필요한 월만 생성
4. 메모리 관리: 멀리 떨어진 월 제거

**장점**:
- ✅ 메모리 최소화
- ✅ 초기 로딩 매우 빠름

**단점**:
- ❌ 구현 복잡
- ❌ 빠른 스크롤 시 버벅임 가능
- ❌ 디버깅 어려움

---

## 🚀 구현 계획 (전략 A 채택)

### Phase 1: CalendarScreen 무한 스크롤 (우선순위 높음)

#### 1.1 데이터 구조 변경
```javascript
// CalendarScreen.js
const [months, setMonths] = useState([]);
const [isLoadingMore, setIsLoadingMore] = useState(false);

// 초기 데이터 생성
useEffect(() => {
    const { months: initialMonths } = generateMonthlyData(24, 48, startDayOfWeek);
    setMonths(initialMonths);
}, [startDayOfWeek]);
```

#### 1.2 무한 스크롤 구현
```javascript
// 스크롤 끝 감지
const handleEndReached = useCallback(() => {
    if (isLoadingMore) return;
    
    setIsLoadingMore(true);
    
    // 마지막 월 기준으로 12개월 추가
    const lastMonth = months[months.length - 1];
    const lastDate = dayjs(lastMonth.monthKey);
    
    const newMonths = [];
    for (let i = 1; i <= 12; i++) {
        const monthStart = lastDate.add(i, 'month');
        // generateMonthlyData 로직 재사용
        newMonths.push(createMonthData(monthStart, startDayOfWeek));
    }
    
    setMonths(prev => [...prev, ...newMonths]);
    setIsLoadingMore(false);
}, [months, isLoadingMore, startDayOfWeek]);

// FlashList에 적용
<FlashList
    onEndReached={handleEndReached}
    onEndReachedThreshold={0.5}
    // ...
/>
```

#### 1.3 동적 이벤트 계산
```javascript
// 현재 보이는 월 추적
const [visibleMonthRange, setVisibleMonthRange] = useState({ start: 0, end: 0 });

const onViewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems.length > 0) {
        const firstIndex = viewableItems[0].index;
        const lastIndex = viewableItems[viewableItems.length - 1].index;
        
        setCurrentViewIndex(firstIndex);
        setVisibleMonthRange({ start: firstIndex, end: lastIndex });
    }
}).current;

// 이벤트 계산 범위 제한
const eventsByDate = useMemo(() => {
    if (!todos || !categories) return {};
    
    // 보이는 월 ±3개월만 계산
    const startMonth = months[Math.max(0, visibleMonthRange.start - 3)];
    const endMonth = months[Math.min(months.length - 1, visibleMonthRange.end + 3)];
    
    if (!startMonth || !endMonth) return {};
    
    const rangeStart = dayjs(startMonth.monthKey).startOf('month');
    const rangeEnd = dayjs(endMonth.monthKey).endOf('month');
    
    // 기존 로직 사용 (범위만 제한)
    return calculateEvents(todos, categories, rangeStart, rangeEnd);
}, [todos, categories, visibleMonthRange, months]);
```

**예상 성능 개선**:
- 기존: 36개월 × 30일 = 1,080일 계산
- 개선: 7개월 × 30일 = 210일 계산
- **80% 감소** 🎉

---

### Phase 2: UltimateCalendar 무한 스크롤 (우선순위 중간)

#### 2.1 데이터 구조 변경
```javascript
// UltimateCalendar.js
const [weeks, setWeeks] = useState([]);

useEffect(() => {
    const { weeks: initialWeeks } = generateCalendarData(today, startDayOfWeek);
    setWeeks(initialWeeks);
}, [today, startDayOfWeek]);
```

#### 2.2 MonthlyView 무한 스크롤
```javascript
// MonthlyView.js
const handleEndReached = useCallback(() => {
    if (onLoadMore) {
        onLoadMore('forward'); // 미래 방향
    }
}, [onLoadMore]);

<FlashList
    onEndReached={handleEndReached}
    onEndReachedThreshold={0.5}
    // ...
/>
```

#### 2.3 부모에서 데이터 추가
```javascript
// UltimateCalendar.js
const handleLoadMore = useCallback((direction) => {
    if (direction === 'forward') {
        const lastWeek = weeks[weeks.length - 1];
        const lastDate = lastWeek[6].dateObj; // 마지막 날
        
        // 12개월 = 약 52주 추가
        const newWeeks = generateWeeksFrom(lastDate, 52);
        setWeeks(prev => [...prev, ...newWeeks]);
    }
}, [weeks]);
```

**이벤트 최적화**:
- TodoScreen에서 이미 `useCalendarEvents` 사용 중
- 현재 월 ±1개월만 로딩 (이미 최적화됨)
- 추가 작업 불필요 ✅

---

### Phase 3: 성능 최적화 (우선순위 낮음)

#### 3.1 메모이제이션 강화
```javascript
// 날짜 객체 재사용
const dateCache = useMemo(() => new Map(), []);

function createDateObject(dateString) {
    if (dateCache.has(dateString)) {
        return dateCache.get(dateString);
    }
    
    const dateObj = {
        dateString,
        dateObj: dayjs(dateString),
        // ...
    };
    
    dateCache.set(dateString, dateObj);
    return dateObj;
}
```

#### 3.2 가상화 개선
```javascript
// FlashList 설정 최적화
<FlashList
    estimatedItemSize={CELL_HEIGHT}
    drawDistance={CELL_HEIGHT * 10} // 10주 미리 렌더링
    removeClippedSubviews={true}
    maxToRenderPerBatch={10}
    updateCellsBatchingPeriod={50}
/>
```

#### 3.3 반복 일정 계산 캐싱
```javascript
// RRule 결과 캐싱
const rruleCache = useMemo(() => new Map(), []);

function calculateRecurrence(rrule, startDate, endDate, rangeStart, rangeEnd) {
    const cacheKey = `${rrule}_${rangeStart}_${rangeEnd}`;
    
    if (rruleCache.has(cacheKey)) {
        return rruleCache.get(cacheKey);
    }
    
    const dates = computeRRuleDates(rrule, startDate, endDate, rangeStart, rangeEnd);
    rruleCache.set(cacheKey, dates);
    
    return dates;
}
```

---

## 📊 예상 성능 비교

### CalendarScreen

| 항목 | 현재 (정적) | Phase 1 (동적) | 개선율 |
|------|------------|---------------|--------|
| 초기 로딩 | 72개월 생성 | 72개월 생성 | 동일 |
| 이벤트 계산 | 36개월 범위 | 7개월 범위 | **80% 감소** |
| 스크롤 범위 | 2030년까지 | 무제한 | **무한** |
| 메모리 | 360개 월 | 360개 월 → 증가 | 증가하지만 문제없음 |

### UltimateCalendar

| 항목 | 현재 (정적) | Phase 2 (동적) | 개선율 |
|------|------------|---------------|--------|
| 초기 로딩 | 36개월 생성 | 36개월 생성 | 동일 |
| 이벤트 계산 | 3개월 범위 | 3개월 범위 | 동일 (이미 최적화됨) |
| 스크롤 범위 | 2029년까지 | 무제한 | **무한** |
| 메모리 | 380주 | 380주 → 증가 | 증가하지만 문제없음 |

---

## ✅ 구현 체크리스트

### Phase 1: CalendarScreen (필수)
- [ ] 1.1 useState로 months 관리
- [ ] 1.2 onEndReached 구현
- [ ] 1.3 동적 이벤트 계산 (visibleMonthRange)
- [ ] 1.4 성능 테스트 (반복 일정 10개)
- [ ] 1.5 DebugScreen에 테스트 버튼 추가

### Phase 2: UltimateCalendar (선택)
- [ ] 2.1 useState로 weeks 관리
- [ ] 2.2 MonthlyView onEndReached
- [ ] 2.3 부모에서 데이터 추가
- [ ] 2.4 WeeklyView 동일 적용
- [ ] 2.5 성능 테스트

### Phase 3: 최적화 (나중에)
- [ ] 3.1 날짜 객체 캐싱
- [ ] 3.2 FlashList 설정 최적화
- [ ] 3.3 RRule 결과 캐싱
- [ ] 3.4 메모리 프로파일링

---

## 🔧 디버깅 도구

### DebugScreen 추가 버튼
```javascript
// 31. 캘린더 스크롤 성능 테스트
const testCalendarScrollPerformance = () => {
    const start = performance.now();
    
    // 100개월 데이터 생성
    const { months } = generateMonthlyData(0, 100, 'sunday');
    
    const end = performance.now();
    addLog(`📊 100개월 생성: ${(end - start).toFixed(2)}ms`);
    addLog(`📦 메모리: ${months.length}개 월`);
};

// 32. 이벤트 계산 성능 테스트
const testEventCalculationPerformance = () => {
    const start = performance.now();
    
    // 36개월 범위 이벤트 계산
    const rangeStart = dayjs().subtract(18, 'month');
    const rangeEnd = dayjs().add(18, 'month');
    
    // 반복 일정 10개 시뮬레이션
    const todos = Array.from({ length: 10 }, (_, i) => ({
        _id: `test_${i}`,
        title: `매일 반복 ${i}`,
        recurrence: ['RRULE:FREQ=DAILY'],
        startDate: '2026-01-01',
    }));
    
    const events = calculateEvents(todos, [], rangeStart, rangeEnd);
    
    const end = performance.now();
    addLog(`📊 이벤트 계산: ${(end - start).toFixed(2)}ms`);
    addLog(`📦 생성된 이벤트: ${Object.keys(events).length}개 날짜`);
};
```

---

## 🎯 권장 순서 (최종 수정)

### ⭐ 올바른 접근 (구글/애플 캘린더 방식)

**무한 스크롤 + 동적 이벤트 = 필수**

**1단계: Phase 1.3 구현 (2-3시간)** 🎯 최우선
- 동적 이벤트 계산 (보이는 월 ±3개월만)
- **80% 성능 개선**
- 무한 스크롤의 전제 조건

**2단계: Phase 1.2 구현 (1-2시간)** � 필수
- CalendarScreen 무한 스크롤
- onEndReached로 12개월씩 추가
- 2050년까지 스크롤 가능

**3단계: Phase 2 구현 (1-2시간)** 📅 필수
- UltimateCalendar 무한 스크롤
- MonthlyView onEndReached
- WeeklyView도 동일 적용

**4단계: 테스트 및 최적화 (1시간)**
- 성능 테스트
- 메모리 프로파일링
- 버그 수정

**총 소요 시간: 5-8시간**

---

## 💡 왜 무한 스크롤이 필수인가?

### 사용자 기대치
- 구글/애플 캘린더 = 업계 표준
- 사용자는 무한 스크롤을 **당연하게** 생각함
- 2030년에서 멈추면 = 버그로 인식

### 실제 사용 사례
1. **장기 계획**: 2-3년 후 프로젝트
2. **반복 일정**: 끝까지 확인하고 싶음
3. **호기심**: 그냥 계속 내려보기
4. **미래 확인**: 특정 날짜의 요일 확인

### 기술적 이유
- FlashList = 무한 스크롤에 최적화됨
- onEndReached = 3줄 코드로 구현
- 메모리 문제 없음 (가상화)

---

## 🚫 제가 틀렸던 이유

**잘못된 가정**:
- ❌ "8년이면 충분하다"
- ❌ "2030년 일정 안 만든다"
- ❌ "무한 스크롤 = 과잉"

**올바른 인식**:
- ✅ 무한 스크롤 = 업계 표준
- ✅ 사용자 기대치 충족
- ✅ 구현 간단 (5-8시간)

---

## 결론

**무한 스크롤 구현하세요!**

**순서**:
1. Phase 1.3 (동적 이벤트) - 성능 해결
2. Phase 1.2 (CalendarScreen 무한) - 표준 기능
3. Phase 2 (UltimateCalendar 무한) - 일관성

**예상 시간**: 5-8시간
**효과**: 구글/애플 캘린더 수준

---

## 📝 참고사항

### 메모리 사용량 추정
- 날짜 객체 1개: 약 200 bytes
- 380주 × 7일 = 2,660개 = **약 0.5MB** (문제없음)
- 1000주 추가 = **약 1.4MB** (여전히 문제없음)

### 반복 일정 계산량
- 매일 반복 × 36개월 = 1,095일 체크
- 매일 반복 × 7개월 = 210일 체크
- **80% 감소** 🎉

### FlashList 성능
- 1000개 아이템도 부드럽게 스크롤
- 가상화로 메모리 효율적
- 걱정 없음 ✅

---

## 결론

**추천 방식**: Phase 1.3 → Phase 1.2 순서로 구현

**이유**:
1. 동적 이벤트 계산이 가장 큰 성능 개선
2. 무한 스크롤은 구현 간단
3. UltimateCalendar는 현재도 충분함
4. 리스크 낮고 효과 큼

**예상 소요 시간**:
- Phase 1.3: 2-3시간
- Phase 1.2: 1-2시간
- 총 3-5시간

시작할까요? 🚀
