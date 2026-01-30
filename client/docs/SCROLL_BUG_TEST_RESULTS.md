# CalendarScreen 스크롤 버그 테스트 결과

## 테스트 일시
2026-01-30

## 문제 요약
CalendarScreen에서 위로 스크롤하여 과거 데이터를 로드할 때, 화면이 순간이동하는 버그 발생.
사용자는 2025-08 → 2025-06으로 건너뛰는 것을 경험하며, 7월이 누락되고 여백이 발생함.

---

## Option A 테스트: maintainVisibleContentPosition (실패)

### 설정
```javascript
<FlashList
    maintainVisibleContentPosition={{
        disabled: false,
        autoscrollToTopThreshold: 10,
    }}
    drawDistance={SCREEN_WIDTH * 3}
    keyExtractor={(item) => item.monthKey}
/>
```

### 테스트 시나리오
2026-01 (인덱스 6)에서 위로 스크롤하여 과거 12개월 로드

### 결과

**BEFORE 데이터 추가**:
```
👁️ [보이는범위] 3 ~ 4
📅 [보이는월] 3:2025-10, 4:2025-11
📊 [디버그] currentViewIndex: 6, scrollOffset: 1897.00px
```

**데이터 추가 실행**:
```
🔄 [무한스크롤-상단] 상단 도달 감지
📊 [상태] currentOffset: 1897.00px
📅 [무한스크롤-상단] 12개월 추가 시작: 2024-07 ~ 2025-07
📦 [데이터] 추가될 월 수: 13개
✅ [무한스크롤-상단] 완료: 13개 월 추가
📍 [무한스크롤-상단] 인덱스 조정: +13
```

**AFTER 데이터 추가** (❌ 순간이동 발생):
```
👁️ [보이는범위] 16 ~ 17
📅 [보이는월] 16:2025-10, 17:2025-11
📊 [디버그] currentViewIndex: 6, scrollOffset: 8325.00px
```

### 분석

| 항목 | BEFORE | AFTER | 차이 |
|------|--------|-------|------|
| 보이는 인덱스 | 3~4 | 16~17 | +13 ✅ |
| 스크롤 오프셋 | 1897px | 8325px | +6428px ❌ |
| 보이는 월 | 2025-10, 11 | 2025-10, 11 | 동일 |

**문제점**:
1. 인덱스는 정상적으로 +13 조정됨
2. 하지만 스크롤 오프셋이 1897px → 8325px로 점프 (6428px 차이)
3. `maintainVisibleContentPosition`이 제대로 작동하지 않음
4. 추가된 13개 월의 실제 높이가 6428px인데, FlashList가 이를 보정하지 못함

**결론**: ❌ FlashList v2의 `maintainVisibleContentPosition`은 동적 높이 리스트에서 신뢰할 수 없음

---

## Option B 구현: 수동 오프셋 보정 (적용됨)

### 설정
```javascript
<FlashList
    maintainVisibleContentPosition={{
        disabled: true,  // 수동 보정 사용
    }}
    onScroll={onScroll}
    scrollEventThrottle={16}
/>
```

### 구현 로직
```javascript
const handleStartReached = useCallback(() => {
    // 1. 현재 오프셋 저장
    const currentOffset = scrollOffsetRef.current;
    
    // 2. 새 데이터 생성
    const newMonths = [...];
    
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
```

### 예상 동작

**BEFORE**:
```
scrollOffset: 1897.00px
visibleRange: 3 ~ 4
```

**계산**:
```
추가된 13개 월의 총 높이: 6428.00px
새 오프셋: 1897 + 6428 = 8325.00px
```

**AFTER**:
```
scrollOffset: 8325.00px (수동 보정)
visibleRange: 16 ~ 17 (인덱스 +13)
보이는 월: 2025-10, 11 (동일 유지) ✅
```

### 상태
✅ 구현 완료  
⏳ 테스트 대기

---

## 다음 단계

1. ⏳ 실제 디바이스/시뮬레이터에서 테스트
2. ⏳ 다양한 월 높이(4주, 5주, 6주)에서 동작 확인
3. ⏳ 빠른 스크롤 시 안정성 검증
4. ⏳ "번쩍" 현상 최소화 방법 탐색
5. ⏳ 성공 시 UltimateCalendar에도 동일한 방식 적용 고려

---

## 참고 자료

- `client/docs/CALENDARSCREEN_SCROLL_BUG.md` - 상세 분석 및 해결 방안
- `client/src/screens/CalendarScreen.js` - 구현 코드
- `client/src/components/ui/ultimate-calendar/MonthlyView.js` - 참고 구현
- `client/docs/debug.md` - 전체 디버그 로그
