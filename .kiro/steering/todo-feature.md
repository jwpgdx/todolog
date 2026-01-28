# Todo 기능 명세서

## 1. 📱 화면 구성

### TodoScreen (할일 목록)
- **역할**: 선택된 날짜의 할일 목록 표시
- **주요 기능**:
  - [x] 주간/월간 캘린더 (일정 유무 점 표시)
  - [x] 날짜별 할일 목록 조회
  - [x] 할일 완료/미완료 토글
  - [x] 완료된 할일 자동으로 아래 정렬
  - [x] + 버튼으로 할일 추가 화면 이동 (Bottom Sheet)
  - [x] ... 버튼으로 수정/삭제 (Bottom Sheet)

### AddTodoScreen (할일 등록)
- **역할**: 새로운 할일 등록
- **입력 항목**:
  - [x] 제목 (필수)
  - [x] 할일 타입 선택 (필수: Todo/Routine)
  - [x] 날짜 선택 (type="todo"일 때)
    - 시작 날짜만: 단일 날짜
    - 시작+종료 날짜: 기간 설정
  - [x] 루틴 설정 (type="routine"일 때 필수)
    - 반복 주기: 매일/매주/매월/매년
    - 요일 선택 (매주일 때)
    - 시작/종료 날짜
  - [x] 카테고리 선택 (인라인 슬라이드 UI)
  - [x] 시간 선택 (선택)
  - [x] 메모 (선택)
- **액션**:
  - [x] 저장 버튼
  - [x] 취소 버튼

### EditTodoScreen (할일 수정) ⭐ 개선됨 (2024-12-12)
- **역할**: 기존 할일 수정
- **기능**: 
  - **todo 타입**: 제목, 날짜, 시간, 메모, 카테고리 수정 가능
  - **routine 타입**: 제목, 시간, 메모, 카테고리만 수정 가능 (타입/루틴 변경 불가)
- **유효성 검사**: todo 타입 시작날짜 필수, 종료일 ≥ 시작일
- **액션**: 저장, 삭제

### ManageTodosScreen (일정 관리) ⭐ 개선됨 (2024-12-12)
- **역할**: 모든 할일 관리
- **주요 기능**:
  - [x] 루틴/특정날짜 섹션별 표시
  - [x] ... 버튼으로 수정/삭제/순서변경 (Bottom Sheet)
  - [x] **관리 모드**: 우상단 "관리" 버튼으로 일괄 관리 모드 전환
  - [x] **체크박스 선택**: 관리 모드에서 할일 다중 선택
  - [x] **전체 선택/해제**: 모든 할일 한번에 선택/해제
  - [x] **일괄 삭제**: 선택된 할일들 한번에 삭제 (구글 캘린더 포함)
  - [x] **드래그 비활성화**: 관리 모드에서 순서 변경 비활성화

### ProfileScreen (내 정보)
- **역할**: 사용자 정보 및 설정
- **주요 기능**:
  - [x] 이메일 표시
  - [x] 일정 관리 페이지 이동
  - [x] 로그아웃

---

## 2. 🗂️ 데이터 구조

### Todo 객체 (할일)
```javascript
{
  _id: "string",           // MongoDB ID
  userId: "string",        // 작성자 ID
  title: "string",         // 할일 제목 (필수)
  time: "14:30",           // 시간 (HH:mm, 선택)
  memo: "string",          // 메모 (선택)
  priority: "normal",      // 우선순위: "low" | "normal" | "high"
  
  // 할일 타입 (필수)
  type: "todo" | "routine",
  
  categoryId: "string",    // 카테고리 ID (선택)
  
  // type="todo"일 때 (특정 날짜)
  date: "2024-11-24",      // 시작 날짜 (YYYY-MM-DD)
  endDate: "2024-11-30",   // 종료 날짜 (선택, 기간 설정 시)
  
  // type="routine"일 때 (반복 일정)
  routine: {
    frequency: "daily" | "weekly" | "monthly" | "yearly",
    weekdays: [1, 3, 5],   // 요일 (0=일, 1=월, ..., 6=토) - weekly일 때
    dayOfMonth: 1,         // 매월 몇일 - monthly일 때
    month: 5,              // 월 (1-12) - yearly일 때
    day: 15,               // 일 (1-31) - yearly일 때
    startDate: "2024-11-01", // 시작 날짜 (필수)
    endDate: "2024-12-31"  // 종료 날짜 (선택)
  },
  
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### Completion 객체 (완료 기록)
```javascript
{
  _id: "string",           // MongoDB ID
  todoId: "string",        // 참조하는 Todo ID
  userId: "string",        // 작성자 ID
  date: "2024-11-24",      // 완료한 날짜 (YYYY-MM-DD, 기간 할일은 null)
  completedAt: "timestamp" // 완료 시각
}
```

- 완료/미완료 할일은 자동으로 분리되어 표시됨 (미완료 → 완료 순서)

### Category 객체 (카테고리)
```javascript
{
  _id: "string",           // MongoDB ID
  userId: "string",        // 작성자 ID
  name: "string",          // 카테고리명
  color: "string",         // 카테고리 색상 (Hex)
  isDefault: boolean,      // 기본 카테고리 여부
  order: number,           // 정렬 순서 (Double/Average 방식)
  createdAt: "timestamp",
  updatedAt: "timestamp"
}
```

### 할일 타입 설명



**1. Todo (특정 날짜 할일)**
- 특정 날짜에만 표시
- 단일 날짜 또는 **기간 설정 가능** (endDate 추가)
- 예: "2024-11-24에 병원 가기", "2024-11-28 ~ 2024-11-30 여행"

**2. Routine (루틴 할일)**
- 반복되는 일정
- 매일, 매주, 매월, 매년 설정 가능
- 예: "매일 아침 운동", "매주 월수금 영어 공부"

### 루틴 예시

```javascript
// 매일 반복
{
  type: "routine",
  routine: {
    frequency: "daily",
    startDate: "2024-11-01",
    endDate: "2024-12-31" // 선택
  }
}

// 매주 월수금 반복
{
  type: "routine",
  routine: {
    frequency: "weekly",
    weekdays: [1, 3, 5], // 월, 수, 금
    startDate: "2024-11-01"
  }
}

// 매월 1일 반복
{
  type: "routine",
  routine: {
    frequency: "monthly",
    dayOfMonth: 1,
    startDate: "2024-11-01"
  }
}

// 매년 생일 (5월 15일)
{
  type: "routine",
  routine: {
    frequency: "yearly",
    month: 5,
    day: 15,
    startDate: "2024-05-15"
  }
}
```

**장점:**
- 유연한 할일 관리 (상시/특정날짜/반복)
- 날짜별 완료 이력 추적
- 통계 분석 용이 (완료율, 연속 달성일)

---

## 3. 🔌 API 엔드포인트

### 할일 조회 (날짜별)
```
GET /api/todos?date=2024-11-24
Response: [
  { 
    _id: "todo123",
    title: "운동하기",
    type: "routine",
    time: "07:00",
    memo: "30분 조깅",
    routine: { frequency: "daily", startDate: "2024-11-01" },
    order: 0,
    completed: true  // Completion 컬렉션 조인 결과
  },
// 서버 로직:
// 1. type="todo" → date가 요청 날짜와 일치하거나 date~endDate 범위 내
// 2. type="routine" → 루틴 규칙에 따라 해당 날짜에 포함되는지 계산
// 3. 완료/미완료 분리: 미완료 → 완료 순서로 표시
```

### 전체 할일 조회 (일정관리용)
```
GET /api/todos/all
Response: [모든 할일 목록, order 순서로 정렬]
```



### 할일 생성
```
POST /api/todos
Body: { 
  title: "운동하기",
  type: "routine",
  time: "07:00",
  memo: "30분 조깅",
  priority: "normal",
  routine: {
    frequency: "weekly",
    weekdays: [1, 3, 5],
    startDate: "2024-11-01"
  }
}
Response: { _id, title, type, ... }
```

### 할일 수정
```
PUT /api/todos/:id
Body: { title?, type?, date?, routine?, time?, memo?, priority? }
Response: { _id, title, ... }
```

### 할일 삭제
```
DELETE /api/todos/:id
Response: { message: "삭제 완료" }
```

### 일괄 삭제 ⭐ 신규 (2024-12-12)
```
POST /api/todos/bulk-delete
Body: { todoIds: ["id1", "id2", "id3"] } // 삭제할 할일 ID 배열
Response: { 
  message: "3개의 할일이 삭제되었습니다",
  deletedCount: 3 
}
```

---

### 완료 기록 생성 (완료 체크)
```
POST /api/completions
Body: { 
  todoId: "todo123",
  date: "2024-11-24"
}
Response: { _id, todoId, date, completedAt }
```

### 완료 기록 삭제 (완료 취소)
```
DELETE /api/completions/:todoId?date=2024-11-24
Response: { message: "완료 취소됨" }
```

### 완료 기록 조회 (통계용)
```
GET /api/completions?startDate=2024-11-01&endDate=2024-11-30
Response: [
  { todoId: "todo123", date: "2024-11-24", completedAt: "..." }
]
```

---

## 4. 🎨 UI/UX 가이드

### TodoScreen
- 할일 없을 때: "할일이 없습니다" 메시지 표시
- 완료된 할일: 회색 + 취소선
- + 버튼: 우측 하단 고정 (Floating Action Button)

### AddTodoScreen / EditTodoScreen
- 모달 또는 풀스크린 화면
- 날짜/시간 선택: React Native DateTimePicker 사용
- 우선순위: 버튼 그룹 (낮음/보통/높음)

---

## 5. 📦 필요한 컴포넌트

### src/components/domain/todo/
- [x] `TodoList.js` - 할일 목록 렌더링 (완료/미완료 분리, 시간순 정렬)
- [x] `TodoItem.js` - 개별 할일 카드 (Bottom Sheet 메뉴)
- [x] `WeeklyCalendar.js` - 주간/월간 캘린더 (일정 유무 표시)

### src/components/ui/
- [x] `FloatingButton.js` - + 버튼 (재사용 가능)
- [x] `DateInput.js` - 날짜 선택 래퍼
- [x] `Input.js` - 텍스트 입력 컴포넌트
- [x] `Button.js` - 버튼 컴포넌트
- [x] `TypeSelector.js` - 할일 타입 선택
- [x] `FrequencySelector.js` - 루틴 반복 주기 선택
- [x] `WeekdaySelector.js` - 요일 선택

---

## 6. 🪝 필요한 Hooks

### src/hooks/queries/
- [x] `useTodos.js` - 날짜별 할일 목록 조회 (TanStack Query)
- [x] `useAllTodos.js` - 전체 할일 조회 (일정관리용)
- [x] `useCreateTodo.js` - 할일 생성 Mutation
- [x] `useUpdateTodo.js` - 할일 수정 Mutation
- [x] `useDeleteTodo.js` - 할일 삭제 Mutation
- [x] `useBulkDeleteTodos.js` - 일괄 삭제 Mutation ⭐ 신규 (2024-12-12)
- [x] `useToggleCompletion.js` - 완료/취소 토글 Mutation
- [x] `useCalendarSummary.js` - 월별 일정 유무 조회
- [x] `useRetryCalendarSync.js` - 캘린더 동기화 재시도 Mutation ⭐ 신규 (2024-12-12)

---

## 7. ✅ 개발 순서

1. [x] 백엔드 API 구현 (server/routes, controllers, models)
2. [x] Todo 데이터 구조 확정 (order, endDate 필드 추가)
3. [x] TanStack Query Hooks 작성
4. [x] UI 컴포넌트 작성 (TodoItem, FloatingButton...)
5. [x] AddTodoScreen 구현
6. [x] TodoScreen에 목록 표시 + CRUD 연동
7. [x] EditTodoScreen 구현
8. [x] ManageTodosScreen 구현 (순서 변경)
9. [x] 완료/미완료 자동 정렬
10. [x] 캘린더 일정 유무 표시
11. [x] 테스트 및 버그 수정

---

## 8. ✅ 구현 완료된 기능

### 기본 기능
- [x] 할일 CRUD (생성, 조회, 수정, 삭제)
- [x] 두 가지 타입 지원 (todo, routine)
- [x] 완료/미완료 토글
- [x] 날짜별 할일 조회
- [x] 주간/월간 캘린더 뷰



### 특정날짜 할일
- [x] 단일 날짜 설정
- [x] 기간 설정 (시작~종료 날짜)
- [x] 시간순 자동 정렬
- [x] 날짜 수정 가능 (EditTodoScreen) ⭐ 신규 (2024-12-12)

### 루틴 할일
- [x] 매일/매주/매월/매년 반복
- [x] 요일 선택 (매주)
- [x] 시작/종료 날짜 설정

### UI/UX
- [x] 완료된 할일 아래로 자동 정렬
- [x] 일정관리 페이지 (ManageTodosScreen)
- [x] Bottom Sheet 메뉴 (수정/삭제/순서변경)
- [x] 캘린더에 일정 유무 표시 (점)

### 입력 유효성 검사 ⭐ 신규 (2024-12-12)
- [x] todo/routine 타입 시작날짜 필수 체크
- [x] 종료날짜 ≥ 시작날짜 검증
- [x] 필수 날짜 지우기 방지 (allowClear prop)
- [x] 타입별 맞춤 입력 UI

### 구글 캘린더 연동 ⭐ 신규 (2024-12-12)
- [x] 구글 로그인 및 캘린더 권한 요청
- [x] TODOLOG 전용 캘린더 자동 생성
- [x] todo 타입 할일 자동 동기화
- [x] 할일 수정/삭제 시 캘린더 이벤트 업데이트
- [x] 동기화 실패 시 재시도 기능
- [x] 단방향 동기화 (앱 → 구글 캘린더)

### 일괄 관리 기능 ⭐ 신규 (2024-12-12)
- [x] 관리 모드 토글 (일정관리 화면)
- [x] 체크박스 선택 UI
- [x] 전체 선택/해제 기능
- [x] 일괄 삭제 기능
- [x] 구글 캘린더 이벤트 일괄 삭제
- [x] 관리 모드에서 드래그 비활성화

---

## 9. 📱 Bottom Sheet 시스템 (2024-12-12 완료)

### 🎯 구현된 기능

#### **1. 통합된 AddTodo 시스템**
- ❌ **기존**: AddTodoScreen (전체 화면) + AddTodoBottomSheet (Bottom Sheet) 중복
- ✅ **개선**: AddTodoBottomSheet로 완전 통합
- ✅ **네비게이션 정리**: AddTodo 라우트 제거, 모든 곳에서 Bottom Sheet 사용

#### **2. 고급 Bottom Sheet 컴포넌트**
```javascript
// client/src/components/ui/BottomSheet.js
- 95% 높이 고정 (상단 5% 여백)
- 웹/모바일 플랫폼별 최적화
- 드래그 제스처 지원 (모바일: 전체 영역, 웹: 헤더만)
- 200ms 빠른 애니메이션
- useNativeDriver 플랫폼별 분기 (웹: false, 모바일: true)
- 자연스러운 UX (배경 효과 없이 단순함)
```

#### **3. 적용된 화면들**
```javascript
// TodoScreen - 메인 할일 목록
<View>
  <Content />
  <AddTodoBottomSheet visible={show} onClose={close} />
</View>

// ManageTodosScreen - 일정 관리
<View>
  <Content />
  <AddTodoBottomSheet visible={show} onClose={close} />
</View>
```

### 🎨 사용자 경험 개선

#### **Before (전체 화면 전환)**
```
할일 목록 → 네비게이션 → AddTodoScreen → 뒤로가기
```

#### **After (Bottom Sheet)**
```
할일 목록 → + 버튼 → Bottom Sheet 올라옴 → 드래그/배경 터치로 닫기
```

#### **자연스러운 동작**
- **단순함**: 복잡한 배경 효과 없이 깔끔한 Bottom Sheet
- **빠른 접근**: 화면 전환 없이 바로 할일 추가
- **직관적 닫기**: 드래그 또는 배경 터치로 닫기
- **부드러운 애니메이션**: 200ms 빠른 전환

### 🔧 기술적 특징

#### **플랫폼별 최적화**
- **웹**: 헤더 드래그만, useNativeDriver: false
- **모바일**: 전체 영역 드래그, useNativeDriver: true

#### **단순한 구조**
- **Provider 없음**: 복잡한 Context 제거
- **직접 사용**: 각 화면에서 직접 Bottom Sheet 사용
- **성능 최적화**: 불필요한 애니메이션 연산 제거

### 📁 파일 구조
```
client/src/
├── components/ui/
│   └── BottomSheet.js              # 고급 Bottom Sheet 컴포넌트
├── components/domain/todo/
│   └── AddTodoBottomSheet.js       # 통합된 할일 추가 폼
├── screens/
│   ├── TodoScreen.js               # 단순한 메인 화면
│   └── ManageTodosScreen.js        # 단순한 관리 화면
└── navigation/
    └── MainStack.js                # AddTodo 라우트 제거됨
```

---

## 10. 🚀 추후 확장 기능 (Optional)

- [ ] 할일 검색 기능
- [x] 카테고리/태그 추가 ✅ 완료 (2024-12-14)
- [ ] 알림 설정 (expo-notifications)
- [ ] 할일 통계 (완료율, 히트맵)
- [x] 구글/애플 소셜 로그인 ✅ 완료 (2024-12-12)
- [x] 구글 캘린더 자동 동기화 ✅ 완료 (2024-12-12)
- [x] 일괄 삭제 기능 ✅ 완료 (2024-12-12)
- [x] Bottom Sheet 시스템 ✅ 완료 (2024-12-12)

---

## 11. 📋 최근 업데이트 (2024-12-12)

### Bottom Sheet 시스템 구현 완료
- **통합**: AddTodoScreen 제거, AddTodoBottomSheet로 완전 통합
- **단순화**: 복잡한 배경 효과 제거, 자연스러운 Bottom Sheet만 유지
- **플랫폼 최적화**: 웹/모바일 각각 최적화된 드래그 동작
- **성능**: 200ms 빠른 애니메이션, useNativeDriver 분기 처리
- **UX**: 깔끔하고 직관적인 사용자 경험

### 일괄 삭제 기능 구현 완료
- **클라이언트**: `useBulkDeleteTodos` Hook 추가
- **서버**: `bulkDeleteTodos` 컨트롤러 함수 추가
- **API**: `POST /api/todos/bulk-delete` 엔드포인트 추가
- **UI**: ManageTodosScreen에 관리 모드 및 체크박스 선택 기능
- **동기화**: 구글 캘린더 이벤트도 함께 삭제
- **에러 처리**: 캘린더 삭제 실패해도 할일은 정상 삭제

### 주요 특징
1. **관리 모드**: 우상단 "관리" 버튼으로 ON/OFF
2. **체크박스 UI**: 관리 모드에서 각 할일 앞에 체크박스 표시
3. **전체 선택**: "전체 선택/해제" 버튼으로 모든 할일 토글
4. **일괄 삭제**: 선택된 할일들을 한번에 삭제
5. **구글 캘린더 연동**: 캘린더 이벤트도 함께 삭제
6. **드래그 비활성화**: 관리 모드에서는 순서 변경 비활성화
7. **단순한 구조**: 복잡한 Context 없이 직접 Bottom Sheet 사용으로 깔끔한 코드

- **인라인 슬라이드**: 카테고리 선택 시 별도의 Bottom Sheet가 뜨지 않고, 현재 시트 내에서 화면이 전환됨
- **네비게이션 헤더**: "할일 추가" <-> "카테고리" 간 헤더 타이틀 및 뒤로가기 버튼 전환
- **UX**: 중첩된 시트로 인한 복잡성 제거, 자연스러운 단계별 입력 경험 제공

### 카테고리 시스템 대규모 개편 (2024-12-14)
- **카테고리 생성 통합**: '할일 추가' 화면과 '관리' 화면에서 동일한 모달(CategoryModal)을 사용하여 일관된 경험 제공 (Google Calendar 색상 팔레트 적용)
- **직관적 관리 UI**: 인라인 입력 폼 대신 FAB(Floating Action Button)와 모달을 사용하여 모바일에 최적화된 UX 구현
- **드래그 앤 드롭 정렬 (Cross-Platform)**:
    - **Native**: Uses `react-native-draggable-flatlist`.
    - **Web**: Uses `@dnd-kit`.
        - **Empty Category Handling**: implemented via **Sortable Headers**. Headers are rendered as `SortableItem`s but without drag listeners. This allows them to shift and create "insertion slots" when dragging items over them, serving as natural drop targets without visual spacers.을 사용하여 웹 표준 드래그 앤 드롭 지원
  - **Double 정렬 알고리즘**: `(prev + next) / 2` 방식으로 빈번한 DB 업데이트 없이 효율적인 순서 변경

### 성능 및 지속성 개선 (2024-12-14)
- **클라이언트 저장소 활용**: '마지막 사용 카테고리', '마지막 사용 타입', '섹션 접힘 상태' 등 개인화 설정을 서버 DB가 아닌 `AsyncStorage` 로컬 저장소로 이관하여 서버 부하 감소 및 반응성 향상
- **Someday(언젠가) 제거**: 사용성이 낮은 '언젠가' 타입을 제거하고, UI 및 서버 로직을 경량화

### 할일 순서 변경 (카테고리 내) 구현 (2024-12-14)
- **자유로운 순서 변경**: 메인 화면에서 할일을 드래그하여 카테고리 내 순서를 변경하거나, 다른 카테고리로 이동시키는 기능 구현
- **Native**: 롱프레스 제스처로 자연스러운 드래그 지원 (`DraggableFlatList`)
- **Web**: '순서 변경' 토글 버튼을 통해 드래그 핸들 활성화/비활성화 (오작동 방지)
- **낙관적 업데이트**: 순서 변경 시 화면에 즉시 반영되어 빠른 반응성 제공
- **안전한 저장**: 서버 저장 로직 강화(`dot notation` 및 `safe params`)로 데이터 무결성 보장
- **웹 스크롤 개선**: 드래그 리스트 및 완료된 항목이 전체 페이지 스크롤에 포함되도록 구조 개선 (`WebTodoList` + `ScrollView`)
