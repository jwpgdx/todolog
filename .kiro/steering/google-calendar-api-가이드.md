# Google Calendar API 가이드

## 📋 개요

Google Calendar API를 사용하여 할일을 구글 캘린더에 자동으로 동기화하는 방법입니다.

공식 문서: https://developers.google.com/calendar/api/v3/reference

---

## 1. 🔑 인증 (OAuth 2.0)

### Access Token & Refresh Token
- **Access Token**: API 호출 시 사용 (1시간 유효)
- **Refresh Token**: Access Token 만료 시 새로 발급받기 위해 사용

```javascript
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET
);

oauth2Client.setCredentials({
  access_token: user.googleAccessToken,
  refresh_token: user.googleRefreshToken,
});

const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
```

### Access Token 갱신
```javascript
// Access Token 만료 시 자동 갱신
oauth2Client.on('tokens', (tokens) => {
  if (tokens.refresh_token) {
    // 새 Refresh Token 저장
    user.googleRefreshToken = tokens.refresh_token;
  }
  // 새 Access Token 저장
  user.googleAccessToken = tokens.access_token;
  user.save();
});
```

---

## 2. 📅 이벤트 생성 (events.insert)

### 기본 이벤트 (종일)
```javascript
const event = {
  summary: '할일 제목',
  description: '메모 내용',
  start: {
    date: '2024-12-10', // 종일 이벤트
  },
  end: {
    date: '2024-12-10',
  },
};

const response = await calendar.events.insert({
  calendarId: 'primary',
  resource: event,
});

console.log('이벤트 ID:', response.data.id);
```

### 시간 지정 이벤트
```javascript
const event = {
  summary: '회의',
  start: {
    dateTime: '2024-12-10T14:00:00+09:00', // ISO 8601 형식
    timeZone: 'Asia/Seoul',
  },
  end: {
    dateTime: '2024-12-10T15:00:00+09:00',
    timeZone: 'Asia/Seoul',
  },
};
```

### 기간 이벤트 (여러 날)
```javascript
const event = {
  summary: '여행',
  start: {
    date: '2024-12-10', // 시작일
  },
  end: {
    date: '2024-12-13', // 종료일 (exclusive, 실제로는 12일까지)
  },
};
```

---

## 3. 🔁 반복 이벤트 (Recurrence)

### RRULE 형식
반복 규칙은 RFC 5545 표준을 따릅니다.

#### 매일 반복
```javascript
const event = {
  summary: '매일 운동',
  start: { date: '2024-12-01' },
  end: { date: '2024-12-01' },
  recurrence: [
    'RRULE:FREQ=DAILY'
  ],
};
```

#### 매주 월수금 반복
```javascript
const event = {
  summary: '영어 공부',
  start: { date: '2024-12-02' }, // 월요일
  end: { date: '2024-12-02' },
  recurrence: [
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR'
  ],
};
```

#### 매월 1일 반복
```javascript
const event = {
  summary: '월급날',
  start: { date: '2024-12-01' },
  end: { date: '2024-12-01' },
  recurrence: [
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=1'
  ],
};
```

#### 매년 생일 (5월 15일)
```javascript
const event = {
  summary: '생일',
  start: { date: '2024-05-15' },
  end: { date: '2024-05-15' },
  recurrence: [
    'RRULE:FREQ=YEARLY;BYMONTH=5;BYMONTHDAY=15'
  ],
};
```

#### 종료일 지정
```javascript
const event = {
  summary: '매일 운동 (12월까지)',
  start: { date: '2024-12-01' },
  end: { date: '2024-12-01' },
  recurrence: [
    'RRULE:FREQ=DAILY;UNTIL=20241231' // YYYYMMDD 형식
  ],
};
```

### RRULE 주요 파라미터
| 파라미터 | 설명 | 예시 |
|---------|------|------|
| `FREQ` | 반복 주기 | DAILY, WEEKLY, MONTHLY, YEARLY |
| `BYDAY` | 요일 지정 | MO, TU, WE, TH, FR, SA, SU |
| `BYMONTHDAY` | 날짜 지정 | 1-31 |
| `BYMONTH` | 월 지정 | 1-12 |
| `UNTIL` | 종료일 | YYYYMMDD 형식 |
| `COUNT` | 반복 횟수 | 10 (10번 반복) |

---

## 4. ✏️ 이벤트 수정 (events.update)

```javascript
await calendar.events.update({
  calendarId: 'primary',
  eventId: 'event_id_here',
  resource: {
    summary: '수정된 제목',
    description: '수정된 메모',
  },
});
```

---

## 5. 🗑️ 이벤트 삭제 (events.delete)

```javascript
await calendar.events.delete({
  calendarId: 'primary',
  eventId: 'event_id_here',
});
```

---

## 6. 🔍 이벤트 조회 (events.list)

### 특정 기간 이벤트 조회
```javascript
const response = await calendar.events.list({
  calendarId: 'primary',
  timeMin: '2024-12-01T00:00:00Z',
  timeMax: '2024-12-31T23:59:59Z',
  singleEvents: true, // 반복 이벤트를 개별 이벤트로 확장
  orderBy: 'startTime',
});

const events = response.data.items;
```

### 특정 이벤트 조회
```javascript
const response = await calendar.events.get({
  calendarId: 'primary',
  eventId: 'event_id_here',
});

const event = response.data;
```

---

## 7. 🚨 에러 처리

### 401 Unauthorized (Access Token 만료)
```javascript
try {
  await calendar.events.insert({ ... });
} catch (error) {
  if (error.code === 401) {
    // Refresh Token으로 새 Access Token 받기
    const { credentials } = await oauth2Client.refreshAccessToken();
    user.googleAccessToken = credentials.access_token;
    await user.save();
    
    // 재시도
    await calendar.events.insert({ ... });
  }
}
```

### 403 Forbidden (권한 없음)
- 사용자가 캘린더 권한을 취소한 경우
- 다시 권한 요청 필요

### 404 Not Found
- 이벤트가 삭제되었거나 존재하지 않음

---

## 8. 💡 TODOLOG 앱 적용 전략

### 8.1 이벤트 생성 시점
- **특정날짜 할일**: 캘린더에 추가 ✅
- **루틴 할일**: 반복 이벤트로 추가 ✅

### 8.2 이벤트 ID 저장
```javascript
// Todo 모델에 googleCalendarEventId 필드 추가
const todoSchema = new mongoose.Schema({
  // ... 기존 필드
  googleCalendarEventId: { type: String }, // 캘린더 이벤트 ID
});
```

### 8.3 동기화 로직
```javascript
// 할일 생성 시
if (user.hasCalendarAccess) {
  const calendarEvent = await createCalendarEvent(user, todo);
  todo.googleCalendarEventId = calendarEvent.id;
  await todo.save();
}

// 할일 수정 시
if (todo.googleCalendarEventId) {
  await updateCalendarEvent(user, todo);
}

// 할일 삭제 시
if (todo.googleCalendarEventId) {
  await deleteCalendarEvent(user, todo.googleCalendarEventId);
}
```

### 8.4 실패 처리
- 캘린더 동기화 실패해도 Todo는 정상 생성/수정/삭제
- 에러 로그만 남기고 사용자에게는 알리지 않음 (선택적 기능)

---

## 9. 📝 Todo → Calendar 이벤트 변환 예시

### 특정날짜 할일 (단일)
```javascript
{
  title: '병원 가기',
  type: 'todo',
  date: '2024-12-10',
  time: '14:00',
  memo: '치과 예약'
}
↓
{
  summary: '병원 가기',
  description: '치과 예약',
  start: {
    dateTime: '2024-12-10T14:00:00+09:00',
    timeZone: 'Asia/Seoul',
  },
  end: {
    dateTime: '2024-12-10T15:00:00+09:00', // 1시간 후
    timeZone: 'Asia/Seoul',
  },
}
```

### 특정날짜 할일 (기간)
```javascript
{
  title: '여행',
  type: 'todo',
  date: '2024-12-10',
  endDate: '2024-12-12',
}
↓
{
  summary: '여행',
  start: { date: '2024-12-10' },
  end: { date: '2024-12-13' }, // +1일 (exclusive)
}
```

### 루틴 할일 (매주 월수금)
```javascript
{
  title: '영어 공부',
  type: 'routine',
  routine: {
    frequency: 'weekly',
    weekdays: [1, 3, 5], // 월, 수, 금
    startDate: '2024-12-02',
    endDate: '2024-12-31',
  },
}
↓
{
  summary: '영어 공부',
  start: { date: '2024-12-02' },
  end: { date: '2024-12-02' },
  recurrence: [
    'RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR;UNTIL=20241231'
  ],
}
```

---

## 10. 🔗 참고 링크

- [Google Calendar API v3 Reference](https://developers.google.com/calendar/api/v3/reference)
- [RFC 5545 (iCalendar)](https://datatracker.ietf.org/doc/html/rfc5545)
- [RRULE Generator](https://icalendar.org/rrule-tool.html) - 반복 규칙 테스트 도구
- [googleapis npm package](https://www.npmjs.com/package/googleapis)

---

## 11. ✅ 체크리스트

구현 전 확인사항:
- [ ] Google Cloud Console에서 Calendar API 활성화
- [ ] OAuth 동의 화면에 `calendar.events` 권한 추가
- [ ] User 모델에 `googleAccessToken`, `googleRefreshToken` 필드 추가
- [ ] Todo 모델에 `googleCalendarEventId` 필드 추가
- [ ] Access Token 갱신 로직 구현
- [ ] 에러 처리 (401, 403, 404)
