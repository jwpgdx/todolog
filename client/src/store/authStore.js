import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';

import api, { setLogoutHandler } from '../api/axios';
import { authAPI } from '../api/auth';
import { clearAllData } from '../services/db/database';
import { getTodoCount, getAllTodos } from '../services/db/todoService';
import {
  ensureInboxCategory,
  getUserCreatedCategoryCount,
} from '../services/db/categoryService';
import {
  getAllCompletionsArray,
  getCompletionCount,
} from '../services/db/completionService';

// QueryClient를 외부에서 주입받을 수 있도록 변수 선언
let queryClientInstance = null;
const LOCAL_GUEST_USER_ID = 'guest_local';
const DEFAULT_GUEST_NAME = 'Guest User';

export const setQueryClient = (client) => {
  queryClientInstance = client;
};

const normalizeAuthUser = (user) => {
  if (!user || typeof user !== 'object') return user;

  const resolvedId = user._id || user.id;
  if (!resolvedId) return user;

  return {
    ...user,
    _id: resolvedId,
    id: resolvedId,
  };
};

const isGuestUser = (user) => {
  if (!user || typeof user !== 'object') return false;
  if (user.accountType === 'anonymous') return true;

  const resolvedId = user._id || user.id;
  if (typeof resolvedId !== 'string') return false;

  return resolvedId === LOCAL_GUEST_USER_ID || resolvedId === 'guest_temp' || resolvedId.startsWith('guest_');
};

const getDeviceTimeZone = () => Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';

const buildLocalGuestUser = (existingUser = null) => {
  const settings = {
    timeZone: getDeviceTimeZone(),
    theme: 'system',
    language: 'system',
    ...(existingUser?.settings || {}),
  };
  const preservedName =
    isGuestUser(existingUser) && typeof existingUser?.name === 'string' && existingUser.name.trim()
      ? existingUser.name.trim()
      : DEFAULT_GUEST_NAME;

  return normalizeAuthUser({
    _id: LOCAL_GUEST_USER_ID,
    id: LOCAL_GUEST_USER_ID,
    accountType: 'anonymous',
    provider: 'local',
    name: preservedName,
    email: null,
    settings,
  });
};

const clearQueryCache = () => {
  if (queryClientInstance) {
    queryClientInstance.clear();
  }
};

const persistGuestSession = async (guestUser) => {
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('refreshToken');
  await AsyncStorage.setItem('user', JSON.stringify(guestUser));
};

const bootstrapLocalGuestSession = async (existingUser = null) => {
  const guestUser = buildLocalGuestUser(existingUser);
  await persistGuestSession(guestUser);

  try {
    await ensureInboxCategory();
  } catch (error) {
    console.warn('⚠️ [Auth] Failed to ensure guest Inbox:', error?.message || error);
  }

  return guestUser;
};

const normalizeRecurrenceForMigration = (value) => {
  if (!value) return null;

  if (Array.isArray(value)) {
    const next = value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
    return next.length > 0 ? next : null;
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return null;
};

const buildTodoMigrationDTO = (todo) => {
  const startDate = todo.startDate || todo.date || null;
  const endDate = todo.endDate || startDate || null;
  const isAllDay = todo.isAllDay !== undefined ? !!todo.isAllDay : !(todo.startTime || todo.endTime);

  return {
    _id: todo._id,
    title: todo.title,
    startDate,
    endDate,
    startTime: isAllDay ? null : (todo.startTime || null),
    endTime: isAllDay ? null : (todo.endTime || null),
    isAllDay,
    recurrence: normalizeRecurrenceForMigration(todo.recurrence),
    recurrenceEndDate: todo.recurrenceEndDate || null,
    memo: todo.memo || null,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
  };
};

const buildCompletionMigrationDTO = (completion) => ({
  _id: completion._id,
  key: completion.key,
  todoId: completion.todoId,
  date: completion.date,
  completedAt: completion.completedAt,
});

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isLoggedIn: false, // ✅ 추가: 로그인 상태 (게스트 제외)
  shouldShowLogin: false, // 로그아웃 후 바로 로그인 화면으로 이동할지 여부

  openLoginScreen: () => {
    set({ shouldShowLogin: true });
  },

  closeLoginScreen: () => {
    set({ shouldShowLogin: false });
  },

  setAuth: async (token, user, options = {}) => {
    const { clearLocalData = false } = options;
    const normalizedUser = normalizeAuthUser(user);

    if (clearLocalData) {
      await clearAllData();
      clearQueryCache();
    }

    if (token) {
      await AsyncStorage.setItem('token', token);
    } else {
      await AsyncStorage.removeItem('token');
    }
    await AsyncStorage.removeItem('refreshToken');

    if (normalizedUser) {
      await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
    } else {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    
    // isLoggedIn 계산: user && token && 게스트 아님
    const isLoggedIn = !!(normalizedUser && token && !isGuestUser(normalizedUser));
    
    set({
      token: token || null,
      user: normalizedUser || null,
      isLoading: false,
      isLoggedIn,
      shouldShowLogin: false,
    });
  },

  setUser: async (user) => {
    const normalizedUser = normalizeAuthUser(user);
    await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
    set({ user: normalizedUser });
  },

  // ✅ Settings 업데이트 (Offline-First)
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
        const serverSettings = response.data.settings; // ✅ settings만 받음
        
        if (!serverSettings) {
          console.warn('⚠️ [updateSettings] Server response missing settings');
          return;
        }
        
        // ⚠️ 서버 응답 반영 시 변경된 key만 확인 (깜빡임 방지)
        const currentUser = get().user;
        if (currentUser.settings[key] === value) {
          // 로컬과 서버가 동일하면 서버 settings 병합
          const updatedUser = {
            ...currentUser,
            settings: serverSettings,
          };
          await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
          set({ user: updatedUser });
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
  },

  // updateSetting은 useSettings 훅으로 이관됨 (deprecated)

  updateProfile: async (data) => {
    try {
      const response = await api.post('/auth/profile', data);
      const updatedUser = normalizeAuthUser(response.data.user);
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      set({ user: updatedUser });
      return updatedUser;
    } catch (error) {
      throw error;
    }
  },

  checkHandle: async (handle) => {
    try {
      const response = await api.post('/auth/handle/check', { handle });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
  verifyPassword: async (password) => {
    try {
      const response = await api.post('/auth/verify-password', { password });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  loginAsGuest: async () => {
    try {
      const guestUser = await bootstrapLocalGuestSession(get().user);
      set({
        token: null,
        user: guestUser,
        isLoading: false,
        isLoggedIn: false,
        shouldShowLogin: false,
      });
      return guestUser;
    } catch (error) {
      console.error('Guest login error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      let user = userStr ? normalizeAuthUser(JSON.parse(userStr)) : null;

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
          user = buildLocalGuestUser({ settings: parsedOldSettings });
          await AsyncStorage.setItem('user', JSON.stringify(user));
          console.log('🔄 [Migration] Created local guest from old settings');
        }
        
        // 마이그레이션 완료 후 삭제
        await AsyncStorage.removeItem('@userSettings');
        console.log('✅ [Migration] Old settings migrated and removed');
      }

      const hasRegularSession = !!(user && token && !isGuestUser(user));
      if (hasRegularSession) {
        set({ token, user, isLoading: false, isLoggedIn: true, shouldShowLogin: false });
        return;
      }

      const guestUser = await bootstrapLocalGuestSession(user);
      set({
        token: null,
        user: guestUser,
        isLoading: false,
        isLoggedIn: false,
        shouldShowLogin: false,
      });
    } catch (error) {
      console.error('❌ [loadAuth] Failed:', error);
      set({ isLoading: false });
    }
  },

  logout: async (options = {}) => {
    const { skipDataClear = false, showLogin = false } = options;
    
    // AsyncStorage 초기화
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('user');
    
    // SQLite 데이터 초기화 (옵션)
    if (!skipDataClear) {
      try {
        await clearAllData();
        console.log('✅ [Logout] SQLite data cleared');
      } catch (error) {
        console.error('⚠️ [Logout] Failed to clear SQLite:', error);
      }
    }

    clearQueryCache();

    if (showLogin) {
      set({ token: null, user: null, isLoggedIn: false, shouldShowLogin: true, isLoading: false });
      return;
    }

    const guestUser = await bootstrapLocalGuestSession(get().user);
    set({
      token: null,
      user: guestUser,
      isLoggedIn: false,
      shouldShowLogin: false,
      isLoading: false,
    });
  },

  // 게스트 데이터 확인
  checkGuestData: async () => {
    try {
      await ensureInboxCategory();

      const [todoCount, completionCount, categoryCount] = await Promise.all([
        getTodoCount(),
        getCompletionCount(),
        getUserCreatedCategoryCount(),
      ]);

      const hasGuestData = todoCount > 0 || completionCount > 0 || categoryCount > 0;

      return {
        todos: todoCount,
        completions: completionCount,
        categories: categoryCount,
        hasGuestData,
      };
    } catch (error) {
      console.error('Check guest data error:', error);
      throw error;
    }
  },

  // 게스트 데이터 마이그레이션
  migrateGuestData: async (credentials) => {
    try {
      const todos = (await getAllTodos()).map(buildTodoMigrationDTO);
      const completions = (await getAllCompletionsArray()).map(buildCompletionMigrationDTO);

      console.log(`📦 [Migration] Collected data: ${todos.length} todos, ${completions.length} completions`);
      
      const response = await authAPI.migrateGuestData({
        email: credentials.email,
        password: credentials.password,
        guestData: {
          todos,
          completions,
        },
      });
      
      const { token, user } = response.data;
      const normalizedUser = normalizeAuthUser(user);
      
      console.log('✅ [Migration] Server migration successful');

      await get().setAuth(token, normalizedUser, { clearLocalData: true });
      
      console.log('✅ [Migration] Migration completed successfully');
      
      return normalizedUser;
    } catch (error) {
      console.error('❌ [Migration] Migration failed:', error);
      throw error;
    }
  },

  // 게스트 데이터 버리기
  discardGuestData: async () => {
    try {
      await clearAllData();
      const guestUser = await bootstrapLocalGuestSession(get().user);
      clearQueryCache();
      set({
        token: null,
        user: guestUser,
        isLoading: false,
        isLoggedIn: false,
        shouldShowLogin: false,
      });
      console.log('✅ [Discard] Guest data discarded');
    } catch (error) {
      console.error('❌ [Discard] Failed to discard guest data:', error);
      throw error;
    }
  },
}));

// Inject logout handler to avoid circular dependency
setLogoutHandler(() => useAuthStore.getState().logout());
