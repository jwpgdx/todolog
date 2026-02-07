# Guest Mode Implementation - Phase 1 Complete ✅

**Date:** 2026-02-05  
**Status:** Server + Client Implementation Complete

---

## ✅ Completed Tasks

### 1. Server Implementation

#### User Model Updates (`server/src/models/User.js`)
- ✅ Removed `isGuest: Boolean` field
- ✅ Added `accountType: String` enum ['anonymous', 'local', 'google', 'apple']
- ✅ Added `refreshToken: String` field
- ✅ Email field allows multiple null values (partial index)

#### API Endpoints (`server/src/controllers/authController.js`)
- ✅ `POST /auth/guest` - Creates guest user with client-provided UUID
  - Accepts: `{ userId: UUID, timeZone: string }`
  - Returns: `{ accessToken, refreshToken, user }`
  - Creates default Inbox category
  - Access Token: 7 days
  - Refresh Token: 90 days

- ✅ `POST /auth/refresh` - Refreshes access token
  - Accepts: `{ refreshToken: string }`
  - Returns: `{ accessToken: string }`
  - Validates refresh token from DB

#### Database Migration
- ✅ Fixed email unique index to allow multiple null values
- ✅ Script: `server/src/scripts/fixEmailIndex.js`
- ✅ Changed from `sparse: true` to `partialFilterExpression: { email: { $type: 'string' } }`

### 2. Client Implementation

#### Auth API (`client/src/api/auth.js`)
- ✅ Added `createGuest(data)` function
- ✅ Added `refreshToken(refreshToken)` function

#### Auth Store (`client/src/store/authStore.js`)
- ✅ Updated `loginAsGuest()` to call server API
  - Generates UUID using `expo-crypto.randomUUID()`
  - Gets timeZone from `Localization.getCalendars()[0]?.timeZone`
  - Calls `POST /auth/guest` API
  - Stores accessToken, refreshToken, user in AsyncStorage
  - Updates Zustand state
- ✅ Updated `logout()` to remove refreshToken from AsyncStorage

#### Axios Interceptor (`client/src/api/axios.js`)
- ✅ Added refresh token auto-renewal logic
  - Intercepts 401 errors
  - Attempts to refresh access token
  - Retries original request with new token
  - Logs out if refresh token is expired

#### UI Updates
- ✅ Created `WelcomeScreen.js` with "시작하기" (Guest) and "로그인" buttons
- ✅ Removed dev quick login buttons from `LoginScreen.js`

---

## 🧪 Testing Results

### Server API Tests
```bash
# Guest Creation
POST /auth/guest
{
  "userId": "b5bc012a-438a-458e-9e34-39179e26b8a3",
  "timeZone": "Asia/Seoul"
}
✅ Response: { accessToken, refreshToken, user }

# Token Refresh
POST /auth/refresh
{ "refreshToken": "..." }
✅ Response: { accessToken }
```

### Database Verification
- ✅ Multiple guest users can be created (null email allowed)
- ✅ Inbox category auto-created for each guest
- ✅ accountType = 'anonymous' for guest users

---

## 📋 Next Steps (Phase 2)

### Navigation Updates
- [ ] Update `MainStack.js` to show WelcomeScreen for first-time users
- [ ] Add logic to detect if user has existing account (check AsyncStorage)
- [ ] Route to WelcomeScreen if no token, else MainTabs

### Profile Screen Updates
- [ ] Add guest banner in ProfileScreen
- [ ] Check `user.accountType === 'anonymous'`
- [ ] Show "게스트로 사용 중입니다" message
- [ ] Add "회원으로 전환" button

### Guest Conversion Screen
- [ ] Create `ConvertGuestScreen.js`
- [ ] Allow guest to add email/password or link Google/Apple account
- [ ] API: `POST /auth/convert-guest`
- [ ] Update user's accountType from 'anonymous' to 'local'/'google'/'apple'

### Sync Logic Updates
- [ ] Update sync hooks to check accountType
- [ ] Skip server sync for anonymous users (local-only mode)
- [ ] Enable sync after guest converts to regular user

### Testing
- [ ] Test guest creation flow in app
- [ ] Test token refresh on 401 error
- [ ] Test guest → regular user conversion
- [ ] Test offline guest mode

---

## 🔑 Key Design Decisions

1. **UUID Generation**: Client-side using `expo-crypto.randomUUID()`
   - No need to change UUID when converting guest → regular user
   - Simplifies data migration

2. **Server Sync for Guests**: Guest data is stored on server
   - Not local-only mode
   - Enables multi-device support via QR code (future feature)
   - Simplifies sync logic (same for all users)

3. **Refresh Token Pattern**: 7-day access + 90-day refresh
   - Auto-renewal via axios interceptor
   - Seamless UX (no manual re-login)

4. **accountType Enum**: More flexible than boolean
   - Supports future auth methods (Apple, etc.)
   - Clear distinction between anonymous/local/social

---

## 📁 Modified Files

### Server
- `server/src/models/User.js`
- `server/src/controllers/authController.js`
- `server/src/routes/auth.js`
- `server/src/scripts/fixEmailIndex.js` (new)

### Client
- `client/src/api/auth.js`
- `client/src/api/axios.js`
- `client/src/store/authStore.js`
- `client/src/screens/WelcomeScreen.js` (new)
- `client/src/screens/LoginScreen.js`

---

## 🎯 Implementation Status

**Phase 1 (Server + Client Core):** ✅ Complete  
**Phase 2 (Navigation + UI):** 🔄 Next  
**Phase 3 (Guest Conversion):** ⏳ Pending  
**Phase 4 (Testing + Polish):** ⏳ Pending
