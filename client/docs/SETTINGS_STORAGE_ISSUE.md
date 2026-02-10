# 🔴 Settings Storage 이중 저장 문제

**작성일:** 2026-02-10  
**심각도:** 🔴 High (기능 동작 불일치)  
**영향 범위:** 설정 변경이 일부 컴포넌트에 반영 안됨

---

## 🎯 문제 요약

**사용자 설정이 2개의 독립적인 저장소에 분리되어 있어, 설정 변경이 일부 컴포넌트에 반영되지 않습니다.**

### 현재 상황

1. **AsyncStorage `@user`** (authStore가 관리)
   - CalendarScreen, UltimateCalendar가 사용
   - 로그인 시에만 업데이트됨

2. **AsyncStorage `@userSettings`** (settingsStorage가 관리)
   - SettingsScreen이 사용
   - 설정 변경 시 업데이트됨

**결과:** 설정 변경해도 캘린더에 반영 안됨 ❌

---

## 📂 File Structure

```
client/src/
├── store/
│   └── authStore.js                    # user.settings 관리 (@user)
│
├── storage/
│   └── settingsStorage.js              # 독립 settings 관리 (@userSettings)
│
├── hooks/queries/
│   └── useSettings.js                  # settingsStorage 사용
│
└── screens/
    ├── CalendarScreen.js               # authStore.user.settings 사용
    ├── SettingsScreen.js               # useSettings Hook 사용
    └── components/ui/ultimate-calendar/
        └── UltimateCalendar.js         # authStore.user.settings 사용
```

---

## 🔍 상세 분석

### 1. authStore (AsyncStorage `@user`)

**파일:** `client/src/store/authStore.js`

**저장 구조:**
```javascript
{
  _id: "user-uuid",
  email: "user@example.com",
  name: "User Name",
  settings: {
    theme: 'system',
    language: 'system',
    startDayOfWeek: 'sunday',
    showCompleted: true,
    calendarSyncEnabled: false,
    timeZone: 'Asia/Seoul',
    timeZoneAuto: true,
    defaultIsAllDay: true,
    notification: { ... }
  }
}
```

**업데이트 시점:**
- 로그인 시 (서버에서 가져옴)
- `setAuth()` 호출 시
- `setUser()` 호출 시

**사용 위치:**
```javascript
// CalendarScreen.js L21
const { user } = useAuthStore();
const startDayOfWeek = user?.settings?.startDayOfWeek || 'sunday';

// UltimateCalendar.js L46
const { user } = useAuthStore();
const startDayOfWeek = user?.settings?.startDayOfWeek || 'sunday';

// App.js L62
const theme = user?.settings?.theme || 'system';

// App.js L69
const language = user?.settings?.language || 'system';
```



---

### 2. settingsStorage (AsyncStorage `@userSettings`)

**파일:** `client/src/storage/settingsStorage.js`

**저장 구조:**
```javascript
{
  theme: 'system',
  language: 'system',
  startDayOfWeek: 'sunday',
  showCompleted: true,
  calendarSyncEnabled: false,
  timeZone: 'Asia/Seoul',
  timeZoneAuto: true,
  defaultIsAllDay: true,
  notification: { ... }
}
```

**업데이트 시점:**
- `useSettings` Hook의 queryFn (서버에서 가져온 후)
- `useUpdateSetting` Hook의 onMutate (Optimistic Update)
- `useUpdateSetting` Hook의 onSuccess (서버 응답 후)

**사용 위치:**
```javascript
// useSettings.js
const { data: settings } = useSettings();

// SettingsScreen.js (간접 사용)
const { data: settings } = useSettings();
```

---

### 3. 데이터 흐름 비교

#### 설정 변경 시 (SettingsScreen)

```
사용자 설정 변경
  ↓
useUpdateSetting Hook
  ↓
1. Optimistic Update → @userSettings 업데이트 ✅
2. 서버 API 호출
3. onSuccess → @userSettings 업데이트 ✅
  ↓
❌ @user는 업데이트 안됨!
  ↓
CalendarScreen은 여전히 이전 값 사용
```

#### 로그인 시

```
로그인 성공
  ↓
서버에서 user 객체 받음 (settings 포함)
  ↓
authStore.setAuth(token, user)
  ↓
@user 저장 ✅
  ↓
CalendarScreen이 새 값 사용 ✅
```

---

## 🐛 재현 시나리오

### 시나리오 1: 시작 요일 변경

1. SettingsScreen에서 시작 요일을 "일요일" → "월요일" 변경
2. `@userSettings`에 저장됨 ✅
3. CalendarScreen 열기
4. ❌ 여전히 "일요일"로 표시됨 (authStore.user.settings 사용)
5. 앱 재시작 또는 재로그인 필요

### 시나리오 2: 테마 변경

1. SettingsScreen에서 테마를 "시스템" → "다크" 변경
2. `@userSettings`에 저장됨 ✅
3. App.js는 `user?.settings?.theme` 사용
4. ❌ 테마 변경 안됨
5. 앱 재시작 필요

---

## 📊 영향 범위 분석

### authStore.user.settings를 사용하는 컴포넌트

| 파일 | 사용 설정 | 영향 |
|------|----------|------|
| `CalendarScreen.js` | `startDayOfWeek` | 🔴 설정 변경 반영 안됨 |
| `UltimateCalendar.js` | `startDayOfWeek` | 🔴 설정 변경 반영 안됨 |
| `App.js` | `theme`, `language` | 🔴 설정 변경 반영 안됨 |
| `useTodoFormLogic.js` | `defaultIsAllDay` | 🔴 설정 변경 반영 안됨 |
| `useTimeZone.js` | `timeZone`, `timeZoneAuto` | 🔴 설정 변경 반영 안됨 |
| `GoogleCalendarSettingsScreen.js` | `calendarSyncEnabled` | 🔴 설정 변경 반영 안됨 |

### useSettings Hook을 사용하는 컴포넌트

| 파일 | 사용 설정 | 영향 |
|------|----------|------|
| `SettingsScreen.js` | 모든 설정 | ✅ 정상 동작 |
| `TimeZoneSelectionScreen.js` | `timeZone` | ✅ 정상 동작 |

---



## 🔧 해결 방안

### Option 1: authStore 통합 (권장 ✅)

**개념:** settingsStorage 제거, authStore.user.settings로 통합

**장점:**
- ✅ 단일 저장소 (중복 제거)
- ✅ Offline-First 아키텍처와 일치
- ✅ 이미 대부분의 컴포넌트가 authStore 사용
- ✅ user 객체와 settings 함께 관리

**단점:**
- ⚠️ useSettings Hook 전면 수정 필요
- ⚠️ SettingsScreen 관련 컴포넌트 수정 필요

**작업 시간:** 2-3시간

---

#### 구현 계획

**Step 1: authStore에 updateSettings 메서드 추가**

```javascript
// client/src/store/authStore.js
export const useAuthStore = create((set, get) => ({
  // ... 기존 코드
  
  updateSettings: async (key, value) => {
    const { user } = get();
    if (!user) return;
    
    // 1. 로컬 즉시 업데이트
    const updatedUser = {
      ...user,
      settings: {
        ...user.settings,
        [key]: value,
      },
    };
    
    await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
    set({ user: updatedUser });
    
    // 2. 서버 전송 (온라인일 때만)
    try {
      const response = await api.patch('/auth/settings', { [key]: value });
      const serverUser = response.data.user;
      await AsyncStorage.setItem('user', JSON.stringify(serverUser));
      set({ user: serverUser });
    } catch (error) {
      console.log('⚠️ [updateSettings] 서버 업데이트 실패 (오프라인?):', error.message);
      // 오프라인이면 무시 (다음 동기화 때 전송)
    }
  },
}));
```

**Step 2: useSettings Hook 수정**

```javascript
// client/src/hooks/queries/useSettings.js
import { useAuthStore } from '../../store/authStore';

export const useSettings = () => {
  const user = useAuthStore(state => state.user);
  
  return {
    data: user?.settings || {},
    isLoading: false,
    isError: false,
  };
};

export const useUpdateSetting = () => {
  const updateSettings = useAuthStore(state => state.updateSettings);
  
  return {
    mutate: ({ key, value }) => {
      updateSettings(key, value);
    },
    mutateAsync: async ({ key, value }) => {
      await updateSettings(key, value);
    },
  };
};
```

**Step 3: settingsStorage.js 삭제 (또는 deprecated 표시)**

```bash
# 삭제
rm client/src/storage/settingsStorage.js

# 또는 deprecated 표시
# @deprecated Use authStore.user.settings instead
```

**Step 4: 테스트**

1. SettingsScreen에서 시작 요일 변경
2. CalendarScreen에서 즉시 반영 확인
3. 오프라인에서 설정 변경
4. 온라인 복귀 시 서버 동기화 확인

---

### Option 2: settingsStorage 사용 (대안)

**개념:** authStore.user.settings 제거, settingsStorage로 통합

**장점:**
- ✅ useSettings Hook 유지
- ✅ 설정만 독립적으로 관리

**단점:**
- ⚠️ 모든 캘린더 컴포넌트 수정 필요
- ⚠️ App.js 수정 필요
- ⚠️ user.settings와 중복 데이터 유지 (서버 응답)
- ⚠️ Offline-First 아키텍처와 불일치

**작업 시간:** 3-4시간

---

#### 구현 계획

**Step 1: CalendarScreen/UltimateCalendar 수정**

```javascript
// CalendarScreen.js
import { useSettings } from '../hooks/queries/useSettings';

const { data: settings } = useSettings();
const startDayOfWeek = settings?.startDayOfWeek || 'sunday';
```

**Step 2: App.js 수정**

```javascript
// App.js
import { useSettings } from './hooks/queries/useSettings';

const { data: settings } = useSettings();
const theme = settings?.theme || 'system';
const language = settings?.language || 'system';
```

**Step 3: 모든 authStore.user.settings 사용처 수정**

- `useTodoFormLogic.js`
- `useTimeZone.js`
- `GoogleCalendarSettingsScreen.js`
- 기타 6개 파일

**Step 4: authStore.setAuth 수정 (settings 제거)**

```javascript
// authStore.js
setAuth: async (token, user) => {
  // user.settings는 무시하고 settingsStorage 사용
  const { settings, ...userWithoutSettings } = user;
  await AsyncStorage.setItem('user', JSON.stringify(userWithoutSettings));
  set({ token, user: userWithoutSettings });
},
```

---



### Option 3: 양방향 동기화 (임시 해결책 ⚠️)

**개념:** 설정 변경 시 두 저장소 모두 업데이트

**장점:**
- ✅ 최소한의 코드 변경
- ✅ 기존 구조 유지

**단점:**
- ❌ 중복 데이터 유지
- ❌ 동기화 로직 복잡
- ❌ 근본적인 해결책 아님
- ❌ 유지보수 어려움

**작업 시간:** 1시간

---

#### 구현 계획

**useUpdateSetting Hook 수정**

```javascript
// client/src/hooks/queries/useSettings.js
export const useUpdateSetting = () => {
  const queryClient = useQueryClient();
  const { user, setUser } = useAuthStore();

  return useMutation({
    mutationFn: async ({ key, value }) => {
      const response = await api.patch('/auth/settings', { [key]: value });
      return response.data.settings || response.data;
    },
    onMutate: async ({ key, value }) => {
      // 1. settingsStorage 업데이트
      await updateSettingStorage(key, value);
      queryClient.setQueryData(['settings'], (old) => ({
        ...old,
        [key]: value,
      }));
      
      // 2. authStore.user.settings 업데이트 ← 추가!
      if (user) {
        const updatedUser = {
          ...user,
          settings: {
            ...user.settings,
            [key]: value,
          },
        };
        await setUser(updatedUser);
      }
    },
    onSuccess: async (updatedSettings) => {
      // 1. settingsStorage 업데이트
      await saveSettings(updatedSettings);
      queryClient.setQueryData(['settings'], updatedSettings);
      
      // 2. authStore.user.settings 업데이트 ← 추가!
      if (user) {
        const updatedUser = {
          ...user,
          settings: updatedSettings,
        };
        await setUser(updatedUser);
      }
    },
  });
};
```

---

## 📋 권장 사항

### 최종 권장: Option 1 (authStore 통합)

**이유:**

1. **Offline-First 아키텍처 원칙**
   - 모든 데이터는 로컬 우선
   - user 객체와 settings는 함께 관리되어야 함

2. **단일 저장소 원칙**
   - 중복 데이터 제거
   - 동기화 이슈 방지

3. **기존 코드 구조**
   - 이미 대부분의 컴포넌트가 authStore 사용
   - useSettings Hook만 수정하면 됨

4. **유지보수성**
   - 명확한 데이터 흐름
   - 디버깅 용이

---

## 🎯 Implementation Roadmap

### Phase 1: authStore 통합 (2-3시간)

1. ✅ **authStore에 updateSettings 메서드 추가** (30분)
2. ✅ **useSettings Hook 수정** (30분)
3. ✅ **settingsStorage.js 삭제** (5분)
4. ✅ **테스트** (1시간)
   - 설정 변경 → 즉시 반영 확인
   - 오프라인 → 온라인 동기화 확인
   - 로그인/로그아웃 테스트
5. ✅ **문서 업데이트** (30분)

### Phase 2: 코드 정리 (선택, 1시간)

1. ⭐ **미사용 import 제거**
2. ⭐ **console.log 정리**
3. ⭐ **주석 업데이트**

---

## 🧪 Testing Checklist

### Test 1: 설정 변경 즉시 반영

**시나리오:**
1. SettingsScreen에서 시작 요일 변경 (일요일 → 월요일)
2. CalendarScreen 열기
3. ✅ 월요일부터 시작하는지 확인

**예상 결과:** 즉시 반영

---

### Test 2: 오프라인 설정 변경

**시나리오:**
1. 네트워크 끄기
2. SettingsScreen에서 테마 변경 (시스템 → 다크)
3. ✅ 앱 테마가 즉시 변경되는지 확인
4. 네트워크 켜기
5. ✅ 서버에 동기화되는지 확인

**예상 결과:** 오프라인에서도 즉시 반영, 온라인 복귀 시 서버 동기화

---

### Test 3: 로그인/로그아웃

**시나리오:**
1. 로그아웃
2. 로그인
3. ✅ 서버에서 가져온 settings가 적용되는지 확인

**예상 결과:** 서버 설정 적용

---

## 📚 Related Files

### 수정 필요
- `client/src/store/authStore.js` (updateSettings 메서드 추가)
- `client/src/hooks/queries/useSettings.js` (전면 수정)
- `client/src/storage/settingsStorage.js` (삭제)

### 영향 받는 파일 (테스트 필요)
- `client/src/screens/CalendarScreen.js`
- `client/src/components/ui/ultimate-calendar/UltimateCalendar.js`
- `client/App.js`
- `client/src/features/todo/form/useTodoFormLogic.js`
- `client/src/hooks/useTimeZone.js`
- `client/src/screens/settings/GoogleCalendarSettingsScreen.js`

---

## 🔗 Related Issues

- **Calendar Architecture Analysis** (`CALENDAR_ARCHITECTURE_ANALYSIS.md`)
  - 캘린더가 authStore.user.settings 사용
  - 설정 변경 시 재렌더링 필요

- **Offline-First Architecture** (README.md)
  - 모든 데이터는 로컬 우선
  - 서버는 선택사항

---

**문서 작성:** 2026-02-10  
**마지막 업데이트:** 2026-02-10  
**작성자:** Kiro AI Assistant
