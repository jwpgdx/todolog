1. 원인 가설 Top 3 (각각: 왜 그런지 근거/로그 포인트)

---

### 가설 1) **monthly는 “settle(정착) 이후”에만 ensure가 돌아서, 스크롤 중 새 주가 “미커버”로 먼저 렌더됨**

* 왜 그런지 (근거)

  * `useStripCalendarDataRange`에서 monthly `activeRange`는 **`monthlyTopWeekStart`(= settle 후 확정된 top week)** 를 기준으로만 계산돼서, 사용자가 스크롤로 몇 주/몇 달을 휙 넘기는 동안엔 **activeRange가 “옛날 위치”** 에 고정됩니다. 
  * `MonthlyStripList`도 settle은 `onMomentumScrollEnd`/idle-timeout 등으로 “끝나고 나서” 확정하는 구조라, **스크롤 도중 보여지는 주(week)들이 activeRange 밖으로 튀어 나가는 순간**이 생길 수밖에요. 
  * 로그에서도 monthly ensure는 `monthly:settled` 이유로만 찍히고, 그 ensure가 끝난 뒤에야 월별 WeekRow들이 대거 update 되는 패턴이 보입니다(= “빈 상태 → 나중에 채움”). 
* 확인용 로그/포인트

  * `MonthlyStripList`에서 **현재 visible min/max index(또는 weekStart)와, activeRange(start/end)** 를 같이 로그로 찍고, activeRange 밖 날짜가 렌더되는 순간을 잡기.
  * “flicker가 발생한 날짜”에 대해 `hasRangeCoverage(date,date)` 결과가 **처음엔 false였다가 ensure 후 true로 바뀌는지** 확인.

---

### 가설 2) **DayCell이 “데이터 미로딩(unknown)”을 “일정 없음(empty)”으로 렌더해서 깜빡임이 필연**

* 왜 그런지 (근거)

  * `DayCell`은 `summariesByDate[date]`가 없으면 그냥 `EMPTY_SUMMARY`로 처리해서 **도트 0개(= 일정 없음)** 로 그립니다. 
  * 근데 이 프로젝트는 요약(summary)을 “모든 날짜”에 저장하지 않고, **실제 아이템이 있는 날짜 중심으로만 summariesByDate가 채워지는 구조**입니다. (`summarizeAdaptedDiagnostics`도 summaryDateCount를 따로 세고, 기본 empty range는 UI selector용으로만 존재) 
    → 즉, “커버는 됐는데 일정이 없는 날”도 summary가 없을 수 있고, “아예 미커버(아직 로딩 안 됨)”도 summary가 없음. 둘이 구분이 안 됨.
  * 그래서 미커버 상태에서 먼저 “0도트”로 보였다가, ensure가 끝나면 해당 날짜 summary가 생기면서 **도트가 갑자기 생김 = flicker**.
* 확인용 로그/포인트

  * DayCell 렌더 시점에 `summary 존재 여부` + `hasRangeCoverage(date,date)`를 같이 찍고,

    * `summary 없음 & coverage=false`(unknown)
    * `summary 없음 & coverage=true`(known-empty)
    * `summary 있음`(known-data)
      이 3가지 분포를 카운트.
  * 특히 flicker 난 날짜는 “unknown → known-data”로 바뀌는지 확인.

---

### 가설 3) **“prefetch 파이프”는 있는데, monthly 스크롤 중에 실제로 트리거가 안 되거나 너무 늦게 온다**

* 왜 그런지 (근거)

  * `useStripCalendarDataRange`에 monthly `prefetchRange`가 있긴 한데, 그 기준이 `monthlyTargetWeekStart || monthlyTopWeekStart`입니다. 
    그런데 `MonthlyStripList`의 `onViewableItemsChanged`는 **샘플 로그만 찍고(최대 4회), 상태를 올려서 target을 갱신하지 않습니다.** 
    → 즉, “사용자 스크롤 중 viewability 기반 prefetch”가 실제로는 동작 안 하는 상태에 가깝습니다.
  * 추가로 FlashList viewability는 `minimumViewTime` 기본값이 250ms라, **쭉 스크롤하면 callback이 늦거나 거의 settle 후에나 의미 있게 불릴 수 있음**(문서에 기본 250, 너무 낮추지 말라고 경고). ([Shopify][1])
    → “스크롤 중 미리 당겨오기”를 viewability에만 걸면 생각보다 늦습니다.
* 확인용 로그/포인트

  * monthly 스크롤 도중에 실제로 `monthlyTargetWeekStart`가 바뀌는지 로그.
  * viewability callback timestamp vs scroll offset timestamp 비교(250ms minimumViewTime 영향 체크).
  * prefetch가 호출됐는데도 flicker면, **prefetch 범위가 작거나/늦거나/쿼리가 오래 걸리는지**(예: eventLoopLag) 같이 확인.

---

2. 추천 솔루션 1~2개 (각각: 구현 난이도/리스크/성능 영향)

---

### 솔루션 A) **“스크롤 중 prefetch”를 진짜로 동작시키되, ‘월(또는 6주) 청크 + 단일 in-flight + throttle’로 얌전히 굴리기**

* 핵심 아이디어

  * “스크롤 중 보이는 주” 기준으로 **2~4주 앞(또는 뒤)** 를 바라보고,
  * 그 지점이 속한 **월(1개월)** 또는 **6주** 범위를 prefetch ensure.
  * 동시에 **한 번에 하나만(in-flight 1개)** 돌리고, 요청은 최신만 남기는 “드레인 큐”로 중복/폭주를 막기.
* 구현 난이도: **중**

  * MonthlyStripList에서 visible window 계산 + 상위로 콜백 올림
  * useStripCalendarDataRange에 prefetch 큐/가드 추가
* 리스크

  * 최악의 달에서 SQLite range query가 250ms+ & event-loop lag가 크게 튀는 케이스가 이미 있음 → 스크롤 중에 잘못 터지면 jank 유발 가능.
  * 그래서 “buffer를 넉넉히” + “thro.
* 성능 영향 (대충 감)

  * **good**: 사용자가 실제로 도달하기 전에 데이터가 올라오면, visible cell이 “빈→채움” 업데이트를 안 겪어서 체감이 좋아짐.
  * **bad**: prefetch가 너무 공격적이면 DB/JS가 바빠져서 스크롤 프레임이 깨질 수 있음.

---

### 솔루션 B) **UI에서 “unknown(미커버)”을 “empty(없음)”으로 그리지 않기: placeholder/last-known로 flicker 숨기기**

* 핵심 아이디어

  * DayCell이 summary가 없을 때:

    * `coverage=true`면 **진짜 empty**(도트 없음)로 그려도 됨.
    * `coverage=false`면 **unknown**이니까 “0도트”로 렌더하지 말고
      **(a) placeholder dots(연한 회색 1~3개)** 또는
      **(b) last-known dots(있으면 흐리게)** 를 보여서 “없었다가 생김”을 최소화.
* 구현 난이도: **하~중**

  * `hasRangeCoverage(date,date)`를 DayCell 렌더 조건에 포함
  * placeholder 스타일 추가
* 리스크

  * placeholder가 UX적으로 “로딩 중”임을 잘 전달해야 함(사용자가 일정 없는 날로 오해하면 역효과).
* 성능 영향

  * **매우 낮음**(조건 분기 + 도트 몇 개 그리는 수준)
  * prefetch가 완벽하지 못해도 사용자 눈에는 “깜빡임”이 덜 보임.

> 결론: **A + B 같이 가는 게 정답 루트**임.
> A로 “보이기 전에 로드”를 최대화하고, B로 “못 막은 잔여 케이스”를 UX로 덮어버리면 됨.

---

3. “스크롤 중 prefetch(viewab-

### 3-1) trigger 조건

전제: monthly는 한 화면에 5주(week row) 노출, `snapToInterval=WEEK_ROW_HEIGHT(76)` 기반.

**추천 트리거(실전용):**

* “현재 visible window”를 얻어서(아래 둘 중 하나)

  1. **FlashList `getVisibleIndices()`를 throttle로 폴링** (추천, 더 예측 가능) ([Shopify][1])
  2. 또는 `onViewableItemsChanged`를 **prefetch 전용 config로** 하나 더 붙이기(`viewabilityConfigCallbackPairs`) ([Shopify][1])

* visible range에서:

  * `minIndex`, `maxIndex` 계산
  * scroll direction 추정:

    * `maxIndex`가 증가하면 down, 감소하면 up (단순하지만 꽤 먹힘)
  * candidate index:

    * down이면 `maxIndex + BUFFER_WEEKS`
    * up이면 `minIndex - BUFFER_WEEKS`

**BUFFER_WEEKS 추천**

* 기본: **4주**

  * 이유: 쿼리가 250ms급으로 튀는 달이 있고(eventLoopLag도 160ms대), 2주 버퍼는 “DB가 한 번 삐끗하면” 바로 노출될 수 있음.
* 저사양/안드로이드 안전모드: **6주** (또는 “velocity 높으면 6주, 낮으면 4주”)

---

### 3-2) 청크 사이즈(6주/1개월) 추천

* 1순위: **1개월 청크**

  * `candidateWeekStart`가 속한 mthEnd`만 ensure
  * 장점: “필요한 만큼만” 로드, store update 사이즈 작음 → jank 리스크 낮음
* 2순위: **6주 청크**

  * `candidateWeekStart`부터 42일(6*7-1) 범위 ensure
  * 장점: month 경계 근처에서도 커버가 촘촘
  * 단점: 월 기준 캐시/프루닝과 살짝 엇갈릴 수 있음

---

### 3-3) throttle 값 + in-flight 제어(중요)

* throttle: **250ms**

  * FlashList viewability 자체도 기본 `minimumViewTime=250ms`이고, 너무 낮추지 말라고 경고가 있음. ([Shopify][1])
  * getVisibleIndices 폴링도 100ms 이하로 낮추면 불필요하게 바빠질 가능성이 커서, 200~300ms가 타협점.
* in-flight: **동시에 1개만**

  * `useTodoCalendarData`의 “pendingVisibleRef + drain” 패턴이 이미 검증된 형태라 그대로 베끼는 게 베스트.
  * 핵심: “새 요청 오면 최신만 남기고, 끝나면 한 번 더”
    → 스크롤 왕복/연속 fling에도 DB 폭주 방지

---

### 3-4) iOS/Android/Web별 주의점

* iOS

  * `onMomentumScrollEnd`는 대체로 믿을 만하지만, **prefetch는 momentum에만 의존하면 늦을 수 있음*새 주가 바로 들어옴).
  * bounce/overscroll로 offset 음수/경계값 튀는 케이스 방어 필요(이미 settle 로직에 있는 편).
* Android

  * 너희도 이미 적어놨듯이 `onMomentumScrollEnd`가 안 올 때가 있어 idle settle 타임아웃으로 메우는 중.
  * **viewability 콜백이 스크롤 중 안정적이지 않을 수 있음** → getVisibleIndices 폴링이 오([Shopify][1])
* Web

  * momentum 이벤트가 없어서 idle settle 기반이 되고, 초기 레이아웃 버그도 있음(월 뷰포트 1줄).
  * web에서는 `requestIdleCallback`(가능할 때)로 prefetch를 “브라우저 유휴 시간”에 붙이는 게 체감이 더 좋을 수 있음(단, RN-web 환경에 따라 지원 다름 → fallback 필요).

---

4. UI 레벨 대안

---

### 옵션 A) **unknown이면 “빈칸(0도트)” 대신 “placeholder dots”**

* 구현: `summary 없음 && !hasRangeCoverage(date,date)`일 때

  * 도트 1~3개를 **연한 회색/outline** 로 그려서 “뭔가 로딩 중”을 표시
  * 실제 summary 도착 시 dot 색만 바뀌는 형태라 “없었다가 생김”보단 덜 튐
* 장점: flicker 체감 확 줄어듦, 구현 쉬움
* 단점: “일정 없는 날”과의 시각적 구분이 중요(placeholder는 색/투명도 확실히 다르게)

### 옵션 B) **last-known 유지 (stale 허용)**

* 구현:

  * store에 `lastKnownSummariesByDate` 같은 얕은 캐시를 두고,
  * 미커버면 last-known을 **50% opacity로** 렌더
  * 단, `invalidateRanges`로 dirty 처리된 구간은 last-known을 버리거나 “stale” 배지 처리
* 장점: “0 → 도트 생김” 자체를 거의 제거 가능
* 단점: stale 정보 노출 리스크(특히 사용자가 방금 할 일을 추가/삭제한 직후)

### 옵션 C) **dot 등장 애니메이션을 “fade-in 120ms”로만**

* placeholder도 싫으면, “나중에 생기는 도트”를 갑툭튀 대신 살짝 페이드인.
* 단, 안드로이드에서 LayoutAnimation류는 지뢰가 될 수 있어서, **opacity만** 추천.

---

5. Apple Calendar / Google Calendar는 month/week indicator를 어떻게 처리하는지

---

### Apple Calendar (iOS)

* **표시 방식(근거)**
  Apple 공식 가이드에서 Month view에 “event indicators(Compact/Stacked) 또는 Details”로 표시를 바꿀 수 있다고 안내합니다. 즉, month 그리드 자체에 “이 날 뭔가 있음”을 나타내는 indicator를 기본 제공하는 구조. ([Apple 지원][2])
* **로딩/스크롤 중 패턴(추정 + 근거)**

  * Apple의 EventKit 프로그래밍 가이드(구 문서지만 개념은 동일)에서 EventKit이 **사용자의 Calendar 데이터베이스에 접근**한다고 설명하고, `eventsMatchingPredicate:` 같은 호출은 **동기(synchronous)라 메인 스레드에서 돌리면 안 된다**고 명시합니다. ([RC Consulting][3])
  * 여기서 합리적 추정: Apple Calendar 앱은 month/week indicator를 “스크롤마다 즉석 쿼리”로 막 때리는 게 아니라, **백그라운드/캐시 기반으로 UI를 즉시 그리도록 설계**했을 가능성이 큼(메인 스레드 블로킹을 피하라고 문서가 직접 경고하니까).
  * 다만 “애플 캘린더가 스크롤 중 placeholder를 어떻게 처리한다” 같은 UI 동작은 공식 문서로 딱 박힌 게 잘 없어서, 이 부분은 **추정**이라고 딱지 붙임.

### Google Calendar

* **오프라인 동작(근거)**
  Google 공식 도움말에 따르면 모바일에서 Google Calendar는 오프라인이어도 이벤트를 찾고/변경하고/생성/응답까지 가능하다고 명시합니다. 즉, 기본 UX는 로컬 캐시/동기화를 전제로 깔려 있음. ([구글 도움말][4])
* **로딩/스크롤 중 패턴(추정)**

  * 위 근거로 보면 month/week indicator도 기본적으로 “로컬 데이터로 즉시 렌더 → 동기화는 백그라운드” 패턴일 가능성이 높습니다.
  * 구글도 “스크롤 중 빈 indicator 먼저 그리고 나중에 채우는 placeholder 전략”을 공식 문서로 설명하진 않아서, 이 역시 **추정**.

요약하면: 둘 다 “스크롤할 때마다 비싼 range aggregation을 JS 메인에서 돌려서 indicator를 채우는” 구조는 피하려는 쪽이 자연스럽고, 그래서 **우리도 ‘보이기 전에 로드 + unknown은 empty로 안 그리기’**가 정석 루트임.

---

6. 우리 코드에 적용한다면 “바꿀 파일/지점” + 짧은 pseudo-code

---

### 바꿀 파일/지점

* `MonthlyStripList.js`

  * 스크롤 중 visible window(또는 candidateWeekStart)를 계산해서 상위로 올리는 콜백 추가
  * (추천) `flashListRef.current.getVisibleIndices()`를 throttle로 사용 ([Shopify][1])
* `useStripCalendarDataRange.js`

  * monthly prefetch anchor(weekStart) 입력을 받아서 “월 청크 ensure”를 돌리는 **single-flight prefetch 큐** 추가
* `DayCell.js`

  * summary가 없을 때 `hasRangeCoverage(date,date)`로 **known-empty vs unknown** 분기
  * unknown이면 placeholder dots(또는 last-known) 렌더
* `stripCalendarConstants.js`

  * `PREFETCH_BUFFER_WEEKS`, `PREFETCH_THROTTLE_MS` 같은 값 상수화

---

### pseudo-code (전문적인 예시 스타일)

#### (A) MonthlyStripList: visible 기반 prefet MonthlyStripList.js (개념 예시)

const PREFETCH_THROTTLE_MS = 250;
const PREFETCH_BUFFER_WEEKS = 4;

const lastVisibleRef = useRef({ mi;
const lastPrefetchAtRef = useRef(0);

const maybeEmitPrefetchAnchor = useCallback(() => {
const now = Date.now();
if (now - lastPrefetchAtRef.current < PREFETCH_THROTTLE_MS) return;
lastPrefetchAtRef.current = now;

const indices = flashListRef.current?.getV[];
if (!indices.length) return;

const minIndex = Math.min(...indices);
const maxIndex = Math.max(...indices);

const prev = lastVisibleRef.current;
const direction =
prev.max != null && maxIndex > prev.max ? 'down' :
prev.min != null && minIndex < prev.min ? 'up' :
'unknown';

lastVisibleRef.current = { min: minIndex, max: maxIndex };

const candidateIndex =
direction === 'down' ? (maxIndex + PREFETCH_BUFFER_WEEKS) :
direction === 'up'   ? (minIndex - PREFETCH_BUFFER_WEEKS) :
null;

if (candidateIndex == null) return;
const candidateWeekStart = weekStarts[candidateIndex];
if (!candidateWeekStart) return;

onPrefetchAnchorChange?.({
candidateWeekStart,
direction,
visibleMinIndex: minIndex,
visibleMaxIndex: maxIndex,
});
}, [weekStarts, onPrefetchAnchorChange]);

// onScroll에서 throttle로 호출
const onScroll = useCallback((e) => {
// 기존 스크롤 상태 머신 유지...
maybeEmitPrefetchAnchor();
}, [maybeEmitPrefetchAnchor]);

````

#### (B) useStripCalendarDataRange: 월 청크 single-flight prefetch
```js
// useStripCalendarDataRange.js (개념 예시)

function monthChunkRange(anyDate /* YYYY-MM-DD */) {
  const m = dayjs(anyDate).startOf('month');
  return {
    startDate: m.format('YYYY-MM-DD'),
    endDate: m.endOf('month').format('YYYY-MM-DD'),
  };
}

const prefetchInFlightRef = useRef(false);
const pendingPrefetchRef = useRef(null);

const requestMonthlyPrefetch = useCallback((candidateWeekStart) => {
  pendingPrefetchRef.current = monthChunkRange(candidateWeekStart);
  drainPrefetchQueue();
}, []);

const drainPrefetchQueue = useCallback(async () => {
  if (prefetchInFlightRef.current) return;
  if (!pendingPrefetchRef.current) return;

  prefetchInFlightRef.current = true;
  try {
    while (pendingPrefetchRef.current) {
      const range = pendingPrefetchRef.current;
      pendingPrefetchRef.current = null;

      // 이미 커버면 스킵 (내부에서도 hasRangeCoverage로 early-return하지만, 여기서도 한 번 더 가드 가능)
      await ensureRangeLoaded({
        mode: 'monthly',
        startDate: range.startDate,
        endDate: range.endDate,
        forceRefresh: false,
        reason: 'monthly:scroll-prefetch',
      });
    }
  } finally {
    prefetchInFlightRef.current = false;
  }
}, []);
````

#### (C) DayCell: unknown vs empty 렌더 분리 + placeholder dots

```js
// DayCell.js (개념 예시)

const { summary, isCovered } = useStripCalendarStore((state) => {
  const s = date ? state.summariesByDate?.[date] : null;
  const covered = date ? state.hasRangeCoverage(date, date) : true;
  return { summary: s, isCovered: covered };
});

const effectiveSummary =
  summary ??
  (isCovered ? EMPTY_SUMMARY : LOADING_PLACEHOLDER_SUMMARY);

// LOADING_PLACEHOLDER_SUMMARY는 dotCount=3, uniqueCategoryColors는 고정된 neutral 색 3개 같은 형태
```

---

## 마지막으로 우선순위(실전 팁)

* **1순위:** DayCell에서 unknown을 empty로 그리지 않기(= flicker 체감 바로 줄어듦)
* **2순위:** monthly 스크롤 중 prefetch anchor 올리기 + 월 청크 ensure + single-flight
* **3순위:** buffer/throttle 튜닝(4주/250ms부터 시작) + 저사양 안드로이드에서만 6주로 스위치

원하면, 너네 실제 스토어( Zustand store ) 파일까지 같이 보면 `hasRangeCoverage` 비용/loadedRanges 구조 보고 “coverage 체크를 DayCell에서 매번 해도 안전한지”까지 딱 잘라서 더 최적화 포인트 잡아줄게.

[1]: https://shopify.github.io/flash-list/docs/usage/ "https://shopify.github.io/flash-list/docs/usage/"
[2]: https://support.apple.com/guide/iphone/change-how-you-view-events-iphfd1054569/ios "https://support.apple.com/guide/iphone/change-how-you-view-events-iphfd1054569/ios"
[3]: https://rcconsulting.com/Downloads/EventKitProgGuide.pdf "https://rcconsulting.com/Downloads/EventKitProgGuide.pdf"
[4]: https://support.google.com/calendar/answer/1340696?co=GENIE.Platform%3DAndroid&hl=en "https://support.google.com/calendar/answer/1340696?co=GENIE.Platform%3DAndroid&hl=en"
