const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const {
  register,
  login,
  createGuest,
  refreshToken,
  convertGuest,
  googleLogin,
  googleLoginWeb,
  exchangeGoogleCode,
  updateCalendarAccess,
  toggleCalendarSync,
  disconnectCalendar,
  updateShowCompletedTodos,
  migrateGuestData,
  updateTimeZone,
  updateProfile,
  checkHandle,
  verifyPassword,
  getSettings,
  updateSettings,
  deleteAccount
} = require('../controllers/authController');

router.post('/register', register);
router.post('/login', login);
router.post('/guest', createGuest); // 게스트 생성
router.post('/refresh', refreshToken); // Access Token 갱신
router.post('/convert-guest', auth, convertGuest); // 게스트 → 정회원 전환
router.post('/migrate-guest-data', migrateGuestData); // 게스트 데이터 마이그레이션
router.post('/google', googleLogin); // 모바일용 (ID Token)
router.post('/google/web', googleLoginWeb); // 웹용 (Access Token)
router.post('/google/calendar/code', auth, exchangeGoogleCode); // 웹용 캘린더 인증 (코드 교환)
router.post('/google/calendar', auth, updateCalendarAccess); // 캘린더 인증
router.post('/google/calendar/toggle', auth, toggleCalendarSync); // 캘린더 동기화 ON/OFF
router.post('/google/calendar/disconnect', auth, disconnectCalendar); // 인증 정보 삭제

router.get('/settings', auth, getSettings); // 설정 조회 (GET)
router.patch('/settings', auth, updateSettings); // 설정 일괄 업데이트 (PATCH)
router.post('/show-completed-todos', auth, updateShowCompletedTodos); // 완료된 할일 표시 설정
router.post('/timezone', auth, updateTimeZone); // 타임존 업데이트
router.post('/profile', auth, updateProfile); // 프로필 업데이트 (닉네임, 핸들)
router.post('/handle/check', checkHandle); // 핸들 중복 확인 (인증 불필요 - 가입시에도 쓸 수 있게)
router.post('/verify-password', auth, verifyPassword); // 비밀번호 확인
router.delete('/delete', auth, deleteAccount); // 회원 탈퇴

module.exports = router;
