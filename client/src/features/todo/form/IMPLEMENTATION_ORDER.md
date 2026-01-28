# 📋 Todo Quick-Add 구현 순서 계획

## 개요
TECH_SPEC에 정의된 Todo Quick-Add 시스템을 단계별로 구현합니다.  
**의존성 순서**: 하위 컴포넌트 → 상위 컴포넌트 → 레이아웃 → 통합

---

## Phase 1: 공통 UI 컴포넌트 점검 ✅

이미 존재하는 공통 컴포넌트들의 상태를 확인하고 필요시 수정합니다.

| # | 컴포넌트 | 경로 | 상태 |
|:-:|:---|:---|:---:|
| 1.1 | Input | `src/components/ui/Input.js` | ✅ 완료 (multiline 지원 추가됨) |
| 1.2 | Switch | `src/components/ui/Switch.js` | 확인 필요 |
| 1.3 | ListRow | `src/components/ui/ListRow.js` | 확인 필요 |
| 1.4 | Dropdown | `src/components/ui/Dropdown.js` | 확인 필요 |
| 1.5 | DatePicker | `src/components/ui/DatePicker.js` | 확인 필요 |
| 1.6 | TimePicker | `src/components/ui/TimePicker.js` | 존재 여부 확인 |

---

## Phase 2: Form 전용 컴포넌트 (Parts Layer)

TECH_SPEC의 "번줄" 순서대로 구현합니다.

### 2.1 FormHeader.js ⭐ (1번줄)
- **경로**: `src/features/todo/form/components/FormHeader.js`
- **역할**: Quick/Detail 모드 공용 헤더
- **Props**: 
  - `mode`: 'quick' | 'detail' | 'category-add' | 'recurrence-add'
  - `onClose`, `onSave`, `onBack`, `onExpand`
- **의존성**: 없음 (독립 컴포넌트)

### 2.2 DateTimeSection.js (5, 6, 7번줄)
- **경로**: `src/features/todo/form/components/DateTimeSection.js`
- **역할**: 날짜/시간 선택 (mode 기반 다목적)
- **Props 추가 필요**:
  - `showTimeInput`: boolean (하루종일 여부에 따라 시간 숨김)
- **의존성**: ListRow, DatePicker, TimePicker

### 2.3 RecurrenceOptions.js (8번줄)
- **경로**: `src/features/todo/form/components/RecurrenceOptions.js`
- **역할**: 반복 설정 (안 함/매일/매주/매월/매년)
- **하위 컴포넌트**:
  - `recurrence/WeeklySelector.js`
  - `recurrence/MonthlySelector.js`
- **추가 구현 필요**: 반복 종료일 설정 UI
- **의존성**: ListRow, Dropdown, DatePicker

### 2.4 QuickInput.js (Quick Mode 전용)
- **경로**: `src/features/todo/form/components/QuickInput.js`
- **역할**: 빠른 입력창 (채팅 스타일)
- **구성**: Input + 저장버튼 + 하단 버튼들(카테고리/날짜/반복)
- **의존성**: Input

### 2.5 DetailedForm.js (Detail Mode 전용)
- **경로**: `src/features/todo/form/components/DetailedForm.js`
- **역할**: 상세 폼 (ScrollView 기반)
- **의존성**: FormHeader, Input, ListRow, Switch, DateTimeSection, RecurrenceOptions, CategorySelector

---

## Phase 3: 비즈니스 로직 (Logic Layer)

### 3.1 useTodoFormLogic.js
- **경로**: `src/features/todo/form/useTodoFormLogic.js`
- **역할**: 폼 상태 관리 + API 호출
- **핵심 상태**:
  ```javascript
  {
    title: '',
    memo: '',
    categoryId: null,
    isAllDay: true,        // DB 기본값과 일치
    startDate: 'YYYY-MM-DD',
    endDate: 'YYYY-MM-DD',
    startDateTime: null,   // Date 객체 또는 null
    endDateTime: null,
    timeZone: 'Asia/Seoul',
    recurrence: [],        // RRULE 문자열 배열
    recurrenceEndDate: null,
  }
  ```
- **핵심 함수**:
  - `handleSubmit()`: 유효성 검사 + payload 생성 + API 호출
  - `buildPayload()`: isAllDay에 따른 데이터 분기 처리

---

## Phase 4: 레이아웃 (Layout Layer)

### 4.1 NativeLayout.js
- **경로**: `src/features/todo/form/layouts/NativeLayout.js`
- **역할**: iOS/Android용 Bottom Sheet 전략
- **의존성**: @gorhom/bottom-sheet, QuickInput, DetailedForm

### 4.2 WebMobileLayout.js
- **경로**: `src/features/todo/form/layouts/WebMobileLayout.js`
- **역할**: 모바일 웹용 Sticky Footer + Drawer
- **의존성**: QuickInput, DetailedForm

### 4.3 WebDesktopLayout.js
- **경로**: `src/features/todo/form/layouts/WebDesktopLayout.js`
- **역할**: 데스크탑 웹용 Modal
- **의존성**: DetailedForm

---

## Phase 5: 컨테이너 & 통합 (Container Layer)

### 5.1 index.js (TodoFormContainer)
- **경로**: `src/features/todo/form/index.js`
- **역할**: 플랫폼 감지 + 적절한 Layout 렌더링 + Logic 주입

---

## 📌 권장 구현 순서 (체크리스트)

```
[x] Phase 1: 공통 컴포넌트 점검 ✅
    [x] 1.1 Switch 확인 ✅
    [x] 1.2 ListRow 확인 ✅  
    [x] 1.3 Dropdown 확인 ✅
    [x] 1.4 DatePicker 확인 ✅
    [x] 1.5 TimePicker 확인 ✅ (wheel-picker 폴더)

[x] Phase 2: Form 컴포넌트 ✅
    [x] 2.1 FormHeader 구현 ✅
    [x] 2.2 DateTimeSection 수정 ✅ (mode: datetime/time-range)
    [x] 2.3 RecurrenceOptions 수정 ✅ (ListRow UI, 종료일 추가)
    [x] 2.4 QuickInput 구현 ✅ (카테고리/날짜/반복 버튼)
    [x] 2.5 DetailedForm 구현 ✅ (TECH_SPEC 기준 전체 재구성)

[x] Phase 3: 로직 훅 ✅
    [x] 3.1 useTodoFormLogic 구현 ✅ (시간 자동조정, buildPayload, RRULE)

[x] Phase 4: 레이아웃 ✅
    [x] 4.1 NativeLayout 구현 ✅ (Bottom Sheet, Quick/Detail 전환)
    [x] 4.2 WebMobileLayout 구현 ✅ (Sticky Footer + Drawer)
    [x] 4.3 WebDesktopLayout 구현 ✅ (중앙 Modal)

[x] Phase 5: 통합 ✅
    [x] 5.1 index.js 컨테이너 구현 ✅ (플랫폼별 분기)
    [ ] 5.2 실제 화면에서 테스트
```

---

## 🧪 검증 계획

### 수동 테스트 (각 Phase 완료 후)
1. **웹에서 확인**: `npm run web` → 브라우저에서 Todo 추가 화면 열기
2. **iOS/Android 확인**: Expo Go 앱에서 테스트

### 체크포인트
- [ ] Quick Mode에서 제목 입력 후 저장 → DB에 정상 저장 확인
- [ ] 하루종일 ON/OFF 전환 시 시간 필드 숨김/표시
- [ ] 반복 설정 후 저장 → recurrence 배열 확인
- [ ] 카테고리 추가 플로우 → 새 카테고리 생성 후 선택

---

## 다음 단계

**Phase 1.1부터 시작**: Switch 컴포넌트 상태 확인
