# UltimateCalendar 동적 이벤트 렌더링 - 실행 계획서

**작성일**: 2026-01-29  
**목표**: UltimateCalendar에 동적 이벤트 렌더링 구현 (스크롤 시 자동 로딩)  
**예상 소요 시간**: 3-4시간  
**위험도**: 낮음 (기존 로직 재사용, 점진적 구현)

---

## 📊 현재 상태 분석

### 문제점:
```javascript
// TodoScreen.js
const { eventsByDate } = useCalendarEvents(currentYear, currentMonth);
<UltimateCalendar eventsByDate={eventsByDate} />

// ❌ 문제:
// - eventsByDate는 currentMonth 기준 (±1개월, 총 3개월)
// - 사용자가 다른 월로 스크롤해도 3개월치만 보임
// - 무한 스크롤로 3년치 주 데이터는 있지만 이벤트는 3개월치만
```

### 현재 데이터 흐름:
```
TodoScreen
  ↓
useCalendarEvents(2026, 1)  // 2025-12, 2026-01, 2026-02 데이터만
  ↓
useQueries (3개월 병렬 요청)
  ├─ ['events', 2025, 12]
  ├─ ['events', 2026, 1]
  └─ ['events', 2026, 2]
  ↓
RRule 전개 (3개월치만)
  ↓
eventsByDate = { "2025-12-01": [...], "2026-01-15": [...], ... }
  ↓
UltimateCalendar (props로 받음)
  - 2026-03으로 스크롤 → 이벤트 없음 ❌
```

### CalendarScreen 방식 (참고):
```
CalendarScreen
  ↓
useAllTodos()  // 전체 캐시 ['todos', 'all']
  ↓
useMemo (클라이언트에서 36개월치 RRule 전개)
  - visibleRange 기반 동적 계산
  - 월별 캐싱 (eventsCacheRef)
  ↓
eventsByDate = { ... } (36개월치)
  ↓
FlashList (36개월 렌더링)
```

---

## 🎯 목표 아키텍처

### 새로운 데이터 흐름:
```
UltimateCalendar
  ↓
useCalendarDynamicEvents({
  weeks,                    // 무한 스크롤 주 데이터 (156주)
  visibleWeekIndex,         // 현재 보는 주 인덱스
  range: 3,                 // ±3주 범위
  cacheType: 'week'         // 주별 캐싱
})
  ↓
useAllTodos()  // 전체 캐시 ['todos', 'all']
  ↓
useMemo (동적 범위 계산)
  - visibleWeekIndex ± 3주 범위만 계산
  - 주별 캐싱 (eventsCacheRef)
  - RRule 전개
  ↓
eventsByDate = { ... } (7주치, 약 49일)
  ↓
WeekRow / MonthlyView (이벤트 표시)
```

---

## 📝 단계별 실행 계획

### Phase 1: Custom Hook 생성 (2시간)

#### Step 1-1: 파일 생성 및 기본 구조 (20분)

**파일**: `client/src/hooks/useCalendarDynamicEvents.js` (신규)

**작업 내용**:
```javascript
import { useMemo, useRef, useState, useEffect } from 'react';
import { useAllTodos } from './queries/useAllTodos';
import { useCategories } from './queries/useCategories';
import dayjs from 'dayjs';
import { isDateInRRule } from '../utils/routineUtils';

/**
 * 캘린더 동적 이벤트 계산 Hook
 * @param {Object} params
 * @param {Array} params.weeks - 주 데이터 배열 (또는 months)
 * @param {number} params.visibleIndex - 현재 보이는 인덱스
 * @param {number} params.range - 계산 범위 (±N)
 * @param {string} params.cacheType - 'week' 또는 'month'
 * @returns {Object} eventsByDate 맵
 */
export function useCalendarDynamicEvents({ 
  weeks, 
  visibleIndex, 
  range = 3, 
  cacheType = 'week' 
}) {
  // 1. 데이터 가져오기
  const { data: todos } = useAllTodos();
  const { data: categories } = useCategories();
  
  // 2. 캐시 관리
  const eventsCacheRef = useRef({});
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // 3. todos 변경 시 캐시 무효화
  useEffect(() => {
    if (todos) {
      eventsCacheRef.current = {};
      setCacheVersion(prev => prev + 1);
      console.log('🔄 [useCalendarDynamicEvents] 캐시 무효화');
    }
  }, [todos]);
  
  // 4. 동적 이벤트 계산
  const eventsByDate = useMemo(() => {
    // 구현 예정
    return {};
  }, [todos, categories, weeks, visibleIndex, range, cacheType, cacheVersion]);
  
  return eventsByDate;
}
```

**체크포인트**:
- [ ] 파일 생성 완료
- [ ] import 문 정상 작동
- [ ] 기본 구조 컴파일 에러 없음

---

#### Step 1-2: 범위 계산 로직 구현 (30분)

**작업 내용**:
```javascript
const eventsByDate = useMemo(() => {
  if (!todos || !categories || !weeks || weeks.length === 0) {
    console.log('⚠️ [useCalendarDynamicEvents] 데이터 없음');
    return {};
  }
  
  const startTime = performance.now();
  
  // 1️⃣ 보이는 범위 계산
  const startIdx = Math.max(0, visibleIndex - range);
  const endIdx = Math.min(weeks.length - 1, visibleIndex + range);
  
  console.log(`🎯 [useCalendarDynamicEvents] 범위: ${startIdx} ~ ${endIdx} (총 ${endIdx - startIdx + 1}${cacheType})`);
  
  // 2️⃣ 날짜 범위 계산
  const startWeek = weeks[startIdx];
  const endWeek = weeks[endIdx];
  
  if (!startWeek || !endWeek) {
    console.log('⚠️ [useCalendarDynamicEvents] 주 데이터 없음');
    return {};
  }
  
  const rangeStart = dayjs(startWeek[0].dateString);
  const rangeEnd = dayjs(endWeek[6].dateString);
  
  console.log(`📅 [useCalendarDynamicEvents] 날짜 범위: ${rangeStart.format('YYYY-MM-DD')} ~ ${rangeEnd.format('YYYY-MM-DD')}`);
  
  // 3️⃣ 이벤트 계산 (다음 단계에서 구현)
  const eventsMap = {};
  
  const endTime = performance.now();
  console.log(`✅ [useCalendarDynamicEvents] 완료 (${(endTime - startTime).toFixed(2)}ms)`);
  
  return eventsMap;
}, [todos, categories, weeks, visibleIndex, range, cacheType, cacheVersion]);
```

**체크포인트**:
- [ ] 범위 계산 정상 작동
- [ ] 로그 출력 확인
- [ ] 성능 측정 (<5ms)

---

#### Step 1-3: 주별 캐싱 로직 구현 (40분)

**작업 내용**:
```javascript
// 3️⃣ 주별 캐싱 및 이벤트 계산
const eventsMap = {};
let cacheHits = 0;
let cacheMisses = 0;

// 카테고리 색상 맵
const categoryColorMap = {};
categories.forEach(c => categoryColorMap[c._id] = c.color);

// 주별로 캐시 확인 및 계산
for (let i = startIdx; i <= endIdx; i++) {
  const week = weeks[i];
  if (!week) continue;
  
  // 캐시 키 생성 (첫 날짜 기준)
  const weekKey = week[0].dateString;
  
  // 캐시 확인
  if (eventsCacheRef.current[weekKey]) {
    // 캐시 히트
    Object.assign(eventsMap, eventsCacheRef.current[weekKey]);
    cacheHits++;
    continue;
  }
  
  // 캐시 미스 - 계산 필요
  cacheMisses++;
  const weekEvents = {};
  
  // 주의 시작/끝 날짜
  const weekStart = dayjs(week[0].dateString);
  const weekEnd = dayjs(week[6].dateString);
  
  // 모든 todos 순회
  todos.forEach(todo => {
    if (!todo.startDate) return;
    
    // 반복 일정 처리
    if (todo.recurrence) {
      const rruleString = Array.isArray(todo.recurrence) 
        ? todo.recurrence[0] 
        : todo.recurrence;
      if (!rruleString) return;
      
      const todoStartDate = new Date(todo.startDate);
      const todoEndDate = todo.recurrenceEndDate 
        ? new Date(todo.recurrenceEndDate) 
        : null;
      
      // 주 범위 내 모든 날짜 체크
      let loopDate = weekStart.clone();
      while (loopDate.isBefore(weekEnd) || loopDate.isSame(weekEnd, 'day')) {
        // exdates 확인
        const dateStr = loopDate.format('YYYY-MM-DD');
        const isExcluded = todo.exdates?.some(exdate => {
          const exdateStr = typeof exdate === 'string'
            ? exdate.split('T')[0]
            : dayjs(exdate).format('YYYY-MM-DD');
          return exdateStr === dateStr;
        });
        
        if (!isExcluded && isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
          if (!weekEvents[dateStr]) weekEvents[dateStr] = [];
          weekEvents[dateStr].push({
            _id: todo._id,
            title: todo.title,
            color: categoryColorMap[todo.categoryId] || '#808080',
            isRecurring: true,
            event: todo,
          });
        }
        loopDate = loopDate.add(1, 'day');
      }
    } else {
      // 단일/기간 일정
      const start = dayjs(todo.startDate);
      const end = todo.endDate ? dayjs(todo.endDate) : start;
      
      let current = start.clone();
      while (current.isBefore(end) || current.isSame(end, 'day')) {
        // 주 범위 내에 있는지 확인
        if ((current.isAfter(weekStart) || current.isSame(weekStart, 'day')) &&
            (current.isBefore(weekEnd) || current.isSame(weekEnd, 'day'))) {
          const dateStr = current.format('YYYY-MM-DD');
          if (!weekEvents[dateStr]) weekEvents[dateStr] = [];
          weekEvents[dateStr].push({
            _id: todo._id,
            title: todo.title,
            color: categoryColorMap[todo.categoryId] || '#808080',
            isRecurring: false,
            event: todo,
          });
        }
        current = current.add(1, 'day');
      }
    }
  });
  
  // 캐시 저장
  eventsCacheRef.current[weekKey] = weekEvents;
  Object.assign(eventsMap, weekEvents);
}

// 캐시 메모리 관리 (최근 20주만 유지)
const cacheKeys = Object.keys(eventsCacheRef.current);
if (cacheKeys.length > 20) {
  const sortedKeys = cacheKeys.sort();
  const keysToDelete = sortedKeys.slice(0, cacheKeys.length - 20);
  keysToDelete.forEach(key => delete eventsCacheRef.current[key]);
  console.log(`🗑️ [캐시] 오래된 캐시 삭제: ${keysToDelete.length}개`);
}

const eventCount = Object.keys(eventsMap).length;
console.log(`📊 [캐시] 히트: ${cacheHits}개, 미스: ${cacheMisses}개, 총 캐시: ${cacheKeys.length}개`);
console.log(`✅ [이벤트] ${eventCount}개 날짜 계산 완료`);
```

**체크포인트**:
- [ ] 캐시 히트/미스 정상 작동
- [ ] RRule 전개 정상 작동
- [ ] 성능 측정 (캐시 히트 시 <1ms, 미스 시 <10ms)

---

#### Step 1-4: Hook 테스트 (30분)

**테스트 파일**: `client/src/test/TestCalendarDynamicEvents.js` (신규)

**작업 내용**:
```javascript
import React from 'react';
import { View, Text, Button, ScrollView } from 'react-native';
import { useCalendarDynamicEvents } from '../hooks/useCalendarDynamicEvents';
import { generateCalendarData } from '../components/ui/ultimate-calendar/calendarUtils';
import dayjs from 'dayjs';

export default function TestCalendarDynamicEvents() {
  const [visibleIndex, setVisibleIndex] = React.useState(30);
  
  // 테스트용 주 데이터 생성
  const { weeks } = React.useMemo(() => {
    const today = dayjs();
    return generateCalendarData(today, 'sunday', 
      today.subtract(6, 'month'), 
      today.add(12, 'month')
    );
  }, []);
  
  // Hook 테스트
  const eventsByDate = useCalendarDynamicEvents({
    weeks,
    visibleIndex,
    range: 3,
    cacheType: 'week'
  });
  
  const eventCount = Object.keys(eventsByDate).length;
  const totalEvents = Object.values(eventsByDate).reduce((sum, arr) => sum + arr.length, 0);
  
  return (
    <ScrollView style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        useCalendarDynamicEvents 테스트
      </Text>
      
      <Text>현재 인덱스: {visibleIndex}</Text>
      <Text>총 주 수: {weeks.length}</Text>
      <Text>이벤트 있는 날짜: {eventCount}개</Text>
      <Text>총 이벤트 수: {totalEvents}개</Text>
      
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
        <Button title="이전 주" onPress={() => setVisibleIndex(prev => Math.max(0, prev - 1))} />
        <Button title="다음 주" onPress={() => setVisibleIndex(prev => Math.min(weeks.length - 1, prev + 1))} />
        <Button title="오늘" onPress={() => setVisibleIndex(30)} />
      </View>
      
      <Text style={{ marginTop: 20, fontWeight: 'bold' }}>이벤트 목록:</Text>
      {Object.entries(eventsByDate).slice(0, 10).map(([date, events]) => (
        <View key={date} style={{ marginTop: 10 }}>
          <Text>{date}: {events.length}개</Text>
          {events.map((e, i) => (
            <Text key={i} style={{ marginLeft: 20, color: e.color }}>
              - {e.title}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
```

**테스트 시나리오**:
1. 앱 실행 → TestDashboard → "Calendar Dynamic Events" 버튼
2. 초기 로딩 확인 (30번째 주 ±3주 범위)
3. "이전 주" / "다음 주" 버튼 클릭 → 이벤트 동적 변경 확인
4. 콘솔 로그 확인:
   - 캐시 히트/미스
   - 성능 측정 (<10ms)
   - 이벤트 개수

**체크포인트**:
- [ ] Hook 정상 작동
- [ ] 동적 범위 계산 확인
- [ ] 캐시 작동 확인
- [ ] 성능 목표 달성 (<10ms)

---

### Phase 2: UltimateCalendar 적용 (1시간)

#### Step 2-1: UltimateCalendar 수정 (30분)

**파일**: `client/src/components/ui/ultimate-calendar/UltimateCalendar.js`

**변경 사항**:
```javascript
// ✅ 추가 import
import { useCalendarDynamicEvents } from '../../hooks/useCalendarDynamicEvents';

// ❌ 기존 props 제거
// export default function UltimateCalendar({ eventsByDate = {} }) {

// ✅ 새로운 시그니처
export default function UltimateCalendar() {
  // ... 기존 코드 ...
  
  // ✅ 동적 이벤트 계산 추가
  const eventsByDate = useCalendarDynamicEvents({
    weeks,
    visibleIndex: visibleWeekIndex,
    range: 3,
    cacheType: 'week'
  });
  
  // ... 나머지 코드 동일 ...
}
```

**체크포인트**:
- [ ] 컴파일 에러 없음
- [ ] eventsByDate 정상 생성
- [ ] 기존 기능 유지

---

#### Step 2-2: TodoScreen 수정 (10분)

**파일**: `client/src/screens/TodoScreen.js`

**변경 사항**:
```javascript
// ❌ 제거
// const { eventsByDate } = useCalendarEvents(currentYear, currentMonth);

// ✅ 변경
<UltimateCalendar />  {/* props 제거 */}
```

**체크포인트**:
- [ ] 컴파일 에러 없음
- [ ] TodoScreen 정상 렌더링

---

#### Step 2-3: 통합 테스트 (20분)

**테스트 시나리오**:
1. TodoScreen 진입
2. 주간뷰에서 스크롤 → 이벤트 점 표시 확인
3. 월간뷰로 전환 → 이벤트 점 표시 확인
4. 다른 월로 스크롤 → 이벤트 동적 로딩 확인
5. 콘솔 로그 확인:
   - 범위 계산
   - 캐시 히트/미스
   - 성능 측정

**체크포인트**:
- [ ] 주간뷰 이벤트 표시 정상
- [ ] 월간뷰 이벤트 표시 정상
- [ ] 스크롤 시 동적 로딩 확인
- [ ] 성능 목표 달성 (<10ms)

---

### Phase 3: CalendarScreen 리팩토링 (선택, 1시간)

#### Step 3-1: CalendarScreen 수정 (40분)

**파일**: `client/src/screens/CalendarScreen.js`

**변경 사항**:
```javascript
// ✅ 추가 import
import { useCalendarDynamicEvents } from '../hooks/useCalendarDynamicEvents';

// ❌ 기존 useMemo 제거 (100줄)
// const eventsByDate = useMemo(() => { ... }, [todos, categories]);

// ✅ Hook 사용
const eventsByDate = useCalendarDynamicEvents({
  weeks: months,  // months를 weeks처럼 취급
  visibleIndex: currentViewIndex,
  range: 3,
  cacheType: 'month'
});
```

**주의사항**:
- months 배열 구조가 weeks와 다를 수 있음
- Hook 내부에서 자동 감지하도록 수정 필요

**체크포인트**:
- [ ] 기존 기능 유지
- [ ] 성능 유지 또는 개선
- [ ] 코드 100줄 감소

---

#### Step 3-2: 테스트 (20분)

**테스트 시나리오**:
1. CalendarScreen 진입
2. 36개월 스크롤 → 이벤트 표시 확인
3. 성능 비교 (기존 vs 새로운 방식)

**체크포인트**:
- [ ] 기존 기능 100% 유지
- [ ] 성능 저하 없음

---

## 🧪 최종 테스트 체크리스트

### 기능 테스트:
- [ ] UltimateCalendar 주간뷰 이벤트 표시
- [ ] UltimateCalendar 월간뷰 이벤트 표시
- [ ] 스크롤 시 동적 이벤트 로딩
- [ ] 반복 일정 정상 표시
- [ ] 단일 일정 정상 표시
- [ ] 기간 일정 정상 표시
- [ ] exdates 제외 정상 작동

### 성능 테스트:
- [ ] 초기 로딩: <10ms
- [ ] 캐시 히트: <1ms
- [ ] 캐시 미스: <10ms
- [ ] 스크롤 버벅임 없음

### 오프라인 테스트:
- [ ] 오프라인 최초 실행 정상
- [ ] AsyncStorage 데이터 사용 확인
- [ ] 캐시 정상 작동

---

## 📊 성능 목표

| 항목 | 목표 | 측정 방법 |
|------|------|-----------|
| 초기 로딩 | <10ms | performance.now() |
| 캐시 히트 | <1ms | performance.now() |
| 캐시 미스 | <10ms | performance.now() |
| 메모리 사용 | <5MB | 캐시 크기 모니터링 |
| 캐시 히트율 | >80% | 히트/미스 비율 |

---

## 🚨 리스크 및 대응

### 리스크 1: 성능 저하
**증상**: 스크롤 시 버벅임  
**원인**: RRule 전개 시간 초과  
**대응**: 
- 범위 축소 (±3주 → ±2주)
- 캐시 크기 증가 (20주 → 30주)

### 리스크 2: 메모리 부족
**증상**: 앱 크래시  
**원인**: 캐시 크기 과다  
**대응**:
- 캐시 크기 제한 강화 (20주 → 10주)
- 오래된 캐시 적극 삭제

### 리스크 3: 이벤트 누락
**증상**: 일부 이벤트 표시 안 됨  
**원인**: 범위 계산 오류  
**대응**:
- 디버깅 로그 확인
- 범위 계산 로직 재검토

---

## 📝 커밋 전략

### 커밋 1: Hook 생성
```bash
git add client/src/hooks/useCalendarDynamicEvents.js
git commit -m "feat: add useCalendarDynamicEvents hook

- Dynamic event calculation based on visible range
- Week-based caching for performance
- Support for recurring events (RRule)
- Performance: <10ms per calculation
"
```

### 커밋 2: UltimateCalendar 적용
```bash
git add client/src/components/ui/ultimate-calendar/UltimateCalendar.js
git add client/src/screens/TodoScreen.js
git commit -m "feat: integrate dynamic events in UltimateCalendar

- Remove static eventsByDate props
- Use useCalendarDynamicEvents hook
- Events load dynamically on scroll
- Performance: <10ms, cache hit rate >80%
"
```

### 커밋 3: CalendarScreen 리팩토링 (선택)
```bash
git add client/src/screens/CalendarScreen.js
git commit -m "refactor: use useCalendarDynamicEvents in CalendarScreen

- Remove 100 lines of duplicate logic
- Reuse shared hook
- Maintain existing functionality
- Code reduction: 100 lines
"
```

---

## ✅ 완료 조건

1. **기능 완성도**: 100%
   - 모든 이벤트 타입 지원
   - 동적 로딩 정상 작동
   - 오프라인 지원

2. **성능 목표 달성**: 100%
   - 초기 로딩 <10ms
   - 캐시 히트 <1ms
   - 스크롤 버벅임 없음

3. **코드 품질**: 100%
   - 컴파일 에러 없음
   - 디버깅 로그 적절
   - 주석 충분

4. **테스트 통과**: 100%
   - 기능 테스트 통과
   - 성능 테스트 통과
   - 오프라인 테스트 통과

---

**작성자**: Kiro AI  
**검토자**: 사용자  
**승인 후 구현 시작**
