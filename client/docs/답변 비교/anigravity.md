# Antigravity 분석

## 🎯 최종 추천 아키텍처

**"범위 기반 API + 클라이언트 RRule 전개"**

다른 AI들의 답변을 검토한 결과, 업계 표준과 일치하는 구조를 추천합니다.

---

## 1️⃣ API 통합 vs 분리?

### ✅ 추천: Option A (범위 기반 통합 API)

```
GET /todos/events?startDate=2026-01-01&endDate=2026-03-31
→ [{ _id, title, color, startDate, recurrence, exdates, ... }]
```

**이유:**
- **Dot/Line 분리 불필요**: title 텍스트는 몇 바이트, gzip 압축되면 무시 가능
- **캐시 일관성**: 하나의 쿼리 키로 모든 뷰가 같은 데이터 공유
- **네트워크 효율**: API 2번 호출(summary + events)보다 1번이 나음

**Option C (GET /all) 거부 이유:**
- Todo 3,000개 넘으면 RN에서 JS thread 점유 → 스크롤 버벅임
- 메모리 부족 → 앱 크래시 가능성
- Google Calendar도 전체 조회 API 없음 (범위 필수)

---

## 2️⃣ 범위(Range) 전략?

### ✅ 추천: 3개월 단위

**TodoScreen:**
```
초기: 현재 월 ± 1개월 (총 3개월)
스와이프 시: 버퍼 범위 확인 후 추가 로드
```

**CalendarScreen (무한 스크롤):**
```
초기: 현재 월 ± 1개월 (총 3개월)
스크롤 70% 도달 시: 다음 3개월 prefetch
```

**이유:**
- 너무 적으면 (1개월): API 호출 빈번 → 네트워크 비용
- 너무 많으면 (6개월+): 초기 로딩 느림 → UX 저하
- 3개월이 균형점 (Apple Calendar, Fantastical 동일)

---

## 3️⃣ RRule 처리 위치?

### ✅ 추천: 클라이언트 전개

**서버:**
- RRule 문자열 그대로 반환
- 범위 필터만 수행 (startDate, recurrenceEndDate 인덱스 활용)

**클라이언트:**
- rrule.js로 화면 범위 내 occurrence 계산
- useMemo로 캐싱 → 재렌더 방지

```javascript
const occurrencesMap = useMemo(() => {
  const map = {};
  
  events.forEach(event => {
    if (event.recurrence) {
      // rrule.js로 범위 내 날짜 계산
      const rule = RRule.fromString(event.recurrence);
      const dates = rule.between(rangeStart, rangeEnd);
      
      dates.forEach(date => {
        const key = formatDate(date);
        if (!map[key]) map[key] = [];
        map[key].push({ ...event, instanceDate: key });
      });
    } else {
      // 단일 일정
      const key = event.startDate;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    }
  });
  
  return map;
}, [events, rangeStart, rangeEnd]);
```

**클라이언트 전개 선택 이유:**

| 서버 전개 | 클라이언트 전개 |
|----------|---------------|
| ❌ 서버 CPU 부하 | ✅ 서버 단순 (DB IO만) |
| ❌ 응답 크기 증가 (52주 = 52개 객체) | ✅ 응답 작음 (1개 Rule 문자열) |
| ❌ 타임존 복잡 | ✅ 로컬 타임존 자연스럽게 적용 |
| ❌ 오프라인 불가 | ✅ 오프라인 지원 가능 |

**업계 표준:**
- Google Calendar API: `RRULE` 문자열 반환, 클라이언트 전개
- Apple Calendar: 로컬 rrule 파싱
- Outlook: 동일

---

## 4️⃣ 캐시 키 전략?

### ✅ 추천: 범위 기반 키

```javascript
// TanStack Query 캐시 키
['events', startDate, endDate]

// 예시
['events', '2026-01-01', '2026-03-31']
```

**이유:**
- `['events', 'all']`: 메모리 과다, 확장성 X
- `['events', '2026-01']` (월 단위): 월 경계 중복 쿼리 발생
- 범위 기반: useInfiniteQuery와 자연스럽게 연동

**staleTime 설정:**
```javascript
{
  staleTime: 5 * 60 * 1000,  // 5분
  gcTime: 30 * 60 * 1000,    // 30분 후 GC
}
```

---

## 5️⃣ 성능 최적화?

### Dot 뷰에 title 포함해도 괜찮나?

**✅ 괜찮음**

- JSON 차이: 수 KB (무시 가능)
- 통일된 응답 → 캐시 효율 ↑
- Dot에서 title 무시하면 끝

### React Native 특화 최적화

```javascript
// 1. RRule 계산 후 UI 블로킹 방지
InteractionManager.runAfterInteractions(() => {
  // 무거운 계산
});

// 2. 가상화 필수
<FlashList /> // FlatList보다 2배 빠름

// 3. 메모이제이션
const MemoizedDayCell = React.memo(DayCell, (prev, next) => 
  prev.dateString === next.dateString &&
  prev.events?.length === next.events?.length
);
```

---

## 🏗️ 제안 아키텍처

### 서버 API

```javascript
// GET /todos/events?startDate=&endDate=
exports.getEvents = async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const todos = await Todo.find({
    userId: req.userId,
    $or: [
      // 범위 내 단일 일정
      { startDate: { $gte: startDate, $lte: endDate }, recurrence: null },
      // 범위에 걸칠 수 있는 반복 일정
      { 
        recurrence: { $ne: null },
        $or: [
          { recurrenceEndDate: { $gte: startDate } },
          { recurrenceEndDate: null }
        ]
      }
    ]
  }).populate('categoryId', 'color');
  
  res.json(todos);
};
```

### 클라이언트 훅

```javascript
// hooks/useCalendarEvents.js
export const useCalendarEvents = (startDate, endDate) => {
  const { data: rawEvents = [] } = useQuery({
    queryKey: ['events', startDate, endDate],
    queryFn: () => fetchEvents(startDate, endDate),
  });
  
  const { data: categories } = useCategories();
  
  // RRule 전개 + 날짜별 그룹핑
  const eventsByDate = useMemo(() => {
    return expandAndGroupEvents(rawEvents, categories, startDate, endDate);
  }, [rawEvents, categories, startDate, endDate]);
  
  return { eventsByDate };
};
```

### 컴포넌트 사용

```javascript
// TodoScreen.js
const { eventsByDate } = useCalendarEvents(rangeStart, rangeEnd);

<UltimateCalendar eventsByDate={eventsByDate} />
<DailyTodoList events={eventsByDate[selectedDate]} />
```

---

## 📊 다른 AI 비교

| 항목 | Antigravity | GPT | Gemini | Grok | DeepSeek |
|-----|------------|-----|--------|------|----------|
| API 구조 | 범위 통합 | 범위 통합 | 범위 통합 | 범위 통합 | ⚠️ 전체+혼합 |
| RRule | 클라이언트 | 클라이언트 | 클라이언트 | 클라이언트 | ⚠️ 서버 |
| 범위 | 3개월 | 3개월 | 3개월 | 3개월 | 3개월 |
| 캐시 키 | 범위 기반 | 범위 기반 | 월+범위 | 범위 기반 | 전체+범위 |

**4/5 AI가 동일 결론:** 범위 API + 클라이언트 RRule 전개

---

## 🔥 결론

```
서버: GET /todos/events?start&end → 원본 Todo (RRule 포함) 반환
클라: rrule.js로 전개 → useMemo 캐싱 → eventsByDate Map
뷰:   Dot/Line/List 모두 같은 Map 사용
```

이 구조가:
- ✅ Google/Apple/Outlook 표준
- ✅ 오프라인 지원 가능
- ✅ 서버 스케일 비용 최소
- ✅ React Native 성능 최적

**구현 시작할까요?** 🚀
