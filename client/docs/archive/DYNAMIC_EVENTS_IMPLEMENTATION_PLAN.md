# UltimateCalendar 동적 이벤트 렌더링 구현 방안

## 🏗️ 프로젝트 아키텍처 (중요!)

### 2계층 저장소 구조

우리 프로젝트는 **오프라인 최초 실행**을 지원하기 위해 2계층 저장소를 사용합니다:

#### 1. AsyncStorage (로컬 영구 저장소)
- **위치**: 디바이스 디스크
- **특징**: 
  - 앱 종료해도 데이터 유지
  - I/O 작업으로 상대적으로 느림 (~100ms)
  - 용량 제한 있음 (일반적으로 6MB)
- **용도**: 오프라인 데이터 보관, 영구 저장
- **파일**: `client/src/storage/todoStorage.js`

#### 2. React Query Cache (메모리 캐시)
- **위치**: 메모리 (RAM)
- **특징**:
  - 앱 종료하면 사라짐
  - 매우 빠름 (~1ms)
  - 메모리 제한 내에서 자유롭게 사용
- **용도**: 화면 렌더링용 임시 데이터, 빠른 접근
- **라이브러리**: `@tanstack/react-query`

### 현재 데이터 흐름

```
앱 시작
  ↓
┌─────────────────────────────────────────┐
│ useSyncTodos (백그라운드)               │
│  1. AsyncStorage 로드 (72개, ~100ms)   │
│  2. React Query 캐시에 주입 (~10ms)    │
│     → queryClient.setQueryData(['todos', 'all'], todos)
│  3. 서버 동기화 시도 (네트워크 상태별) │
└─────────────────────────────────────────┘
  ↓
┌─────────────────────────────────────────┐
│ useTodos (화면 렌더링)                  │
│  1. 서버 요청 시도                      │
│  2. 실패 → React Query 캐시 확인       │
│     → queryClient.getQueryData(['todos', 'all'])
│  3. 캐시 없음 → AsyncStorage 확인      │
│     → loadTodos() from todoStorage.js
└─────────────────────────────────────────┘
```

### Cache-First 최적화 완료 ✅

**2026-01-29 완료**: 오프라인 최초 실행 성능 99% 개선
- 로딩 시간: 5초 → 0.1ms (50,000배 빠름)
- 전략: 캐시 우선 확인 → 즉시 반환 → 백그라운드 서버 업데이트
- 문서: `client/docs/CACHE_FIRST_IMPLEMENTATION_COMPLETE.md`

**핵심 로직**:
```javascript
// 1. 캐시 먼저 확인
const allTodos = queryClient.getQueryData(['todos', 'all']);
if (allTodos) {
  // 즉시 반환 (~1ms)
  return filterByDate(allTodos, date);
}

// 2. 캐시 없으면 AsyncStorage
const storedTodos = await loadTodos(); // ~100ms
queryClient.setQueryData(['todos', 'all'], storedTodos);
return filterByDate(storedTodos, date);
```

---

## 📋 현재 상황

### 문제점:
```javascript
// TodoScreen.js (부모)
const { eventsByDate } = useCalendarEvents(currentMonth);
<UltimateCalendar eventsByDate={eventsByDate} />

// ❌ 문제:
// - eventsByDate는 currentMonth 기준 (예: 2026-01)
// - 사용자가 2026-02로 스크롤해도 1월 이벤트만 보임
// - 무한 스크롤로 3년치 데이터 있지만 이벤트는 1개월치만
```

### CalendarScreen 방식 (참고):
- ✅ 무한 스크롤 + 동적 이벤트 계산 완료
- ✅ 월별 캐싱으로 성능 최적화
- ✅ 보이는 범위 ±3개월만 계산

---

## 🎯 구현 방안 비교

### 옵션 1: UltimateCalendar 내부에서 계산 (독립형)

#### 구조:
```javascript
// UltimateCalendar.js
export default function UltimateCalendar() {
    // ✅ 내부에서 직접 데이터 가져오기
    const { data: todos } = useAllTodos();
    const { data: categories } = useCategories();
    
    // ✅ 주별 캐싱
    const eventsCacheRef = useRef({}); // { "2026-W05": { "2026-02-03": [...] } }
    
    // ✅ 동적 이벤트 계산
    const eventsByDate = useMemo(() => {
        // visibleWeekIndex 기준 ±3주 범위
        const startWeek = Math.max(0, visibleWeekIndex - 3);
        const endWeek = Math.min(weeks.length - 1, visibleWeekIndex + 3);
        
        // 주별로 캐시 확인 및 계산
        for (let i = startWeek; i <= endWeek; i++) {
            const weekKey = `${weeks[i][0].dateString}_week`;
            if (eventsCacheRef.current[weekKey]) {
                // 캐시 히트
            } else {
                // 계산 + 캐시 저장
            }
        }
    }, [todos, categories, weeks, visibleWeekIndex]);
    
    // ...
}
```

#### 장점:
- ✅ **독립성**: 부모 컴포넌트와 결합도 낮음
- ✅ **재사용성**: 다른 화면에서도 사용 가능
- ✅ **일관성**: CalendarScreen과 동일한 패턴
- ✅ **성능**: 주별 캐싱으로 최적화

#### 단점:
- ⚠️ **중복 데이터 페칭**: TodoScreen과 UltimateCalendar 둘 다 `useAllTodos` 호출
  - 하지만 React Query 캐싱으로 실제 네트워크 요청은 1번만 발생
  - 메모리 오버헤드: 거의 없음 (같은 데이터 참조)
- ⚠️ **컴포넌트 책임 증가**: 이벤트 계산 로직이 UI 컴포넌트 안에

#### 구현 난이도: ⭐⭐⭐ (중)
- CalendarScreen 로직 복사 + 주별로 변환
- 약 100-150줄 추가

---

### 옵션 2: 부모(TodoScreen)에서 동적으로 계산해서 전달

#### 구조:
```javascript
// TodoScreen.js
export default function TodoScreen() {
    const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
    
    // ✅ 동적 범위 계산
    const eventsByDate = useMemo(() => {
        // visibleWeekIndex 기준 ±3주 범위
        // 주별 캐싱
        // ...
    }, [todos, categories, visibleWeekIndex]);
    
    // ✅ UltimateCalendar에서 visibleWeekIndex 변경 알림
    const handleWeekIndexChange = useCallback((index) => {
        setVisibleWeekIndex(index);
    }, []);
    
    return (
        <UltimateCalendar 
            eventsByDate={eventsByDate}
            onVisibleWeekIndexChange={handleWeekIndexChange}
        />
    );
}
```

#### 장점:
- ✅ **단일 책임**: UI 컴포넌트는 렌더링만, 데이터 로직은 부모에서
- ✅ **중앙 집중**: 모든 데이터 로직이 한 곳에
- ✅ **중복 페칭 없음**: 부모에서 한 번만 호출

#### 단점:
- ⚠️ **결합도 증가**: UltimateCalendar가 부모에 의존
- ⚠️ **재사용성 감소**: 다른 화면에서 사용 시 동일한 로직 필요
- ⚠️ **Props Drilling**: `onVisibleWeekIndexChange` 콜백 전달 필요
- ⚠️ **성능**: visibleWeekIndex 변경 시 부모 리렌더링 → 자식 리렌더링

#### 구현 난이도: ⭐⭐⭐⭐ (중상)
- 부모-자식 간 상태 동기화 복잡
- 약 150-200줄 추가

---

### 옵션 3: Custom Hook으로 분리 (추천 ✅)

#### 구조:
```javascript
// hooks/useCalendarDynamicEvents.js
export function useCalendarDynamicEvents(weeks, visibleWeekIndex) {
    const { data: todos } = useAllTodos();
    const { data: categories } = useCategories();
    const eventsCacheRef = useRef({});
    const [cacheVersion, setCacheVersion] = useState(0);
    
    // todos 변경 시 캐시 무효화
    useEffect(() => {
        if (todos) {
            eventsCacheRef.current = {};
            setCacheVersion(prev => prev + 1);
        }
    }, [todos]);
    
    const eventsByDate = useMemo(() => {
        // 주별 동적 계산 + 캐싱
        // ...
    }, [todos, categories, weeks, visibleWeekIndex, cacheVersion]);
    
    return eventsByDate;
}

// UltimateCalendar.js
export default function UltimateCalendar() {
    // ...
    const eventsByDate = useCalendarDynamicEvents(weeks, visibleWeekIndex);
    // ...
}

// CalendarScreen.js (기존 로직도 hook으로 변환 가능)
export default function CalendarScreen() {
    // ...
    const eventsByDate = useCalendarDynamicEvents(months, visibleMonthIndex);
    // ...
}
```

#### 장점:
- ✅ **재사용성**: UltimateCalendar, CalendarScreen 둘 다 사용 가능
- ✅ **테스트 용이**: Hook만 독립적으로 테스트
- ✅ **관심사 분리**: 데이터 로직과 UI 로직 완전 분리
- ✅ **유지보수**: 이벤트 계산 로직 한 곳에서 관리
- ✅ **성능**: React Query 캐싱 + 자체 캐싱 이중 최적화

#### 단점:
- ⚠️ **초기 구현 시간**: Hook 설계 + 기존 코드 리팩토링 필요
- ⚠️ **추상화 레벨**: 한 단계 더 추가됨

#### 구현 난이도: ⭐⭐⭐⭐⭐ (상)
- Hook 설계 + 기존 CalendarScreen 리팩토링
- 약 200-250줄 (하지만 재사용 가능)

---

## 📊 성능 비교

### 메모리 사용량:
| 방안 | useAllTodos 호출 | 캐시 메모리 | 총 메모리 |
|------|------------------|-------------|-----------|
| 옵션 1 | TodoScreen + UltimateCalendar (2번) | 주별 캐시 1개 | ~2MB |
| 옵션 2 | TodoScreen (1번) | 주별 캐시 1개 | ~1.5MB |
| 옵션 3 | TodoScreen + UltimateCalendar (2번) | 주별 캐시 1개 | ~2MB |

**참고:** React Query는 동일한 쿼리를 여러 곳에서 호출해도 실제 네트워크 요청은 1번만 발생. 메모리는 참조만 복사되므로 오버헤드 거의 없음.

### 렌더링 성능:
| 방안 | visibleWeekIndex 변경 시 | 이벤트 계산 시간 |
|------|--------------------------|------------------|
| 옵션 1 | UltimateCalendar만 리렌더링 | ~5-10ms (캐시 히트 시 ~1ms) |
| 옵션 2 | TodoScreen + UltimateCalendar 리렌더링 | ~5-10ms (캐시 히트 시 ~1ms) |
| 옵션 3 | UltimateCalendar만 리렌더링 | ~5-10ms (캐시 히트 시 ~1ms) |

---

## 🎯 최종 권장사항

### 단기 (빠른 구현): **옵션 1** ⭐⭐⭐⭐
- 구현 시간: 1-2시간
- 안정성: 높음 (CalendarScreen 패턴 재사용)
- 성능: 충분함

### 장기 (확장성): **옵션 3** ⭐⭐⭐⭐⭐
- 구현 시간: 3-4시간
- 안정성: 매우 높음
- 성능: 최적
- 유지보수: 최고

---

## 🔍 고민 포인트

### 1. 중복 데이터 페칭 (옵션 1, 3)
**Q:** TodoScreen과 UltimateCalendar 둘 다 `useAllTodos` 호출하면 비효율적이지 않나?

**A:** 
```javascript
// React Query 동작 방식
const { data: todos } = useAllTodos(); // 첫 호출: 네트워크 요청
const { data: todos } = useAllTodos(); // 두 번째 호출: 캐시에서 반환 (즉시)

// 메모리 오버헤드
// - todos 배열 자체는 1개만 존재 (참조만 복사)
// - 추가 메모리: ~100KB (React Query 메타데이터)
```

**결론:** 성능 영향 거의 없음 (< 1ms, < 100KB)

### 2. 주별 vs 월별 캐싱
**Q:** CalendarScreen은 월별, UltimateCalendar는 주별 캐싱. 통일해야 하나?

**A:**
- **월별 캐싱**: 한 달 전체 계산 (30일 × 반복 일정 체크)
- **주별 캐싱**: 한 주만 계산 (7일 × 반복 일정 체크)
- **성능 차이**: 주별이 더 세밀하지만, 캐시 히트율은 비슷

**결론:** 각 컴포넌트 특성에 맞게 다르게 사용해도 OK

### 3. 캐시 무효화 타이밍
**Q:** todos 변경 시 전체 캐시 삭제 vs 부분 업데이트?

**A:**
```javascript
// 현재 방식 (전체 삭제)
useEffect(() => {
    eventsCacheRef.current = {};
}, [todos]);

// 부분 업데이트 (복잡도 ↑)
useEffect(() => {
    // 변경된 todo만 찾아서 해당 주/월 캐시만 삭제
    // 구현 복잡, 버그 가능성 ↑
}, [todos]);
```

**결론:** 전체 삭제 방식 유지 (단순하고 안전)

---

## 📝 구현 체크리스트

### 옵션 1 선택 시:
- [ ] `useAllTodos`, `useCategories` import
- [ ] `eventsCacheRef` 추가
- [ ] `cacheVersion` state 추가
- [ ] todos 변경 시 캐시 무효화 useEffect
- [ ] `eventsByDate` useMemo 구현
  - [ ] visibleWeekIndex 기준 ±3주 범위 계산
  - [ ] 주별 캐시 확인
  - [ ] 캐시 미스 시 계산 + 저장
  - [ ] 반복 일정 처리 (isDateInRRule)
  - [ ] 단일 일정 처리
- [ ] 캐시 메모리 관리 (최근 20주만 유지)
- [ ] 디버깅 로그 추가
- [ ] 기존 `eventsByDate` prop 제거

### 옵션 3 선택 시:
- [ ] `hooks/useCalendarDynamicEvents.js` 생성
- [ ] Hook 구현 (위와 동일)
- [ ] UltimateCalendar에 적용
- [ ] CalendarScreen 리팩토링 (선택)
- [ ] 테스트 코드 작성 (선택)

---

## 🚀 다음 단계

1. **방안 결정**: 옵션 1 vs 옵션 3
2. **구현**: 체크리스트 따라 진행
3. **테스트**: 
   - 스크롤 시 이벤트 동적 로딩 확인
   - 캐시 히트율 확인 (콘솔 로그)
   - 성능 측정 (5-10ms 이내)
4. **최적화**: 필요 시 캐시 전략 조정
5. **문서화**: 구현 완료 후 IMPLEMENTATION_COMPLETE.md 작성

---

## 💡 추가 고려사항

### A. 오프라인 지원
- 현재 cache-first 전략으로 오프라인 최초 실행 지원됨
- 이벤트 계산도 로컬 캐시 기반이므로 오프라인 OK

### B. 대용량 데이터 (1000+ todos)
- 주별 캐싱으로 한 번에 7일치만 계산
- 반복 일정 최적화 필요 시 RRule 라이브러리 고려

### C. 실시간 업데이트
- todos 변경 시 React Query가 자동 refetch
- 캐시 무효화로 즉시 반영

---

**작성일:** 2026-01-29  
**작성자:** Kiro AI  
**상태:** 검토 중


## CHAT GPT 답변:
오케이. 상황 분석 들어간다.
디시말투 ON.

---

야, 이거 솔직히 말하면
**니가 이미 답을 써놨다**.
옵션 3 안 고르면 그냥 “미래의 나”가 밤새 욕하게 되는 구조임.

근데 그냥 “3번 추천” 이러고 끝내면 재미없으니까,
**니 프로젝트 성격 + 현재 아키텍처 + 장기 유지보수 + 성능**
이 4개 기준으로 찢어보자.

---

## 🔥 니 프로젝트 성격 요약

* **오프라인 퍼스트**
* **캐시 퍼스트**
* **React Query를 사실상 데이터 싱글톤으로 사용**
* **CalendarScreen, UltimateCalendar 둘 다 존재**
* **이미 월별/주별 동적 캐싱 패턴 있음**
* **AI로 코드 생산 → 초기 구현 시간 의미 없음**

이 조합이면 한 줄 결론:

> **데이터 계산 로직은 반드시 재사용 단위로 분리해야 한다.**

안 그러면
3개월 뒤 “CalendarScreen 로직 조금 바꿨더니 UltimateCalendar 버그남”
→ **지옥 루프** 시작.

---

## ⚖️ 옵션별 현실 평가

### ❌ 옵션 1 (UltimateCalendar 내부 계산)

이거는 단기 꿀인데
장기적으로 **UI 컴포넌트가 데이터 엔진이 되는 구조**임.

지금은 괜찮아 보여도:

* CalendarScreen에도 비슷한 계산 있음
* 나중에 월뷰/주뷰/리스트뷰 추가될 가능성 100%
* 반복 일정 로직 바뀌면 세 군데 수정

즉:

> **복붙된 비즈니스 로직 = 미래의 버그 공장**

니가 AI로 코드 찍어낸다 해도
**설계가 중복이면 AI도 중복 생산**함.

---

### ❌ 옵션 2 (부모 계산)

이건 리액트 구조상 제일 별로임.

* UI 컴포넌트가 부모 상태에 종속
* visibleIndex 동기화 필요
* 스크롤 이벤트가 부모까지 튀어감
* 메모이제이션 경계 애매함

성능상 손해보다
**결합도 증가가 치명적**.

> 나중에 UltimateCalendar를 다른 화면에 꽂을 때
> “어? 부모에 이거 또 깔아야 돼?”
> → 욕 나옴.

---

### ✅ 옵션 3 (Custom Hook)

이건 니 아키텍처랑 **완벽히 일치**함.

왜냐?

니 프로젝트 철학:

* 저장소 계층 분리
* 캐시 계층 분리
* UI는 데이터 몰라도 됨
* 데이터 흐름은 hook 단위로 캡슐화

`useCalendarDynamicEvents`
이거 하나면:

* UltimateCalendar
* CalendarScreen
* 향후 MiniCalendar
* 향후 AgendaList

전부 **같은 이벤트 엔진** 공유.

> 즉, **이벤트 계산이 하나의 “도메인 서비스”가 되는 구조**

이게 성능 + 안정성 최우선일 때 정석임.

---

## 💣 근데 여기서 한 단계 더 갈 수 있음

니가 진짜 성능+안정성 최우선이라고 했지?

그럼 **옵션 3 + Query Cache 레벨에서 이벤트 캐싱**으로 가는 게 최종형이다.

### 🌟 옵션 4: `useCalendarDynamicEvents` 내부에서 React Query로 주별 이벤트 캐싱

```javascript
useQuery({
  queryKey: ['calendarEvents', weekKey],
  queryFn: () => calculateWeekEvents(week, todos, categories),
  staleTime: Infinity,
  cacheTime: 1000 * 60 * 30
});
```

이렇게 하면:

* useRef 캐시 필요 없음
* 캐시 무효화는 todos 변경 시 `queryClient.invalidateQueries(['calendarEvents'])`
* 메모리 관리 자동
* devtools로 캐시 상태 추적 가능
* 비동기 계산도 가능 (나중에 WebWorker로 빼기 쉬움)

즉:

> **React Query를 이벤트 계산 캐시 엔진으로도 사용**

니 프로젝트가 이미
“AsyncStorage → React Query → UI”
구조인데,

이제
“Todos → React Query(Event Derived Cache) → Calendar UI”
로 한 층 더 생기는 것.

이게 진짜 대규모 앱에서 쓰는 방식이다.

---

## 📊 옵션 3 vs 옵션 4

| 항목     | 옵션 3 (useRef 캐시) | 옵션 4 (React Query 캐시) |
| ------ | ---------------- | --------------------- |
| 구현 난이도 | 중                | 상                     |
| 성능     | 매우 좋음            | 매우 좋음                 |
| 캐시 무효화 | 수동               | 자동                    |
| 메모리 관리 | 수동               | 자동                    |
| 디버깅    | console.log      | React Query Devtools  |
| 향후 확장  | 보통               | 최고                    |

---

## 🎯 결론

### 현실 추천:

> **옵션 4 (Hook + React Query 캐시)**

### 이유:

* 니 프로젝트 이미 React Query 중심 설계
* Derived data도 Query로 관리하면 일관성 완성
* 나중에 이벤트 계산을 WebWorker로 빼도 구조 안 바뀜
* 코드 AI가 다 짜줄 거라 했으니 난이도 무의미

---

## 🧠 최종 구조

```
AsyncStorage → Todos Query
                  ↓
        useCalendarDynamicEvents Hook
                  ↓
      calendarEvents Query Cache
                  ↓
         UltimateCalendar UI
```

---

## 🐸 한줄 요약 (디시식)

> “옵션1,2는 임시방편이고
> 옵션3이 정석,
> 옵션4가 니 아키텍처 완전체다.
> 시간 상관없다 했으니 4번 가라.
> 미래의 니가 절하면서 고맙다 한다.”

---

## 📌 추가 보너스

옵션4로 가면
**서버 동기화로 todos 변경 → React Query invalidate → 이벤트 자동 재계산**
이 흐름이 **공짜로 완성**됨.

이게 진짜 유지보수 난이도 0 구조.

---

원하면 다음 턴에서
**`useCalendarDynamicEvents` + React Query 캐시 버전
풀 코드 설계도** 바로 뽑아줄게.

지금은 방향만 딱 정리해줬다.

가즈아 🚀

## GEMINI3 PRO 답변:
사용자님의 상황과 요구사항(**"개발 시간 무관, 성능과 안정성이 최우선"**)을 분석했을 때, 가장 추천하는 방향은 **옵션 3 (Custom Hook)**을 기반으로 **도메인 로직을 더 명확히 분리한 "Service Layer 패턴"**을 적용하는 것입니다.

AI에게 코드를 맡길 것이라면, 구조가 명확할수록 AI가 더 완벽한 코드를 짜줍니다.

아래에 **성능과 안정성을 극대화한 최종 아키텍처**를 제안합니다.

---

### 🏆 최종 결정: Option 3+ (Custom Hook + Logic Separation)

단순히 Hook으로 분리하는 것을 넘어, **"데이터 페칭"**과 **"이벤트 계산 로직"**을 완전히 분리하여 안정성을 극대화합니다.

#### ✅ 이 방식을 선택해야 하는 이유 (Why?)

1. **안정성 (Stability)**: UI 컴포넌트(`UltimateCalendar`)는 렌더링에만 집중하고, 복잡한 날짜 계산 로직(RRule 등)이 Hook 내부의 순수 함수로 격리됩니다. 버그 발생 시 UI 문제인지 계산 문제인지 즉시 파악 가능합니다.
2. **성능 (Performance)**: `TodoScreen`(부모)이 리렌더링되어도 `UltimateCalendar`는 영향받지 않습니다. 또한, React Query의 캐싱과 Hook 내부의 Memoization이 이중으로 작동하여 불필요한 연산을 0에 수렴하게 만듭니다.
3. **확장성 (Scalability)**: 추후 '월간 뷰(CalendarScreen)'와 '주간 뷰(UltimateCalendar)' 간에 로직을 100% 공유할 수 있습니다. "월간 뷰에선 되는데 주간 뷰에선 안 돼요" 같은 문제가 발생하지 않습니다.

---

### 🏗️ 제안하는 아키텍처 구조

파일 구조를 이렇게 잡으라고 AI에게 지시하십시오:

```text
client/src/
├── components/
│   └── UltimateCalendar/
│       └── index.js          (UI 렌더링만 담당)
├── hooks/
│   └── calendar/
│       ├── useCalendarEvents.js  (메인 Hook: 데이터와 로직 연결)
│       └── useEventCalculator.js (순수 계산 로직: RRule, 필터링 등)
└── utils/
    └── dateUtils.js          (날짜 관련 헬퍼)

```

#### 1. 핵심 Hook 로직 (`useCalendarEvents.js`)

이 Hook은 **"스마트한 데이터 공급자"** 역할을 합니다. 현재 보이는 주(Week)를 기준으로 필요한 데이터를 미리 준비하고 캐싱합니다.

```javascript
// hooks/calendar/useCalendarEvents.js

export function useCalendarEvents(visibleDateString, mode = 'week') {
    // 1. 데이터 소스 (React Query - Cache First 이미 적용됨)
    const { data: allTodos } = useAllTodos(); 
    
    // 2. 뷰포트 계산 (현재 보이는 날짜 기준 ±Buffer 계산)
    // week 모드면 ±3주, month 모드면 ±2달
    const dateRange = useMemo(() => 
        calculateDateRange(visibleDateString, mode), 
        [visibleDateString, mode]
    );

    // 3. 이벤트 계산 (무거운 연산 - useMemo 필수)
    // dependency에 allTodos가 포함되어 있어, 데이터 변경 시 자동 재계산
    const events = useMemo(() => {
        if (!allTodos) return {};
        
        // 🚀 성능 핵심: 전체 Todos 중 dateRange에 해당하는 것만 필터링하여 계산
        // 전체 데이터를 순회하지 않고 필요한 범위만 연산하여 Janky Frame 방지
        return processEventsForRange(allTodos, dateRange);
    }, [allTodos, dateRange]);

    return events;
}

```

#### 2. UI 컴포넌트 (`UltimateCalendar.js`)

UI는 이제 매우 단순해집니다.

```javascript
// UltimateCalendar.js

export default function UltimateCalendar() {
    const [visibleDate, setVisibleDate] = useState(today);

    // Hook 하나로 모든 동적 데이터 해결
    const eventsByDate = useCalendarEvents(visibleDate, 'week');

    return (
        <HorizontalList
            // 스크롤 시 visibleDate만 업데이트하면 Hook이 알아서 데이터 계산
            onVisibleDateChange={setVisibleDate} 
            data={weeks}
            renderItem={({ item }) => (
                <WeekView 
                    weekData={item} 
                    events={eventsByDate} // 해당 주차 이벤트 자동 매핑
                />
            )}
        />
    );
}

```

---

### 🚀 성능 최적화 포인트 (AI에게 강조할 지침)

AI에게 코드를 요청할 때 다음 **4가지 제약 조건**을 반드시 포함시키세요.

#### 1. 윈도우잉 (Windowing) & 버퍼링

* **지침:** "현재 보이는 주(`visibleWeekIndex`)를 기준으로 **앞뒤 3주(총 7주)** 데이터만 계산해서 메모리에 올릴 것. 스크롤이 이동하면 오래된 캐시는 폐기하거나 LRU(Least Recently Used) 알고리즘으로 관리할 것."
* **이유:** 수천 개의 할 일을 매번 다 계산하면 스크롤이 버벅거립니다.

#### 2. Deep Memoization

* **지침:** "`allTodos` 배열의 참조값이 바뀌더라도, 실제 내용(id, title, date)이 바뀌지 않았다면 재계산을 수행하지 않도록 `React.memo` 또는 `useMemo`의 디펜던시를 신중하게 설정할 것."

#### 3. InteractionManager 활용 (React Native 특화)

* **지침:** "스크롤 애니메이션이 진행되는 도중에는 무거운 이벤트 계산을 잠시 멈추고, 스크롤이 끝난 직후(`InteractionManager.runAfterInteractions`)에 계산을 수행하여 프레임 드랍을 방지할 것."
* **이유:** 부드러운 스크롤 경험이 사용자 경험의 핵심입니다.

#### 4. Background Calculation (선택 사항, 초고성능 필요 시)

* **지침:** "만약 데이터 양이 2,000건을 넘어가면 JS 스레드가 멈출 수 있으므로, 계산 로직을 비동기(`setTimeout` 분할 처리)로 구현하거나 필요시 Worklet(Reanimated) 사용을 고려할 것." (일반적으로는 불필요하나, '안정성 최우선'이라면 고려)

---

### 📝 실행 계획 (Action Plan)

개발 시간이 상관없다고 하셨으니, 가장 견고한 순서대로 진행합니다.

1. **Step 1: 계산 로직 분리 (`useEventCalculator`)**
* 기존 `CalendarScreen`에 있는 로직을 뜯어내어, 날짜 범위(Start~End)와 Todos를 받으면 이벤트를 뱉어내는 순수 함수로 만듭니다.
* *AI 프롬프트:* "기존 CalendarScreen의 이벤트 매핑 로직을 추출해서 `utils/eventCalculator.js`로 분리해줘. 입력값은 (todos, startDate, endDate)이고 출력값은 `{ dateString: event[] }` 형태여야 해."


2. **Step 2: Custom Hook 구현 (`useCalendarEvents`)**
* 위의 순수 함수를 사용하는 Hook을 만듭니다. 여기서 `visibleWeekIndex`에 따른 범위 계산 로직이 들어갑니다.
* *AI 프롬프트:* "`useCalendarEvents` 훅을 만들어줘. React Query의 `useAllTodos`를 사용하고, 현재 보이는 날짜를 받아서 앞뒤 3주치 이벤트를 계산해서 반환해야 해."


3. **Step 3: UltimateCalendar 적용**
* `UltimateCalendar` 내부에서 이 Hook을 호출하고, 스크롤 콜백과 연결합니다.


4. **Step 4: 스트레스 테스트**
* 더미 데이터 500개를 넣고 1년치를 빠르게 스크롤해봅니다.



### 💡 결론

**"옵션 3 (Custom Hook)"으로 가시되, 로직을 철저히 분리하십시오.**
이 방식은 초기 구현량이 조금 많지만(약 300줄 예상), 한번 만들어두면 앱의 어떤 곳에서든 "달력 이벤트"가 필요할 때 `useCalendarEvents` 한 줄로 해결되므로 장기적인 **유지보수성과 안정성** 면에서 압도적입니다.

AI에게 **"옵션 3번 구조로 진행하되, 성능을 위해 Windowing 기법을 적용하고 계산 로직을 별도 파일로 분리해달라"**고 요청하시면 됩니다.

## CLAUDE SONNET 답변:
문서를 꼼꼼히 분석했습니다. 개발 시간보다 **성능 + 안정성**을 최우선으로 한다면, 제가 **옵션 4 (하이브리드)**를 제안하겠습니다.

## 🎯 옵션 4: 하이브리드 아키텍처 (추천) ⭐⭐⭐⭐⭐

### 핵심 컨셉
```
통합 이벤트 관리 레이어 (Singleton)
    ↓
┌─────────────────────────────────────┐
│ EventsManager (Global State)        │
│ - 전역 이벤트 캐시 (메모리)        │
│ - 지능형 캐시 무효화               │
│ - 구독 패턴 (Pub/Sub)              │
└─────────────────────────────────────┘
    ↓           ↓           ↓
TodoScreen  UltimateCalendar  CalendarScreen
```

### 왜 이 방법인가?

#### 현재 문제점 분석:
1. **중복 계산 로직**: CalendarScreen(월별), UltimateCalendar(주별) → 같은 일 다르게 계산
2. **독립적 캐시**: 각 컴포넌트가 자체 캐시 → 메모리 낭비, 동기화 이슈
3. **확장성 부족**: 새 화면(WeekView, AgendaView) 추가 시 또 복사-붙여넣기

#### 하이브리드 해결책:

```javascript
// ===================================
// 1. 통합 이벤트 관리자 (Singleton)
// ===================================
// src/services/EventsManager.js

class EventsManager {
  constructor() {
    this.cache = new Map(); // { "2026-W05": [...events], "2026-02": [...events] }
    this.subscribers = new Set();
    this.todos = [];
    this.categories = [];
  }

  // 데이터 소스 업데이트
  updateData(todos, categories) {
    const hasChanged = 
      JSON.stringify(this.todos) !== JSON.stringify(todos) ||
      JSON.stringify(this.categories) !== JSON.stringify(categories);
    
    if (hasChanged) {
      this.todos = todos;
      this.categories = categories;
      this.invalidateCache();
      this.notifySubscribers();
    }
  }

  // 주별 이벤트 가져오기 (UltimateCalendar용)
  getWeekEvents(weekStartDate, weekEndDate) {
    const cacheKey = `week_${weekStartDate}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const events = this.calculateEvents(weekStartDate, weekEndDate);
    this.cache.set(cacheKey, events);
    
    // LRU: 최근 50주만 유지
    if (this.cache.size > 50) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    return events;
  }

  // 월별 이벤트 가져오기 (CalendarScreen용)
  getMonthEvents(year, month) {
    const cacheKey = `month_${year}-${month}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0); // 마지막 날
    const events = this.calculateEvents(startDate, endDate);
    this.cache.set(cacheKey, events);
    
    return events;
  }

  // 단일 날짜 이벤트 (TodoScreen용)
  getDateEvents(dateString) {
    const cacheKey = `date_${dateString}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const events = this.calculateEvents(dateString, dateString);
    this.cache.set(cacheKey, events);
    
    return events;
  }

  // ⚡ 핵심: 통합 이벤트 계산 로직
  calculateEvents(startDate, endDate) {
    const eventsByDate = {};
    
    this.todos.forEach(todo => {
      if (todo.recurrenceRule) {
        // 반복 일정 처리
        const dates = this.expandRecurrence(todo, startDate, endDate);
        dates.forEach(date => {
          if (!eventsByDate[date]) eventsByDate[date] = [];
          eventsByDate[date].push(this.formatEvent(todo));
        });
      } else if (todo.date) {
        // 단일 일정
        if (todo.date >= startDate && todo.date <= endDate) {
          if (!eventsByDate[todo.date]) eventsByDate[todo.date] = [];
          eventsByDate[todo.date].push(this.formatEvent(todo));
        }
      }
    });

    return eventsByDate;
  }

  // 구독 패턴 (React 컴포넌트가 변경 감지)
  subscribe(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  notifySubscribers() {
    this.subscribers.forEach(callback => callback());
  }

  invalidateCache() {
    this.cache.clear();
  }
}

// Singleton 인스턴스
export const eventsManager = new EventsManager();
```

```javascript
// ===================================
// 2. React Hook (컴포넌트 연결)
// ===================================
// src/hooks/useCalendarEvents.js

import { eventsManager } from '../services/EventsManager';
import { useAllTodos } from './useTodos';
import { useCategories } from './useCategories';

export function useCalendarEvents(mode, params) {
  const { data: todos = [] } = useAllTodos();
  const { data: categories = [] } = useCategories();
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  // EventsManager에 데이터 주입
  useEffect(() => {
    eventsManager.updateData(todos, categories);
  }, [todos, categories]);

  // 변경 사항 구독
  useEffect(() => {
    return eventsManager.subscribe(() => {
      forceUpdate();
    });
  }, []);

  // 모드별 이벤트 가져오기
  const eventsByDate = useMemo(() => {
    switch (mode) {
      case 'week':
        return eventsManager.getWeekEvents(params.startDate, params.endDate);
      
      case 'month':
        return eventsManager.getMonthEvents(params.year, params.month);
      
      case 'date':
        return eventsManager.getDateEvents(params.date);
      
      case 'range': // 동적 범위 (UltimateCalendar의 ±3주)
        const events = {};
        params.weeks.forEach(week => {
          const weekEvents = eventsManager.getWeekEvents(
            week[0].dateString, 
            week[6].dateString
          );
          Object.assign(events, weekEvents);
        });
        return events;
      
      default:
        return {};
    }
  }, [mode, params, todos, categories]); // todos, categories로 리렌더링 트리거

  return eventsByDate;
}
```

```javascript
// ===================================
// 3. 컴포넌트에서 사용
// ===================================

// UltimateCalendar.js
export default function UltimateCalendar() {
  const [visibleWeekIndex, setVisibleWeekIndex] = useState(0);
  
  const visibleWeeks = useMemo(() => {
    const start = Math.max(0, visibleWeekIndex - 3);
    const end = Math.min(weeks.length - 1, visibleWeekIndex + 3);
    return weeks.slice(start, end + 1);
  }, [weeks, visibleWeekIndex]);

  const eventsByDate = useCalendarEvents('range', { weeks: visibleWeeks });
  
  // ...
}

// CalendarScreen.js
export default function CalendarScreen() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const eventsByDate = useCalendarEvents('month', {
    year: currentMonth.getFullYear(),
    month: currentMonth.getMonth() + 1
  });
  
  // ...
}

// TodoScreen.js
export default function TodoScreen() {
  const [selectedDate, setSelectedDate] = useState('2026-01-29');
  
  const eventsByDate = useCalendarEvents('date', { date: selectedDate });
  
  // ...
}
```

---

## 🏆 옵션 4의 압도적 장점

### 1. **성능 최적화** (문서보다 더 나음)
| 지표 | 옵션 1/2/3 | 옵션 4 |
|------|-----------|--------|
| 중복 계산 | 각 컴포넌트마다 | 0 (전역 캐시) |
| 캐시 메모리 | ~2MB × 3 = 6MB | ~2MB (공유) |
| 계산 시간 | ~5-10ms | ~1-3ms (캐시 히트 시 < 1ms) |
| useAllTodos 호출 | 3번 (TodoScreen + UltimateCalendar + CalendarScreen) | 1번 (Hook에서) |

### 2. **안정성** ⭐⭐⭐⭐⭐
- **단일 진실 공급원**: 모든 이벤트 로직이 한 곳에
- **동기화 보장**: todos 변경 시 모든 화면 자동 업데이트
- **타입 안정성**: EventsManager를 TypeScript로 전환 가능
- **테스트 용이**: EventsManager만 집중 테스트

### 3. **확장성** (미래 대비)
```javascript
// ✅ 새로운 뷰 추가가 매우 쉬움
// WeekView.js
const eventsByDate = useCalendarEvents('week', { 
  startDate: '2026-01-26', 
  endDate: '2026-02-01' 
});

// AgendaView.js (3개월 범위)
const eventsByDate = useCalendarEvents('range', {
  weeks: allWeeksInNext3Months
});

// SearchView.js (검색 결과)
const eventsByDate = useCalendarEvents('custom', {
  filter: (todo) => todo.title.includes('회의')
});
```

### 4. **디버깅 & 모니터링**
```javascript
// EventsManager.js에 추가
class EventsManager {
  // ...
  
  getStats() {
    return {
      cacheSize: this.cache.size,
      todosCount: this.todos.length,
      subscribersCount: this.subscribers.size,
      cacheHitRate: this.cacheHits / (this.cacheHits + this.cacheMisses)
    };
  }
  
  debugLog() {
    console.log('📊 EventsManager Stats:', this.getStats());
    console.log('🗂️ Cache Keys:', Array.from(this.cache.keys()));
  }
}

// 개발 중 디버깅
eventsManager.debugLog();
```

---

## 🚀 구현 로드맵 (AI 작업 분할)

### Phase 1: 기반 구축 (1시간)
```bash
# Step 1: EventsManager 구현
- [ ] src/services/EventsManager.js 생성
- [ ] calculateEvents 로직 (CalendarScreen에서 복사)
- [ ] 캐싱 로직 (Map 기반)
- [ ] 구독 패턴 (Pub/Sub)

# Step 2: Hook 생성
- [ ] src/hooks/useCalendarEvents.js 생성
- [ ] 모드별 분기 로직
- [ ] EventsManager 연결
```

### Phase 2: 통합 (1-2시간)
```bash
# Step 3: UltimateCalendar 전환
- [ ] useCalendarEvents('range') 적용
- [ ] 기존 eventsByDate prop 제거
- [ ] visibleWeeks 계산 로직 추가

# Step 4: CalendarScreen 전환
- [ ] useCalendarEvents('month') 적용
- [ ] 기존 계산 로직 제거

# Step 5: TodoScreen 전환
- [ ] useCalendarEvents('date') 적용
```

### Phase 3: 최적화 (1시간)
```bash
# Step 6: 성능 테스트
- [ ] 캐시 히트율 측정 (>95% 목표)
- [ ] 렌더링 시간 측정 (<5ms 목표)
- [ ] 메모리 사용량 측정 (<3MB 목표)

# Step 7: 엣지 케이스 처리
- [ ] 1000+ todos 테스트
- [ ] 복잡한 반복 일정 테스트
- [ ] 빠른 스크롤 테스트
```

### Phase 4: 프로덕션 준비 (선택)
```bash
# Step 8: TypeScript 전환 (강력 추천)
- [ ] EventsManager.ts
- [ ] useCalendarEvents.ts
- [ ] 타입 정의

# Step 9: 에러 핸들링
- [ ] try-catch 추가
- [ ] Sentry 연동
```

---

## 📊 최종 비교표

| 기준 | 옵션 1 | 옵션 2 | 옵션 3 | **옵션 4** |
|------|--------|--------|--------|------------|
| **성능** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| **안정성** | ⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| **확장성** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| **유지보수** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| **메모리 효율** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| **중복 제거** | ❌ | ✅ | ❌ | **✅✅** |
| **테스트 용이성** | ⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ | **⭐⭐⭐⭐⭐** |
| **구현 난이도** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | **⭐⭐⭐⭐** |
| **AI 작업 시간** | 1-2h | 2-3h | 3-4h | **3-5h** |

---

## 💡 왜 옵션 4가 최선인가?

### 현재 vs 미래
```
현재 (문서의 옵션들):
- 3개 화면 → 3개의 독립적 이벤트 계산 로직
- 새 화면 추가 → 또 복사-붙여넣기
- 버그 발견 → 3곳 모두 수정

옵션 4:
- N개 화면 → 1개의 중앙 집중 로직
- 새 화면 추가 → useCalendarEvents('mode') 한 줄
- 버그 발견 → EventsManager만 수정
```

### 실제 성능 시뮬레이션
```javascript
// 시나리오: 사용자가 3개월치 스크롤 (12주)

// 옵션 1/2/3:
// - 12주 × 7일 = 84일치 이벤트 계산
// - 각 날짜마다 72개 todos 순회
// - 총 연산: 84 × 72 = 6,048회
// - 시간: ~50-100ms (캐시 없이)

// 옵션 4 (첫 실행):
// - 12주를 한 번에 계산
// - 총 연산: 동일하지만 중복 제거됨
// - 시간: ~30-50ms (최적화된 로직)

// 옵션 4 (두 번째 실행 - 같은 범위 재방문):
// - 캐시에서 즉시 반환
// - 시간: < 1ms ⚡
```

---

## ✅ 결론 및 액션 아이템

### 최종 추천: **옵션 4 (하이브리드)**

**이유:**
1. ✅ **성능**: 전역 캐시로 중복 계산 0
2. ✅ **안정성**: 단일 진실 공급원 (Single Source of Truth)
3. ✅ **확장성**: 새 화면 추가 시 1줄 코드
4. ✅ **유지보수**: 모든 로직이 한 곳에
5. ✅ **미래 대비**: TypeScript, 테스트, 모니터링 모두 용이

### 다음 단계:
```bash
1. EventsManager.js 구현 (AI 프롬프트 준비)
2. useCalendarEvents.js 구현
3. 각 화면에 적용 (하나씩 순차적으로)
4. 성능 측정 및 최적화
5. 문서화 (IMPLEMENTATION_COMPLETE.md)
```

### AI 프롬프트 예시:
```
"다음 요구사항으로 EventsManager.js를 구현해줘:
- Singleton 패턴
- Map 기반 캐싱 (LRU, 최근 50개)
- Pub/Sub 구독 패턴
- calculateEvents 메서드 (반복 일정 포함)
- getWeekEvents, getMonthEvents, getDateEvents 메서드
- 상세한 JSDoc 주석 포함"
```

궁금한 점이나 특정 부분 구현이 필요하면 말씀해주세요! 🚀