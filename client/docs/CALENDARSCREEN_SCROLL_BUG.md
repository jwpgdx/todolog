# CalendarScreen 상단 스크롤 순간이동 버그

## 문제 상황

CalendarScreen에서 위로 스크롤하여 과거 데이터를 로드할 때, 화면이 순간이동하는 버그 발생.

### 로그 분석
```
👁️ [보이는범위] 4 ~ 4
👁️ [보이는범위] 3 ~ 4
🔄 [무한스크롤-상단] 상단 도달 감지
📅 [무한스크롤-상단] 12개월 추가 시작: 2024-07 ~ 2025-07
✅ [무한스크롤-상단] 완료: 13개 월 추가 (총 32개)
📍 [무한스크롤-상단] 인덱스 조정: +13
👁️ [보이는범위] 13 ~ 13  // ← 순간이동 발생!
```

**증상**: 인덱스 3-4에서 스크롤 중 → 데이터 추가 후 → 인덱스 13으로 점프

---

## 원인 분석

### 1. UltimateCalendar (정상 작동)

**MonthlyView.js** (lines 60-65):
```javascript
if (onStartReached && firstIndex <= 15 && !isLoadingPast.current) {
    isLoadingPast.current = true;
    onStartReached(scrollOffsetRef.current); // ✅ 현재 오프셋 전달
    setTimeout(() => { isLoadingPast.current = false; }, 1000);
}
```

**UltimateCalendar.js** (lines 250-310):
```javascript
const handleStartReached = useCallback((currentOffset = 0) => {
    // 1️⃣ 현재 스크롤 오프셋 저장
    console.log(`   - 현재 스크롤 오프셋: ${currentOffset.toFixed(2)}px`);
    
    // 2️⃣ 새 데이터 생성
    const addedCount = newWeeks.length;
    
    // 3️⃣ 오프셋 계산
    const addedHeight = addedCount * CELL_HEIGHT;
    const newOffset = currentOffset + addedHeight;
    console.log(`   - 새 오프셋: ${newOffset.toFixed(2)}px`);
    
    // 4️⃣ Content Offset 보정 (즉시)
    setTimeout(() => {
        if (monthlyRef.current) {
            monthlyRef.current.scrollToOffset(newOffset, false);
            console.log(`   ✅ 월간뷰 오프셋 보정 완료`);
        }
    }, 0);
    
    // 5️⃣ 상태 업데이트
    setWeeks(prev => [...newWeeks, ...prev]);
}, []);
```

**핵심**: 
- `scrollOffsetRef`로 현재 스크롤 위치 추적
- 추가된 높이만큼 오프셋 보정
- `scrollToOffset`으로 정확한 위치 유지

---

### 2. CalendarScreen (버그 발생)

**CalendarScreen.js** (lines 115-157):
```javascript
const handleStartReached = useCallback(() => {
    // 1️⃣ 새 데이터 생성
    const addedCount = newMonths.length;
    
    // 2️⃣ 상태 업데이트
    setMonths(prev => [...newMonths, ...prev]);
    setCurrentViewIndex(prev => prev + addedCount);
    
    // 3️⃣ 스크롤 위치 복원 시도 (문제!)
    setTimeout(() => {
        const newIndex = visibleRange.start + addedCount;
        flatListRef.current?.scrollToIndex({ 
            index: newIndex, 
            animated: false 
        });
        setIsLoadingPast(false);
    }, 50);
}, []);
```

**문제점**:
1. ❌ **스크롤 오프셋 추적 없음** → 현재 위치를 모름
2. ❌ **`scrollToIndex` 사용** → FlashList의 동적 높이로 인해 부정확
3. ❌ **`setTimeout(50ms)`** → 타이밍 이슈 발생 가능
4. ❌ **Content Offset 보정 없음** → 순간이동

---

## 해결 방안

### ❌ Option A: `maintainVisibleContentPosition` 명시적 설정 (실패)

FlashList v2의 `maintainVisibleContentPosition` 기능을 명시적으로 활성화하여 자동 위치 유지를 시도했으나 **실패했습니다**.

**테스트 결과 (2026-01-30)**:
```
BEFORE: offset 1897px, indices 3~4 (2025-10, 2025-11)
AFTER:  offset 8325px, indices 16~17 (2025-10, 2025-11) ❌ 순간이동 발생
```

**문제점**:
- 인덱스는 정상적으로 +13 조정됨
- 하지만 오프셋이 1897px → 8325px로 점프 (6428px 차이)
- `maintainVisibleContentPosition`이 제대로 작동하지 않음
- 사용자는 2025-08 → 2025-06으로 건너뛰는 것을 경험 (7월 누락)

**결론**: FlashList v2의 `maintainVisibleContentPosition`은 동적 높이 리스트에서 신뢰할 수 없음

---

### ✅ Option B: 수동 오프셋 보정 (UltimateCalendar 방식) - 적용됨

```javascript
<FlashList
    ref={flatListRef}
    data={months}
    renderItem={renderMonth}
    // ✅ keyExtractor 필수 (위치 추적용)
    keyExtractor={(item) => item.monthKey}
    
    // ✅ maintainVisibleContentPosition 명시적 설정
    maintainVisibleContentPosition={{
        disabled: false,  // 명시적으로 활성화
        autoscrollToTopThreshold: 10,  // 상단 10개 아이템 이내에서 자동 스크롤
    }}
    
    // ✅ drawDistance 증가 (더 많은 아이템 미리 렌더링)
    drawDistance={SCREEN_WIDTH * 3}
    
    estimatedItemSize={400}
    initialScrollIndex={todayMonthIndex}
    showsVerticalScrollIndicator={false}
    onViewableItemsChanged={onViewableItemsChanged}
    viewabilityConfig={viewabilityConfig}
    onEndReached={handleEndReached}
    onEndReachedThreshold={0.5}
    onScrollToIndexFailed={(info) => {
        flatListRef.current?.scrollToOffset({
            offset: info.averageItemLength * info.index,
            animated: false
        });
    }}
/>
```

**handleStartReached 수정**:
```javascript
const handleStartReached = useCallback(() => {
    if (isLoadingMore || isLoadingPast) {
        console.log('⚠️ [무한스크롤-상단] 이미 로딩 중 - 스킵');
        return;
    }
    
    if (visibleRange.start > 3) {
        return;
    }
    
    console.log('🔄 [무한스크롤-상단] 상단 도달 감지');
    setIsLoadingPast(true);
    
    const startTime = performance.now();
    const currentStart = loadedRange.start;
    const newStart = currentStart.subtract(12, 'month');
    
    console.log(`📅 [무한스크롤-상단] 12개월 추가 시작: ${newStart.format('YYYY-MM')} ~ ${currentStart.format('YYYY-MM')}`);
    
    const newMonths = [];
    let current = newStart.clone().startOf('month');
    
    while (current.isBefore(currentStart)) {
        newMonths.push(createMonthData(current, startDayOfWeek));
        current = current.add(1, 'month').startOf('month');
    }
    
    const addedCount = newMonths.length;
    
    // ✅ maintainVisibleContentPosition이 자동으로 처리하므로
    // 수동 스크롤 조정 불필요!
    setMonths(prev => [...newMonths, ...prev]);
    setLoadedRange(prev => ({ ...prev, start: newStart }));
    setTodayMonthIndex(prev => prev + addedCount);
    setCurrentViewIndex(prev => prev + addedCount);
    
    const endTime = performance.now();
    console.log(`✅ [무한스크롤-상단] 완료: ${addedCount}개 월 추가 (총 ${months.length + addedCount}개) (${(endTime - startTime).toFixed(2)}ms)`);
    console.log(`📍 [무한스크롤-상단] 인덱스 조정: +${addedCount}`);
    
    // ✅ 짧은 딜레이 후 로딩 상태 해제
    setTimeout(() => {
        setIsLoadingPast(false);
    }, 100);
}, [loadedRange, isLoadingMore, isLoadingPast, startDayOfWeek, months.length, visibleRange]);
```

UltimateCalendar의 MonthlyView에서 사용하는 방식을 적용합니다. `maintainVisibleContentPosition`을 비활성화하고 수동으로 오프셋을 계산하여 보정합니다.

**구현 완료 (2026-01-30)**:

```javascript
const scrollOffsetRef = useRef(0);

const onScroll = useCallback((e) => {
    scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
}, []);

const handleStartReached = useCallback(() => {
    // 1. 현재 오프셋 저장
    const currentOffset = scrollOffsetRef.current;
    
    // 2. 새 데이터 생성
    const newMonths = [...];
    const addedCount = newMonths.length;
    
    // 3. 추가된 높이 계산
    let addedHeight = 0;
    for (let i = 0; i < addedCount; i++) {
        const monthData = newMonths[i];
        const weeksCount = monthData?.weeks?.length || 5;
        const monthHeight = 52 + 30 + (weeksCount * CELL_HEIGHT);
        addedHeight += monthHeight;
    }
    
    // 4. 새 오프셋 계산
    const newOffset = currentOffset + addedHeight;
    
    // 5. 상태 업데이트
    setMonths(prev => [...newMonths, ...prev]);
    setCurrentViewIndex(prev => prev + addedCount);
    
    // 6. 오프셋 보정 (즉시)
    setTimeout(() => {
        flatListRef.current?.scrollToOffset({ 
            offset: newOffset, 
            animated: false 
        });
        scrollOffsetRef.current = newOffset;
        setIsLoadingPast(false);
    }, 0);
}, []);

<FlashList
    ref={flatListRef}
    onScroll={onScroll}
    scrollEventThrottle={16}
    maintainVisibleContentPosition={{ disabled: true }}
    // ... 나머지 props
/>
```

**장점**:
- ✅ 정확한 오프셋 계산 가능
- ✅ UltimateCalendar에서 검증된 방법
- ✅ 디버깅 가능 (모든 계산 과정 추적)
- ✅ FlashList의 버그에 의존하지 않음

**단점**:
- ⚠️ 코드가 복잡함
- ⚠️ 약간의 "번쩍" 현상 있을 수 있음 (UltimateCalendar에서 관찰됨)
- ⚠️ 수동 계산이므로 유지보수 필요

**구현 세부사항**:
1. `maintainVisibleContentPosition.disabled = true` 설정
2. `scrollOffsetRef`로 현재 오프셋 추적
3. `handleStartReached`에서 현재 오프셋 저장
4. 추가될 월들의 높이 계산 (헤더 52 + 요일 30 + 주 수 * CELL_HEIGHT)
5. 새 오프셋 = 현재 오프셋 + 추가된 높이
6. `scrollToOffset({ offset: newOffset, animated: false })` 호출
7. 상세한 디버그 로그로 추적

---

## 비교: UltimateCalendar vs CalendarScreen

| 항목 | UltimateCalendar | CalendarScreen |
|------|------------------|----------------|
| 스크롤 추적 | ✅ `scrollOffsetRef` | ❌ 없음 |
| 위치 복원 | ✅ `scrollToOffset` | ❌ `scrollToIndex` |
| 오프셋 보정 | ✅ Content Offset 계산 | ❌ 없음 |
| 타이밍 | ✅ `setTimeout(0)` | ⚠️ `setTimeout(50)` |
| 결과 | ✅ 부드러운 스크롤 | ❌ 순간이동 |

---

## 참고 파일

- `client/src/components/ui/ultimate-calendar/MonthlyView.js` (lines 40-65)
- `client/src/components/ui/ultimate-calendar/UltimateCalendar.js` (lines 200-320)
- `client/src/screens/CalendarScreen.js` (lines 115-157)

---

## 구현 상태

**작성일**: 2026-01-30  
**최종 업데이트**: 2026-01-30  
**상태**: ✅ Option B 구현 완료, 테스트 대기

**변경 사항**:
1. ✅ `scrollOffsetRef` 추가 (이미 존재)
2. ✅ `onScroll` 이벤트 핸들러 구현 (이미 존재)
3. ✅ `handleStartReached`에서 수동 오프셋 보정 로직 추가
4. ✅ `maintainVisibleContentPosition.disabled = true` 설정
5. ✅ 상세한 디버그 로그 추가
6. ⏳ 테스트 및 검증 필요

**다음 단계**:
1. 실제 디바이스/시뮬레이터에서 테스트
2. 다양한 월 높이(4주, 5주, 6주)에서 동작 확인
3. 빠른 스크롤 시 안정성 검증
4. "번쩍" 현상 최소화 방법 탐색
5. 성공 시 UltimateCalendar에도 동일한 방식 적용 고려

## CHAT GPT 답변 = 
ㅋㅋㅋ 니 상황 아주 잘 알겠어. **상단 무한스크롤에서 “데이터 추가 → 스크롤 위치가 갑자기 다른 데로 툭 튀는 문제”**는 FlashList 쓰는 사람들 사이에서 **완전 클래식 빡침 현상**이다. 특히 상단 prepend(위로 과거 로딩) 상황에서는 FlatList도 FlashList도 기본적으로 위치 보정이 자동으로 안 되거나 불안정함이 많음. ([GitHub][1])

아래 개꿀 요약 + 추천 솔루션 가자.

---

## 🧠 왜 FlashList가 위 스크롤에서 튀는가?

* FlashList에는 `maintainVisibleContentPosition` 옵션이 있는데도 **prepend로 데이터 추가할 때(특히 index 0에 가까울 때)** 완벽히 보정이 되지 않는 이슈가 공식 GitHub에서 보고됨. ([GitHub][1])
* FlatList처럼 기본 virtualization 전략만으로는, **새 아이템을 위에 붙이면 내부 height 계산이 바뀌면서 리스트가 아래로 이동하려는 현상**이 생김.
* `scrollToIndex`는 동적 높이 리스트에서 정확한 위치 산출이 어렵고, 타이밍(`setTimeout(50)`)도 헬임.

---

## 📌 다른 사람들이 어떻게 해결하나

### 1) **scrollOffset + scrollToOffset 직접 보정 (일반적인 해법)**

* 너가 UltimateCalendar에서 한 방식이 거의 표준으로 통함.
  *현재 오프셋을 추적 → prepend 데이터 개수 * 아이템 높이만큼 보정 → scrollToOffset으로 위치 유지*
* React Native 커뮤니티에서도 FlatList든 FlashList든 이 전략을 가장 많이 씀 (수정 전에 콘텐츠 높이 읽어서 보정). ([Stack Overflow][2])

---

### 2) **FlashList의 maintainVisibleContentPosition 사용**

```tsx
<FlashList
  data={data}
  renderItem={...}
  estimatedItemSize={...}
  maintainVisibleContentPosition={{
    autoscrollToTopThreshold: 0, 
    autoscrollToBottomThreshold: 0
  }}
/>
```

* 이 옵션은 **prepend 시 기본 위치 유지 노력**을 해줌.
* 하지만 공식 이슈 보면 “완전히 안 되는 경우 있음”이라고 나와서,
  **맨 위 바로 스크롤 0에 가까운 위치에서 prepend할 때는 신뢰도 낮음**. ([shopify.github.io][3])

---

### 3) **Height 추적 + 수동 스크롤 보정 (정확하고 안정된 방법)**

> 나는 이게 제일 추천됨. 특히 너처럼 동적 높이 월 뷰일 때.

**핵심 개념**

* prepend 하기 전 list height 저장
* prepend 후 list height 계산
* 증가한 height만큼 scroll offset 보정

**전문 예시 (공식 FlatList 대응 방식 아님, 로직 참고용)**

```js
let prevContentHeight = 0;

const onContentSizeChange = (w, h) => {
  if (!isPrepending) {
    prevContentHeight = h;
    return;
  }

  const delta = h - prevContentHeight;
  flatListRef.current?.scrollToOffset({ offset: delta + currentOffset, animated: false });
  isPrepending = false;
};

const handlePrepend = () => {
  isPrepending = true;
  // set data
};
```

📌 이건 FlashList에서도 똑같이 응용 가능.
**v1/FlatList 커뮤니티 팁**에서 많이 보이는데 FlashList에서도 통함. ([Stack Overflow][2])

---

## 🏆 내가 추천하는 방법 (너 상황 기준)

### ✅ 기본 전략 (유지 보정 로직 적용)

**1) onScroll 으로 현재 offset 추적**
**2) prepend 전/후 content height 확인**
**3) delta 만큼 scrollToOffset 보정 (animated: false)**

이건 FlatList/FlashList 둘 다 안정성 최고임.

---

## 🚫 하지 말아야 할 짓

* `scrollToIndex`로 위치 보정 → **불안정 + 동적 높이에서 에러 쉬움**
* 적은 delay (50ms) → 타이밍 문제로 도리어 더 많이 튐
* 데이터 붙이고 그냥 놔둠 → 사용자 눈앞에서 화면 위치가 흔들림

---

## 🔥 퍼포먼스 측면

* 너가 말한 것처럼 AI가 처리한다고 시간 상관없으면,
  **contentHeight 측정 + 오프셋 보정 로직**이 가장 안전하고 테스트 커버도 높음.
* FlashList v2는 maintainVisibleContentPosition이 꽤 좋아졌지만 아직 완벽하진 않음. ([libraries.io][4])

---

## 📌 Quick Recap (드립 없이 전문가 스타일)

### 상단 prepend 위치 유지 베스트 프랙티스

| 방법                                   |        안정성 | 난이도 |   추천   |
| ------------------------------------ | ---------: | --: | :----: |
| maintainVisibleContentPosition       | 🟡 (기본 제공) |   ⭐ |   🟡   |
| scrollOffset + addedHeight 보정        |    🟢 (정확) |  ⭐⭐ | 🟢🟢🟢 |
| contentHeight delta + scrollToOffset |  🟢🟢 (정밀) | ⭐⭐⭐ | 🟢🟢🟢 |

---

필요하면 **contentHeight 기반 실제 코드 템플릿**로 바로 붙여줄게.
어떤 옵션 선택하고 싶은지 (scrollOffset 보정 vs contentHeight delta) 말해라! 👨‍💻

[1]: https://github.com/Shopify/flash-list/issues/547?utm_source=chatgpt.com "maintainVisibleContentPosition Not Working · Issue #547 · Shopify/flash-list · GitHub"
[2]: https://stackoverflow.com/questions/79439158/how-to-preserve-scroll-position-in-flashlist-with-inverted-when-loading-earlier?utm_source=chatgpt.com "react native - How to preserve scroll position in FlashList with inverted when loading earlier messages? - Stack Overflow"
[3]: https://shopify.github.io/flash-list/docs/usage?utm_source=chatgpt.com "Usage | FlashList"
[4]: https://libraries.io/npm/flashlistv2?utm_source=chatgpt.com "flashlistv2 2.0.3 on npm - Libraries.io - security & maintenance data for open source software"

## GEMINI3 PRO 답변 = 
`FlashList` (그리고 `FlatList`)에서 상단으로 스크롤하여 데이터를 추가할 때 발생하는 "스크롤 튀는 현상(Scroll Jump)"은 아주 고전적이고 유명한 문제입니다.

새로운 데이터가 리스트의 **앞쪽(Prepend)**에 추가되면, 기존 아이템들이 아래로 밀려나지만 스크롤 위치(`contentOffset.y`)는 그대로 유지되기 때문에, 사용자의 시점에서는 화면이 아래쪽의 엉뚱한 데이터로 "순간이동"한 것처럼 보이게 됩니다.

FlashList Github 이슈와 커뮤니티에서 권장하는 해결책은 크게 두 가지입니다. **안정성**을 최우선으로 한다면 **방법 1 (수동 오프셋 보정)**을, **코드 간결성**을 원한다면 **방법 2 (Prop 사용)**를 추천합니다.

작성자님의 상황(캘린더, 월별 높이가 다름, 정확한 계산 로직 보유)에서는 **방법 1이 가장 확실한 해결책**입니다.

---

### 방법 1: 수동 오프셋 보정 (권장 & 가장 안정적)

작성자님이 분석하신 `UltimateCalendar`의 방식이 사실상 정석입니다. **"추가된 높이만큼 스크롤을 즉시 아래로 밀어주는 것"**입니다.

FlashList는 내부적으로 레이아웃을 측정하는 타이밍이 비동기적일 수 있어서 `scrollToIndex`는 불안정합니다. 대신 정확한 픽셀 단위의 `scrollToOffset`을 사용해야 합니다.

#### 구현 가이드

CalendarScreen에 적용할 코드는 다음과 같습니다.

```javascript
import { useRef, useCallback, useState } from 'react';

// ... (기타 import)

const CalendarScreen = () => {
    const flatListRef = useRef(null);
    const scrollOffsetRef = useRef(0); // 현재 스크롤 위치 추적용
    const [isPrepend, setIsPrepend] = useState(false); // 상단 추가 상태 플래그

    // 1. 스크롤 위치 실시간 추적
    const onScroll = useCallback((e) => {
        scrollOffsetRef.current = e.nativeEvent.contentOffset.y;
    }, []);

    // 2. 데이터 추가 및 오프셋 계산 로직
    const handleStartReached = useCallback(async () => {
        if (isLoadingPast.current) return;
        isLoadingPast.current = true;

        // 현재 오프셋 캡처 (데이터 추가 직전 위치)
        const currentOffset = scrollOffsetRef.current;

        // 데이터 로드 (예시)
        const newMonths = await loadPastMonths(); 
        const addedCount = newMonths.length;

        if (addedCount > 0) {
            // [중요] 추가된 아이템들의 총 높이 계산
            // getItemLayout 로직이나, 고정된 높이 공식을 그대로 사용하세요.
            let addedContentHeight = 0;
            for (let i = 0; i < addedCount; i++) {
                const monthData = newMonths[i];
                // 예: 헤더(52) + 요일(30) + (주 개수 * 주 높이)
                const monthHeight = 82 + (monthData.weeks.length * CELL_HEIGHT);
                addedContentHeight += monthHeight;
            }

            // 새로운 오프셋 계산
            const nextOffset = currentOffset + addedContentHeight;

            // 3. 상태 업데이트 전 'maintainVisibleContentPosition' 흉내내기
            // FlashList는 상태 변경 -> 렌더링 -> 레이아웃 측정 과정이 있음.
            // React의 상태 업데이트는 비동기이므로, 
            // 렌더링 직후 스크롤을 튀지 있게 잡으려면 아래 순서가 중요합니다.

            setMonths(prev => [...newMonths, ...prev]);
            
            // 4. 즉시 오프셋 보정 (animated: false 필수)
            // requestAnimationFrame을 쓰면 렌더링 사이클에 맞춰 더 부드러울 수 있습니다.
            requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({
                    offset: nextOffset,
                    animated: false
                });
                
                // 로딩 상태 해제
                isLoadingPast.current = false;
            });
        }
    }, [/* deps */]);

    return (
        <FlashList
            ref={flatListRef}
            onScroll={onScroll} // 필수 연결
            scrollEventThrottle={16} // 16ms 마다 이벤트 발생 (부드러운 추적)
            estimatedItemSize={400} // 평균 월 높이값 근사치 설정 (성능 최적화)
            // ...
        />
    );
};

```

**핵심 포인트:**

1. **`scrollToIndex` 사용 금지**: FlashList에서 동적 높이를 가진 아이템으로 인덱스 이동을 하면, 측정되지 않은 아이템 때문에 위치가 어긋납니다.
2. **높이 계산 공식**: 캘린더는 `weeks` 길이에 따라 높이가 달라지므로, 단순 곱셈(`count * fixedHeight`) 대신 **데이터 기반 루프 합산**이 필요합니다. (작성자님의 분석 내용처럼 구현하면 완벽합니다).
3. **`scrollEventThrottle={16}`**: 스크롤 오프셋을 놓치지 않고 추적하기 위해 필수입니다.

---

### 방법 2: `maintainVisibleContentPosition` Prop 사용 (실험적/간편)

React Native 0.72+ 및 최신 FlashList 버전에서는 이 Prop을 지원하기 시작했습니다. Chat 앱처럼 역순 스크롤이 아닌, 일반 리스트의 상단 추가 시 스크롤 유지를 도와주는 기능입니다.

하지만 **아이템 높이가 동적(Dynamic)일 경우** FlashList에서 가끔 떨림 현상이 보고되기도 합니다. 코드가 훨씬 간결해지므로 시도해볼 가치는 있습니다.

```javascript
<FlashList
    // ...
    maintainVisibleContentPosition={{
        minIndexForVisible: 0, // 첫 번째 아이템(인덱스 0) 위로 데이터가 추가될 때 위치 유지
        autoscrollToTopThreshold: 10, // 선택사항: 최상단에 있을 때 자동으로 새 데이터 보여줄지 여부
    }}
/>

```

* **주의**: 이 속성은 원래 React Native의 `FlatList` 속성이며, FlashList가 이를 포워딩하여 구현합니다. Android/iOS 간 동작 차이가 있을 수 있습니다.
* **제약**: 이 기능을 쓸 때는 `handleStartReached` 안에서 수동으로 `scrollToOffset`을 하면 안 됩니다. 둘이 충돌합니다.

---

### 결론 및 추천

작성자님의 상황을 분석했을 때, **캘린더의 각 월(Month)은 주(Week) 수에 따라 높이가 달라지는 동적인 구조**를 가지고 있습니다. 또한 이미 `UltimateCalendar`에서 성공한 로직이 있습니다.

따라서 **[방법 1: 수동 오프셋 보정]**을 적용하는 것이 **오버엔지니어링이 아니라, 가장 확실한 엔지니어링**입니다.

**구체적인 적용 단계:**

1. `CalendarScreen`에 `scrollOffsetRef`를 생성하고 `onScroll`을 연결합니다.
2. `handleStartReached` 함수 내에서 `newMonths` 데이터를 순회하며 **추가될 픽셀 높이(Height)**를 정확히 계산합니다. (`weeks.length` 활용)
3. `setMonths` 직후 `requestAnimationFrame` 혹은 `setTimeout(0)`을 사용하여 `scrollToOffset`으로 계산된 위치(`current + addedHeight`)로 이동시킵니다.
4. 기존의 `scrollToIndex` 코드는 삭제합니다.

이 방식은 `FlashList`의 렌더링 방식과 무관하게 수학적으로 계산된 위치를 강제하므로 "순간이동" 버그를 완벽하게 잡을 수 있습니다.

## CLAUDE 답변 = 
좋습니다. FlashList와 상단 prepend시 스크롤 점프 문제에 대해 조사했습니다. 

## 핵심 결론

FlashList v2는 **`maintainVisibleContentPosition`이 기본으로 활성화**되어 있어서, 이론상으로는 상단에 아이템을 추가할 때 자동으로 스크롤 위치를 유지해줘야 합니다. 하지만 실제로는 여러 버그가 있고, 특히 **채팅 앱처럼 상단에 과거 데이터를 계속 추가하는 케이스**에서 문제가 많습니다.

## 현재 상황 분석

당신의 경우:
- CalendarScreen에서 `scrollToIndex`로 위치 복원 시도 중
- 동적 높이로 인해 정확한 위치 계산 어려움
- 순간이동(jump) 발생

## 추천 솔루션

### ✅ **Option 1: `maintainVisibleContentPosition` 활용 (가장 간단)**

FlashList v2는 이 기능이 기본 활성화되어 있지만, 명시적으로 설정하면 더 안정적입니다:

```javascript
<FlashList
  ref={flatListRef}
  data={months}
  renderItem={renderMonth}
  // maintainVisibleContentPosition 명시적 설정
  maintainVisibleContentPosition={{
    minIndexForVisible: 0,  // 첫 번째 보이는 아이템 기준
  }}
  onStartReached={handleStartReached}
  onStartReachedThreshold={0.1}
  // keyExtractor 반드시 제공 (v2에서 매우 중요!)
  keyExtractor={(item) => item.id || item.yearMonth}
/>
```

**handleStartReached 수정**:
```javascript
const handleStartReached = useCallback(() => {
  if (isLoadingPast) return;
  setIsLoadingPast(true);
  
  const newMonths = generatePreviousMonths(12);
  
  // maintainVisibleContentPosition이 자동으로 처리하므로
  // 수동 스크롤 조정 불필요!
  setMonths(prev => [...newMonths, ...prev]);
  
  setTimeout(() => {
    setIsLoadingPast(false);
  }, 100);
}, [isLoadingPast]);
```

**주의사항**:
FlashList v2에서는 keyExtractor가 매우 중요합니다. 상단으로 스크롤할 때 레이아웃 변경으로 인한 깜빡임을 방지하려면 유효한 keyExtractor를 반드시 제공해야 합니다.

---

### ✅ **Option 2: `scrollToOffset` 방식 (UltimateCalendar와 동일)**

만약 `maintainVisibleContentPosition`이 제대로 작동하지 않으면, UltimateCalendar처럼 수동으로 처리:

```javascript
const scrollOffsetRef = useRef(0);

const onScroll = useCallback((event) => {
  scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
}, []);

const handleStartReached = useCallback(() => {
  if (isLoadingPast) return;
  setIsLoadingPast(true);
  
  const currentOffset = scrollOffsetRef.current;
  const newMonths = generatePreviousMonths(12);
  
  // 추가된 높이 계산 (getItemLayout 활용)
  let addedHeight = 0;
  for (let i = 0; i < newMonths.length; i++) {
    const layout = getItemLayout(null, i);
    addedHeight += layout.length;
  }
  
  const newOffset = currentOffset + addedHeight;
  
  // 상태 업데이트
  setMonths(prev => [...newMonths, ...prev]);
  
  // 오프셋 보정 (즉시)
  setTimeout(() => {
    flatListRef.current?.scrollToOffset({
      offset: newOffset,
      animated: false
    });
    setIsLoadingPast(false);
  }, 0);
}, [isLoadingPast]);

return (
  <FlashList
    ref={flatListRef}
    data={months}
    renderItem={renderMonth}
    getItemLayout={getItemLayout}  // 이미 구현되어 있음
    onScroll={onScroll}
    onStartReached={handleStartReached}
  />
);
```

---

### ⚠️ **Option 3: `maintainVisibleContentPosition` 비활성화 (버그 회피)**

FlashList는 maintainVisibleContentPosition이 기본으로 활성화되어 있습니다. 문제가 발생하면 `maintainVisibleContentPosition={{disabled: true}}`로 비활성화할 수 있습니다.

하지만 이 경우 Option 2처럼 수동으로 스크롤 위치를 관리해야 합니다.

---

## 다른 개발자들의 해결 방법

FlashList GitHub 이슈 #547에서 maintainVisibleContentPosition이 제대로 작동하지 않는 문제가 보고되었습니다. FlatList는 문제가 없지만 FlashList는 데이터를 앞에 추가할 때 스크롤이 이동하는 현상이 있었습니다.

FlashList 2.x 이슈 #2050에서는 초기 데이터가 화면을 채우지 못할 때 maintainVisibleContentPosition과 startRenderingFromBottom을 함께 사용하면 점프 현상이 발생한다고 보고되었습니다.

**커뮤니티 workaround**:
일부 개발자들은 `autoscrollToBottomThreshold: 1`과 `animateAutoScrollToBottom: false`를 설정하여 문제를 우회했지만, 이는 해킹에 가깝다고 언급했습니다.

---

## 최종 추천

**당신의 상황에 맞는 단계별 접근**:

1. **먼저 시도**: Option 1 (`maintainVisibleContentPosition` + 올바른 `keyExtractor`)
   - 가장 간단하고 FlashList가 의도한 방식
   - 코드 변경 최소화

2. **안 되면**: Option 2 (`scrollToOffset` 수동 관리)
   - UltimateCalendar에서 이미 검증된 방식
   - 더 정확하지만 코드 복잡도 증가

3. **최후의 수단**: FlashList → FlatList 변경 고려
   - FlatList는 이 문제가 덜함
   - 하지만 성능 손실 있음

---

## 구현 우선순위

**성능 + 안정성**을 모두 고려하면:

```
Option 1 시도 (1시간) 
  ↓ 실패
Option 2 구현 (2-3시간)
  ↓ 여전히 불안정
FlatList 고려 또는 FlashList v1로 다운그레이드
```

**제 추천**: Option 1부터 시작하되, `keyExtractor`를 제대로 설정하고, 로그로 `maintainVisibleContentPosition`이 실제로 작동하는지 확인하세요. FlashList v2는 이론상 이 문제를 해결했다고 하지만, 실제로는 엣지 케이스가 많습니다.