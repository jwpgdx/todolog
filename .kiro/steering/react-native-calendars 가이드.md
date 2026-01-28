# react-native-calendars 가이드

공식 문서: https://wix.github.io/react-native-calendars/docs/Intro

## 설치

```bash
npm install react-native-calendars
# or
yarn add react-native-calendars
```

---

## 주요 컴포넌트

### 1. Calendar (기본 캘린더)
- 단일 월 표시
- 날짜 선택, 마킹 기능

### 2. CalendarList (스크롤 가능한 캘린더)
- 여러 달을 스크롤로 탐색
- 수평/수직 스크롤 지원

### 3. Agenda (일정 목록)
- 캘린더 + 일정 목록 조합
- 날짜별 아이템 렌더링

### 4. ExpandableCalendar (확장 가능한 캘린더)
- 주간/월간 뷰 전환
- CalendarProvider와 함께 사용

---

## Calendar 기본 사용법

```javascript
import { Calendar } from 'react-native-calendars';

<Calendar
  // 초기 표시 날짜
  initialDate={'2024-11-24'}
  
  // 날짜 선택 핸들러
  onDayPress={(day) => {
    console.log('selected day', day);
    // day = { day: 24, month: 11, year: 2024, dateString: '2024-11-24', timestamp: ... }
  }}
  
  // 날짜 마킹
  markedDates={{
    '2024-11-24': { selected: true, marked: true, selectedColor: 'blue' },
    '2024-11-25': { marked: true, dotColor: 'red' }
  }}
  
  // 최소/최대 날짜
  minDate={'2024-01-01'}
  maxDate={'2024-12-31'}
  
  // 월 변경 핸들러
  onMonthChange={(month) => {
    console.log('month changed', month);
  }}
  
  // 주 시작 요일 (0=일요일, 1=월요일)
  firstDay={1}
  
  // 스와이프로 월 변경 활성화
  enableSwipeMonths={true}
/>
```

---

## 날짜 마킹 (Marking) 종류

### 1. Dot Marking (기본)
```javascript
markedDates={{
  '2024-11-24': { selected: true, marked: true, selectedColor: 'blue' },
  '2024-11-25': { marked: true, dotColor: 'red' },
  '2024-11-26': { disabled: true }
}}
```

### 2. Multi-Dot Marking
```javascript
<Calendar
  markingType={'multi-dot'}
  markedDates={{
    '2024-11-24': {
      dots: [
        { key: 'vacation', color: 'red' },
        { key: 'workout', color: 'green' }
      ],
      selected: true
    }
  }}
/>
```

### 3. Period Marking (기간 표시)
```javascript
<Calendar
  markingType={'period'}
  markedDates={{
    '2024-11-22': { startingDay: true, color: 'green' },
    '2024-11-23': { color: 'green' },
    '2024-11-24': { endingDay: true, color: 'green' }
  }}
/>
```

### 4. Custom Marking
```javascript
<Calendar
  markingType={'custom'}
  markedDates={{
    '2024-11-24': {
      customStyles: {
        container: { backgroundColor: 'green' },
        text: { color: 'white', fontWeight: 'bold' }
      }
    }
  }}
/>
```

---

## 한국어 로케일 설정

```javascript
import { LocaleConfig } from 'react-native-calendars';

LocaleConfig.locales['ko'] = {
  monthNames: [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ],
  monthNamesShort: [
    '1월', '2월', '3월', '4월', '5월', '6월',
    '7월', '8월', '9월', '10월', '11월', '12월'
  ],
  dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
  dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
  today: '오늘'
};

LocaleConfig.defaultLocale = 'ko';
```

---

## 테마 커스터마이징

```javascript
<Calendar
  theme={{
    backgroundColor: '#ffffff',
    calendarBackground: '#ffffff',
    textSectionTitleColor: '#b6c1cd',
    selectedDayBackgroundColor: '#00adf5',
    selectedDayTextColor: '#ffffff',
    todayTextColor: '#00adf5',
    dayTextColor: '#2d4150',
    textDisabledColor: '#d9e1e8',
    dotColor: '#00adf5',
    selectedDotColor: '#ffffff',
    arrowColor: 'orange',
    monthTextColor: 'blue',
    textDayFontFamily: 'monospace',
    textMonthFontFamily: 'monospace',
    textDayFontSize: 16,
    textMonthFontSize: 16
  }}
/>
```

---

## CalendarList (스크롤 캘린더)

```javascript
import { CalendarList } from 'react-native-calendars';

<CalendarList
  // 과거로 스크롤 가능한 개월 수
  pastScrollRange={12}
  
  // 미래로 스크롤 가능한 개월 수
  futureScrollRange={12}
  
  // 수평 스크롤
  horizontal={true}
  pagingEnabled={true}
  
  // 스크롤 인디케이터 표시
  showScrollIndicator={true}
  
  // Calendar의 모든 props 사용 가능
  onDayPress={(day) => console.log(day)}
  markedDates={{...}}
/>
```

---

## ExpandableCalendar (확장 캘린더)

```javascript
import { CalendarProvider, ExpandableCalendar } from 'react-native-calendars';

<CalendarProvider date={'2024-11-24'}>
  <ExpandableCalendar
    // 초기 위치 ('open' | 'closed')
    initialPosition="open"
    
    // 열림/닫힘 핸들러
    onCalendarToggled={(isOpen) => console.log(isOpen)}
    
    // 날짜 선택 시 자동으로 닫기
    closeOnDayPress={true}
    
    // 손잡이 숨기기
    hideKnob={false}
  />
</CalendarProvider>
```

---

## 주요 Props 정리

### 공통 Props
| Prop | Type | 설명 |
|------|------|------|
| `initialDate` | string | 초기 표시 날짜 (YYYY-MM-DD) |
| `minDate` | string | 선택 가능한 최소 날짜 |
| `maxDate` | string | 선택 가능한 최대 날짜 |
| `onDayPress` | function | 날짜 클릭 핸들러 |
| `onMonthChange` | function | 월 변경 핸들러 |
| `markedDates` | object | 마킹할 날짜 객체 |
| `firstDay` | number | 주 시작 요일 (0=일, 1=월) |
| `enableSwipeMonths` | boolean | 스와이프로 월 변경 |
| `hideArrows` | boolean | 화살표 숨기기 |
| `theme` | object | 테마 설정 |

### markedDates 객체 구조
```javascript
{
  'YYYY-MM-DD': {
    selected: boolean,        // 선택됨
    marked: boolean,          // 점 표시
    selectedColor: string,    // 선택 색상
    dotColor: string,         // 점 색상
    disabled: boolean,        // 비활성화
    disableTouchEvent: boolean, // 터치 이벤트 비활성화
    startingDay: boolean,     // 기간 시작일 (period marking)
    endingDay: boolean,       // 기간 종료일 (period marking)
    color: string,            // 배경색 (period marking)
    textColor: string         // 텍스트 색상
  }
}
```

---

## Todo 앱에서 사용 예시

```javascript
import { Calendar } from 'react-native-calendars';
import { useDateStore } from '../store/dateStore';

export default function CalendarScreen() {
  const { currentDate, setCurrentDate } = useDateStore();
  
  return (
    <Calendar
      initialDate={currentDate}
      onDayPress={(day) => {
        setCurrentDate(day.dateString);
      }}
      markedDates={{
        [currentDate]: { selected: true, selectedColor: 'blue' },
        '2024-11-25': { marked: true, dotColor: 'green' }, // 할일 있는 날
        '2024-11-26': { marked: true, dotColor: 'red' }    // 완료 안 한 날
      }}
      theme={{
        selectedDayBackgroundColor: '#3b82f6',
        todayTextColor: '#3b82f6',
        arrowColor: '#3b82f6'
      }}
      firstDay={1}
      enableSwipeMonths={true}
    />
  );
}
```

---

## 참고사항

1. **markedDates는 immutable해야 함** - 객체 참조가 바뀌어야 업데이트됨
2. **날짜 형식은 'YYYY-MM-DD'** - 반드시 이 형식 사용
3. **markingType은 하나만 사용** - dot, multi-dot, period, custom 중 선택
4. **CalendarProvider 필요** - ExpandableCalendar 사용 시 필수
