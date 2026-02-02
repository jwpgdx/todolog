const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  userId: {
    type: String,  // ObjectId → String
    ref: 'User',
    required: true,
  },

  // --- 기본 정보 ---
  title: {
    type: String, // Google: summary
    required: true,
  },
  memo: {
    type: String, // Google: description
  },
  categoryId: {
    type: String,  // ObjectId → String
    ref: 'Category',
    required: true,
  },

  // --- 날짜 및 시간 (구글 연동 핵심) ---

  // 1. 하루종일 여부
  // 앱 내 UI 토글 상태 저장용이자, 구글 전송 시 date vs dateTime 판단 기준
  isAllDay: {
    type: Boolean,
    default: true,
  },

  // 2. 날짜 (하루종일 일정용 & 정렬 기준)
  // 포맷: "YYYY-MM-DD"
  // 시간 지정 일정이라도, 달력 UI에 '어느 날짜 칸'에 보여줄지 빠르게 찾기 위해 필수
  startDate: {
    type: String,
    required: true,
    index: true,
  },
  endDate: {
    type: String, // 하루종일 일정은 종료일 필수 (단일일 경우 startDate와 동일하게 저장 추천)
  },

  // 3. 시간 (시간 지정 일정용)
  // Google: start.dateTime / end.dateTime
  startDateTime: {
    type: Date,
  },
  endDateTime: {
    type: Date,
  },

  // 4. 타임존 (필수!)
  // Google: start.timeZone
  // 시간 지정 반복 일정에서 썸머타임 등을 계산하기 위해 구글이 꼭 필요로 함
  timeZone: {
    type: String,
    default: 'Asia/Seoul',
  },

  // --- 반복 (Recurrence) ---

  // 1. 구글 전송용 (문자열 배열)
  // 예: ["RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20251231T000000Z"]
  // 구글은 이 안에 종료일(UNTIL)을 포함해서 보내야 함
  recurrence: [{
    type: String,
  }],

  // 2. 우리 DB 검색용 (Date 객체)
  // "RRULE 문자열"을 파싱하지 않고도, "2026년에 유효한 반복인가?"를 쿼리로 찾기 위함
  // 무한 반복이면 null
  recurrenceEndDate: {
    type: Date,
    default: null,
    index: true, // 인덱스 필수 (조회 성능 핵심)
  },

  // 3. 반복 예외 날짜 (특정 날짜만 반복 안 함)
  // 앱에서 달력 렌더링할 때 "이 날은 건너뛰어"라고 표시하기 위함
  exdates: [{
    type: Date,
  }],

  // --- 순서 관리 ---
  order: {
    keep: { type: Number },
    category: { type: Number }
  },

  // --- 구글 캘린더 연동 메타데이터 ---
  googleCalendarEventId: {
    type: String,
    unique: true,   // 중복 방지
    sparse: true,   // null 값은 unique 체크 제외 (연동 안 한 할일도 있으므로)
  },
  googleEtag: {
    type: String, // 데이터 버전 관리 (충돌 방지)
  },
  syncStatus: {
    type: String,
    enum: ['synced', 'pending', 'failed', 'offline_only'],
    default: 'offline_only',
  },
  lastSyncAttempt: {
    type: Date,
  },

  // --- 델타 동기화용 (Soft Delete) ---
  deletedAt: {
    type: Date,
    default: null,
  },

}, { _id: false, timestamps: true });

// --- 인덱스 전략 (성능 최적화) ---

// 1. 메인 화면 조회용: 특정 유저의 특정 월(startDate 기준) 조회
todoSchema.index({ userId: 1, startDate: 1 });

// 2. 반복 일정 조회용: "아직 안 끝난 반복 일정"을 빠르게 찾기
// 쿼리 예: { userId: '...', recurrence: { $ne: null }, recurrenceEndDate: { $gte: 조회시작일 } }
todoSchema.index({ userId: 1, recurrenceEndDate: 1 });

// 3. 구글 연동용: 구글 ID로 빠르게 내 DB 문서 찾기
todoSchema.index({ googleCalendarEventId: 1 });

// 4. 델타 동기화용: 특정 시간 이후 변경된 일정 조회
todoSchema.index({ userId: 1, updatedAt: -1 });

// 5. Soft delete 조회용: 삭제된 일정 조회
todoSchema.index({ userId: 1, deletedAt: 1 });

module.exports = mongoose.model('Todo', todoSchema);