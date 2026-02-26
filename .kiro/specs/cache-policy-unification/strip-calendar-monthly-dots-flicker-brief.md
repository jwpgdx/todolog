# Strip-Calendar (Monthly Mode) 도트 “깜빡임/늦게 채워짐” 이슈 — 외부 AI 상담용 브리프

작성일: 2026-02-25  
목적: 우리 프로젝트 상황/구조/로그를 요약해서 다른 AI에게 “원인 추정 + 해결책/UX 레퍼런스(Apple/Google Calendar)”를 질문하기 위함.

---

## 0) TL;DR (한 줄 요약)

- **문제:** strip-calendar `monthly`에서 스크롤로 새 주가 화면에 들어올 때, 도트(카테고리 색상 점)가 **빈 상태로 먼저 렌더**됐다가 **나중에(정착/settle 후) 채워져서** “반짝” 보임.
- **핵심 원인 후보:** 데이터 로드 트리거가 **스크롤 중이 아니라 settle 이후**에만 걸려 있고, `DayCell`이 summary 미존재를 “로딩 중”이 아니라 “도트 없음(EMPTY)”으로 렌더하기 때문.
- **방향:** todo-calendar처럼 **viewability 기반 prefetch(스크롤 중 선로딩)** + (필요 시) **placeholder 렌더링**이 가장 유력.

---

## 1) 우리 앱/기술 스택(관련 부분만)

- React Native(Expo) 기반, **offline-first**.
- 로컬 데이터: SQLite (todos/completions/categories 등).
- “공통 query aggregation layer”가 날짜 range 단위로 todos/completions를 묶어 가져오고, 화면별 adapter가 화면에 필요한 형태로 변환.
- List: strip-calendar monthly는 `@shopify/flash-list` 사용.

버전 참고(상대방이 성능/동작 가정할 때 도움):
- RN: `0.81.5`
- FlashList: `2.0.2`

---

## 2) Strip-Calendar monthly 모드가 “어떻게 동작”하는가

### 2.1 UI(렌더링) 구조

- Monthly 화면은 “월 1장”이 아니라 **주(week) row 리스트를 세로로 스크롤**하는 형태.
- 한 화면(뷰포트)에서 보이는 주(row) 개수는 상수로 고정:
  - `MONTHLY_VISIBLE_WEEK_COUNT = 5` (기본값)
  - 이 값은 **뷰포트 높이/초기 draw batch**에 영향.

중요: `MONTHLY_VISIBLE_WEEK_COUNT`를 15로 바꿔도 “도트가 15주 단위로 채워진다”는 의미가 아님.  
그건 “동시에 화면에 그려지는 주 수”만 늘리는 것이고, **데이터 로딩 단위/트리거**는 별도 로직이 결정함.

### 2.2 도트(요약) 데이터 파이프라인

- 각 날짜 셀(`DayCell`)은 `summariesByDate[date]`를 읽어 도트를 그림.
- summary가 없으면 `EMPTY_SUMMARY`로 처리되어 **도트 0개로 렌더**됨.
  - 이게 “미로딩”도 “진짜 도트 없음”처럼 보여서 깜빡임을 강화함.

### 2.3 monthly 데이터 로딩(ensure) 구조

- `useStripCalendarDataRange`가 월간 active range를 계산해서 `ensureRangeLoaded()` 호출.
- 핵심: monthly active range는 **`monthlyTopWeekStart` (정착 후 결정되는 top week)** 기준으로 계산됨.
- 기본 정책: `three_month`
  - “월 기준”으로 **과거 1개월 + 현재 1개월 + 미래 1개월(말일까지)** 커버.
- 실험 정책: `six_month`
  - “월 기준”으로 **과거 2개월 + 현재 1개월 + 미래 3개월(말일까지)** 커버.

즉, 스크롤 중에는 `monthlyTopWeekStart`가 바로 안 바뀌고, **settle 후에만 바뀌는 구조**라면:
- 사용자가 스크롤로 새로운 주를 화면에 띄우는 동안 그 날짜들의 summary가 아직 없어서 **EMPTY로 보임**
- settle 후 active range가 바뀌고 ensure가 돌면서 summary가 채워져 **그때 도트가 나타남(반짝)**  
이 현상이 현재 UX 문제로 관찰됨.

---

## 3) Todo-Calendar는 어떤 구조인가? (비교 포인트)

todo-calendar는 “스크롤 도중에 로딩되는 구조”가 맞음.

- `FlashList`의 `onViewableItemsChanged`에서 “현재 보이는 month 아이템들”을 받고,
- `useTodoCalendarData`가 visible months를 기준으로 **prefetch window(±2개월)**를 계산해서
- 캐시 없는 월만 batch fetch -> store 업데이트를 수행함.

즉, todo-calendar는 기본 설계가:
- **스크롤 중 viewability 변화 → 미리 로딩(prefetch)**
- “보이기 전에” 채워지는 쪽에 가깝고,
- strip-calendar monthly의 settle-only 대비 깜빡임이 덜 생길 수 있는 구조.

---

## 4) 관측된 로그/실험 결과(요약)

### 4.1 기존 버그(월 range endDate 컷오프) 수정 이력

- 과거에는 “다음달 말일까지”가 아니라 월 계산이 끊겨서, 특정 케이스에서 range 밖으로 스크롤하면 빈 도트가 보일 수 있었음.
- 현재는 정책 계산이 “월 기준 말일까지(inclusive)”로 잡히도록 수정됨.

### 4.2 정책별 정량 벤치(Option A benchmark) 한 번의 결과 예시

DebugScreen에서 월 정책을 바꿔가며 6개 앵커(month anchor)를 로드하는 벤치 결과(예시):

- `legacy_9week`: `elapsed=81.4ms, missΔ=6`
- `three_month`: `elapsed=31.5ms, missΔ=6`
- `six_month`: `elapsed=36.8ms, missΔ=6`

해석:
- `six_month`는 `three_month` 대비 **miss 횟수는 줄지 않음**(anchor가 1달씩 이동하면 “끝자락 1달”은 항상 새로 생김).
- 대신 초기/추가 로드 크기가 커져서 elapsed가 **조금 증가(예: +5ms)** 할 수 있음.
- 결론: “정량 벤치”만 보면 six_month는 **성능이 크게 나쁘진 않지만**, miss 감소로 flicker가 자동 해결되는 구조는 아님.

---

## 5) 우리가 풀고 싶은 UX 목표(정확한 기대)

목표:
- 이미 커버(로드)된 날짜라면, 사용자가 스크롤로 아래/위 주가 새로 보이더라도 **도트가 즉시 떠야 함**.
- “빈 도트(없음) → 잠깐 뒤 도트 생김” 같은 **시각적 반짝임을 제거**하고 싶음.

---

## 6) 해결책 후보(설계 옵션) + 장단점

### 옵션 A) viewability 기반 “스크롤 중 prefetch” 추가 (todo-calendar 방식)

개념:
- `MonthlyStripList`의 `onViewableItemsChanged`에서 현재 보이는 주의 `startIndex/endIndex`를 얻는다.
- 아래/위로 스크롤 방향을 추정하거나, “가장 아래에 보이는 주”를 기준으로
  - **남은 버퍼가 2주 이하**가 되면
  - **6주(또는 1개월) 단위로** `ensureRangeLoaded()`를 선호출.
- 호출은 반드시 throttle(예: 200~300ms) + inFlight/dedup + already-covered skip 로 보호.

장점:
- “보이기 전에 채움”에 가까워져 깜빡임이 크게 줄 가능성.
- todo-calendar와 패턴이 유사해져 유지보수/이해가 쉬움.

단점/리스크:
- 스크롤 중 DB/aggregation이 돌면 저사양에서 jank 가능.
  - 그래서 “작은 청크 + 임계치 기반 + throttle”이 중요.

### 옵션 B) monthlyRangePolicy를 더 크게(예: 6개월)로 기본 확대

장점:
- 사용자가 조금 스크롤하는 구간에서는 range 밖으로 벗어날 확률이 줄어들어 flicker가 줄 수 있음.

단점:
- 로드량 증가(초기 비용, 메모리, 배터리).
- “scroll 중 미로딩”을 구조적으로 완전히 제거하진 못함(여전히 settle-only면 경계에서 발생).

### 옵션 C) “미로딩”과 “진짜 없음”을 UI에서 구분 (placeholder/skeleton)

개념:
- `summariesByDate[date]`가 없을 때, 그냥 dot 0개를 그리지 말고:
  - “로딩 중” 표시(예: 회색 점 1개, shimmer, opacity 등) 또는
  - 직전 값 유지(optimistic) 같은 UX 처리.

장점:
- 데이터 로딩 타이밍이 남아 있어도 “없음처럼 보였다가 생김” 착시를 줄임.

단점:
- “로딩 상태 판정”을 위해 inFlight/coverage 정보를 UI에 전달해야 할 수 있음.

### 옵션 D) hybrid 추천(현실적인 1순위)

1) 기본 정책은 `three_month` 유지(또는 `six_month`는 실험적으로만)  
2) monthly는 **viewability 기반 prefetch**로 “2주 남으면 6주 더” 같은 작은 청크 로딩 추가  
3) 그래도 남는 케이스만 “placeholder”로 감춤

---

## 7) Apple/Google Calendar는 어떻게 하나? (우리가 묻고 싶은 것)

우리는 아래를 “사실로 단정”하진 못하고, 외부 AI에게 **UX/엔지니어링 관점**으로 확인/추정/레퍼런스를 받고 싶음.

질문 예시:
- Apple Calendar / Google Calendar의 month view에서 “event dots/indicators”는
  - 스크롤 도중에도 즉시 보이는가?
  - 비동기 로딩이면 placeholder(로딩 표시)를 쓰는가, 아니면 마지막 상태를 유지하는가?
- OS 캘린더는 보통 로컬 인덱스(EventKit/Google cache) 기반이라 “즉시” 가능한데,
  - 우리처럼 SQLite + aggregation + adapter 구조에서도 비슷한 UX를 만들려면 어떤 패턴이 적절한가?

---

## 8) 외부 AI에게 요청할 답변 형태(원하는 출력)

아래 형태로 답변해주면 좋겠음:

1) 원인 가설 Top 3 (근거 포함)  
2) 권장 솔루션 1~2개 (구현 난이도/리스크/성능 영향)  
3) “스크롤 중 prefetch”를 한다면:
   - trigger 조건(임계치), 청크 사이즈(주/월), throttle 권장값
   - iOS/Android/Web에서 위험 포인트(FlashList viewability, snapToInterval 등)
4) Apple/Google Calendar 레퍼런스 관찰/추정(가능하면 근거/링크 제시)  
5) 우리 코드에 적용한다면 바꿀 파일/지점 제안(대략적인 pseudo-code)

---

## 9) 코드 포인터(상대방이 빠르게 맥락 잡도록)

Strip-calendar:
- `client/src/features/strip-calendar/hooks/useStripCalendarDataRange.js`  
  - monthly range 정책 계산(`three_month`, `six_month`)과 ensure 호출
- `client/src/features/strip-calendar/services/stripCalendarDataAdapter.js`  
  - `ensureRangeLoaded()` / coverage 판단 / invalidate 처리
- `client/src/features/strip-calendar/services/stripCalendarSummaryService.js`  
  - 공통 range 로드(`getOrLoadRange`) + adapter 변환
- `client/src/features/strip-calendar/ui/MonthlyStripList.js`  
  - FlashList + snap + settle 상태 머신, `onViewableItemsChanged`는 현재 로그만 찍음
- `client/src/features/strip-calendar/ui/DayCell.js`  
  - summary 없으면 `EMPTY_SUMMARY`로 dot 0 렌더(깜빡임 체감과 관련)
- `client/src/features/strip-calendar/utils/stripCalendarConstants.js`  
  - `MONTHLY_VISIBLE_WEEK_COUNT`

Todo-calendar (비교용):
- `client/src/features/todo-calendar/ui/CalendarList.js`  
  - `onViewableItemsChanged`에서 visible 변화마다 데이터 fetch 트리거
- `client/src/features/todo-calendar/hooks/useTodoCalendarData.js`  
  - visible months ±2개월 prefetch, uncached만 batch fetch

실험 로그:
- `.kiro/specs/cache-policy-unification/3mo.md` (strip-calendar perf/timeline/range-cache trace 로그 모음)

