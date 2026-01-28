# 📑 개발 명세서: 크로스 플랫폼 Todo Quick-Add 시스템

## 1. 프로젝트 개요 (Overview)

본 프로젝트는 **React Native (Expo)** 기반의 크로스 플랫폼(iOS, Android, Web) 투두 리스트 앱입니다.
핵심 목표는 **Todoist 스타일의 "Quick-Add" UX**를 구현하는 것입니다. 사용자가 할 일을 입력할 때, 단순한 채팅창 형태(Quick Mode)에서 시작하여 필요시 상세 설정 폼(Detail Mode)으로 자연스럽게 확장되는 경험을 제공해야 합니다.

---

## 2. 아키텍처 설계 (Architecture Pattern)

유지보수성과 플랫폼별 최적화를 위해 **Container-Presenter 패턴**을 확장한 **[Logic - Container - Layout - Parts]** 4계층 구조를 채택합니다.

### 📂 구조 및 역할 정의

1. **Logic Layer (Brain)**
* **역할:** UI와 완전히 분리된 순수 비즈니스 로직.
* **책임:** 폼 상태 관리(Title, Date, Category 등), 유효성 검사, API 호출(Create/Update 분기), 초기 데이터 주입.
* **산출물:** `useTodoFormLogic` (Custom Hook).


2. **Container Layer (Router)**
* **역할:** 진입점 및 플랫폼 분기 처리.
* **책임:** 현재 실행 환경(Native vs Web Mobile vs Web Desktop)을 감지하여 적절한 **Layout**을 호출하고, **Logic**을 주입(DI)함.
* **산출물:** `index.js` (TodoFormContainer).


3. **Layout Layer (Shell)**
* **역할:** 플랫폼별 UX 전략을 구현하는 껍데기.
* **책임:**
* **Native:** Bottom Sheet 제스처 및 애니메이션 처리.
* **Web:** Sticky Footer 및 Drawer/Modal 처리.


* **특징:** Logic으로부터 데이터와 핸들러를 주입받아 하위 Component에 전달함.


4. **Component Layer (Parts)**
* **역할:** 재사용 가능한 UI 부품.
* **산출물:** `QuickInput`(빠른 입력창), `DetailedForm`(상세 스크롤 영역) 등.



---

## 3. 플랫폼별 상세 구현 전략 (Implementation Strategy)

플랫폼마다 입력 방식(키보드, 마우스)과 화면 제약이 다르므로, 아래와 같이 이원화된 전략을 사용합니다.



내가 알아서 설명달은거.

* **Quick mode:**
오늘 날짜로 간편하게 입력할 수 있도록 기본값 설정. 초기설정 오늘날짜, '하루종일' 설정. 
아래부터는 quick mode에 들어가는 순서대로 작성하겠음. 각각 순서를 몇번째 줄로 인식하면됨.
1. 헤더는 components/FormHeader.js 사용
    - 헤더에 맨 왼쪽 x 버튼 , 맨 오른쪽 위로 화살표 <- detail mode 전환 가능,
2. input <- flex:1, 맨오른쪽에는 저장 버튼, 
    - 공통 컴포넌트인 components/input.js 사용 
    - input placeholder은 '제목'으로 설정.
3. 선택된 카테고리 버튼, 날짜 선택 버튼, 반복 선택 버튼 
    - 세개는 gap:12px로 띄워놓음.
    - 카테고리 클릭시엔 카테고리 선택 components/dropdown은 위로 뜨게 카테고리 추가 클릭하면 detail mode의 카테고리 추가 컴포넌트 나오게 한다.
    - 날짜 선택 버튼 <- 오늘로 설정되어있고, 클릭시에 detail mode로 전환되면서 오늘 날짜 캘린더 클릭해서 열어놓은 상태.
    - 반복 선택 버튼 <- 클릭시에 detail mode로 전환되면서 반복 선택 components/dropdown이 열림.
**제스처:** 사용자가 Quick 입력창을 잡고 위로 당기면(Swipe Up) 자연스럽게 Detail Mode로 전환됨.

* **Detail mode:**
detail mode에 들어가는 순서대로 작성하겠음. 각각 순서를 몇번째 줄로 인식하면됨.
1번줄. 헤더는 components/FormHeader.js 사용
    - 기본 상태: 맨 왼쪽 x 버튼, 가운데 이벤트 추가 텍스트, 맨 오른쪽 저장 버튼
    - 카테고리 추가 상태: 맨 왼쪽 뒤로 버튼, 가운데 카테고리 추가 텍스트, 맨 오른쪽 추가 버튼, 
    - 반복 추가 상태: 맨 왼쪽 뒤로 버튼, 가운데 반복 추가 텍스트, 

2번줄. 제목 입력 컴포넌트는 components/input.js 사용 
3번줄. 카테고리 
    - components/listRow 사용
    - 맨 오른쪽 선택된 카테고리를 보여주고 클릭하면 카테고리 선택 components/dropdown이 아래로 뜨게.
    - 카테고리 추가 클릭하면 detail mode의 화면은 카테고리 추가 화면으로 전환된다.
    - 카테고리 추가 화면은 my 페이지에서 카테고리 설정 -> 카테고리 추가시에 사용되는 src/components/domain/category/CategoryForm.js을 공통으로 사용한다.
    - 카테고리 추가 화면에서 추가 버튼을 클릭하면 detail mode의 화면은 기본 화면으로 전환되고 선택된 카테고리를 해당 카테고리로 한다.
    - 카테고리 추가 화면에서 뒤로 버튼을 클릭하면 detail mode의 화면은 기본 화면으로 전환된다.

4번줄. 하루종일 (All Day)

* **UI 컴포넌트**: `components/listRow` 사용
* **Title**: 하루종일
* **Right**: `components/Switch` 사용
* **UI 동작**:
* 스위치 **ON**:
* 하단 [시작 날짜], [종료 날짜] row에서 **시간(Time) 텍스트/피커가 숨겨짐**.
* 날짜(Date)만 선택 가능.

* 스위치 **OFF**:
* 하단 [시작 날짜], [종료 날짜] row에 **시간(Time)이 다시 표시됨**.
* 날짜와 시간을 모두 선택해야 함.

* **Data 처리 로직 (Payload)**:
* **Case 1: 하루종일 ON (`true`)**
* `isAllDay`: `true`
* `startDate`: "YYYY-MM-DD" (문자열, 필수)
* `endDate`: "YYYY-MM-DD" (문자열, 단일 일정이면 startDate와 동일값)
* `startDateTime`: `null` (또는 무시)
* `endDateTime`: `null` (또는 무시)
* `timeZone`: `null` (또는 기본값, 날짜 기반이라 타임존 영향 적음)

* **Case 2: 하루종일 OFF (`false`)**
* `isAllDay`: `false`
* `startDateTime`: "YYYY-MM-DDTHH:mm:ss.sssZ" (ISO String, 필수)
* `endDateTime`: "YYYY-MM-DDTHH:mm:ss.sssZ" (ISO String, 필수)
* `timeZone`: "Asia/Seoul" (사용자 기기 타임존 필수)
* **`startDate`**: "YYYY-MM-DD" (startDateTime에서 날짜 부분만 추출해서 **반드시 함께 전송**. DB 인덱싱용)
* **`endDate`**: "YYYY-MM-DD" (endDateTime에서 날짜 부분만 추출해서 **반드시 함께 전송**)

**예시 1) 하루종일 켜짐 (1월 10일 하루)**

```json
{
  "title": "친구 생일",
  "isAllDay": true,
  "startDate": "2026-01-10",
  "endDate": "2026-01-10",  // 종료일도 동일한 날짜 (앱 내부 로직상)
  "startDateTime": null,
  "endDateTime": null
}

```

**예시 2) 하루종일 꺼짐 (1월 10일 오후 2시 ~ 3시)**

```json
{
  "title": "팀 미팅",
  "isAllDay": false,
  "startDateTime": "2026-01-10T14:00:00.000Z", // UTC 기준
  "endDateTime": "2026-01-10T15:00:00.000Z",
  "timeZone": "Asia/Seoul",
  "startDate": "2026-01-10", // 검색 성능을 위해 파생 데이터로 같이 전송
  "endDate": "2026-01-10"
}

```

5번줄. 시작 날짜 / 시작 시간
    - 공통 컴포넌트 src/features/todo/form/components/DateTimeSection.js 사용
    - 처음에 딱 오늘 날짜로 설정되어있고, 시간의 기본값은 현재 시간값만 가져와서 설정한다. (예시: 현재시간 17:25 일경우 17:00으로 설정)
    - 하루종일 스위치가 켜져있으면 시간은 표시되지 않는다.

6번줄. 종료 날짜 / 종료 시간
    - 공통 컴포넌트 src/features/todo/form/components/DateTimeSection.js 사용
    - 시작날짜와 마찬가지로 오늘 날짜로 설정되어있고, 시간의 기본값은 현재 시간값에서 +1시간을 설정한다. (예시: 현재시간 17:25 일경우 18:00으로 설정)
    - 시작시간을 위에서 설정하면 종료시간은 +1시간으로 설정한다. (예시: 기본 시작시간 17:00, 기본 종료시간 18:00 -> 시작 시간을 17:30으로 변경하면 종료시간은 18:30으로 변경 반대로 종료시간 설정시 시작시간은 바뀌지 않는다.)
    - 만약 시작날짜와 종료날짜가 같을때, 종료시간을 시작 시간보다 이전으로 설정하면, 종료날짜는 시작날짜의 하루 뒤로 변경된다. (예시: 시작날짜 2026-01-10, 시작시간 17:00, 종료날짜 2026-01-10, 종료시간을 01:00으로 변경하면 종료날짜는 2026-01-11로 변경)
    - 하루종일 스위치가 켜져있으면 시간은 표시되지 않는다.
    - 아래의 반복설정이 켜질경우 종료날짜 / 종료시간항목은 없어진다.

7번줄. 시작 시간 / 종료 시간
    - 공통 컴포넌트 src/features/todo/form/components/DateTimeSection.js 사용
    - 아래의 반복설정이 켜질경우에만 나타나는 항목
    - 만약 반복설정 + 하루종일 설정일경우에는 나타나지 않는다.

---

### **DateTimeSection**

* **컴포넌트명**: `DateTimeSection`
* **경로**: `src/features/todo/form/components/DateTimeSection.js`
* **역할**: 설정된 **모드(`mode`)**에 따라 '날짜+시간' 또는 '시간 구간(Start~End)'을 입력받는 다목적 복합 컴포넌트. `ListRow`를 기반으로 하며, 클릭 시 하단에 Picker가 인라인으로 확장되는 아코디언 UI를 제공한다.

### 2. UI 구조 및 레이아웃 (Layout)

* **기본 구조**:
* `ListRow` 컴포넌트를 사용한다.
* **Left (Title)**: `label` Props로 전달받은 항목 이름.
* **Expanded Area**: `activeInput`과 일치하는 Picker가 하단에 배경색(`bg-gray-100`)으로 렌더링 된다.


* **Right (Value Area) - 모드별 표시 방식**:
**Type A. 기본 모드 (`mode="datetime"`)**
* **구성**: `[날짜 버튼]` + `[시간 버튼]`
* **날짜 버튼**: `YYYY.MM.DD.` 포맷. (값 없으면 `----.--.--.`)
* **시간 버튼**: `HH:MM` 포맷. (값 없으면 `--:--`)
* *참고: `showTimeInput=false`일 경우 시간 버튼은 숨겨진다.*


**Type B. 시간 구간 모드 (`mode="time-range"`)**
* **용도**: 반복 설정이 켜져 있을 때, 날짜 없이 시작/종료 시간만 설정할 때 사용.
* **구성**: `[시작 시간 버튼]` `➜` `[종료 시간 버튼]`
* **표시**: 두 시간 모두 `HH:MM` 포맷.
* **익일 표시**: 종료 시간이 시작 시간보다 이르거나 같은 경우(자정 경과), 종료 버튼 우측에 `(+1)` 텍스트 뱃지를 노출한다.



### 3. 기능 및 동작 요건 (Functional Requirements)

**3-1. 배타적 아코디언 (Exclusive Accordion)**

* 두 개의 버튼 중 하나를 클릭하면 해당 Picker가 열리고, 다른 Picker는 닫힌다. (Toggle 방식)
* 활성화된 버튼의 텍스트는 `text-blue-500`으로 강조된다.

**3-2. 모드별 동작**

* **기본 모드 (`datetime`)**:
* `date`와 `time` Props를 사용하여 날짜/시간을 제어한다.
* 날짜 선택 시 Picker가 자동으로 닫히도록 설정한다.


* **시간 구간 모드 (`time-range`)**:
* `date` Props는 무시되고, `startTime`, `endTime` Props를 사용한다.
* **자정 경과 로직**: `endTime` <= `startTime` 일 경우, 프론트엔드에서 시각적으로 `(+1)`을 표시해준다.
* 화살표 아이콘(`➜`)이 두 시간 사이에 고정적으로 표시된다.



**3-3. 상태 제어 (Controlled)**

* `activeInput` (부모 상태)을 통해 현재 어떤 Picker(날짜, 시간, 시작시간, 종료시간 등)가 열려있는지 관리하여, 화면 내 다른 컴포넌트와 포커스 충돌을 방지한다.

### 4. 속성 정의 (Props Specification)

하나의 컴포넌트가 두 역할을 수행하므로 Props가 확장됩니다.

| Prop Name | Type | Required | Description |
| --- | --- | --- | --- |
| **`mode`** | String | No | **표시 모드 설정** (`'datetime'` | `'time-range'`). Default: `'datetime'` |
| `label` | String | Yes | 리스트 좌측 라벨 |
| `activeInput` | String | Yes | 현재 활성화된 Picker Key |
| `setActiveInput` | Function | Yes | Picker 제어 함수 |
| **[Mode A: DateTime]** |  |  |  |
| `date` | String | Cond. | 날짜 값 (Format: "YYYY-MM-DD") |
| `time` | String | Cond. | 시간 값 (Format: "HH:MM") |
| `onDateChange` | Function | Cond. | 날짜 변경 콜백 |
| `onTimeChange` | Function | Cond. | 시간 변경 콜백 |
| `dateKey` | String | Cond. | 날짜 Picker 식별자 |
| `timeKey` | String | Cond. | 시간 Picker 식별자 |
| **[Mode B: TimeRange]** |  |  |  |
| `startTime` | String | Cond. | 시작 시간 값 ("HH:MM") |
| `endTime` | String | Cond. | 종료 시간 값 ("HH:MM") |
| `onStartTimeChange` | Function | Cond. | 시작 시간 변경 콜백 |
| `onEndTimeChange` | Function | Cond. | 종료 시간 변경 콜백 |
| `startTimeKey` | String | Cond. | 시작 시간 Picker 식별자 |
| `endTimeKey` | String | Cond. | 종료 시간 Picker 식별자 |

> **Note:** `Cond.` (Conditional) 항목은 해당 모드에서 필수입니다. 예를 들어 `mode="time-range"`일 때는 `startTime`, `endTime` 관련 Props가 필수입니다.


8번줄. 반복설정
    - src/features/todo/form/components/RecurrenceOptions.js 사용

### **RecurrenceOptions**
* **컴포넌트명**: `RecurrenceOptions`
* **경로**: `src/features/todo/form/components/RecurrenceOptions.js`
* **역할**: 반복설정을 위한 복합 컴포넌트. `ListRow`를 통해 현재 설정값을 보여준다.
ListRow
---------------------------------
title: 반복                설정값 v
---------------------------------
설정값 : 안 함, 매일, 매주, 매월, 매년
설정값에 따라 ListRow 아래에 설정값이 나타남
매일: 안나옴
매주: src/features/todo/form/components/recurrence/WeeklySelector.js
매월: src/features/todo/form/components/recurrence/MonthlySelector.js
매년: src/components/ui/DatePicker.js

9번줄. 메모
 - 컴포넌트: 공통 컴포넌트 src/components/ui/Input.js 사용
 - 설정 (Props):
    - multiline: true (여러 줄 입력 모드 활성화)
    - numberOfLines: 5 (또는 높이 클래스 h-32 적용)
    - placeholder: "메모"
    - 일반 입력창보다 높은 **박스 형태(Textarea)**로 렌더링 된다.
    - 텍스트 커서는 박스의 **좌측 상단(Top-Left)**에서 시작한다. (textAlignVertical: 'top')
    - 내용이 지정된 높이를 초과할 경우, 박스 내부에서 스크롤이 발생한다.




**제스처:** 사용자가 Detail Bottom Sheet를 잡고 아래로 내리면 (Swipe Down) 자연스럽게 Quick Mode로 전환됨.







### 📱 A. Native (iOS / Android) 전략

**"Single Bottom Sheet with Interpolation"**

두 개의 뷰를 스위칭하는 것이 아니라, **단일 Bottom Sheet** 내에서 높이 변화에 따라 UI를 Cross-fade 합니다.

* **컴포넌트:** `@gorhom/bottom-sheet` 기반의 커스텀 래퍼 사용. <- `BottomSheetNative` 공통 컴포넌트를 통해.
* **스냅 포인트 (Snap Points):**
* `Index 0`: (Quick Mode) - src/features/todo/form/components/QuickInput.js 입력창 크기만큼만 노출.
* `Index 1`: **90%** (Detail Mode) - 전체 상세 폼 노출. `BottomSheetNative`안에서 스크롤 가능하게


* **레이아웃 배치:**
* 내부 `ScrollView`를 비활성화(`useScrollView={false}`)하여 커스텀 Flexbox 레이아웃을 구성.
* **Quick UI:** 시트가 확장되면 `Opacity`가 0으로 변하며 `zIndex`가 낮아짐.
* **Detail UI:** 시트가 확장될 때 `Opacity`가 0에서 1로 변함.


* **키보드 인터랙션:**
* `keyboardBehavior="interactive"` 설정을 통해 시트가 키보드 높이만큼 자동으로 올라가며, 입력창이 항상 키보드 상단에 부착됨(Sticky)을 보장.
* `returnKeyType="done"`  quck mode 일경우 설정을 통해 키보드의 Done 버튼이 입력창 아래에 표시됨.



### 🌐 B. Web Mobile 전략

**"Sticky Footer + Drawer Separation"**

모바일 브라우저의 주소창 크기 변화(Viewport Resizing)와 가상 키보드 이슈를 방지하기 위해 뷰를 물리적으로 분리합니다.

* **Quick Mode:**
* CSS `position: fixed; bottom: 0`을 사용한 **Sticky Footer**.
* 항상 화면 최하단에 고정되어 빠른 접근성 제공.


* **Detail Mode:**
* 확장 버튼 클릭 시 별도의 **Drawer** (또는 Modal)가 호출됨.
* 공통 BottomSheet 컴포넌트를 재사용하여 일관된 디자인 유지.


* **데이터 동기화:**
* Logic Hook을 공유하므로, Sticky Footer에서 입력하던 텍스트가 Drawer가 열릴 때 그대로 유지됨.



### 🖥️ C. Web Desktop 전략

**"Direct Modal"**

* 화면 공간이 충분하므로 Quick Mode 단계를 생략.
* 진입 시 즉시 **Dialog/Modal** 형태의 Detail Mode 폼을 렌더링.

---

## 4. 핵심 데이터 흐름 (Data Flow)

1. **초기화 (Initialization):**
* `Container`가 마운트되면 `useTodoFormLogic` 훅이 실행됨.
* `props`로 전달된 `initialTodo`가 있으면 "수정 모드", 없으면 "생성 모드"로 상태 초기화.
* 생성 모드일 경우, 기본 카테고리(Default Category)를 비동기로 로드하여 설정.


2. **입력 및 상태 변경 (Interaction):**
* 사용자가 `QuickInput`에서 텍스트 입력 -> `Logic`의 `formState.title` 업데이트.
* **Native:** 사용자가 시트를 당김 -> `reanimated` 값이 변하면서 Quick UI 사라짐 / Detail UI 나타남.
* **Web:** 사용자가 확장 버튼 클릭 -> `Logic` 상태는 유지된 채 Detail Mode 컴포넌트 마운트.


3. **저장 (Submission):**
* 저장 버튼 클릭 -> `Logic`의 `handleSubmit` 실행.
* 유효성 검사(제목 필수, 날짜 유효성 등) 수행.
* 데이터 포맷팅 (Recurrence Rule 변환 등).
* `react-query`의 `mutate` 함수 호출 (Create 또는 Update).
* 성공 시 폼 닫기(`onClose`) 및 토스트 메시지 출력.



---

## 5. 주요 컴포넌트 명세 (Component Specs)

### 🛠️ Common Wrapper (`BottomSheetNative`)

기존 라이브러리를 감싸 프로젝트 전용으로 확장한 컴포넌트입니다.

* **Render Props 지원:** `children`을 함수로 전달받아 `animatedIndex`(현재 시트 위치값)를 하위 컴포넌트에 노출해야 함. (애니메이션 구현 필수 요소)
* **Layout 유연성:** 내부 `ScrollView` 사용 여부를 prop으로 제어하여, Sticky Header/Footer 레이아웃을 허용해야 함.

### 🧩 `DetailedForm`

Detail Mode에서 보여질 실제 폼 컨텐츠입니다.

* **구성:** `ScrollView` 내부에 `TitleInput`, `DateTimeSection`, `CategorySelector`, `RecurrenceOptions`, `MemoInput`을 순차적으로 배치.
* **확장성:** 카테고리 추가와 같은 Sub-Flow 발생 시, 폼 내용을 일시적으로 "카테고리 생성 폼"으로 교체하는 `viewMode` 분기 처리를 포함.

### 🧩 `DateTimeSection`

* 독립적인 UI 부품으로, 시작일/종료일/시간/하루종일 설정을 담당.
* `DetailedForm` 내부에서 재사용됨.

---

## 6. 개발 요구 사항 (Requirements)

현재 이 명세서에 따라 리팩토링을 진행 중입니다. 개발자는 다음 사항을 준수해야 합니다.

1. **Dry Principle:** 로직은 `useTodoFormLogic` 한 곳에서만 관리할 것. UI 컴포넌트 내부에서 비즈니스 로직을 구현하지 말 것.
2. **Platform Isolation:** `layouts/` 폴더 내의 파일들은 서로의 플랫폼 코드를 참조하지 않도록 하여, 웹 빌드 시 네이티브 의존성 에러를 방지할 것.
3. **UX Consistency:** 플랫폼별 구현 방식은 다르더라도, 사용자가 느끼는 "데이터의 연속성(입력 중 확장)"은 끊기지 않아야 함.

## 📂 7. 프로젝트 디렉토리 구조 (Project Directory Structure)

본 프로젝트는 기능 단위(Feature-based) 구조를 따르며, 공통 UI 컴포넌트는 별도 디렉토리에서 관리합니다.

```text
src/
├── components/
│   └── ui/
│       ├── bottom-sheet/
│       │   ├── core/
│       │   │   ├── bottom-sheet-native.js  # [공통] 네이티브용 래퍼 (Render Props & 레이아웃 제어 지원)
│       │   │   └── bottom-sheet-web.js     # [공통] 웹 브라우저용 래퍼 (Drawer/Modal 지원)
│       │   └── index.js                    # [공통] 플랫폼별 레이아웃 전략
│       ├── DatePicker.js                   # [공통] 날짜 선택 컴포넌트
│       ├── Dropdown.js                     # [공통] 드롭다운 컴포넌트
│       ├── Input.js                        # [공통] 입력 컴포넌트
│       ├── ListRow.js                      # [공통] 리스트 아이템 컴포넌트
│       └── Switch.js                       # [공통] 스위치 컴포넌트
│
└── features/
    └── todo/
        └── form/
            ├── index.js                  # [컨테이너] 진입점 (플랫폼 분기 처리)
            ├── useTodoFormLogic.js       # [로직] 비즈니스 로직 훅 (UI 코드 없음)
            │
            ├── components/               # [부품] 순수 UI 컴포넌트들
            │   ├── QuickInput.js         # 빠른 모드 입력창 (채팅 스타일)
            │   ├── DetailedForm.js       # 풀 모드 상세 설정 폼 (스크롤 가능)
            │   ├── FormHeader.js         # 헤더 (저장/취소 버튼)
            │   ├── DateTimeSection.js    # 날짜/시간 선택 섹션
            │   ├── RecurrenceOptions.js  # 반복 설정 섹션
            │   └── recurrence/           # [Parent] Recurrence Manager
            │        ├── WeeklySelector.js     # for frequency === 'weekly'
            │        └── MonthlySelector.js    # for frequency === 'monthly'
            │
            └── layouts/                  # [껍데기] 플랫폼별 레이아웃 전략
                ├── NativeLayout.js       # iOS/Android: 단일 바텀 시트 전략 (Single Bottom Sheet)
                ├── WebMobileLayout.js    # 모바일 웹: 스티키 푸터 + 드로어 전략 (Sticky Footer + Drawer)
                └── WebDesktopLayout.js   # 데스크탑 웹: 단일 바텀 시트 전략 (Single Bottom Sheet)

```
