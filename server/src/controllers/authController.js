const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const Category = require('../models/Category');
const { generateId, generateGuestId } = require('../utils/idGenerator');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

async function ensureInbox(userId) {
  if (!userId) return null;

  const inbox = await Category.findOne({
    userId,
    systemKey: 'inbox',
    deletedAt: null,
  });

  if (!inbox) {
    return Category.create({
      _id: generateId(),
      userId,
      name: 'Inbox',
      color: '#CCCCCC',
      order: 0,
      systemKey: 'inbox',
    });
  }

  let changed = false;

  if (inbox.order !== 0) {
    inbox.order = 0;
    changed = true;
  }
  if (inbox.name !== 'Inbox') {
    inbox.name = 'Inbox';
    changed = true;
  }
  if (inbox.color !== '#CCCCCC') {
    inbox.color = '#CCCCCC';
    changed = true;
  }

  if (changed) {
    await inbox.save();
  }

  return inbox;
}

function deriveAuthAccountType(user) {
  if (!user) return 'anonymous';

  if (user.provider === 'google' || user.googleId) {
    return 'google';
  }

  if (user.provider === 'apple' || user.appleId) {
    return 'apple';
  }

  if (user.email || user.password || user.accountType === 'local') {
    return 'local';
  }

  return 'anonymous';
}

async function reconcileAuthAccountType(user, options = {}) {
  if (!user) return user;

  const expectedAccountType = deriveAuthAccountType(user);
  if (user.accountType !== expectedAccountType) {
    user.accountType = expectedAccountType;
    await user.save(options);
  }

  return user;
}

function serializeAuthUser(user) {
  return {
    _id: user._id,
    id: user._id,
    email: user.email,
    name: user.name,
    accountType: user.accountType,
    provider: user.provider,
    hasCalendarAccess: !!user.googleAccessToken,
    settings: user.settings,
    ...(user.picture ? { picture: user.picture } : {}),
    ...(user.handle ? { handle: user.handle } : {}),
  };
}

exports.register = async (req, res) => {
  try {
    const { email, password, name, timeZone } = req.body;

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: '유효하지 않은 이메일 형식입니다.' });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '이미 가입된 이메일입니다.' });
    }

    // 핸들 자동 생성
    let initialHandle = email.split('@')[0].toLowerCase();

    // 허용되지 않는 문자 제거 (영문 소문자, 숫자, 밑줄, 마침표만 허용)
    initialHandle = initialHandle.replace(/[^a-z0-9_.]/g, '');

    // 길이가 너무 짧거나 없으면 Inbox값 설정
    if (initialHandle.length < 3) {
      initialHandle = `user_${Math.floor(1000 + Math.random() * 9000)}`;
    }

    let validatedHandle = initialHandle;
    let isUnique = false;
    let attempts = 0;

    // 예약어 체크
    const reservedHandles = [
      'admin', 'administrator', 'root', 'support', 'help', 'info',
      'manager', 'test', 'dev', 'api', 'signin', 'signup', 'login',
      'logout', 'register', 'profile', 'settings'
    ];

    while (!isUnique && attempts < 10) {
      if (reservedHandles.includes(validatedHandle)) {
        validatedHandle = `${initialHandle}${Math.floor(1000 + Math.random() * 9000)}`;
      } else {
        const existingHandle = await User.findOne({ handle: validatedHandle });
        if (!existingHandle) {
          isUnique = true;
        } else {
          validatedHandle = `${initialHandle}${Math.floor(1000 + Math.random() * 9000)}`;
        }
      }
      attempts++;
    }

    // 10번 시도해도 중복이면 타임스탬프 추가
    if (!isUnique) {
      validatedHandle = `${initialHandle}${Date.now()}`;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = generateId();  // UUID 생성
    const user = await User.create({
      _id: userId,
      email,
      password: hashedPassword,
      name,
      accountType: 'local',
      handle: validatedHandle,
      settings: {
        timeZone: timeZone || 'Asia/Seoul',
        theme: 'system',
        language: 'system'
      }
    });

    await ensureInbox(user._id);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.status(201).json({
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// 게스트 생성
exports.createGuest = async (req, res) => {
  try {
    const { userId, timeZone } = req.body;

    // UUID 유효성 검증
    const { isValidUUID } = require('../utils/idGenerator');
    if (!userId || !isValidUUID(userId)) {
      return res.status(400).json({ message: '유효하지 않은 UUID입니다' });
    }

    // 중복 체크
    const existing = await User.findById(userId);
    if (existing) {
      return res.status(400).json({ message: '이미 존재하는 사용자입니다' });
    }

    // 게스트 사용자 생성
    const user = await User.create({
      _id: userId,
      accountType: 'anonymous',
      name: 'Guest User',
      provider: 'local',
      settings: {
        timeZone: timeZone || 'Asia/Seoul',
        theme: 'system',
        language: 'system',
      }
    });

    await ensureInbox(user._id);

    // Access Token (7일)
    const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    // Refresh Token (90일)
    const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, {
      expiresIn: '90d',
    });

    // Refresh Token DB 저장
    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      accessToken,
      refreshToken,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error('Create guest error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Refresh Token으로 Access Token 갱신
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token required' });
    }

    // Refresh Token 검증
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

    // DB에서 사용자 조회
    const user = await User.findById(decoded.userId);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    // 새 Access Token 발급
    const newAccessToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ message: 'Token expired or invalid' });
  }
};

// 게스트 → 정회원 전환
exports.convertGuest = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    const userId = req.userId; // auth 미들웨어에서 추출

    // 현재 사용자 조회
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // 게스트가 아니면 에러
    if (user.accountType !== 'anonymous') {
      return res.status(400).json({ message: '이미 정회원입니다' });
    }

    // 이메일 중복 체크
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '이미 사용 중인 이메일입니다' });
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: '유효하지 않은 이메일 형식입니다' });
    }

    // 비밀번호 길이 검증
    if (password.length < 6) {
      return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다' });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 정보 업데이트
    user.email = email;
    user.password = hashedPassword;
    user.name = name || user.name;
    user.accountType = 'local';
    await user.save();

    await ensureInbox(user._id);

    res.json({
      message: '회원 전환 완료',
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error('Convert guest error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    console.log('Login request received:', req.body);
    const { email, password } = req.body;

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ message: 'Email and password are required' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      console.log('User not found:', email);
      return res.status(400).json({ message: '존재하지 않는 이메일입니다.' });
    }

    console.log('User found, checking password...');
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log('Password mismatch');
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다.' });
    }

    console.log('Password match, creating token...');

    user = await reconcileAuthAccountType(user);
    await ensureInbox(user._id);

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    console.log('Login successful for:', email);

    res.json({
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

exports.googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;

    // 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;

    // 사용자 찾기 또는 생성
    let user = await User.findOne({ email });

    if (!user) {
      const userId = generateId();
      user = await User.create({
        _id: userId,
        email,
        name,
        googleId,
        accountType: 'google',
        provider: 'google',
        picture,
      });
      await ensureInbox(user._id);
    } else if (!user.googleId) {
      // 기존 이메일 계정에 구글 연동
      user.googleId = googleId;
      user.accountType = 'google';
      user.provider = 'google';
      user.picture = picture;
      await user.save();

      await ensureInbox(user._id);
    }

    // JWT 토큰 생성
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({ message: '구글 로그인 실패', error: error.message });
  }
};

// 웹용 구글 로그인 (access token 방식)
exports.googleLoginWeb = async (req, res) => {
  try {
    const { accessToken, email, name, googleId } = req.body;

    if (!email || !googleId) {
      return res.status(400).json({ message: '필수 정보가 누락되었습니다' });
    }

    // 사용자 찾기 또는 생성
    let user = await User.findOne({ email });

    if (!user) {
      user = await User.create({
        _id: generateId(),
        email,
        name,
        googleId,
        accountType: 'google',
        provider: 'google',
      });
    } else if (!user.googleId) {
      // 기존 이메일 계정에 구글 연동
      user.googleId = googleId;
      user.accountType = 'google';
      user.provider = 'google';
      await user.save();
    }

    await ensureInbox(user._id);

    // JWT 토큰 생성
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({
      token,
      user: serializeAuthUser(user),
    });
  } catch (error) {
    console.error('Google web login error:', error);
    res.status(401).json({ message: '구글 로그인 실패', error: error.message });
  }
};

// 구글 인증 코드를 토큰으로 교환 (웹용 캘린더 권한)
exports.exchangeGoogleCode = async (req, res) => {
  try {
    const { code } = req.body;
    const userId = req.userId;

    console.log('🔑 [exchangeGoogleCode] 인증 코드 교환 시작:', { userId, code: code?.substring(0, 20) + '...' });

    if (!code) {
      return res.status(400).json({ message: '인증 코드가 필요합니다' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // OAuth2Client 설정
    const oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      'postmessage' // 웹용 리디렉션 URI
    );

    console.log('📞 [exchangeGoogleCode] 구글 토큰 교환 API 호출...');

    // 인증 코드를 토큰으로 교환
    const { tokens } = await oauth2Client.getToken(code);
    console.log('✅ [exchangeGoogleCode] 토큰 교환 성공:', {
      access_token: tokens.access_token?.substring(0, 20) + '...',
      refresh_token: !!tokens.refresh_token,
      scope: tokens.scope
    });

    // 토큰 저장
    user.googleAccessToken = tokens.access_token;
    if (tokens.refresh_token) {
      user.googleRefreshToken = tokens.refresh_token;
    }
    user.hasCalendarAccess = true;
    if (!user.settings) user.settings = {};
    user.settings.calendarSyncEnabled = true;
    await user.save();

    console.log('💾 [exchangeGoogleCode] 사용자 토큰 저장 완료');

    res.json({
      message: '구글 캘린더 연동 완료',
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        hasCalendarAccess: user.hasCalendarAccess,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error('❌ [exchangeGoogleCode] 토큰 교환 실패:', error);
    res.status(500).json({ message: '구글 캘린더 연동 실패', error: error.message });
  }
};

// 구글 캘린더 권한 업데이트 (할일 추가 화면에서 토글 ON 시)
exports.updateCalendarAccess = async (req, res) => {
  try {
    const { accessToken, refreshToken, googleId } = req.body;
    const userId = req.userId; // auth 미들웨어에서 추출

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // Access Token & Refresh Token 저장
    user.googleAccessToken = accessToken;
    if (refreshToken) {
      user.googleRefreshToken = refreshToken;
    }
    user.hasCalendarAccess = true;
    if (!user.settings) user.settings = {};
    user.settings.calendarSyncEnabled = true; // 인증 받으면 자동으로 ON

    // 구글 ID가 없으면 저장 (비구글 로그인 사용자)
    if (!user.googleId && googleId) {
      user.googleId = googleId;
    }

    await user.save();

    res.json({
      message: '캘린더 연동 완료',
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        hasCalendarAccess: user.hasCalendarAccess,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error('Calendar access update error:', error);
    res.status(500).json({ message: '캘린더 연동 실패', error: error.message });
  }
};

// 구글 캘린더 동기화 토글 (ON/OFF)
exports.toggleCalendarSync = async (req, res) => {
  try {
    const { enabled } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    if (!user.settings) user.settings = {};
    user.settings.calendarSyncEnabled = enabled;
    await user.save();

    res.json({
      message: enabled ? '캘린더 동기화 활성화' : '캘린더 동기화 비활성화',
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        hasCalendarAccess: user.hasCalendarAccess,
        settings: user.settings,
      },
    });
  } catch (error) {
    console.error('Toggle calendar sync error:', error);
    res.status(500).json({ message: '토글 실패', error: error.message });
  }
};

// 구글 캘린더 인증 정보 삭제
exports.disconnectCalendar = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // 토큰 삭제
    user.googleAccessToken = null;
    user.googleRefreshToken = null;
    user.hasCalendarAccess = false;
    if (!user.settings) user.settings = {};
    user.settings.calendarSyncEnabled = false;
    await user.save();

    res.json({ message: '캘린더 인증 정보 삭제 완료' });
  } catch (error) {
    console.error('Disconnect calendar error:', error);
    res.status(500).json({ message: '삭제 실패', error: error.message });
  }
};


// 완료된 할일 표시 설정 업데이트
exports.updateShowCompletedTodos = async (req, res) => {
  try {
    const { show } = req.body;
    const userId = req.userId;

    if (typeof show !== 'boolean') {
      return res.status(400).json({ message: '유효하지 않은 값입니다' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    if (!user.settings) user.settings = {};
    user.settings.showCompleted = show;
    await user.save();

    res.json({
      message: '완료된 할일 표시 설정 업데이트 완료',
      showCompletedTodos: user.settings.showCompleted,
    });
  } catch (error) {
    console.error('Update show completed todos error:', error);
    res.status(500).json({ message: '설정 업데이트 실패', error: error.message });
  }
};

// 타임존 업데이트
exports.updateTimeZone = async (req, res) => {
  try {
    const { timeZone } = req.body;
    const userId = req.userId;

    if (!timeZone) {
      return res.status(400).json({ message: '타임존이 필요합니다' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    if (!user.settings) user.settings = {};
    user.settings.timeZone = timeZone;
    await user.save();

    res.json({
      message: '타임존 업데이트 완료',
      timeZone: user.settings.timeZone,
    });
  } catch (error) {
    console.error('Update timezone error:', error);
    res.status(500).json({ message: '타임존 업데이트 실패', error: error.message });
  }
};

// 프로필 업데이트 (닉네임, 비밀번호)
exports.updateProfile = async (req, res) => {
  try {
    const { name, password } = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // 닉네임 업데이트
    if (name) {
      user.name = name;
    }

    // 비밀번호 업데이트
    if (password) {
      if (password.length < 6) {
        return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    await user.save();

    res.json({
      message: '프로필 업데이트 완료',
      user: {
        _id: user._id,
        id: user._id,
        email: user.email,
        name: user.name,
        handle: user.handle,
        provider: user.provider,
        hasCalendarAccess: user.hasCalendarAccess,
        settings: user.settings,
      },
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ message: '프로필 업데이트 실패', error: error.message });
  }
};

// 핸들 중복 확인 (단독 호출용)
exports.checkHandle = async (req, res) => {
  try {
    const { handle } = req.body;

    if (!handle) {
      return res.status(400).json({ message: '아이디를 입력해주세요' });
    }

    const cleanHandle = handle.replace(/^@/, '').toLowerCase();

    // 예약어 체크
    const reservedHandles = [
      'admin', 'administrator', 'root', 'support', 'help', 'info',
      'manager', 'test', 'dev', 'api', 'signin', 'signup', 'login',
      'logout', 'register', 'profile', 'settings'
    ];
    if (reservedHandles.includes(cleanHandle)) {
      return res.status(400).json({ message: '사용할 수 없는 아이디입니다 (예약어)' });
    }

    const existingUser = await User.findOne({ handle: cleanHandle });
    if (existingUser) {
      return res.status(400).json({ message: '이미 사용 중인 아이디입니다' });
    }

    res.json({ message: '사용 가능한 아이디입니다' });
  } catch (error) {
    console.error('Check handle error:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다', error: error.message });
  }
};

// 비밀번호 확인 (프로필 수정 접근용)
exports.verifyPassword = async (req, res) => {
  try {
    const { password } = req.body;
    const userId = req.userId;

    if (!password) {
      return res.status(400).json({ message: '비밀번호를 입력해주세요' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // 소셜 로그인 유저는 비밀번호가 없음 (예외 처리)
    if (!user.password && user.provider === 'google') {
      // 구글 로그인 유저는 일단 통과시키거나, 별도 인증 로직이 필요함.
      // 여기서는 비밀번호가 없으므로 비밀번호 검증을 패스(성공) 처리하거나 
      // 클라이언트에서 아예 요청을 안보내도록 처리해야 함.
      // 일단 서버에서는 "비밀번호가 없는 유저"는 검증 불가로 에러를 낼지 고민.
      // 요구사항: "비밀번호 물어보고 통과". 구글 유저는 비밀번호가 없으므로 해당 UI가 안뜨는게 맞음.
      // 만약 요청이 왔다면 에러.
      return res.status(400).json({ message: '소셜 로그인 사용자는 비밀번호가 없습니다.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: '비밀번호가 일치하지 않습니다' });
    }

    res.json({ message: '비밀번호 인증 성공' });
  } catch (error) {
    console.error('Verify password error:', error);
    res.status(500).json({ message: '서버 오류', error: error.message });
  }
};

// 설정 조회
exports.getSettings = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    res.json({
      settings: user.settings || {},
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ message: '설정 조회 실패', error: error.message });
  }
};

// 설정 일괄 업데이트
exports.updateSettings = async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    if (!user.settings) user.settings = {};

    // 설정 업데이트 (Merge)
    Object.keys(updates).forEach((key) => {
      // notification 같은 중첩 객체 처리
      if (key === 'notification' && typeof updates[key] === 'object' && updates[key] !== null) {
        user.settings.notification = {
          ...user.settings.notification,
          ...updates[key]
        };
      } else {
        // 기타 최상위 설정 (theme, language 등)
        user.settings[key] = updates[key];
      }
    });

    await user.save();

    res.json({
      message: '설정 업데이트 완료',
      settings: user.settings,
    });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ message: '설정 업데이트 실패', error: error.message });
  }
};

// 회원 탈퇴
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.userId;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '사용자를 찾을 수 없습니다' });
    }

    // 연관 데이터 삭제 (Cascading Delete)
    // 1. 할일 삭제
    const deletedTodos = await require('../models/Todo').deleteMany({ userId });
    console.log(`Deleted ${deletedTodos.deletedCount} todos for user ${userId}`);

    // 2. 카테고리 삭제
    const deletedCategories = await Category.deleteMany({ userId });
    console.log(`Deleted ${deletedCategories.deletedCount} categories for user ${userId}`);

    // 3. 사용자 삭제
    await User.findByIdAndDelete(userId);
    console.log(`Deleted user ${userId}`);

    res.json({ message: '회원 탈퇴가 완료되었습니다.' });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({ message: '회원 탈퇴 실패', error: error.message });
  }
};

// 게스트 데이터 마이그레이션
exports.migrateGuestData = async (req, res) => {
  const mongoose = require('mongoose');
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { email, password, guestData } = req.body;
    
    // 1. 사용자 인증
    let user = await User.findOne({ email }).session(session);
    
    if (!user) {
      await session.abortTransaction();
      return res.status(404).json({ 
        success: false,
        message: '사용자를 찾을 수 없습니다' 
      });
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await session.abortTransaction();
      return res.status(401).json({ 
        success: false,
        message: '비밀번호가 일치하지 않습니다' 
      });
    }

    user = await reconcileAuthAccountType(user, { session });
    
    const targetInbox = await Category.findOne({
      userId: user._id,
      systemKey: 'inbox',
      deletedAt: null,
    }).session(session);

    if (!targetInbox) {
      await session.abortTransaction();
      return res.status(409).json({
        success: false,
        message: '대상 계정 Inbox를 찾을 수 없습니다',
      });
    }

    // 3. Todos 삽입
    const Todo = require('../models/Todo');
    const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
    const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
    const LEGACY_GUEST_TODO_FIELDS = ['date', 'startDateTime', 'endDateTime', 'timeZone'];

    const normalizeDate = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return DATE_PATTERN.test(trimmed) ? trimmed : null;
    };

    const normalizeTime = (value) => {
      if (typeof value !== 'string') return null;
      const trimmed = value.trim();
      return TIME_PATTERN.test(trimmed) ? trimmed : null;
    };

    const normalizeRecurrence = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) {
        const sanitized = value.filter(item => typeof item === 'string' && item.trim().length > 0);
        return sanitized.length > 0 ? sanitized : null;
      }
      if (typeof value === 'string' && value.trim().length > 0) {
        return [value.trim()];
      }
      return null;
    };

    if (!guestData || !Array.isArray(guestData.todos) || !Array.isArray(guestData.completions)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'guestData 형식이 올바르지 않습니다',
      });
    }

    const todoValidationErrors = [];
    const todosToInsert = [];

    for (const [index, todo] of guestData.todos.entries()) {
      const rowErrors = [];
      const legacyFields = LEGACY_GUEST_TODO_FIELDS.filter(
        field => Object.prototype.hasOwnProperty.call(todo, field)
      );

      if (legacyFields.length > 0) {
        rowErrors.push(`legacy fields are not allowed: ${legacyFields.join(', ')}`);
      }

      if (typeof todo._id !== 'string' || !todo._id.trim()) {
        rowErrors.push('_id is required');
      }
      if (typeof todo.title !== 'string' || !todo.title.trim()) {
        rowErrors.push('title is required');
      }

      const startDate = normalizeDate(todo.startDate);
      const endDate = normalizeDate(todo.endDate);
      const startTime = normalizeTime(todo.startTime);
      const endTime = normalizeTime(todo.endTime);
      const recurrenceEndDate = normalizeDate(todo.recurrenceEndDate);
      const recurrence = normalizeRecurrence(todo.recurrence);
      const isAllDay = todo.isAllDay !== undefined ? !!todo.isAllDay : (!startTime && !endTime);

      if (!startDate) {
        rowErrors.push('startDate must match YYYY-MM-DD');
      }
      if (todo.endDate !== undefined && todo.endDate !== null && !endDate) {
        rowErrors.push('endDate must match YYYY-MM-DD');
      }
      if (todo.startTime !== undefined && todo.startTime !== null && !startTime) {
        rowErrors.push('startTime must match HH:mm');
      }
      if (todo.endTime !== undefined && todo.endTime !== null && !endTime) {
        rowErrors.push('endTime must match HH:mm');
      }
      if (todo.recurrenceEndDate !== undefined && todo.recurrenceEndDate !== null && !recurrenceEndDate) {
        rowErrors.push('recurrenceEndDate must match YYYY-MM-DD');
      }
      if (!isAllDay && !startTime) {
        rowErrors.push('startTime is required when isAllDay is false');
      }
      if (startDate && endDate && endDate < startDate) {
        rowErrors.push('endDate must be greater than or equal to startDate');
      }
      if (startDate && recurrenceEndDate && recurrenceEndDate < startDate) {
        rowErrors.push('recurrenceEndDate must be greater than or equal to startDate');
      }

      if (rowErrors.length > 0) {
        todoValidationErrors.push({
          index,
          _id: todo?._id ?? null,
          errors: rowErrors,
        });
        continue;
      }

      todosToInsert.push({
        _id: todo._id,
        userId: user._id,
        title: todo.title.trim(),
        categoryId: targetInbox._id,
        memo: typeof todo.memo === 'string' ? todo.memo : null,
        startDate,
        endDate: endDate || null,
        startTime: isAllDay ? null : startTime,
        endTime: isAllDay ? null : endTime,
        isAllDay,
        recurrence,
        recurrenceEndDate: recurrenceEndDate || null,
        createdAt: todo.createdAt || new Date(),
        updatedAt: todo.updatedAt || new Date(),
        syncStatus: 'synced',
        deletedAt: null,
        // order 필드 추가
        order: todo.order || {},
      });
    }

    if (todoValidationErrors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'guestData.todos 형식 검증 실패',
        errors: todoValidationErrors.slice(0, 20),
      });
    }
    
    if (todosToInsert.length > 0) {
      await Todo.insertMany(todosToInsert, { session });
      console.log(`✅ [Migration] Inserted ${todosToInsert.length} todos`);
    }
    
    // 4. Completions 삽입
    const Completion = require('../models/Completion');
    const importedTodoIds = new Set(todosToInsert.map(todo => todo._id));
    const completionValidationErrors = [];
    const completionsToInsert = [];

    guestData.completions.forEach((comp, index) => {
      const completion = {
        _id: comp._id,
        key: comp.key,
        todoId: comp.todoId,
        userId: user._id,
        date: comp.date,
        completedAt: comp.completedAt,
      };
      const rowErrors = [];

      if (typeof completion._id !== 'string' || !completion._id.trim()) {
        rowErrors.push('_id is required');
      }
      if (typeof completion.key !== 'string' || !completion.key.trim()) {
        rowErrors.push('key is required');
      }
      if (typeof completion.todoId !== 'string' || !completion.todoId.trim()) {
        rowErrors.push('todoId is required');
      }
      if (!completion.completedAt) {
        rowErrors.push('completedAt is required');
      }
      if (!importedTodoIds.has(completion.todoId)) {
        rowErrors.push('todoId must reference an imported todo');
      }

      if (rowErrors.length > 0) {
        completionValidationErrors.push({
          index,
          _id: completion?._id ?? null,
          errors: rowErrors,
        });
        return;
      }

      completionsToInsert.push(completion);
    });

    if (completionValidationErrors.length > 0) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'guestData.completions 형식 검증 실패',
        errors: completionValidationErrors.slice(0, 20),
      });
    }
    
    if (completionsToInsert.length > 0) {
      await Completion.insertMany(completionsToInsert, { session });
      console.log(`✅ [Migration] Inserted ${completionsToInsert.length} completions`);
    }
    
    // 5. 데이터 무결성 검증
    const verifyTodos = await Todo.find({ 
      userId: user._id,
      _id: { $in: todosToInsert.map(t => t._id) }
    }).session(session);
    
    if (verifyTodos.length !== todosToInsert.length) {
      throw new Error('Todo insertion verification failed');
    }
    
    const allHaveCorrectCategory = verifyTodos.every(
      t => t.categoryId === targetInbox._id
    );
    
    if (!allHaveCorrectCategory) {
      throw new Error('Category assignment verification failed');
    }

    const verifyCompletions = await Completion.find({
      userId: user._id,
      _id: { $in: completionsToInsert.map(c => c._id) },
    }).session(session);

    const allCompletionsLinked = verifyCompletions.every(
      completion => importedTodoIds.has(completion.todoId)
    );

    if (!allCompletionsLinked) {
      throw new Error('Completion linkage verification failed');
    }
    
    console.log('✅ [Migration] Data integrity verified');
    
    // 6. 트랜잭션 커밋
    await session.commitTransaction();
    
    // 7. JWT 토큰 생성
    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });
    
    console.log(`✅ [Migration] Completed for user: ${user.email}`);
    
    res.json({
      success: true,
      message: '마이그레이션 완료',
      token,
      user: serializeAuthUser(user),
      targetInboxCategoryId: targetInbox._id,
      stats: {
        todosInserted: todosToInsert.length,
        completionsInserted: completionsToInsert.length,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('❌ [Migration] Error:', {
      userId: req.body.email,
      error: error.message,
      stack: error.stack,
      guestDataSize: {
        todos: req.body.guestData?.todos?.length || 0,
        completions: req.body.guestData?.completions?.length || 0,
      },
    });
    
    res.status(500).json({ 
      success: false,
      message: '마이그레이션 실패', 
      error: error.message 
    });
  } finally {
    session.endSession();
  }
};
