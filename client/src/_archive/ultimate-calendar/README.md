# UltimateCalendar Archive

> **Archived Date**: 2026-02-12  
> **Reason**: Replaced by new todo-calendar implementation  
> **Status**: Reference Only (Do Not Use)

## 📋 Overview

UltimateCalendar는 주별 무한 스크롤 캘린더로, Phase 1에서 구현되었으나 다음 이유로 아카이브되었습니다:

1. **복잡한 아키텍처**: 주별 스크롤 + 동적 이벤트 계산이 과도하게 복잡함
2. **성능 이슈**: SQLite/서버 동기화 시 카테고리 색상 동기화 문제
3. **유지보수 어려움**: 6주 패딩 로직과 이벤트 캐싱이 얽혀있음

## 🆕 New Implementation

**새 구현 위치**: `client/src/features/todo-calendar/`

**주요 개선사항**:
- 월별 스크롤 (주별 → 월별)
- 단순화된 데이터 흐름
- 별도 캘린더 전용 캐시 (todoCalendarStore)
- Selector 패턴으로 리렌더링 최적화

**관련 Spec**:
- `.kiro/specs/infinite-scroll-calendar/` - Phase 1: UI 구현
- `.kiro/specs/calendar-data-integration/` - Phase 2: 데이터 연동

## 📂 Archived Files

```
_archive/ultimate-calendar/
├── components/ui/ultimate-calendar/
│   ├── UltimateCalendar.js          # 메인 컴포넌트 (주별 스크롤)
│   ├── WeeklyView.js                # 주별 뷰
│   ├── MonthlyView.js               # 월별 뷰 (미완성)
│   ├── MonthSection.js              # 월 섹션 (6주 그리드)
│   ├── WeekRow.js                   # 주 행
│   ├── CalendarHeader.js            # 헤더 (요일 표시)
│   ├── calendarUtils.js             # 유틸리티 함수
│   ├── constants.js                 # 상수 정의
│   └── day-cells/
│       ├── DayCell.js               # 날짜 셀 (점 표시)
│       └── useDayCell.js            # 날짜 셀 로직
├── hooks/
│   ├── useCalendarDynamicEvents.js  # 동적 이벤트 계산
│   ├── useCalendarEvents.js         # 이벤트 조회
│   └── useCalendarSync.js           # 캘린더 동기화
├── screens/
│   └── CalendarScreen.js            # 캘린더 화면
└── README.md                        # 이 파일
```

## 🔍 Key Reference Points

### 1. 주별 무한 스크롤 구현

**파일**: `components/ui/ultimate-calendar/UltimateCalendar.js`

```javascript
// Virtual Window: 3년치 (156주)
const MAX_WEEKS = 156;

// FlashList로 주별 스크롤
<FlashList
  data={weeks}
  renderItem={({ item }) => <WeekRow week={item} />}
  estimatedItemSize={CELL_HEIGHT}
/>
```

**참고 포인트**:
- Virtual Window 크기 조정 (156주 → 적절한 크기)
- FlashList 최적화 설정
- 양방향 무한 스크롤 구현

---

### 2. 동적 이벤트 계산

**파일**: `hooks/useCalendarDynamicEvents.js`

```javascript
// 보이는 범위 ±buffer 계산
const visibleRange = {
  start: weeks[startIdx].startDate,
  end: weeks[endIdx].endDate,
};

// 범위 내 Todo 필터링
const filteredTodos = todos.filter(todo => 
  isInRange(todo, visibleRange)
);
```

**참고 포인트**:
- 범위 기반 필터링 로직
- 반복 일정 계산 (recurrenceUtils)
- 캐시 전략 (range: 12주, maxCacheSize: 60주)

---

### 3. 6주 패딩 처리

**파일**: `components/ui/ultimate-calendar/calendarUtils.js`

```javascript
// 월의 첫 날이 속한 주의 일요일부터 시작
const firstDayOfWeek = firstDayOfMonth.day(0);

// 6주 고정 (42일)
for (let i = 0; i < 42; i++) {
  days.push(firstDayOfWeek.add(i, 'day'));
}
```

**참고 포인트**:
- 6주 고정 레이아웃 계산
- 이전/다음 월 날짜 포함
- startDayOfWeek 설정 (일요일/월요일 시작)

---

### 4. 카테고리 색상 동기화 이슈

**문제**: SQLite와 서버 간 카테고리 색상 불일치

**원인**:
1. 클라이언트에서 카테고리 생성 시 임시 색상 사용
2. 서버 동기화 후 색상 변경
3. 캘린더 캐시가 이전 색상 유지

**해결 방안** (새 구현에 반영):
- 별도 캘린더 캐시 사용 (todoCalendarStore)
- Sync 완료 시 캘린더 캐시 전체 클리어
- Category CRUD 시 인접 월 캐시 무효화

---

## 🚫 Do Not Use

이 코드는 **참고용**으로만 사용하세요. 다음 이유로 프로덕션에서 사용하지 마세요:

1. ❌ **동기화 이슈**: 카테고리 색상 동기화 문제 미해결
2. ❌ **복잡도**: 주별 스크롤 + 동적 이벤트 계산이 과도하게 복잡
3. ❌ **유지보수**: 6주 패딩 로직과 이벤트 캐싱이 얽혀있음
4. ❌ **성능**: 대량 데이터 시 성능 저하 가능성

## 📚 Migration Guide

UltimateCalendar → todo-calendar 마이그레이션 시 참고:

### 1. 스크롤 방식 변경

```diff
- 주별 스크롤 (WeekRow 단위)
+ 월별 스크롤 (MonthSection 단위)

- Virtual Window: 156주
+ Virtual Window: 25개월 (±12개월)
```

### 2. 데이터 조회 방식 변경

```diff
- useCalendarDynamicEvents (범위 기반 필터링)
+ useTodoCalendarData (월별 Batch Fetch)

- 보이는 범위 ±12주 조회
+ 보이는 월 ±2개월 조회
```

### 3. 캐시 전략 변경

```diff
- 단일 캐시 (todos 캐시 재사용)
+ 별도 캐시 (todoCalendarStore)

- 범위 기반 캐싱 (startDate ~ endDate)
+ 월별 캐싱 (monthId: 'YYYY-MM')
```

### 4. 컴포넌트 구조 변경

```diff
- UltimateCalendar
-   └── WeekRow × N
-       └── DayCell × 7

+ CalendarList
+   └── MonthSection × N
+       └── WeekRow × 6
+           └── DayCell × 7
```

---

## 🔗 Related Documentation

- [CALENDAR_ARCHITECTURE_ANALYSIS.md](../../../docs/CALENDAR_ARCHITECTURE_ANALYSIS.md) - 아키텍처 분석
- [INFINITE_SCROLL_CALENDAR_FINAL_CHECKPOINT.md](../../../docs/INFINITE_SCROLL_CALENDAR_FINAL_CHECKPOINT.md) - Phase 1 완료 체크포인트
- [CALENDAR_PERFORMANCE_GUIDE.md](../../../docs/CALENDAR_PERFORMANCE_GUIDE.md) - 성능 가이드

---

## 📝 Notes

- 이 코드는 2026-02-06에 TodoScreen에서 비활성화되었습니다
- 새 구현은 `.kiro/specs/calendar-data-integration/`를 참고하세요
- 질문이 있으면 README.md의 "Key Architecture Patterns" 섹션을 확인하세요

---

**Last Updated**: 2026-02-12  
**Archived By**: Kiro AI
