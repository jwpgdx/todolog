# Package Reference: `react-native-date-picker`

## Overview

**Package Name:** `react-native-date-picker`
**Version:** 5.0.13 (Published approx. June 2024)
**Description:** A cross-platform React Native date picker component for both Android and iOS. It provides a unified API to display native date/time selectors.

## Key Features

  * **Cross-Platform:** Supports both iOS and Android with a native look and feel.
  * **3 Modes:**
    1.  `date` (Date Picker)
    2.  `time` (Time Picker)
    3.  `datetime` (Date & Time Picker)
  * **Customizable:** Supports multiple languages and styling options.
  * **Display Options:**
      * **Modal:** Built-in modal popup (default).
      * **Inlined:** Can be embedded directly into a View or custom modal.

## Installation

```bash
npm i react-native-date-picker
```

*Note: See GitHub repository for platform-specific linking or Expo setup instructions.*

## Usage Styles

### 1\. Modal (Built-in)

Uses the library's internal modal system.

  * **Support:** iOS, Android

### 2\. Inlined (Embed)

Renders the picker directly on the screen (useful for custom UI or "wheel" style on Android).

  * **Support:** iOS, Android

## Metadata & Statistics

  * **License:** MIT
  * **Weekly Downloads:** \~242,326 (Indicates high stability and popularity)
  * **Unpacked Size:** 3.97 MB
  * **Repository:** [github.com/henninghall/react-native-date-picker](https://github.com/henninghall/react-native-date-picker)

## Keywords

`datepicker`, `date-picker`, `react native`, `react-native`, `react native date picker`, `react native datetimepicker`, `react native timepicker`, `android`, `ios`

-----

## TODOLOG 앱 구현 현황 ✅

### TimeInput 컴포넌트 (2024-12-11 구현 완료)

플랫폼별로 최적화된 시간 선택 컴포넌트:

#### 웹 (Web)
- HTML `input type="time"` 사용
- 브라우저 네이티브 시간 선택기
- 초기값: 빈 상태 (--:-- 표시)
- 지우기 버튼 포함
- 키보드 입력 지원

```javascript
// 웹용 구현
<input
  type="time"
  value={value || ''}
  onChange={(e) => onChangeText(e.target.value)}
  style={{ /* 네이티브 스타일링 */ }}
/>
```

#### 모바일 (Android/iOS)
- `react-native-date-picker` inline 모드 사용
- TouchableOpacity → 모달 방식
- 네이티브 wheel picker 경험
- 한국어 로케일 지원
- 24시간 형식

```javascript
// 모바일용 구현
<DatePicker
  date={currentDate}
  onDateChange={handleTimeChange}
  mode="time"
  locale="ko"
  is24hourSource="locale"
  style={{ height: 200, width: 300 }}
/>
```

### DateInput 컴포넌트 (2024-12-11 개선 완료)

날짜 선택 컴포넌트에 지우기 기능 추가:

#### 주요 기능
- 조건부 지우기 버튼: 날짜 선택 시에만 표시
- 이벤트 분리: `e.stopPropagation()`으로 지우기 버튼 클릭 시 캘린더가 열리지 않도록 방지
- 일관된 디자인: TimeInput과 동일한 스타일
- 📅 이모지 아이콘 추가

```javascript
// 지우기 버튼 구현
{value && (
  <TouchableOpacity
    onPress={(e) => {
      e.stopPropagation();
      onChangeText('');
    }}
  >
    <Text className="text-red-500 text-sm">지우기</Text>
  </TouchableOpacity>
)}
```

### AddTodoScreen 디버깅 개선 (2024-12-11)

할일 추가 화면에 실시간 디버깅 정보 표시:

#### 표시 정보
- 시작 날짜 & 시간: `📅 시작: 2024-12-11 14:30`
- 종료 날짜 & 시간: `📅 종료: 2024-12-15 16:00` (설정된 경우만)
- 현재 활성 입력: `활성: startTime | 타입: todo`
- 루틴 정보: `루틴: weekly [1,3,5]` (루틴 타입일 때만)

#### 디자인
- 배경: 노란색 배경 (`bg-yellow-50`)
- 테두리: 노란색 테두리 (`border-yellow-200`)
- 폰트: 모노스페이스 폰트로 정렬된 표시
- 실시간 업데이트: 모든 값 변경 시 즉시 반영

### 패키지 정리 (2024-12-12)

불필요한 패키지 제거로 프로젝트 최적화:

#### 제거된 패키지
- ❌ `@quidone/react-native-wheel-picker` - 이전에 사용했던 불안정한 wheel picker
- 이유: react-native-date-picker로 대체되어 더 이상 사용하지 않음

#### 현재 사용 중인 패키지
- ✅ `react-native-date-picker` - 안정적인 네이티브 date/time picker
- ✅ `react-native-calendars` - 캘린더 컴포넌트

### UX 개선사항 (2024-12-12)

#### 1. 종료시간 선택 시 자동 종료날짜 설정

종료시간을 선택할 때 종료날짜가 비어있으면 자동으로 시작날짜로 설정:

```javascript
const handleEndTimeChange = (time) => {
  // 종료시간을 선택했는데 종료날짜가 없으면 시작날짜로 자동 설정
  if (time && !endDate && startDate) {
    setEndDate(startDate);
  }
  setEndTime(time);
};
```

**사용 시나리오:**
- 시작날짜: 2024-12-11
- 종료날짜: (비어있음)
- 종료시간: 15:30 선택
- → 자동으로 종료날짜가 2024-12-11로 설정됨

#### 2. 웹 TimeInput 활성 상태 자동 해제

웹에서 HTML input 클릭 시 활성 상태를 자동으로 해제하여 UX 개선:

```javascript
// 웹용 TimeInput에서 HTML input 클릭 시
onFocus={() => {
  // 웹에서 input 클릭 시 활성 상태 해제 (HTML input이 자체 시간 선택기를 제공)
  if (inline && onTogglePicker) {
    onTogglePicker(); // 활성 상태를 null로 만들어 다른 선택기들 닫기
  }
}}
```

**동작 방식:**
- 웹: HTML input 클릭 → 활성 상태 해제 → 브라우저 네이티브 시간 선택기
- 모바일: TouchableOpacity 클릭 → 활성 상태 토글 → react-native-date-picker 모달

-----

## AI Implementation Note

When implementing this library:

1.  **For Android:** It successfully replicates the iOS "wheel" interaction when using `variant="native"` or inlined mode, solving the issue of Android's default calendar view.
2.  **For Expo:** Requires `npx expo run:android` or `npx expo run:ios` (Development Build) because it includes native code.
3.  **Platform Optimization:** Use HTML input for web, react-native-date-picker for mobile
4.  **UX Improvements:** Add clear buttons, placeholder states, and debugging info for better development experience