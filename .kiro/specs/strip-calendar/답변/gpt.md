좋다. 지금 로그(목표 208000인데 실제 207800 = **정확히 width/2 차이**)는 “대충 오차”가 아니라 **구조적으로 반 페이지가 끼어든** 전형적인 패턴임. 웹만 이러는 것도 그 패턴이랑 딱 맞고.

아래는 내가 제일 그럴싸한 원인 가설 1개로 딱 찍고, **플랫폼 분기 없이 단일 코드패스**로 “무조건 주간 딱딱 맞추기” 전략/패치/검증까지 한 번에 정리한 거다.

---

## 1) Root cause hypothesis: 왜 하필 “반 페이지(width/2)”로 드리프트하냐

핵심 가설은 이거임:

### ✅ 스크롤 콘텐츠 시작점에 **leading inset(=가로 여백/헤더 스페이서)** 가 있고, 그 값이 **weekWidth/2(=200)** 정도인데,

너는 offset을 `index * weekWidth`로 계산해서 **그 inset을 빼먹고** 스크롤을 걸고 있음.

그러면 웹(react-native-web / DOM 스크롤)은 보통 이런 조건에서:

* `pagingEnabled`, `snapToInterval`, 또는 RNW 내부의 **scroll-snap류 동작**
* 혹은 콘텐츠가 “페이지 단위로 스냅되는” 상황

에서 **가장 가까운 스냅 포인트로 최종 위치를 강제로 맞춤**.

### 숫자로 너 로그 그대로 대입해보면

* `weekWidth = 400`
* 실제 landing `x = 207800`
* 목표 `x = 208000`
* 차이 `-200 = -weekWidth/2`

이 값은 “오차”가 아니라 **스냅 포인트가 실제로는 `leadingInset + index*weekWidth`에 찍혀있다는 증거**로 해석이 됨.

예를 들어 `leadingInset = 200`이라면 스냅 포인트는:

* week 519 시작: `200 + 519*400 = 207800` ✅ (네 실제 landing)
* week 520 시작: `200 + 520*400 = 208200`

근데 너는 week 520으로 가려고 `208000`으로 스크롤을 던짐 → 이 값은 **207800과 208200의 정확히 정중앙**임.

웹 스냅 구현이 정중앙이면 “앞쪽”을 택하는 식으로 타이브레이크 걸면:

* 첫 클릭: 208000 → 207800로 스냅(이전 주) → UI상 “안 움직인 것처럼” 보일 수 있음
* 두 번째 클릭: 다음 목표로 넘어가면서 그제서야 점프

➡️ 그래서 **“첫 화살표 클릭이 노옵처럼 보이고, 두 번째가 점프”** 현상이 같이 터짐.
그리고 viewport에 **인접 주가 섞여 보이는 것도** “반 페이지 밀림”이면 당연히 그렇게 보임.

**leading inset의 대표적인 원인들(대부분 여기서 나옴):**

* `contentContainerStyle={{ paddingHorizontal: weekWidth/2 }}` 같은 반폭 패딩
* `ListHeaderComponent`로 폭 `weekWidth/2`짜리 spacer를 넣어둔 경우(캐러셀 센터링 트릭)
* 부모 레이아웃에서 스크롤 영역과 아이템 폭 기준이 어긋나는데, 그 차이가 우연히 반폭으로 고정된 경우
* `initialScrollIndex` + 수동 `scrollToOffset`를 같이 써서 “한 번은 inset 없는 좌표계, 한 번은 inset 있는 좌표계”로 싸우는 경우

---

## 2) 단일 코드패스로 “무조건 주간 정렬 고정”하는 가장 튼튼한 전략 1개

**전략 이름: “측정 기반 페이지 좌표계 + 스냅 보정(quantize)”**

플랫폼 분기 없이(=웹/네이티브 동일 로직) 아래 3가지만 지키면 됨:

### A. 페이지 폭(pageWidth)은 “실제 FlashList 컨테이너 onLayout”로 측정

* `Dimensions.get('window').width` 같은 전역 값 말고,
* **FlashList를 감싸는 컨테이너의 `onLayout` width**를 pageWidth로 씀
  (웹에서 특히 레이아웃/스크롤 컨테이너 폭이 window랑 안 맞는 경우가 흔함)

### B. 스냅 기준 오프셋은 무조건 이 공식 하나로 통일

> `snapOffset(index) = leadingInset + index * pageWidth`

* 이상적으로는 **leadingInset = 0**으로 만드는 게 가장 깔끔함(추천).
* 제거 못 하면, leadingInset을 “정확히” 반영하고 **FlashList에도 알려줘야 함**(아래 5번에서 설명).

### C. 어떤 스크롤이든 “정착 시점”에 최종 1번 보정해서 딱 맞춘다

* 웹은 스크롤 최종 위치가 “의도한 값”과 다르게 끝나는 일이 있음(스냅/서브픽셀/타이브레이크 등)
* 그래서 **스크롤이 멈춘 뒤**(idle 감지) 현재 x를 읽고

  * `index = round((x - leadingInset)/pageWidth)`
  * `scrollToOffset(snapOffset(index), animated:false)`로 한 번 **정렬 보정**
* 이 보정 로직은 네이티브에서도 동작하고, 플랫폼 분기가 필요 없음.

이러면:

* 초기 정렬도 0.5페이지 드리프트 없음
* 손 스와이프/트랙패드 스크롤로 애매하게 멈춰도 “항상 주 경계로” 떨어짐
* 화살표 클릭 노옵/점프 현상도 같이 사라짐

---

## 3) Weekly 리스트 최소 패치 플랜 (state flow + scroll API 호출 순서)

여기서 “최소”는 진짜 최소만 말함. (아키텍처 갈아엎지 말고)

### 0) 먼저 leading inset 후보를 제거하거나 “수치화”하기

**가장 먼저 확인/조치:**

* `contentContainerStyle.paddingHorizontal = weekWidth/2` 같은 거 있으면 **주간에서는 제거**
  (디자인 여백이 필요하면: 리스트 밖 wrapper에 padding을 주고, 스크롤 콘텐츠에는 주지 마)
* `ListHeaderComponent`로 반폭 spacer 넣었으면 **주간에서는 제거**
  (이게 있으면 너의 `index*width` 좌표계가 100% 깨짐)

> 제거가 불가능하면: leadingInset을 변수로 들고가서 오프셋 공식에 포함 + FlashList에 `estimatedFirstItemOffset`까지 세팅해야 함(5번 참고).

### 1) pageWidth를 onLayout으로 확보 (0이면 스크롤 명령 금지)

* `pageWidth`가 준비되기 전엔 어떤 scroll sync도 하지 마
* `pageWidth`는 가능하면 `Math.round(width)`로 정수화(웹 서브픽셀 방지)

### 2) “초기 정렬”은 딱 한 군데에서만 수행

가장 흔한 실수:

* `initialScrollIndex`도 쓰고
* mount effect에서 `scrollToOffset`도 또 때림
  → 서로 싸우면서 웹에서 이상한 스냅/오프셋이 남음

**권장(최소 변경 기준):**

* 주간은 `initialScrollIndex`를 빼고,
* `pageWidth` + `data` 준비된 뒤 **한 번만** `scrollToOffset({ animated:false })`

호출 순서(권장):

1. `onLayout`로 pageWidth set
2. `useEffect([pageWidth, targetIndex])`에서

   * `scrollToOffset(targetOffset, animated:false)`
   * `requestAnimationFrame` 1~2번 뒤에 **같은 오프셋으로 한 번 더** `animated:false` (웹 스냅/레이아웃 적용 타이밍 보정)

### 3) “화살표 클릭”은 state 업데이트보다 스크롤 명령이 먼저

버그가 “첫 클릭 노옵”처럼 보이는 이유 중 하나가

* state는 다음 index로 바뀌었는데 실제 스크롤은 이전에 남아있어서 UI가 꼬이는 패턴임.

최소 플로우:

* 클릭 → `nextIndex` 계산(현재는 **scroll에서 확정된 indexRef**를 기준)
* `scrollToOffset(snapOffset(nextIndex), animated:true)`
* 스크롤 정착(아래 4번 idle 스냅)에서 최종 index를 확정하고 상태 반영

### 4) 스크롤 정착 감지(Idle) → 스냅 보정 → index 확정

* `onScroll`에서 마지막 x 저장
* 80~120ms 정도로 idle 타이머 갱신
* idle 되면:

  * `snapped = round((x - leadingInset)/pageWidth)`
  * `scrollToOffset(snapOffset(snapped), animated:false)` (오차가 있을 때만)
  * `currentIndex state` / `targetWeekStart` 갱신

이게 **웹/네이티브 동일하게 먹히는 “보험”**임.

---

## 4) Validation checklist (기대 로그/지표)

아래 로그 찍어보면 원인/해결이 바로 판별됨.

### A. 레이아웃/좌표계 확인

* `pageWidth` (컨테이너 onLayout)
* `leadingInset` (0이어야 베스트, 아니면 정확한 값이어야 함)
* `snapOffset(520)` 값

**기대 예시(공적/전문 스타일):**

```txt
layout: pageWidth=400 leadingInset=0
target: index=520 snapOffset=208000
```

만약 leadingInset이 살아있으면:

```txt
layout: pageWidth=400 leadingInset=200
target: index=520 snapOffset=208200
```

### B. scrollToOffset 직후/정착 후 오차(delta) 측정

* `requestedOffset`
* `firstSampleX`
* `settledX`
* `delta = settledX - requestedOffset`

**기대:**

* 패치 후: `|delta| <= 1px` (실무 기준)
* 그리고 `settledX`가 항상 `leadingInset + n*pageWidth` 형태

### C. “첫 클릭 노옵” 재현 체크

* 클릭 전 `currentIndex`
* 클릭 후 “정착된 index”

**기대:**

* 첫 클릭부터 `currentIndex`가 +1 되고,
* viewport가 섞이지 않음(이전/다음 주가 동시에 보이지 않음)

### D. 보정 횟수(metric)

* `snapCorrectionCount`를 카운트해봐.
  **기대:**
* 초기 1회(또는 0회)
* 이후 화살표 이동은 거의 0회
* 사용자가 트랙패드로 애매하게 멈추는 경우만 보정 1회씩

보정이 과하게 많이 뜨면:

* pageWidth가 매 렌더마다 바뀌거나
* 아이템 외곽에 margin이 있어 실제 “페이지 길이”가 pageWidth가 아니거나
* leadingInset이 불안정하게 변하고 있는 거임

---

## 5) FlashList props: 추가/제거해야 할 것과 “왜”

### ✅ 추가 권장

#### (1) `overrideItemLayout`

**왜:** 주간은 아이템 길이가 “항상 pageWidth로 고정”이잖아.
FlashList에게 이걸 명시해주면:

* 측정/추정 오차로 인한 미세 드리프트가 줄고
* `scrollToIndex/scrollToOffset`의 일관성이 올라감
* 웹에서 “추정 → 실제 측정 후 보정” 같은 흔들림이 줄어듦

설정 개념:

* horizontal 방향 size를 `pageWidth`로 고정

#### (2) `estimatedItemSize={pageWidth}`

**왜:** FlashList 가상화/레이아웃 추정 안정화.
`estimatedItemSize`가 엉뚱하면 초기 오프셋/측정 보정이 흔들릴 수 있음.

#### (3) (leadingInset이 존재한다면) `estimatedFirstItemOffset={leadingInset}`

**왜:** 헤더/패딩 같은 “첫 아이템 시작 전 오프셋”이 있으면, FlashList의 초기 계산이 틀어질 수 있음.
특히 `initialScrollIndex`를 쓰는 경우 이 값이 없으면 오프셋이 미묘하게 엇나가고, 웹에서 더 티 남.

---

### ❌ 제거/회피 권장 (주간에서 특히)

#### (1) `contentContainerStyle.paddingHorizontal = pageWidth/2` 또는 반폭 `ListHeaderComponent` 스페이서

**왜:** 네가 지금 겪는 “반 페이지 드리프트”를 만드는 1순위 후보.
이게 있으면 스냅 포인트가 `index*width`가 아니라 `leadingInset + index*width`가 됨.

주간이 “한 주가 viewport를 꽉 채우는 페이지”라면,

* 스크롤 콘텐츠에 반폭 패딩/스페이서는 구조적으로 안 맞음.

#### (2) `pagingEnabled` / `snapToInterval`을 “정확 정렬의 유일한 수단”으로 믿는 것

**왜:** 웹에서는 구현이 DOM scroll-snap 기반이거나, 브라우저별 타이브레이크/서브픽셀 영향이 있어서
“가끔 정확히 안 떨어지는” 사례가 생김.

그래서 결론은:

* `pagingEnabled`를 유지하든 말든(단일 코드패스 가능),
* **최종 정착 후 보정(quantize)** 로직을 “정확 정렬의 최종 권위”로 둬라.

> 제일 깔끔한 구성은: 주간에서는 `pagingEnabled/snapToInterval` 다 빼고,
> “idle 스냅 보정”으로만 페이지화시키는 것. (웹/네이티브 체감도 비슷하게 만들기 쉬움)

---

## (참고) 최소 레퍼런스 구현 스케치 (복붙 가능한 형태, 단일 코드패스)

아래는 “측정 기반 + idle 스냅 보정 + inset=0 전제”의 가장 단순한 형태임.
(예시는 공적/전문적인 스타일로 작성)

```tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { FlashList } from "@shopify/flash-list";

type WeekItem = {
  id: string;
  weekStartISO: string; // e.g. "2026-02-15"
};

type Props = {
  weeks: WeekItem[];
  targetIndex: number; // e.g. 520
  onIndexSettled?: (index: number) => void;
};

export function WeeklyStripCalendar({ weeks, targetIndex, onIndexSettled }: Props) {
  const listRef = useRef<FlashList<WeekItem>>(null);

  const pageWidthRef = useRef(0);
  const leadingInsetRef = useRef(0); // keep 0; if you must have inset, set it explicitly and use estimatedFirstItemOffset too.
  const lastScrollXRef = useRef(0);

  const isProgrammaticRef = useRef(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pageWidth, setPageWidth] = useState(0);
  const currentIndexRef = useRef(targetIndex);

  const clampIndex = useCallback(
    (i: number) => Math.max(0, Math.min(i, weeks.length - 1)),
    [weeks.length]
  );

  const snapOffset = useCallback((index: number) => {
    const w = pageWidthRef.current;
    const inset = leadingInsetRef.current;
    return inset + index * w;
  }, []);

  const scrollToIndexExact = useCallback(
    (index: number, animated: boolean) => {
      const w = pageWidthRef.current;
      if (!listRef.current || w <= 0) return;

      const i = clampIndex(index);
      const offset = snapOffset(i);

      isProgrammaticRef.current = true;
      listRef.current.scrollToOffset({ offset, animated });

      // Post-settle correction: ensure exact alignment even on web scroll-snap timing.
      requestAnimationFrame(() => {
        listRef.current?.scrollToOffset({ offset, animated: false });
        requestAnimationFrame(() => {
          isProgrammaticRef.current = false;
        });
      });

      currentIndexRef.current = i;
    },
    [clampIndex, snapOffset]
  );

  const onContainerLayout = useCallback((e: any) => {
    const w = Math.round(e.nativeEvent.layout.width);
    if (!w || w === pageWidthRef.current) return;
    pageWidthRef.current = w;
    setPageWidth(w);
  }, []);

  // Initial / sync scroll (single source of truth)
  useEffect(() => {
    if (pageWidth <= 0 || weeks.length === 0) return;
    scrollToIndexExact(targetIndex, false);
  }, [pageWidth, weeks.length, targetIndex, scrollToIndexExact]);

  const settleSnapFromX = useCallback(() => {
    const w = pageWidthRef.current;
    if (w <= 0) return;

    const inset = leadingInsetRef.current;
    const raw = (lastScrollXRef.current - inset) / w;
    const snappedIndex = clampIndex(Math.round(raw));
    const snappedOffset = snapOffset(snappedIndex);

    const delta = lastScrollXRef.current - snappedOffset;
    if (Math.abs(delta) > 1) {
      // Correct only when meaningfully misaligned
      scrollToIndexExact(snappedIndex, false);
    }

    if (snappedIndex !== currentIndexRef.current) {
      currentIndexRef.current = snappedIndex;
      onIndexSettled?.(snappedIndex);
    }
  }, [clampIndex, onIndexSettled, scrollToIndexExact, snapOffset]);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      lastScrollXRef.current = e.nativeEvent.contentOffset.x;

      if (isProgrammaticRef.current) return;

      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        settleSnapFromX();
      }, 100);
    },
    [settleSnapFromX]
  );

  const goPrev = useCallback(() => {
    scrollToIndexExact(currentIndexRef.current - 1, true);
  }, [scrollToIndexExact]);

  const goNext = useCallback(() => {
    scrollToIndexExact(currentIndexRef.current + 1, true);
  }, [scrollToIndexExact]);

  const overrideItemLayout = useCallback((layout: any) => {
    // Force fixed page size for best cross-platform determinism
    layout.size = pageWidthRef.current || 1;
  }, []);

  return (
    <View onLayout={onContainerLayout} style={{ width: "100%" }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Pressable onPress={goPrev}><Text>◀</Text></Pressable>
        <Pressable onPress={goNext}><Text>▶</Text></Pressable>
      </View>

      <FlashList
        ref={listRef}
        horizontal
        data={weeks}
        keyExtractor={(item) => item.id}
        estimatedItemSize={pageWidth || 1}
        overrideItemLayout={overrideItemLayout}
        renderItem={({ item }) => (
          <View style={{ width: pageWidth, justifyContent: "center", alignItems: "center" }}>
            <Text>{item.weekStartISO}</Text>
          </View>
        )}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsHorizontalScrollIndicator={false}
      />
    </View>
  );
}
```

---

## 결론(한 줄 요약)

지금 현상은 웹이 멍청해서가 아니라(…라고 하고 싶지만) **leadingInset(대개 반폭 스페이서/패딩) + 스냅의 타이브레이크** 때문에 딱 `width/2`로 밀리는 “구조적 버그”에 가깝고,
해결은 **(1) inset 제거 또는 오프셋 공식에 포함** + **(2) 스크롤 정착 후 quantize 보정** 이 두 개면 끝임. 플랫폼 분기 필요 없음.

원하면, 네 현재 FlashList props 목록(weekly 쪽) 그대로 붙여주면 내가 “어느 prop이 실제로 inset/스냅을 만들고 있는지”를 로그 값 기준으로 더 확정적으로 지목해서 **딱 필요한 줄만 최소 수정안**으로 깎아줄게.
