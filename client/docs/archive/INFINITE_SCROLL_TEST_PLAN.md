# 무한 스크롤 테스트 계획서

## 📋 전체 프로세스

```
1. DebugScreen 테스트 환경 구축
   ↓
2. 핵심 로직 단위 테스트
   ↓
3. 통합 테스트
   ↓
4. CalendarScreen 적용
   ↓
5. UltimateCalendar 적용
```

---

## 🧪 Phase 0: DebugScreen 테스트 환경

### 목표
- 실제 캘린더 수정 전에 로직 검증
- 버튼 클릭으로 각 단계 테스트
- 로그로 결과 확인

### 테스트 항목

#### Test 1: 초기 데이터 생성
**버튼**: `📅 초기 데이터 생성 (19개월)`

**테스트 내용**:
```javascript
const testInitialDataGeneration = () => {
    const start = performance.now();
    
    const rangeStart = dayjs().subtract(6, 'month');
    const rangeEnd = dayjs().add(12, 'month');
    
    const months = [];
    let current = rangeStart.clone();
    
    while (current.isBefore(rangeEnd) || current.isSame(rangeEnd, 'month')) {
        months.push({
            monthKey: current.format('YYYY-MM'),
            title: current.format('YYYY년 M월'),
        });
        current = current.add(1, 'month');
    }
    
    const end = performance.now();
    
    addLog(`✅ 초기 생성 완료`);
    addLog(`📊 생성된 월: ${months.length}개`);
    addLog(`📅 범위: ${rangeStart.format('YYYY-MM')} ~ ${rangeEnd.format('YYYY-MM')}`);
    addLog(`⏱️ 소요 시간: ${(end - start).toFixed(2)}ms`);
    addLog(`💾 첫 월: ${months[0].monthKey}`);
    addLog(`💾 마지막 월: ${months[months.length - 1].monthKey}`);
};
```

**예상 결과**:
```
✅ 초기 생성 완료
📊 생성된 월: 19개
📅 범위: 2025-07 ~ 2027-01
⏱️ 소요 시간: 2.34ms
💾 첫 월: 2025-07
💾 마지막 월: 2027-01
```

---

#### Test 2: 무한 스크롤 시뮬레이션
**버튼**: `🔄 무한 스크롤 시뮬레이션 (12개월 추가)`

**테스트 내용**:
```javascript
let testMonths = [];
let testLoadedRange = {
    start: dayjs().subtract(6, 'month'),
    end: dayjs().add(12, 'month')
};

const testInfiniteScroll = () => {
    // 초기 데이터가 없으면 먼저 생성
    if (testMonths.length === 0) {
        addLog(`⚠️ 초기 데이터 없음 - 먼저 생성`);
        testInitialDataGeneration();
        return;
    }
    
    const start = performance.now();
    
    // 현재 끝에서 12개월 추가
    const currentEnd = testLoadedRange.end;
    const newEnd = currentEnd.add(12, 'month');
    
    const newMonths = [];
    let current = currentEnd.add(1, 'month');
    
    while (current.isBefore(newEnd) || current.isSame(newEnd, 'month')) {
        newMonths.push({
            monthKey: current.format('YYYY-MM'),
            title: current.format('YYYY년 M월'),
        });
        current = current.add(1, 'month');
    }
    
    testMonths = [...testMonths, ...newMonths];
    testLoadedRange = { ...testLoadedRange, end: newEnd };
    
    const end = performance.now();
    
    addLog(`✅ 무한 스크롤 완료`);
    addLog(`📊 추가된 월: ${newMonths.length}개`);
    addLog(`📊 총 월: ${testMonths.length}개`);
    addLog(`📅 새 범위: ${currentEnd.format('YYYY-MM')} ~ ${newEnd.format('YYYY-MM')}`);
    addLog(`⏱️ 소요 시간: ${(end - start).toFixed(2)}ms`);
    addLog(`💾 마지막 월: ${testMonths[testMonths.length - 1].monthKey}`);
};
```

**예상 결과**:
```
✅ 무한 스크롤 완료
📊 추가된 월: 12개
📊 총 월: 31개
📅 새 범위: 2027-01 ~ 2028-01
⏱️ 소요 시간: 1.23ms
💾 마지막 월: 2028-01
```

---

#### Test 3: 동적 이벤트 계산 (정적 범위)
**버튼**: `🎯 이벤트 계산 (정적 36개월)`

**테스트 내용**:
```javascript
const testStaticEventCalculation = async () => {
    const todos = await loadTodos();
    
    if (todos.length === 0) {
        addLog(`⚠️ 할일 없음 - 먼저 생성하세요`);
        return;
    }
    
    const start = performance.now();
    
    // 정적 범위 (기존 방식)
    const rangeStart = dayjs().subtract(18, 'month');
    const rangeEnd = dayjs().add(18, 'month');
    
    let eventCount = 0;
    const eventsMap = {};
    
    todos.forEach(todo => {
        if (!todo.startDate) return;
        
        if (todo.recurrence) {
            // 반복 일정 - 36개월 전체 체크
            let loopDate = rangeStart.clone();
            while (loopDate.isBefore(rangeEnd)) {
                const dateStr = loopDate.format('YYYY-MM-DD');
                if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                eventsMap[dateStr].push(todo);
                eventCount++;
                loopDate = loopDate.add(1, 'day');
            }
        }
    });
    
    const end = performance.now();
    
    addLog(`✅ 정적 이벤트 계산 완료`);
    addLog(`📊 할일 수: ${todos.length}개`);
    addLog(`📅 범위: ${rangeStart.format('YYYY-MM')} ~ ${rangeEnd.format('YYYY-MM')} (36개월)`);
    addLog(`📊 생성된 이벤트: ${eventCount}개`);
    addLog(`📊 날짜 수: ${Object.keys(eventsMap).length}개`);
    addLog(`⏱️ 소요 시간: ${(end - start).toFixed(2)}ms`);
};
```

**예상 결과**:
```
✅ 정적 이벤트 계산 완료
📊 할일 수: 10개
📅 범위: 2024-07 ~ 2027-07 (36개월)
📊 생성된 이벤트: 10,950개
📊 날짜 수: 1,095개
⏱️ 소요 시간: 245.67ms
```

---

#### Test 4: 동적 이벤트 계산 (동적 범위)
**버튼**: `⚡ 이벤트 계산 (동적 7개월)`

**테스트 내용**:
```javascript
const testDynamicEventCalculation = async () => {
    const todos = await loadTodos();
    
    if (todos.length === 0) {
        addLog(`⚠️ 할일 없음 - 먼저 생성하세요`);
        return;
    }
    
    const start = performance.now();
    
    // 동적 범위 (현재 보이는 월 ±3개월)
    const currentMonth = dayjs();
    const rangeStart = currentMonth.subtract(3, 'month');
    const rangeEnd = currentMonth.add(3, 'month');
    
    let eventCount = 0;
    const eventsMap = {};
    
    todos.forEach(todo => {
        if (!todo.startDate) return;
        
        if (todo.recurrence) {
            // 반복 일정 - 7개월만 체크
            let loopDate = rangeStart.clone();
            while (loopDate.isBefore(rangeEnd)) {
                const dateStr = loopDate.format('YYYY-MM-DD');
                if (!eventsMap[dateStr]) eventsMap[dateStr] = [];
                eventsMap[dateStr].push(todo);
                eventCount++;
                loopDate = loopDate.add(1, 'day');
            }
        }
    });
    
    const end = performance.now();
    
    addLog(`✅ 동적 이벤트 계산 완료`);
    addLog(`📊 할일 수: ${todos.length}개`);
    addLog(`📅 범위: ${rangeStart.format('YYYY-MM')} ~ ${rangeEnd.format('YYYY-MM')} (7개월)`);
    addLog(`📊 생성된 이벤트: ${eventCount}개`);
    addLog(`📊 날짜 수: ${Object.keys(eventsMap).length}개`);
    addLog(`⏱️ 소요 시간: ${(end - start).toFixed(2)}ms`);
    
    // 성능 비교
    addLog(`📊 개선율: 약 80% 감소 예상`);
};
```

**예상 결과**:
```
✅ 동적 이벤트 계산 완료
📊 할일 수: 10개
📅 범위: 2025-10 ~ 2026-04 (7개월)
📊 생성된 이벤트: 2,100개
📊 날짜 수: 210개
⏱️ 소요 시간: 48.23ms
📊 개선율: 약 80% 감소 예상
```

---

#### Test 5: 성능 비교
**버튼**: `📊 성능 비교 (정적 vs 동적)`

**테스트 내용**:
```javascript
const testPerformanceComparison = async () => {
    const todos = await loadTodos();
    
    if (todos.length === 0) {
        addLog(`⚠️ 할일 없음 - 먼저 생성하세요`);
        return;
    }
    
    addLog(`🔄 성능 비교 시작...`);
    addLog(`📊 할일 수: ${todos.length}개`);
    addLog(``);
    
    // 1. 정적 방식
    const staticStart = performance.now();
    const staticRange = {
        start: dayjs().subtract(18, 'month'),
        end: dayjs().add(18, 'month')
    };
    let staticCount = 0;
    
    todos.forEach(todo => {
        if (todo.recurrence) {
            let loopDate = staticRange.start.clone();
            while (loopDate.isBefore(staticRange.end)) {
                staticCount++;
                loopDate = loopDate.add(1, 'day');
            }
        }
    });
    
    const staticEnd = performance.now();
    const staticTime = staticEnd - staticStart;
    
    addLog(`📅 정적 방식 (36개월):`);
    addLog(`  ⏱️ 소요 시간: ${staticTime.toFixed(2)}ms`);
    addLog(`  📊 이벤트 수: ${staticCount}개`);
    addLog(``);
    
    // 2. 동적 방식
    const dynamicStart = performance.now();
    const dynamicRange = {
        start: dayjs().subtract(3, 'month'),
        end: dayjs().add(3, 'month')
    };
    let dynamicCount = 0;
    
    todos.forEach(todo => {
        if (todo.recurrence) {
            let loopDate = dynamicRange.start.clone();
            while (loopDate.isBefore(dynamicRange.end)) {
                dynamicCount++;
                loopDate = loopDate.add(1, 'day');
            }
        }
    });
    
    const dynamicEnd = performance.now();
    const dynamicTime = dynamicEnd - dynamicStart;
    
    addLog(`⚡ 동적 방식 (7개월):`);
    addLog(`  ⏱️ 소요 시간: ${dynamicTime.toFixed(2)}ms`);
    addLog(`  📊 이벤트 수: ${dynamicCount}개`);
    addLog(``);
    
    // 3. 비교
    const improvement = ((staticTime - dynamicTime) / staticTime * 100).toFixed(1);
    const speedup = (staticTime / dynamicTime).toFixed(1);
    
    addLog(`📊 성능 개선:`);
    addLog(`  🚀 ${improvement}% 빠름`);
    addLog(`  🚀 ${speedup}배 속도 향상`);
    addLog(`  💾 ${((staticCount - dynamicCount) / staticCount * 100).toFixed(1)}% 메모리 감소`);
};
```

**예상 결과**:
```
🔄 성능 비교 시작...
📊 할일 수: 10개

📅 정적 방식 (36개월):
  ⏱️ 소요 시간: 245.67ms
  📊 이벤트 수: 10,950개

⚡ 동적 방식 (7개월):
  ⏱️ 소요 시간: 48.23ms
  📊 이벤트 수: 2,100개

📊 성능 개선:
  🚀 80.4% 빠름
  🚀 5.1배 속도 향상
  💾 80.8% 메모리 감소
```

---

#### Test 6: 스크롤 시뮬레이션 (통합)
**버튼**: `🎬 스크롤 시뮬레이션 (전체 흐름)`

**테스트 내용**:
```javascript
const testScrollSimulation = async () => {
    addLog(`🎬 스크롤 시뮬레이션 시작`);
    addLog(``);
    
    // 1. 초기 로딩
    addLog(`1️⃣ 초기 로딩 (19개월)`);
    const initStart = performance.now();
    
    let months = [];
    let current = dayjs().subtract(6, 'month');
    const end = dayjs().add(12, 'month');
    
    while (current.isBefore(end) || current.isSame(end, 'month')) {
        months.push({ monthKey: current.format('YYYY-MM') });
        current = current.add(1, 'month');
    }
    
    const initEnd = performance.now();
    addLog(`  ✅ ${months.length}개 월 생성`);
    addLog(`  ⏱️ ${(initEnd - initStart).toFixed(2)}ms`);
    addLog(``);
    
    // 2. 첫 이벤트 계산
    addLog(`2️⃣ 첫 이벤트 계산 (7개월)`);
    const event1Start = performance.now();
    
    const todos = await loadTodos();
    let eventCount1 = 0;
    
    const calcStart1 = dayjs().subtract(3, 'month');
    const calcEnd1 = dayjs().add(3, 'month');
    
    todos.forEach(todo => {
        if (todo.recurrence) {
            let loopDate = calcStart1.clone();
            while (loopDate.isBefore(calcEnd1)) {
                eventCount1++;
                loopDate = loopDate.add(1, 'day');
            }
        }
    });
    
    const event1End = performance.now();
    addLog(`  ✅ ${eventCount1}개 이벤트 생성`);
    addLog(`  ⏱️ ${(event1End - event1Start).toFixed(2)}ms`);
    addLog(``);
    
    // 3. 스크롤 (12개월 추가)
    addLog(`3️⃣ 스크롤 - 12개월 추가`);
    const scrollStart = performance.now();
    
    const lastMonth = dayjs(months[months.length - 1].monthKey);
    const newEnd = lastMonth.add(12, 'month');
    
    let newCurrent = lastMonth.add(1, 'month');
    let addedCount = 0;
    
    while (newCurrent.isBefore(newEnd) || newCurrent.isSame(newEnd, 'month')) {
        months.push({ monthKey: newCurrent.format('YYYY-MM') });
        newCurrent = newCurrent.add(1, 'month');
        addedCount++;
    }
    
    const scrollEnd = performance.now();
    addLog(`  ✅ ${addedCount}개 월 추가`);
    addLog(`  📊 총 ${months.length}개 월`);
    addLog(`  ⏱️ ${(scrollEnd - scrollStart).toFixed(2)}ms`);
    addLog(``);
    
    // 4. 이벤트 재계산 (범위 이동)
    addLog(`4️⃣ 이벤트 재계산 (범위 이동)`);
    const event2Start = performance.now();
    
    let eventCount2 = 0;
    
    // 스크롤 후 보이는 범위 (예: 2026-12)
    const calcStart2 = dayjs('2026-12').subtract(3, 'month');
    const calcEnd2 = dayjs('2026-12').add(3, 'month');
    
    todos.forEach(todo => {
        if (todo.recurrence) {
            let loopDate = calcStart2.clone();
            while (loopDate.isBefore(calcEnd2)) {
                eventCount2++;
                loopDate = loopDate.add(1, 'day');
            }
        }
    });
    
    const event2End = performance.now();
    addLog(`  ✅ ${eventCount2}개 이벤트 생성`);
    addLog(`  ⏱️ ${(event2End - event2Start).toFixed(2)}ms`);
    addLog(``);
    
    // 5. 총 시간
    const totalTime = (initEnd - initStart) + (event1End - event1Start) + 
                      (scrollEnd - scrollStart) + (event2End - event2Start);
    
    addLog(`📊 총 소요 시간: ${totalTime.toFixed(2)}ms`);
    addLog(`✅ 스크롤 시뮬레이션 완료`);
};
```

**예상 결과**:
```
🎬 스크롤 시뮬레이션 시작

1️⃣ 초기 로딩 (19개월)
  ✅ 19개 월 생성
  ⏱️ 2.34ms

2️⃣ 첫 이벤트 계산 (7개월)
  ✅ 2,100개 이벤트 생성
  ⏱️ 48.23ms

3️⃣ 스크롤 - 12개월 추가
  ✅ 12개 월 추가
  📊 총 31개 월
  ⏱️ 1.23ms

4️⃣ 이벤트 재계산 (범위 이동)
  ✅ 2,100개 이벤트 생성
  ⏱️ 47.89ms

📊 총 소요 시간: 99.69ms
✅ 스크롤 시뮬레이션 완료
```

---

## 📝 테스트 순서

### Step 1: 기본 테스트
```
1. 📅 초기 데이터 생성 (19개월)
   → 로그 확인: 19개 생성되는지
   
2. 🔄 무한 스크롤 시뮬레이션 (12개월 추가)
   → 로그 확인: 31개로 증가하는지
   
3. 🔄 무한 스크롤 시뮬레이션 (12개월 추가) - 다시 클릭
   → 로그 확인: 43개로 증가하는지
```

### Step 2: 이벤트 계산 테스트
```
4. 🎯 이벤트 계산 (정적 36개월)
   → 로그 확인: 소요 시간 체크
   
5. ⚡ 이벤트 계산 (동적 7개월)
   → 로그 확인: 소요 시간 체크
   
6. 📊 성능 비교 (정적 vs 동적)
   → 로그 확인: 80% 개선 확인
```

### Step 3: 통합 테스트
```
7. 🎬 스크롤 시뮬레이션 (전체 흐름)
   → 로그 확인: 전체 흐름 정상 작동
```

---

## ✅ 성공 기준

### 초기 데이터 생성
- [ ] 19개월 생성 확인
- [ ] 소요 시간 < 5ms
- [ ] 범위 정확성 (현재 ±6/12개월)

### 무한 스크롤
- [ ] 12개월씩 추가 확인
- [ ] 소요 시간 < 3ms
- [ ] 중복 없음

### 이벤트 계산
- [ ] 동적 방식이 정적 방식보다 70% 이상 빠름
- [ ] 이벤트 수 정확성
- [ ] 범위 정확성

### 통합 테스트
- [ ] 전체 흐름 정상 작동
- [ ] 총 소요 시간 < 150ms
- [ ] 메모리 누수 없음

---

## 🐛 예상 문제 및 해결

### 문제 1: 초기 데이터 생성 느림
**증상**: 소요 시간 > 10ms
**원인**: 날짜 계산 비효율
**해결**: dayjs 캐싱

### 문제 2: 이벤트 계산 여전히 느림
**증상**: 동적 방식도 > 100ms
**원인**: RRule 계산 비효율
**해결**: RRule 결과 캐싱

### 문제 3: 무한 스크롤 중복 생성
**증상**: 같은 월이 여러 번 생성
**원인**: 범위 계산 오류
**해결**: 범위 체크 로직 수정

---

## 다음 단계

### Phase 1: DebugScreen 구현 (1-2시간)
- [ ] Test 1-6 버튼 추가
- [ ] 로직 구현
- [ ] 로그 출력

### Phase 2: DebugScreen 테스트 (30분)
- [ ] 각 버튼 클릭
- [ ] 로그 확인
- [ ] 문제 수정

### Phase 3: CalendarScreen 적용 (2-3시간)
- [ ] 검증된 로직 적용
- [ ] 실제 데이터로 테스트
- [ ] 성능 확인

### Phase 4: UltimateCalendar 적용 (2-3시간)
- [ ] 검증된 로직 적용
- [ ] 실제 데이터로 테스트
- [ ] 성능 확인

---

## 시작 준비 완료!

**다음 작업**: DebugScreen에 테스트 버튼 6개 추가

시작할까요? 🚀
