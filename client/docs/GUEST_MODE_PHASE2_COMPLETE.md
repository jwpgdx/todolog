# Guest Mode Implementation - Phase 2 Complete ✅

**Date:** 2026-02-05  
**Status:** UI + Guest Conversion Complete

---

## ✅ 완료된 작업

### 1. ProfileScreen 게스트 배너 추가

**위치:** `client/src/screens/ProfileScreen.js`

**기능:**
- `user.accountType === 'anonymous'` 체크
- 게스트 사용자에게만 배너 표시
- "게스트로 사용 중입니다" 메시지
- "회원으로 전환" 버튼 → ConvertGuestScreen으로 이동

**UI:**
```
┌─────────────────────────────────┐
│ ℹ️ 게스트로 사용 중입니다        │
│ 회원으로 전환하면 여러 기기에서  │
│ 데이터를 동기화할 수 있습니다.   │
│ [회원으로 전환]                  │
└─────────────────────────────────┘
```

### 2. ConvertGuestScreen 생성

**파일:** `client/src/screens/ConvertGuestScreen.js`

**기능:**
- 이름, 이메일, 비밀번호 입력 폼
- 유효성 검증:
  - 이메일 형식 체크
  - 비밀번호 최소 6자
  - 비밀번호 확인 일치 여부
- `POST /auth/convert-guest` API 호출
- 성공 시 user 정보 업데이트 및 ProfileScreen으로 복귀

**UI 특징:**
- 모달 형태 (presentation: 'modal')
- 게스트 데이터 유지 안내 배너
- 소셜 로그인 옵션 (준비 중 표시)

### 3. MainStack에 라우트 추가

**파일:** `client/src/navigation/MainStack.js`

```javascript
<Stack.Screen
  name="ConvertGuest"
  component={ConvertGuestScreen}
  options={{
    headerShown: false,
    presentation: 'modal',
  }}
/>
```

### 4. 서버 API 구현

**엔드포인트:** `POST /auth/convert-guest`

**Controller:** `server/src/controllers/authController.js`

**기능:**
- 현재 사용자가 게스트인지 확인 (`accountType === 'anonymous'`)
- 이메일 중복 체크
- 이메일 형식 및 비밀번호 길이 검증
- 비밀번호 해싱 (bcrypt)
- User 정보 업데이트:
  - `email` 설정
  - `password` 설정
  - `accountType` → 'local'로 변경
- 업데이트된 user 정보 반환

**Route:** `server/src/routes/auth.js`
```javascript
router.post('/convert-guest', auth, convertGuest);
```

---

## 🧪 테스트 결과

### API 테스트
```bash
POST /auth/convert-guest
Authorization: Bearer <guest_token>
{
  "email": "test@example.com",
  "password": "password123",
  "name": "Test User"
}

✅ Response:
{
  "message": "회원 전환 완료",
  "user": {
    "id": "b5bc012a-438a-458e-9e34-39179e26b8a3",
    "email": "test@example.com",
    "name": "Test User",
    "accountType": "local",
    ...
  }
}
```

### 데이터 유지 확인
- ✅ UUID 변경 없음 (동일한 사용자 ID 유지)
- ✅ 기존 todos, categories, completions 모두 유지
- ✅ accountType만 'anonymous' → 'local'로 변경

---

## 📋 다음 단계 (Phase 3)

### 1. 전체 플로우 테스트
- [ ] 게스트로 시작
- [ ] 일정 추가
- [ ] 회원 전환
- [ ] 데이터 유지 확인
- [ ] 로그아웃 후 재로그인

### 2. 소셜 로그인 연동 (선택)
- [ ] 구글 계정으로 게스트 전환
- [ ] 애플 계정으로 게스트 전환

### 3. 동기화 로직 개선
- [ ] 게스트는 서버 동기화 스킵 (현재는 동기화 시도)
- [ ] 회원 전환 후 자동 동기화 시작

### 4. 에러 처리 개선
- [ ] 네트워크 오류 시 재시도 로직
- [ ] 오프라인 상태에서 회원 전환 시도 시 안내

---

## 🔑 주요 설계 결정

1. **UUID 유지**: 게스트 → 정회원 전환 시 UUID 변경 없음
   - 데이터 마이그레이션 불필요
   - 모든 관계(FK) 유지

2. **accountType 변경**: 'anonymous' → 'local'
   - 단순하고 명확한 상태 전환
   - 추후 'google', 'apple' 추가 가능

3. **모달 형태**: ConvertGuestScreen을 모달로 표시
   - 중요한 작업임을 강조
   - 취소 시 쉽게 돌아갈 수 있음

4. **데이터 유지 안내**: 명시적인 안내 배너
   - 사용자 불안감 해소
   - 데이터 손실 우려 제거

---

## 📁 수정된 파일

### Client
- `client/src/screens/ProfileScreen.js` (게스트 배너 추가)
- `client/src/screens/ConvertGuestScreen.js` (신규 생성)
- `client/src/navigation/MainStack.js` (라우트 추가)

### Server
- `server/src/controllers/authController.js` (convertGuest 함수 추가)
- `server/src/routes/auth.js` (라우트 추가)

---

## 🎯 구현 상태

**Phase 1 (Server + Client Core):** ✅ Complete  
**Phase 2 (UI + Guest Conversion):** ✅ Complete  
**Phase 3 (Testing + Polish):** 🔄 Next  
**Phase 4 (Social Login):** ⏳ Optional
