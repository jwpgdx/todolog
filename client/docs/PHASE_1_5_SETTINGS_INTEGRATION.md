# Phase 1.5: Settings Integration (시작 요일 & 언어)

**작성일:** 2026-02-11  
**상태:** Completed ✅  
**소요 시간:** 2시간

---

## Overview

Phase 1 (무한 스크롤 캘린더)과 Phase 2 (데이터 연동) 사이의 중간 단계로, 사용자 설정(시작 요일, 언어)을 캘린더 UI에 즉시 반영하는 기능을 구현했습니다.

---

## 구현 내용

### 1. calendarHelpers.js 확장

**추가된 함수:**

```javascript
// 언어별 요일 이름 배열 반환 (시작 요일 회전 지원)
getWeekdayNames(language, startDayOfWeek)
// 예: getWeekdayNames('ko', 1) → ['월', '화', '수', '목', '금', '토', '일']

// 언어별 월 타이틀 포맷
formatMonthTitle(year, month, language)
// 예: formatMonthTitle(2026, 2, 'en') → 'Feb 2026'

// generateWeeks에 startDayOfWeek 파라미터 추가
generateWeeks(year, month, startDayOfWeek)
// 0: 일요일 시작, 1: 월요일 시작
```

**시작 요일 계산 로직:**

```javascript
// 월요일 시작 시
const dayOfWeek = firstDay.day(); // 0 (Sun) ~ 6 (Sat)
const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
startDay = firstDay.subtract(daysToSubtract, 'day');
```

---

### 2. CalendarList.js - authStore 통합

**authStore 구독 (Selector 패턴):**

```javascript
// 필요한 설정값만 구독 (불필요한 재렌더링 방지)
const startDayOfWeek = useAuthStore(state => 
  state.user?.settings?.startDayOfWeek === 'monday' ? 1 : 0
);
const language = useAuthStore(state => 
  state.user?.settings?.language || 'ko'
);
```

**동적 요일 헤더:**

```javascript
const weekdayNames = useMemo(() => {
  return getWeekdayNames(language, startDayOfWeek);
}, [language, startDayOfWeek]);

// 렌더링
{weekdayNames.map((name, index) => (
  <Text key={index}>{name}</Text>
))}
```

**언어별 월 타이틀:**

```javascript
const currentMonthTitle = useMemo(() => {
  if (!currentMonth) return '';
  return formatMonthTitle(currentMonth.year, currentMonth.month, language);
}, [currentMonth, language]);
```

---

### 3. MonthSection.js - Props 전달

```javascript
function MonthSection({ monthMetadata, startDayOfWeek = 0, language = 'ko' }) {
  const weeks = useMemo(() => {
    return generateWeeks(monthMetadata.year, monthMetadata.month, startDayOfWeek);
  }, [monthMetadata.year, monthMetadata.month, startDayOfWeek]);

  const monthTitle = useMemo(() => {
    return formatMonthTitle(monthMetadata.year, monthMetadata.month, language);
  }, [monthMetadata.year, monthMetadata.month, language]);
  
  // ...
}
```

---

### 4. 무한 루프 버그 수정

**문제:**
- MainTabs에 `CalendarTest` 탭이 등록되어 있어 TodoCalendarScreen이 항상 백그라운드에 마운트됨
- SettingsScreen으로 이동 시 authStore 구독 중인 CalendarList가 계속 리렌더링
- `extraData={{ startDayOfWeek, language }}` prop이 매 렌더링마다 새 객체 생성 → 무한 루프

**해결:**
1. MainTabs에서 `CalendarTest` 탭 제거
2. `extraData` prop 제거 (renderMonth의 의존성 배열만으로 충분)

---

## 주요 특징

### ✅ Offline-First
- authStore 기반 (useSettings 대신)
- 설정 변경 시 즉시 UI 반영 (Zustand 구독)

### ✅ 6주 고정 레이아웃 유지
- 어떤 시작 요일이든 6주 레이아웃 유지
- FlashList estimatedItemSize 정확도 100%

### ✅ 성능 최적화
- Zustand Selector 패턴 (필요한 값만 구독)
- useMemo로 weekdayNames, monthTitle 캐싱
- React.memo로 컴포넌트 최적화

### ✅ 다국어 지원
- 한국어 (ko): "2026년 2월", "일~토"
- 영어 (en): "Feb 2026", "Sun~Sat"
- 일본어 (ja): "2026年2月", "日~土"

---

## 테스트 결과

### Test 1: 시작 요일 변경
1. SettingsScreen → "시작 요일" → "월요일" 선택
2. CalendarScreen 확인
3. ✅ 요일 헤더가 "월~일"로 즉시 변경
4. ✅ 각 월의 첫 주가 월요일부터 시작

### Test 2: 언어 변경
1. SettingsScreen → "언어" → "English" 선택
2. CalendarScreen 확인
3. ✅ 요일 헤더가 "Mon~Sun"으로 즉시 변경
4. ✅ 월 타이틀이 "Feb 2026"으로 즉시 변경

### Test 3: 무한 루프 해결
1. CalendarScreen 진입
2. SettingsScreen으로 이동
3. ✅ 백그라운드에서 months 추가 안됨
4. ✅ 메모리 제한 메시지 안뜸

---

## 파일 변경 내역

### 수정된 파일
- `client/src/features/todo-calendar/utils/calendarHelpers.js`
  - `getWeekdayNames()` 추가
  - `formatMonthTitle()` 추가
  - `generateWeeks()` startDayOfWeek 파라미터 추가

- `client/src/features/todo-calendar/ui/CalendarList.js`
  - authStore 구독 추가
  - 동적 요일 헤더 생성
  - 언어별 월 타이틀 표시
  - extraData prop 제거

- `client/src/features/todo-calendar/ui/MonthSection.js`
  - startDayOfWeek, language props 추가
  - 언어별 월 타이틀 적용

- `client/src/navigation/MainTabs.js`
  - CalendarTest 탭 제거

- `client/src/features/todo-calendar/ui/DayCell.js`
  - 다른 달 날짜 숨김 처리

---

## 다음 단계 (Phase 2)

Phase 1.5 완료로 캘린더 뼈대(Grid)가 사용자 설정에 맞게 동작합니다. 이제 Phase 2에서 SQLite 데이터를 연동할 준비가 되었습니다:

1. SQLite에서 Todo 데이터 조회
2. 날짜별 완료 표시 (점/체크마크)
3. 날짜 클릭 이벤트
4. 오늘 날짜 시각적 하이라이트

---

**작성자:** Kiro AI Assistant  
**완료일:** 2026-02-11
