const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    sparse: true,  // 게스트는 이메일 없음
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    // 소셜 로그인은 비밀번호 없음
  },
  isGuest: {
    type: Boolean,
    default: false,
  },
  name: {
    type: String,
    required: true,
  },
  handle: {
    type: String, // @핸들 (고유 ID)
    unique: true,
    sparse: true,
    trim: true,
  },
  provider: {
    type: String,
    enum: ['local', 'google', 'apple'],
    default: 'local',
  },
  googleId: {
    type: String,
  },
  appleId: {
    type: String,
  },
  picture: {
    type: String, // 프로필 이미지 URL
  },
  // === [외부 API 토큰] (민감 정보는 루트에 유지) ===
  googleAccessToken: {
    type: String, // 구글 캘린더 API용
  },
  googleRefreshToken: {
    type: String,
  },
  hasCalendarAccess: {
    type: Boolean,
    default: false, // 캘린더 인증 정보 보유 여부
  },
  todoLogCalendarId: {
    type: String, // TODOLOG 전용 캘린더 ID
  },

  // === [사용자 설정] ===
  settings: {
    type: new mongoose.Schema({
      // 화면 및 스타일
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system',
      },
      language: {
        type: String,
        enum: ['ko', 'en', 'ja', 'system'],
        default: 'system',
      },

      // 할 일 및 캘린더
      startDayOfWeek: {
        type: String,
        enum: ['sunday', 'monday'],
        default: 'sunday',
      },
      showCompleted: {
        type: Boolean,
        default: true,
      },
      calendarSyncEnabled: {
        type: Boolean,
        default: false,
      },

      // 알림
      notification: {
        enabled: { type: Boolean, default: false },
        pushToken: { type: String },
        remindTime: { type: String, default: '09:00' },
      },

      // 기타
      timeZone: {
        type: String,
        default: 'Asia/Seoul',
      },
      timeZoneAuto: {
        type: Boolean,
        default: true,
      },

      // 할일 기본값
      defaultIsAllDay: {
        type: Boolean,
        default: true,
      },
    }, { _id: false }),
    default: () => ({}),
  }
}, { _id: false, timestamps: true });

module.exports = mongoose.model('User', userSchema);
