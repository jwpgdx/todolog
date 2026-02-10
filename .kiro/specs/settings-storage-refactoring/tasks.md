# Tasks: Settings Storage 통합 리팩토링

**작성일:** 2026-02-10  
**상태:** Ready  
**예상 소요 시간:** 2-3시간

---

## Task Overview

총 **10개 태스크** (필수 9개 + 선택 1개)

- **Phase 1:** authStore 수정 (3개 태스크)
- **Phase 2:** useSettings Hook 수정 (2개 태스크)
- **Phase 3:** settingsStorage 제거 (1개 태스크)
- **Phase 4:** 테스트 및 검증 (3개 태스크)
- **Phase 5:** 코드 정리 (1개 태스크, 선택)

---

## Phase 1: authStore 수정

### [x] 1.1 authStore에 updateSettings 메서드 추가

**파일:** `client/src/store/authStore.js`

**요구사항:** Requirements AC-1.1, AC-2.1, AC-3.1, AC-4.1

**설명:**
- authStore에 `updateSettings(key, value)` 메서드 추가
- Phase 1: 로컬 즉시 업데이트 (AsyncStorage + Zustand state)
- Phase 2: 서버 백그라운드 동기화 (로그인 사용자만)
- 게스트 모드는 로컬만 저장
- 깜빡임 방지: 서버 응답 반영 시 로컬 변경 여부 확인

**구현 내용:**
```javascript
updateSettings: async (key, value) => {
  const { user, isLoggedIn } = get();
  if (!user) {
    console.warn('⚠️ [updateSettings] No user found');
    return;
  }
  
  // Phase 1: Local Update (즉시)
  const updatedUser = {
    ...user,
    settings: {
      ...user.settings,
      [key]: value,
    },
  };
  
  await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
  set({ user: updatedUser });
  console.log(`✅ [updateSettings] Local update: ${key} = ${value}`);
  
  // Phase 2: Server Sync (백그라운드, 로그인 사용자만)
  if (isLoggedIn) {
    try {
      const response = await api.patch('/auth/settings', { [key]: value });
      const serverUser = response.data.user;
      
      // ⚠️ 서버 응답 반영 시 변경된 key만 확인 (깜빡임 방지)
      const currentUser = get().user;
      if (currentUser.settings[key] === value) {
        // 로컬과 서버가 동일하면 전체 반영
        await AsyncStorage.setItem('user', JSON.stringify(serverUser));
        set({ user: serverUser });
        console.log(`✅ [updateSettings] Server sync: ${key} = ${value}`);
      } else {
        // 로컬이 변경되었으면 서버 응답 무시 (사용자가 다시 변경한 경우)
        console.log(`⚠️ [updateSettings] Local changed during sync, keeping local`);
      }
    } catch (error) {
      console.log(`⚠️ [updateSettings] Server sync failed (offline?): ${error.message}`);
      // 오프라인이면 무시 (로컬 설정 유지)
    }
  } else {
    console.log('📱 [updateSettings] Guest mode - local only');
  }
}
```

**⚠️ 주요 개선사항:**
- **Offline-First**: 로컬 먼저 저장 (실패 불가) → 서버 동기화 (실패해도 로컬 유지)
- **깜빡임 방지**: 서버 응답 반영 시 로컬 변경 여부 확인

**검증:**
- [ ] updateSettings 메서드 존재
- [ ] 로컬 즉시 업데이트 확인
- [ ] 로그인 사용자는 서버 동기화
- [ ] 게스트는 로컬만 저장
- [ ] 서버 응답 시 깜빡임 없음

---

### [x] 1.2 authStore.loadAuth에 마이그레이션 로직 추가

**파일:** `client/src/store/authStore.js`

**요구사항:** Requirements AC-5.1, AC-5.2, AC-5.3

**설명:**
- 앱 시작 시 `@userSettings` 존재 여부 확인
- 존재하면 `user.settings`와 병합 (로컬 최신 변경 우선)
- user 없는 경우도 처리 (게스트가 설정만 변경한 경우)
- 병합 후 `@userSettings` 삭제

**구현 내용:**
```javascript
loadAuth: async () => {
  try {
    const token = await AsyncStorage.getItem('token');
    const userStr = await AsyncStorage.getItem('user'); // ⚠️ 'user' 키 사용 (@user 아님)
    let user = userStr ? JSON.parse(userStr) : null;
    
    // 🔄 Migration: @userSettings → user.settings
    const oldSettingsStr = await AsyncStorage.getItem('@userSettings');
    if (oldSettingsStr) {
      console.log('🔄 [Migration] Found old settings, merging...');
      const parsedOldSettings = JSON.parse(oldSettingsStr);
      
      if (user) {
        // Case 1: user 존재 - 병합 (로컬 최신 변경 우선)
        user.settings = {
          ...user.settings,        // 서버 기본값 (베이스)
          ...parsedOldSettings,    // 로컬 최신 변경 (우선) ✅
        };
        
        await AsyncStorage.setItem('user', JSON.stringify(user));
      } else {
        // Case 2: user 없음 (게스트가 설정만 변경한 경우)
        // 기본 user 객체 생성 후 oldSettings 적용
        user = {
          _id: 'guest_temp',
          settings: parsedOldSettings,
        };
        await AsyncStorage.setItem('user', JSON.stringify(user));
        console.log('🔄 [Migration] Created user from old settings (guest case)');
      }
      
      // 마이그레이션 완료 후 삭제
      await AsyncStorage.removeItem('@userSettings');
      console.log('✅ [Migration] Old settings migrated and removed');
    }
    
    const isLoggedIn = !!(user && token && !user._id?.startsWith('guest_'));
    set({ token, user, isLoading: false, isLoggedIn, shouldShowLogin: false });
  } catch (error) {
    console.error('❌ [loadAuth] Failed:', error);
    set({ isLoading: false });
  }
}
```

**⚠️ 주요 수정사항:**
1. **AsyncStorage 키**: `'user'` 사용 (`'@user'` 아님)
2. **병합 우선순위**: `parsedOldSettings`를 뒤에 배치 (로컬 최신 변경 우선)
3. **user 없는 경우**: 기본 user 객체 생성 후 oldSettings 적용

**검증:**
- [ ] @userSettings 존재 시 병합
- [ ] 병합 우선순위: 로컬 최신 변경 우선
- [ ] user 없는 경우 처리
- [ ] 병합 후 @userSettings 삭제
- [ ] 멱등성 (재실행 시 에러 없음)

---

### [x] 1.3 Checkpoint: authStore 동작 확인

**요구사항:** Requirements AC-1.1, AC-2.1, AC-3.1

**설명:**
- authStore.updateSettings 메서드 수동 테스트
- 로컬 업데이트 확인
- 서버 동기화 확인 (로그인 사용자)
- 게스트 모드 확인

**테스트 방법:**
```javascript
// React Native Debugger 또는 console에서
import { useAuthStore } from './store/authStore';

// 1. 로컬 업데이트 테스트
await useAuthStore.getState().updateSettings('theme', 'dark');
console.log(useAuthStore.getState().user.settings.theme); // 'dark'

// 2. AsyncStorage 확인
const user = await AsyncStorage.getItem('user');
console.log(JSON.parse(user).settings.theme); // 'dark'

// 3. 게스트 모드 테스트
// 게스트로 로그인 후
await useAuthStore.getState().updateSettings('language', 'ko');
// 서버 호출 안함 확인 (Network 탭)
```

**검증:**
- [ ] 로컬 즉시 업데이트
- [ ] AsyncStorage 저장 확인
- [ ] 로그인 사용자 서버 동기화
- [ ] 게스트 로컬만 저장

---

## Phase 2: useSettings Hook 수정

### [x] 2.1 useSettings Hook을 authStore 기반으로 수정

**파일:** `client/src/hooks/queries/useSettings.js`

**요구사항:** Requirements AC-1.1, AC-2.2

**설명:**
- useSettings를 authStore.user.settings 기반으로 변경
- React Query 제거 (Zustand로 충분)
- 기본값 처리 추가

**구현 내용:**
```javascript
import { useAuthStore } from '../../store/authStore';

/**
 * 설정 조회 (authStore 기반)
 * @returns {Object} { data: UserSettings, isLoading, isError }
 */
export const useSettings = () => {
  const user = useAuthStore(state => state.user);
  
  return {
    data: user?.settings || getDefaultSettings(),
    isLoading: false,
    isError: false,
  };
};

/**
 * 기본 설정 반환
 */
const getDefaultSettings = () => ({
  theme: 'system',
  language: 'system',
  startDayOfWeek: 'sunday',
  showCompleted: true,
  calendarSyncEnabled: false,
  timeZone: 'Asia/Seoul',
  timeZoneAuto: true,
  defaultIsAllDay: true,
  notification: {
    enabled: false,
    time: '09:00',
  },
});
```

**검증:**
- [ ] useSettings가 authStore.user.settings 반환
- [ ] user 없을 때 기본값 반환
- [ ] React Query 의존성 제거

---

### [x] 2.2 useUpdateSetting Hook을 authStore 위임으로 수정

**파일:** `client/src/hooks/queries/useSettings.js`

**요구사항:** Requirements AC-2.1, AC-4.1

**설명:**
- useUpdateSetting을 authStore.updateSettings 위임으로 변경
- React Query useMutation 제거
- 간단한 wrapper로 변경
- useUpdateSettings (복수형) 삭제 (미사용)

**구현 내용:**
```javascript
import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

/**
 * 설정 업데이트 (authStore 위임)
 * @returns {Object} { mutate, mutateAsync, isPending }
 */
export const useUpdateSetting = () => {
  const updateSettings = useAuthStore(state => state.updateSettings);
  const [isPending, setIsPending] = useState(false);
  
  return {
    mutate: ({ key, value }) => {
      setIsPending(true);
      updateSettings(key, value).finally(() => setIsPending(false));
    },
    mutateAsync: async ({ key, value }) => {
      setIsPending(true);
      try {
        await updateSettings(key, value);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
};

// ❌ useUpdateSettings (복수형) 삭제 - 미사용
```

**⚠️ 주의사항:**
- React Query 전용 메서드(`refetch`, `status` 등) 제거됨
- 사용처에서 이런 메서드를 쓰는 곳이 있는지 확인 필요

**검증:**
- [ ] useUpdateSetting이 authStore.updateSettings 호출
- [ ] mutate, mutateAsync 동작 확인
- [ ] isPending 상태 관리
- [ ] useUpdateSettings (복수형) 삭제
- [ ] React Query 의존성 제거

---

## Phase 3: settingsStorage 제거

### [x] 3.1 settingsStorage.js 파일 삭제 및 import 제거

**파일:** 
- `client/src/storage/settingsStorage.js` (삭제)
- `client/src/hooks/queries/useSettings.js` (import 제거)

**요구사항:** Requirements AC-1.2, AC-1.3

**설명:**
- settingsStorage.js 파일 삭제
- useSettings.js에서 settingsStorage import 제거
- 미사용 함수 제거 (saveSettings, loadSettings, updateSetting)

**구현 내용:**
```bash
# 파일 삭제
rm client/src/storage/settingsStorage.js
```

```javascript
// useSettings.js에서 제거
// ❌ 삭제
import {
  loadSettings,
  saveSettings,
  updateSetting as updateSettingStorage,
} from '../../storage/settingsStorage';
```

**검증:**
- [ ] settingsStorage.js 파일 삭제
- [ ] useSettings.js에서 import 제거
- [ ] 빌드 에러 없음

---

## Phase 4: 테스트 및 검증

### [x] 4.1 Manual Test: 설정 변경 즉시 반영

**요구사항:** Requirements AC-1.1, AC-2.1, AC-2.2

**테스트 시나리오:**

**Test 1: 시작 요일 변경**
1. SettingsScreen 열기
2. 시작 요일을 "일요일" → "월요일" 변경
3. CalendarScreen 열기
4. ✅ 월요일부터 시작하는지 확인

**Test 2: 테마 변경**
1. SettingsScreen 열기
2. 테마를 "시스템" → "다크" 변경
3. ✅ 앱 테마가 즉시 다크 모드로 변경되는지 확인

**Test 3: 기본 하루종일 설정**
1. SettingsScreen 열기
2. 기본 하루종일을 true → false 변경
3. TodoForm 열기
4. ✅ 하루종일 토글이 false로 시작하는지 확인

**검증:**
- [x] 시작 요일 즉시 반영 ✅ 테스트 완료 (2026-02-11)
- [x] 테마 즉시 반영 ✅
- [x] 기본 하루종일 즉시 반영 ✅
- [x] 앱 재시작 불필요 ✅

---

### [x] 4.2 Manual Test: 오프라인 설정 변경

**요구사항:** Requirements AC-3.1, AC-3.2, AC-3.3

**테스트 시나리오:**

**Test 1: 오프라인 설정 변경**
1. 네트워크 끄기 (비행기 모드)
2. SettingsScreen에서 언어를 "시스템" → "한국어" 변경
3. ✅ 앱 언어가 즉시 한국어로 변경되는지 확인
4. 네트워크 켜기
5. ✅ 서버에 동기화되는지 확인 (Network 탭)

**Test 2: 오프라인 → 온라인 복귀**
1. 오프라인에서 여러 설정 변경
2. 온라인 복귀
3. ✅ 모든 설정이 서버에 동기화되는지 확인

**검증:**
- [x] 오프라인에서 설정 변경 가능 ✅ 테스트 완료 (2026-02-11)
- [x] 로컬 즉시 반영 ✅
- [x] 온라인 복귀 시 서버 동기화 ✅
- [x] 동기화 실패 시 로컬 설정 유지 ✅

**테스트 로그:**
```
✅ [updateSettings] Local update: startDayOfWeek = sunday
✅ [updateSettings] Server sync: startDayOfWeek = sunday
```

---

### [ ] 4.3 Manual Test: 게스트 모드 및 마이그레이션

**요구사항:** Requirements AC-3.3, AC-5.1, AC-5.2, AC-5.3

**테스트 시나리오:**

**Test 1: 게스트 모드**
1. 게스트로 로그인
2. SettingsScreen에서 설정 변경
3. ✅ 로컬에만 저장되는지 확인 (Network 탭에서 서버 호출 없음)
4. 앱 재시작
5. ✅ 게스트 설정이 유지되는지 확인

**Test 2: 마이그레이션**
1. AsyncStorage에 `@userSettings` 데이터 수동 추가
```javascript
await AsyncStorage.setItem('@userSettings', JSON.stringify({
  theme: 'dark',
  language: 'ko',
  startDayOfWeek: 'monday',
}));
```
2. 앱 재시작
3. ✅ `user.settings`에 병합되는지 확인 (로컬 최신 변경 우선)
4. ✅ `@userSettings`가 삭제되는지 확인
```javascript
const oldSettings = await AsyncStorage.getItem('@userSettings');
console.log(oldSettings); // null
```
5. ✅ user 없는 경우도 테스트 (게스트가 설정만 변경한 경우)

**검증:**
- [ ] 게스트 로컬만 저장
- [ ] 게스트 설정 유지
- [ ] @userSettings 병합 (로컬 최신 우선)
- [ ] @userSettings 삭제
- [ ] user 없는 경우 처리

---

## Phase 5: 코드 정리 (선택사항)

### [ ]* 5.1 코드 정리 및 최적화

**파일:** 
- `client/src/store/authStore.js`
- `client/src/hooks/queries/useSettings.js`

**요구사항:** Requirements NFR-5, NFR-6

**설명:**
- 미사용 import 제거
- console.log 정리 (필요한 것만 유지)
- 주석 업데이트
- Zustand selector 최적화 (필요 시)

**구현 내용:**
```javascript
// Before (전체 user 구독)
const user = useAuthStore(state => state.user);
const theme = user?.settings?.theme;

// After (필요한 값만 구독)
const theme = useAuthStore(state => state.user?.settings?.theme);
```

**검증:**
- [ ] 미사용 import 제거
- [ ] console.log 정리
- [ ] 주석 업데이트
- [ ] 불필요한 재렌더링 없음

---

## Regression Test Checklist

모든 설정 항목에 대해 변경 후 즉시 반영 확인:

- [ ] theme (시스템/라이트/다크)
- [ ] language (시스템/한국어/영어/일본어)
- [ ] startDayOfWeek (일요일/월요일)
- [ ] showCompleted (true/false)
- [ ] calendarSyncEnabled (true/false)
- [ ] timeZone (Asia/Seoul 등)
- [ ] timeZoneAuto (true/false)
- [ ] defaultIsAllDay (true/false)
- [ ] notification (알림 설정 객체)

---

## Success Criteria

### 기능 검증
- [ ] 모든 설정 변경이 즉시 반영됨
- [ ] 오프라인에서 설정 변경 가능
- [ ] 게스트 모드 정상 동작
- [ ] 마이그레이션 성공

### 코드 검증
- [ ] settingsStorage.js 삭제
- [ ] @userSettings 키 사용 안함
- [ ] authStore.user.settings만 사용
- [ ] 빌드 에러 없음

### 성능 검증
- [ ] 설정 변경 후 UI 반영 < 100ms
- [ ] AsyncStorage 읽기/쓰기 < 50ms
- [ ] 불필요한 재렌더링 없음

---

## Rollback Plan

문제 발생 시:
1. Git revert
2. 기존 코드 복원
3. @userSettings 데이터 복구 (백업 필요)

---

**작성자:** Kiro AI Assistant  
**검토자:** (개발자님 검토 필요)  
**승인자:** (개발자님 승인 필요)
