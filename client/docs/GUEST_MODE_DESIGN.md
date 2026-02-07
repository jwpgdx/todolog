# Guest Mode Design Document

## Overview

게스트 모드는 회원가입 없이 앱을 즉시 사용할 수 있는 기능입니다. Offline-First 아키텍처를 기반으로 설계되었으며, 게스트 사용자도 정회원과 동일한 기능을 사용할 수 있습니다.

## Design Philosophy

### Core Principle: Guest = Anonymous User

```
게스트 ≈ 정회원 (이메일/비밀번호만 없음)
├─ 동일한 UUID 체계
├─ 동일한 데이터 구조
├─ 동일한 동기화 로직
└─ 동일한 API 호출
```

**게스트는 "로컬 전용 모드"가 아니라 "익명 정회원"입니다.**

---

## Why Server-Sync for Guests?

### ❌ 로컬 전용 방식의 문제점

```javascript
if (isGuest) {
  // SQLite에만 저장
  await todoService.create(todo);
} else {
  // SQLite + 서버 동기화
  await todoService.create(todo);
  await pendingService.add(...);
}
```

**문제:**
1. 모든 CRUD 로직에 분기 처리 필요
2. 회원 전환 시 Bulk Upload (네트워크 실패 위험)
3. 멀티 디바이스 불가능
4. 동기화 로직 이원화 (유지보수 지옥)


### ✅ 서버 동기화 방식의 장점

```javascript
// 게스트든 정회원이든 로직 동일
await todoService.create(todo);
await pendingService.add(...);
```

**장점:**
1. **단일 코드 경로**: 분기 처리 불필요
2. **간단한 회원 전환**: 이메일/비밀번호만 UPDATE
3. **멀티 디바이스 지원**: 게스트도 여러 기기에서 동기화 가능
4. **유지보수 용이**: 동기화 로직 하나만 관리

---

## Architecture

### 1. User Data Structure

#### Guest User
```javascript
{
  _id: "550e8400-e29b-41d4-a716-446655440000", // 클라이언트 생성 UUID
  email: null,          // ✅ null (게스트 구분자)
  password: null,       // ✅ null
  accountType: "anonymous",  // ✅ 게스트 타입 (isGuest 대체)
  name: "Guest User",
  provider: "local",
  hasCalendarAccess: false,
  settings: {
    timeZone: "Asia/Seoul",
    theme: "system",
    language: "system"
  }
}
```

#### Regular User (회원 전환 후)
```javascript
{
  _id: "550e8400-e29b-41d4-a716-446655440000", // ✅ UUID 동일
  email: "user@example.com",  // ✅ 추가됨
  password: "$2a$10$...",      // ✅ 추가됨
  accountType: "local",        // ✅ anonymous → local
  name: "John Doe",
  provider: "local",
  hasCalendarAccess: false,
  settings: { ... }
}
```

**accountType 값:**
- `anonymous`: 게스트 (이메일 없음)
- `local`: 이메일/비밀번호 회원
- `google`: 구글 로그인
- `apple`: 애플 로그인
- (확장 가능: `enterprise`, `team`, `trial`)


### 2. UUID Strategy

**핵심: 게스트도 일반 UUID 사용 (guest_ 접두사 없음)**

#### ❌ 잘못된 설계
```javascript
게스트: guest_550e8400-e29b-41d4-a716-446655440000
정회원 전환: 550e8400-e29b-41d4-a716-446655440000 (새로 발급)

문제:
- UUID 변경 → 모든 관계 데이터 UPDATE 필요
  - todos.userId 전부 UPDATE
  - categories.userId 전부 UPDATE
  - completions.userId 전부 UPDATE
- 클라이언트 SQLite도 전부 UPDATE
- 전환 중 에러 시 데이터 꼬임
```

#### ✅ 올바른 설계
```javascript
게스트: 550e8400-e29b-41d4-a716-446655440000
정회원 전환: 550e8400-e29b-41d4-a716-446655440000 (그대로)

장점:
- UUID 변경 불필요
- User 테이블에 email/password만 UPDATE
- 관계 데이터 건드릴 필요 없음
- 전환 로직 초간단
```

### 3. Guest Identification

```javascript
// 게스트 판별 로직
const isGuest = user.accountType === 'anonymous';

// 동기화 여부 판단
const shouldSync = user && !isGuest && token;
```

---

## Implementation Plan

### Phase 1: Guest Creation

#### Server API
```javascript
POST /auth/guest
Body: { 
  userId: "550e8400-e29b-41d4-a716-446655440000",  // ✅ 클라이언트 생성 UUID
  timeZone: "Asia/Seoul" 
}

Response: {
  accessToken: "jwt_access_token",   // ✅ 7일
  refreshToken: "jwt_refresh_token", // ✅ 90일
  user: {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: null,
    accountType: "anonymous",
    name: "Guest User",
    ...
  }
}
```


#### Server Implementation
```javascript
// server/src/controllers/authController.js
exports.createGuest = async (req, res) => {
  const { userId, timeZone } = req.body; // ✅ 클라이언트에서 UUID 받음
  
  // UUID 유효성 검증
  if (!userId || !isValidUUID(userId)) {
    return res.status(400).json({ message: '유효하지 않은 UUID입니다' });
  }
  
  // 중복 체크
  const existing = await User.findById(userId);
  if (existing) {
    return res.status(400).json({ message: '이미 존재하는 사용자입니다' });
  }
  
  const user = await User.create({
    _id: userId, // ✅ 클라이언트가 생성한 UUID 사용
    email: null,
    password: null,
    accountType: 'anonymous', // ✅ isGuest 대신 accountType
    name: 'Guest User',
    provider: 'local',
    settings: {
      timeZone: timeZone || 'Asia/Seoul',
      theme: 'system',
      language: 'system',
    }
  });
  
  // Inbox 카테고리 생성
  await Category.create({
    _id: generateId(),
    userId: user._id,
    name: 'Inbox',
    isDefault: true,
    color: '#CCCCCC'
  });
  
  // ✅ Access + Refresh Token 발급
  const accessToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
    expiresIn: '7d',
  });
  
  const refreshToken = jwt.sign({ userId: user._id }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '90d',
  });
  
  // Refresh Token DB 저장
  user.refreshToken = refreshToken;
  await user.save();
  
  res.json({ 
    accessToken, 
    refreshToken,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      accountType: user.accountType,
      provider: user.provider,
      hasCalendarAccess: user.hasCalendarAccess,
      settings: user.settings,
    }
  });
};
```

#### Client Implementation
```javascript
// client/src/store/authStore.js
loginAsGuest: async () => {
  // ✅ 1. 클라이언트에서 UUID 생성
  const guestId = crypto.randomUUID();
  const timeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';
  
  // ✅ 2. 온라인 체크 (오프라인 게스트 생성 제거)
  if (!navigator.onLine) {
    throw new Error('게스트 모드는 인터넷 연결이 필요합니다');
  }
  
  // ✅ 3. 서버에 게스트 생성 요청 (UUID 전송)
  const response = await api.post('/auth/guest', { 
    userId: guestId,
    timeZone 
  });
  
  const { accessToken, refreshToken, user } = response.data;
  
  // ✅ 4. 로컬 저장
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  
  set({ token: accessToken, user, isLoading: false });
}
```


#### UI Implementation (Welcome Screen)
```javascript
// client/src/screens/WelcomeScreen.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { loginAsGuest } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = async () => {
    try {
      setIsLoading(true);
      await loginAsGuest();
      // 게스트 로그인 성공 시 자동으로 Home으로 이동 (authStore에서 처리)
    } catch (error) {
      Toast.show({
        type: 'error',
        text1: '시작 실패',
        text2: error.message || '다시 시도해주세요'
      });
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center items-center bg-white px-6">
      {/* 앱 아이콘/로고 */}
      <Text className="text-6xl mb-4">📝</Text>
      
      {/* 앱 이름 */}
      <Text className="text-4xl font-bold text-gray-800 mb-2">
        Todolog
      </Text>
      
      {/* 설명 */}
      <Text className="text-gray-500 text-center mb-12">
        할 일을 기록하고 관리하세요
      </Text>

      {/* 시작하기 버튼 (큰 버튼) */}
      <TouchableOpacity
        className={`w-full rounded-xl py-4 mb-4 ${isLoading ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
        onPress={handleGetStarted}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold text-lg">
            시작하기
          </Text>
        )}
      </TouchableOpacity>

      {/* 로그인 링크 (작은 텍스트) */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('Login')}
        className="p-2"
      >
        <Text className="text-gray-500 text-center">
          이미 계정이 있으신가요? <Text className="text-blue-500 font-semibold">로그인</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
```

---

### Phase 2: Guest to Regular User Conversion

#### Server API
```javascript
PATCH /auth/guest/convert
Headers: { Authorization: "Bearer <guest_jwt_token>" }
Body: {
  email: "user@example.com",
  password: "123456",
  name: "John Doe"
}

Response: {
  message: "회원 전환 완료",
  user: {
    id: "uuid", // ✅ 동일한 UUID
    email: "user@example.com",
    isGuest: false,
    ...
  }
}
```

#### Server Implementation
```javascript
// server/src/controllers/authController.js
exports.convertGuest = async (req, res) => {
  const { email, password, name } = req.body;
  const userId = req.userId; // JWT에서 추출
  
  // ✅ Transaction 사용 (안전성)
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const user = await User.findById(userId).session(session);
    if (!user || user.accountType !== 'anonymous') {
      await session.abortTransaction();
      return res.status(400).json({ message: '게스트 사용자가 아닙니다' });
    }
    
    // 이메일 중복 체크
    const existing = await User.findOne({ email }).session(session);
    if (existing) {
      await session.abortTransaction();
      return res.status(400).json({ 
        message: '이미 사용 중인 이메일입니다',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    // ✅ 이메일/비밀번호만 UPDATE (UUID 변경 없음)
    user.email = email;
    user.password = await bcrypt.hash(password, 10);
    user.name = name;
    user.accountType = 'local'; // ✅ anonymous → local
    await user.save({ session });
    
    await session.commitTransaction();
    
    res.json({ 
      message: '회원 전환 완료',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accountType: user.accountType,
        provider: user.provider,
        hasCalendarAccess: user.hasCalendarAccess,
        settings: user.settings,
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
```


#### Client Implementation
```javascript
// client/src/store/authStore.js
convertGuestToUser: async (email, password, name) => {
  try {
    const response = await api.patch('/auth/guest/convert', {
      email,
      password,
      name
    });
    
    const { user: updatedUser } = response.data;
    
    // 로컬 user 정보 업데이트
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
    
    return updatedUser;
  } catch (error) {
    throw error;
  }
}
```

#### UI Implementation
```javascript
// client/src/screens/ProfileScreen.js
{user?.accountType === 'anonymous' && (
  <View className="bg-blue-50 p-4 rounded-xl mb-4 border border-blue-200">
    <Text className="text-blue-800 font-semibold mb-2">
      💡 게스트 모드로 사용 중입니다
    </Text>
    <Text className="text-blue-600 text-sm mb-3">
      계정을 만들어 데이터를 안전하게 백업하세요
    </Text>
    <TouchableOpacity
      className="bg-blue-500 py-3 rounded-lg"
      onPress={() => navigation.navigate('ConvertGuest')}
    >
      <Text className="text-white text-center font-semibold">
        계정 만들기
      </Text>
    </TouchableOpacity>
  </View>
)}
```

---

### Phase 3: Google/Apple Sign-In Conversion

#### Server API
```javascript
PATCH /auth/guest/convert/google
Headers: { Authorization: "Bearer <guest_jwt_token>" }
Body: {
  idToken: "google_id_token"
}

Response: {
  message: "구글 계정 연동 완료",
  user: { ... }
}
```

#### Server Implementation
```javascript
// server/src/controllers/authController.js
exports.convertGuestToGoogle = async (req, res) => {
  const { idToken } = req.body;
  const userId = req.userId;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const user = await User.findById(userId).session(session);
    if (!user || user.accountType !== 'anonymous') {
      await session.abortTransaction();
      return res.status(400).json({ message: '게스트 사용자가 아닙니다' });
    }
    
    // 구글 토큰 검증
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, sub: googleId, picture } = payload;
    
    // 이메일 중복 체크
    const existing = await User.findOne({ email }).session(session);
    if (existing) {
      await session.abortTransaction();
      return res.status(400).json({ 
        message: '이미 사용 중인 이메일입니다',
        code: 'EMAIL_ALREADY_EXISTS'
      });
    }
    
    // ✅ 구글 정보로 업데이트
    user.email = email;
    user.name = name;
    user.googleId = googleId;
    user.picture = picture;
    user.provider = 'google';
    user.accountType = 'google'; // ✅ anonymous → google
    await user.save({ session });
    
    await session.commitTransaction();
    
    res.json({ 
      message: '구글 계정 연동 완료',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        provider: user.provider,
        accountType: user.accountType,
        hasCalendarAccess: user.hasCalendarAccess,
        settings: user.settings,
      }
    });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};
```


---

## Data Flow

### Guest User Journey (Welcome Screen)

```
1. 앱 설치
   ↓
2. Welcome 화면
   - [시작하기] ← 70% 신규 사용자
   - [로그인] ← 30% 기존 사용자
   ↓
3a. "시작하기" 클릭 (게스트 생성)
   ↓
4a. POST /auth/guest
   - 클라이언트에서 UUID 생성
   - 서버에 User 생성 (accountType: 'anonymous')
   - Access Token (7일) + Refresh Token (90일) 발급
   - Inbox 카테고리 생성
   ↓
5a. Todo 화면 (정회원과 동일)
   - 할일 생성 → SQLite + 서버 동기화
   - 카테고리 생성 → SQLite + 서버 동기화
   - 완료 토글 → SQLite + 서버 동기화
   ↓
6a. "계정 만들기" 클릭 (프로필 화면 배너)
   ↓
7a. PATCH /auth/guest/convert
   - User 테이블에 email/password만 UPDATE
   - accountType: 'anonymous' → 'local'
   - UUID 변경 없음
   - 모든 관계 데이터 그대로 유지
   ↓
8a. 정회원으로 전환 완료

OR

3b. "로그인" 클릭 (기존 사용자)
   ↓
4b. 로그인 화면
   ↓
5b. POST /auth/login
   ↓
6b. Todo 화면 (기존 데이터 로드)
```

### Synchronization Flow

```javascript
// 게스트든 정회원이든 동일한 로직
const createTodo = async (todoData) => {
  // 1. SQLite에 저장
  await todoService.create(todoData);
  
  // 2. Pending Change 추가
  await pendingService.add({
    type: 'createTodo',
    entityId: todoData._id,
    data: todoData
  });
  
  // 3. 동기화 (백그라운드)
  // - 게스트: JWT 토큰 있음 → 서버 동기화 성공
  // - 정회원: JWT 토큰 있음 → 서버 동기화 성공
  syncTodos();
};
```

---

## Key Differences from Local-Only Approach

| 항목 | 로컬 전용 방식 | 서버 동기화 방식 (채택) |
|------|---------------|----------------------|
| **게스트 데이터 위치** | SQLite만 | 서버 + SQLite |
| **서버 API 호출** | ❌ 안함 | ✅ 함 |
| **JWT 토큰** | ❌ 없음 | ✅ 있음 |
| **동기화 로직** | 분기 처리 필요 | 단일 로직 |
| **회원 전환** | Bulk Upload (복잡) | UPDATE만 (단순) |
| **멀티 디바이스** | ❌ 불가능 | ✅ 가능 |
| **코드 복잡도** | 높음 (이원화) | 낮음 (단일화) |
| **유지보수** | 어려움 | 쉬움 |


---

## Security Considerations

### 1. Guest Token Expiry
```javascript
// 게스트 토큰은 길게 설정 (1년)
const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
  expiresIn: '365d',
});
```

**이유:**
- 게스트는 비밀번호가 없어 재로그인 불가
- 토큰 만료 시 데이터 접근 불가 → 사용자 경험 악화
- 1년 후에도 사용 중이면 자동 갱신 로직 추가 가능

### 2. Guest Data Cleanup (Optional)
```javascript
// 30일 이상 미접속 게스트 자동 삭제 (Cron Job)
const inactiveGuests = await User.find({
  isGuest: true,
  updatedAt: { $lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
});

for (const guest of inactiveGuests) {
  await Todo.deleteMany({ userId: guest._id });
  await Category.deleteMany({ userId: guest._id });
  await Completion.deleteMany({ userId: guest._id });
  await User.findByIdAndDelete(guest._id);
}
```

### 3. Rate Limiting
```javascript
// 게스트는 API 호출 제한 강화 (선택사항)
if (user.isGuest) {
  // 게스트: 100 requests/hour
  rateLimit = 100;
} else {
  // 정회원: 1000 requests/hour
  rateLimit = 1000;
}
```

---

## Edge Cases

### 1. 오프라인에서 게스트 생성 시도 ✅ (차단됨)
```javascript
// client/src/store/authStore.js
loginAsGuest: async () => {
  // ✅ 온라인 체크
  if (!navigator.onLine) {
    throw new Error('게스트 모드는 인터넷 연결이 필요합니다');
  }
  
  const guestId = crypto.randomUUID();
  const timeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';
  
  const response = await api.post('/auth/guest', { 
    userId: guestId,
    timeZone 
  });
  
  const { accessToken, refreshToken, user } = response.data;
  
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  
  set({ token: accessToken, user, isLoading: false });
}
```

**이유:** UUID 충돌 방지, 복잡도 감소


### 2. 게스트 전환 중 네트워크 실패
```javascript
// client/src/store/authStore.js
convertGuestToUser: async (email, password, name) => {
  try {
    const response = await api.patch('/auth/guest/convert', {
      email, password, name
    });
    
    const { user: updatedUser } = response.data;
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
    
    return updatedUser;
  } catch (error) {
    if (error.message === 'Network Error') {
      // ✅ 오프라인: 로컬에 전환 요청 저장
      await AsyncStorage.setItem('pendingConversion', JSON.stringify({
        email, password, name
      }));
      
      throw new Error('네트워크 연결을 확인해주세요. 온라인 상태에서 다시 시도됩니다.');
    }
    throw error;
  }
}
```

### 3. 동일 이메일로 이미 가입된 경우 ✅ (UX 개선)
```javascript
// 서버에서 에러 반환
if (existing) {
  return res.status(400).json({ 
    message: '이미 사용 중인 이메일입니다',
    code: 'EMAIL_ALREADY_EXISTS'
  });
}

// 클라이언트에서 처리 (UX 개선)
catch (error) {
  if (error.response?.data?.code === 'EMAIL_ALREADY_EXISTS') {
    // ✅ 선택지 제공
    Alert.alert(
      '이미 가입된 이메일',
      '이 이메일은 이미 사용 중입니다.\n\n현재 게스트 데이터를 유지하려면 다른 이메일로 가입하세요.\n\n기존 계정으로 로그인하면 현재 데이터는 삭제됩니다.',
      [
        {
          text: '다른 이메일 사용',
          style: 'default'
        },
        {
          text: '기존 계정 로그인',
          style: 'destructive',
          onPress: () => {
            // 게스트 데이터 경고 후 로그인 화면으로
            navigation.navigate('Login');
          }
        }
      ]
    );
  }
}
```

---

## Testing Checklist

### Phase 1: Welcome Screen & Guest Creation
- [ ] Welcome 화면 표시 (최초 실행 시)
- [ ] "시작하기" 버튼 → 게스트 생성
- [ ] "로그인" 링크 → 로그인 화면
- [ ] 온라인 체크 (오프라인 시 에러 메시지)
- [ ] 게스트 생성 성공 → Todo 화면 자동 이동
- [ ] 게스트로 할일 생성/수정/삭제
- [ ] 게스트로 카테고리 생성/수정/삭제
- [ ] 게스트로 완료 토글
- [ ] 게스트 데이터 서버 동기화 확인
- [ ] 앱 재시작 후 게스트 세션 유지 확인
- [ ] 앱 재시작 시 Welcome 화면 스킵 (이미 로그인됨)

### Phase 2: Guest Conversion
- [ ] 프로필 화면에 게스트 배너 표시
- [ ] "계정 만들기" 버튼 → ConvertGuestScreen
- [ ] 이메일/비밀번호로 회원 전환
- [ ] 구글 계정으로 회원 전환
- [ ] 애플 계정으로 회원 전환 (iOS)
- [ ] 전환 후 UUID 동일 확인
- [ ] 전환 후 기존 데이터 유지 확인
- [ ] 전환 후 동기화 정상 작동 확인
- [ ] 이메일 중복 시 UX 처리 (Alert 선택지)
- [ ] 오프라인 상태에서 전환 시도 (에러 메시지)

### Phase 3: Edge Cases
- [ ] Welcome 화면에서 "로그인" 선택 → 기존 계정 로그인
- [ ] 게스트 상태에서 기존 계정 로그인 시도 → 게스트 데이터 삭제 경고
- [ ] 게스트 계정으로 여러 기기 로그인 (JWT 공유)
- [ ] 기기 간 데이터 동기화 확인
- [ ] 한 기기에서 전환 → 다른 기기에서 자동 반영
- [ ] Refresh Token 만료 시 자동 갱신
- [ ] Access Token 만료 시 자동 갱신 (Axios interceptor)

---

## Implementation Checklist

### Server
- [ ] `POST /auth/guest` API 구현 (클라이언트 UUID 받기)
- [ ] `POST /auth/refresh` API 구현 (Refresh Token)
- [ ] `PATCH /auth/guest/convert` API 구현 (Transaction 사용)
- [ ] `PATCH /auth/guest/convert/google` API 구현 (Transaction 사용)
- [ ] `PATCH /auth/guest/convert/apple` API 구현 (선택)
- [ ] Guest cleanup Cron Job 구현 (필수 - 90일)
- [ ] Rate limiting for guests (선택)
- [ ] User Model에 `accountType`, `refreshToken` 필드 추가

### Client
- [ ] **WelcomeScreen 구현** (시작하기 + 로그인 선택)
- [ ] `authStore.loginAsGuest()` 구현 (클라이언트 UUID 생성)
- [ ] `authStore.refreshAccessToken()` 구현 (자동 갱신)
- [ ] `authStore.convertGuestToUser()` 구현
- [ ] `authStore.convertGuestToGoogle()` 구현
- [ ] **Navigation 수정** (최초 실행 시 WelcomeScreen)
- [ ] ProfileScreen 게스트 배너 추가 (accountType 체크)
- [ ] ConvertGuestScreen 구현 (이메일/비밀번호 입력)
- [ ] 이메일 중복 시 UX 개선 (Alert 선택지)
- [ ] Axios interceptor에 Refresh Token 로직 추가
- [ ] 기존 계정 로그인 시 게스트 데이터 처리 (삭제 경고)

### Documentation
- [ ] requirements.md 업데이트 (accountType, Refresh Token)
- [ ] ROADMAP.md 업데이트
- [ ] README.md 업데이트 (Guest Mode 섹션 추가)
- [ ] User Model 스키마 문서화


---

## API Routes Summary

### Server Routes
```javascript
// server/src/routes/auth.js
router.post('/guest', createGuest);                          // 게스트 생성 (UUID 받기)
router.post('/refresh', refreshToken);                       // Access Token 갱신
router.patch('/guest/convert', auth, convertGuest);          // 이메일 회원 전환
router.patch('/guest/convert/google', auth, convertGuestToGoogle);  // 구글 전환
router.patch('/guest/convert/apple', auth, convertGuestToApple);    // 애플 전환 (선택)
```

---

## Database Schema Changes

### User Model (Changes Required) ✅
```javascript
// server/src/models/User.js
{
  _id: String,           // UUID (클라이언트 생성)
  email: String,         // null 허용 (게스트는 null)
  password: String,      // null 허용 (게스트는 null)
  accountType: {         // ✅ 추가 (isGuest 대체)
    type: String,
    enum: ['anonymous', 'local', 'google', 'apple'],
    default: 'anonymous'
  },
  refreshToken: String,  // ✅ 추가 (Refresh Token 저장)
  name: String,
  provider: String,
  googleId: String,
  appleId: String,
  ...
}
```

**변경 사항:**
1. ✅ `isGuest` → `accountType` (확장성)
2. ✅ `refreshToken` 필드 추가 (보안)
3. ✅ 클라이언트 생성 UUID 수용

---

## Performance Considerations

### 1. Guest User Count
```
예상 게스트 비율: 30-50% (일반적인 앱)
게스트 → 정회원 전환율: 10-20%

시나리오:
- 월 1만 명 신규 사용자
- 5천 명 게스트 생성
- 1천 명 정회원 전환
- 4천 명 게스트 유지 (30일 후 자동 삭제)
```

### 2. Database Impact
```
게스트 1명당 데이터:
- User: 1 document (~1KB)
- Category: 1-5 documents (~5KB)
- Todo: 0-100 documents (~50KB)
- Completion: 0-500 documents (~25KB)

총: ~81KB per guest

4천 명 게스트 = 324MB (무시 가능한 수준)
```

### 3. Server Load
```
게스트도 정회원처럼 API 호출
→ 서버 부하 증가 가능

대응:
1. Rate limiting (게스트는 더 낮은 제한)
2. CDN 캐싱 (정적 리소스)
3. 게스트 데이터 자동 삭제 (30일)
```

---

## Migration Plan (기존 사용자 영향 없음)

### 1. 서버 배포
```bash
# 1. 새 API 라우트 추가
POST /auth/guest
PATCH /auth/guest/convert
PATCH /auth/guest/convert/google

# 2. 기존 API 영향 없음 (하위 호환성 유지)
# 3. 배포 후 즉시 사용 가능
```

### 2. 클라이언트 배포
```bash
# 1. LoginScreen에 "게스트로 시작하기" 버튼 추가
# 2. 기존 로그인/회원가입 로직 영향 없음
# 3. 앱 업데이트 후 즉시 사용 가능
```

### 3. 롤백 계획
```bash
# 문제 발생 시:
1. 클라이언트: "게스트로 시작하기" 버튼 숨김
2. 서버: 게스트 생성 API 비활성화
3. 기존 게스트 사용자는 계속 사용 가능 (JWT 유효)
```

---

## Conclusion

게스트 모드는 **서버 동기화 방식**으로 구현하여:

1. ✅ **단순한 코드**: 게스트와 정회원의 로직 통일
2. ✅ **안전한 전환**: UUID 변경 없이 이메일만 추가
3. ✅ **확장 가능**: 멀티 디바이스 지원
4. ✅ **유지보수 용이**: 동기화 로직 단일화
5. ✅ **보안 강화**: Refresh Token 패턴
6. ✅ **명확한 타입**: accountType으로 확장 가능

**핵심 원칙: Guest = Anonymous User (Not Local-Only User)**

**주요 개선 사항 (3개 AI 리뷰 반영):**
- UUID 생성 주체 → 클라이언트 (Gemini 제안)
- Refresh Token 추가 (Claude, GPT 제안)
- accountType 필드 (GPT 제안)
- 오프라인 게스트 생성 제거 (GPT 제안)
- 데이터 정리 90일 (Claude 제안)

---

## References

- [Offline-First Architecture](.kiro/steering/requirements.md#offline-first-architecture)
- [UUID Migration Plan](UUID_MIGRATION_PLAN.md)
- [Sync Implementation](OPTIMISTIC_UPDATE_COMPLETED.md)
- [User Model](../server/src/models/User.js)
- [Auth Controller](../server/src/controllers/authController.js)
- [AI Reviews](./분석/) - Claude, Gemini, GPT 분석


---

## Appendix: Refresh Token Implementation

### Client-Side (Axios Interceptor)
```javascript
// client/src/api/axios.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

// Request Interceptor (Access Token 추가)
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor (Token 만료 시 자동 갱신)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 401 에러 && 재시도 아님
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          // Refresh Token 없음 → 로그아웃
          await logout();
          return Promise.reject(error);
        }
        
        // Refresh Token으로 새 Access Token 요청
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken
        });
        
        const { accessToken } = response.data;
        
        // 새 Access Token 저장
        await AsyncStorage.setItem('accessToken', accessToken);
        
        // 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh Token도 만료 → 로그아웃
        await logout();
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

export default api;
```

### Server-Side (Refresh Token API)
```javascript
// server/src/routes/auth.js
router.post('/refresh', refreshToken);

// server/src/controllers/authController.js
exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(401).json({ message: 'Refresh token required' });
  }
  
  try {
    // Refresh Token 검증
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    
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
    res.status(401).json({ message: 'Token expired or invalid' });
  }
};
```

### Environment Variables
```bash
# server/.env
JWT_SECRET=your_access_token_secret
JWT_REFRESH_SECRET=your_refresh_token_secret  # ✅ 추가
```

---

## Appendix: Guest Cleanup Cron Job

### Implementation
```javascript
// server/src/jobs/cleanupGuests.js
const cron = require('node-cron');
const User = require('../models/User');
const Todo = require('../models/Todo');
const Category = require('../models/Category');
const Completion = require('../models/Completion');

const RETENTION_DAYS = 90;

const cleanupInactiveGuests = async () => {
  try {
    const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
    
    const inactiveGuests = await User.find({
      accountType: 'anonymous',
      updatedAt: { $lt: cutoffDate }
    });
    
    console.log(`[Cleanup] Found ${inactiveGuests.length} inactive guests (>90 days)`);
    
    let deletedCount = 0;
    
    for (const guest of inactiveGuests) {
      // Cascading Delete
      const [todosDeleted, categoriesDeleted, completionsDeleted] = await Promise.all([
        Todo.deleteMany({ userId: guest._id }),
        Category.deleteMany({ userId: guest._id }),
        Completion.deleteMany({ userId: guest._id })
      ]);
      
      await User.findByIdAndDelete(guest._id);
      
      deletedCount++;
      
      console.log(`[Cleanup] Deleted guest ${guest._id}:`, {
        todos: todosDeleted.deletedCount,
        categories: categoriesDeleted.deletedCount,
        completions: completionsDeleted.deletedCount
      });
    }
    
    console.log(`[Cleanup] Completed: ${deletedCount} guests deleted`);
  } catch (error) {
    console.error('[Cleanup] Error:', error);
  }
};

// 매일 자정 실행 (서버 시간 기준)
cron.schedule('0 0 * * *', cleanupInactiveGuests);

// 수동 실행용 export
module.exports = { cleanupInactiveGuests };
```

### Server Integration
```javascript
// server/src/index.js
const express = require('express');
const app = express();

// ... 기존 설정 ...

// ✅ Cron Job 시작
require('./jobs/cleanupGuests');

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Guest cleanup cron job started (runs daily at midnight)');
});
```

### Manual Execution (Optional)
```javascript
// server/src/scripts/manualCleanup.js
const mongoose = require('mongoose');
const { cleanupInactiveGuests } = require('../jobs/cleanupGuests');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('MongoDB connected');
    await cleanupInactiveGuests();
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
```

Run manually:
```bash
node server/src/scripts/manualCleanup.js
```


---

## Welcome Screen Implementation Guide

### Navigation Setup

```javascript
// client/src/navigation/MainStack.js
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuthStore } from '../store/authStore';
import WelcomeScreen from '../screens/WelcomeScreen';
import LoginScreen from '../screens/LoginScreen';
import MainTabs from './MainTabs';

const Stack = createNativeStackNavigator();

export default function MainStack() {
  const { user, token, isLoading } = useAuthStore();

  if (isLoading) {
    return <LoadingScreen />;
  }

  // 로그인 상태 확인
  const isAuthenticated = user && token;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        // 미로그인 상태
        <>
          <Stack.Screen name="Welcome" component={WelcomeScreen} />
          <Stack.Screen name="Login" component={LoginScreen} />
        </>
      ) : (
        // 로그인 상태 (게스트 포함)
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}
```

### First Launch Detection (Optional)

```javascript
// client/src/store/authStore.js
import AsyncStorage from '@react-native-async-storage/async-storage';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isFirstLaunch: false,

  loadAuth: async () => {
    try {
      const [token, userStr, hasLaunched] = await Promise.all([
        AsyncStorage.getItem('accessToken'),
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('hasLaunched')
      ]);

      const user = userStr ? JSON.parse(userStr) : null;

      // 최초 실행 여부
      if (!hasLaunched) {
        await AsyncStorage.setItem('hasLaunched', 'true');
        set({ isFirstLaunch: true });
      }

      set({ token, user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  // ... 기존 메서드들
}));
```

### Guest Login with Navigation

```javascript
// client/src/store/authStore.js
loginAsGuest: async () => {
  // 1. 온라인 체크
  if (!navigator.onLine) {
    throw new Error('게스트 모드는 인터넷 연결이 필요합니다');
  }
  
  // 2. 클라이언트에서 UUID 생성
  const guestId = crypto.randomUUID();
  const timeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';
  
  // 3. 서버에 게스트 생성 요청
  const response = await api.post('/auth/guest', { 
    userId: guestId,
    timeZone 
  });
  
  const { accessToken, refreshToken, user } = response.data;
  
  // 4. 로컬 저장
  await AsyncStorage.setItem('accessToken', accessToken);
  await AsyncStorage.setItem('refreshToken', refreshToken);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  
  set({ token: accessToken, user, isLoading: false });
  
  // 5. Navigation은 MainStack에서 자동 처리됨 (isAuthenticated 변경)
}
```

### Guest Data Cleanup on Login

```javascript
// client/src/screens/LoginScreen.js
const handleLogin = async () => {
  try {
    const currentUser = useAuthStore.getState().user;
    
    // 현재 게스트 상태인지 확인
    if (currentUser?.accountType === 'anonymous') {
      // 게스트 데이터 삭제 경고
      Alert.alert(
        '기존 계정으로 로그인',
        '현재 게스트 데이터는 삭제됩니다.\n\n기존 계정 데이터를 불러오시겠습니까?',
        [
          {
            text: '취소',
            style: 'cancel'
          },
          {
            text: '로그인 (게스트 데이터 삭제)',
            style: 'destructive',
            onPress: async () => {
              // 게스트 데이터 삭제 (서버)
              await api.delete(`/auth/guest/${currentUser._id}`);
              
              // 로컬 데이터 삭제
              await clearLocalData();
              
              // 로그인 진행
              await performLogin(email, password);
            }
          }
        ]
      );
    } else {
      // 게스트 아니면 바로 로그인
      await performLogin(email, password);
    }
  } catch (error) {
    Toast.show({
      type: 'error',
      text1: '로그인 실패',
      text2: error.message
    });
  }
};

const clearLocalData = async () => {
  // SQLite 데이터 삭제
  await todoService.deleteAll();
  await categoryService.deleteAll();
  await completionService.deleteAll();
  await pendingService.clearAll();
};

const performLogin = async (email, password) => {
  const response = await api.post('/auth/login', { email, password });
  const { token, user } = response.data;
  
  await AsyncStorage.setItem('accessToken', token);
  await AsyncStorage.setItem('user', JSON.stringify(user));
  
  useAuthStore.getState().setAuth(token, user);
};
```

---

## UX Best Practices

### 1. Welcome Screen Design
```
✅ 큰 "시작하기" 버튼 (Primary CTA)
✅ 작은 "로그인" 링크 (Secondary CTA)
✅ 앱 로고/아이콘 표시
✅ 간단한 설명 문구
❌ 복잡한 온보딩 슬라이드 (나중에 추가 가능)
```

### 2. Button Hierarchy
```javascript
// Primary: 시작하기 (70% 사용자)
className="bg-blue-500 py-4 rounded-xl"

// Secondary: 로그인 (30% 사용자)
className="text-gray-500 text-center"
```

### 3. Loading States
```javascript
// 게스트 생성 중
<ActivityIndicator color="white" />

// 로그인 중
<ActivityIndicator color="blue" />
```

### 4. Error Handling
```javascript
// 오프라인
Toast.show({
  type: 'info',
  text1: '인터넷 연결 필요',
  text2: '게스트 모드는 온라인 상태에서 시작할 수 있습니다'
});

// 서버 에러
Toast.show({
  type: 'error',
  text1: '시작 실패',
  text2: '잠시 후 다시 시도해주세요'
});
```

---

## Comparison: Welcome Screen vs Direct Todo

| 항목 | Welcome 화면 | 바로 Todo |
|------|-------------|----------|
| **신규 사용자 마찰** | 1번 클릭 | 0번 클릭 |
| **기존 사용자 경험** | 명확 ✅ | 혼란 😱 |
| **데이터 병합** | 불필요 ✅ | 필수 (지옥) ❌ |
| **코드 복잡도** | 낮음 ✅ | 매우 높음 ❌ |
| **UX 명확성** | 높음 ✅ | 낮음 ❌ |
| **유지보수** | 쉬움 ✅ | 어려움 ❌ |
| **업계 표준** | Notion, Slack ✅ | Things 3 (로컬 전용) |

**결론: Welcome 화면이 압도적으로 우수**
