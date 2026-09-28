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

// Serialize writes to the single AsyncStorage user record. Auth transitions use
// the same lane so an older settings write cannot restore a previous session.
let userWriteQueue = Promise.resolve();
let settingsSyncQueue = Promise.resolve();
let authEpoch = 0;
let pendingAuthTransitions = 0;

const enqueueUserWrite = (operation) => {
  const result = userWriteQueue.then(operation);
  userWriteQueue = result.catch(() => {});
  return result;
};

const runAuthTransition = (operation) => {
  authEpoch += 1;
  pendingAuthTransitions += 1;
  return enqueueUserWrite(operation).finally(() => {
    pendingAuthTransitions -= 1;
  });
};

const getUserId = (user) => user?._id || user?.id || null;

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

  setAuth: (token, user, options = {}) => runAuthTransition(async () => {
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
  }),

  setUser: (user) => runAuthTransition(async () => {
    const normalizedUser = normalizeAuthUser(user);
    await AsyncStorage.setItem('user', JSON.stringify(normalizedUser));
    set({ user: normalizedUser });
  }),

  // ✅ Settings 업데이트 (Offline-First)
  updateSettings: async (key, value) => {
    const session = get();
    const epoch = authEpoch;
    if (!session.user || pendingAuthTransitions > 0) {
      return null;
    }

    const isCurrentSession = () =>
      epoch === authEpoch &&
      getUserId(get().user) === getUserId(session.user) &&
      get().token === session.token;

    return enqueueUserWrite(async () => {
      if (!isCurrentSession()) return null;

      // Read after preceding local commits, not before awaiting the write lane.
      const user = get().user;
      const updatedUser = {
        ...user,
        settings: { ...user.settings, [key]: value },
      };
      await AsyncStorage.setItem('user', JSON.stringify(updatedUser));
      if (!isCurrentSession()) return null;
      set({ user: updatedUser });

      // Local persistence is the success boundary. Remote patches remain best
      // effort (no new durable settings retry policy), ordered and session-bound.
      if (session.isLoggedIn && session.token) {
        settingsSyncQueue = settingsSyncQueue.then(async () => {
          if (!isCurrentSession()) return;
          await api.patch('/auth/settings', { [key]: value }, {
            headers: { Authorization: `Bearer ${session.token}` },
            skipAuthRecovery: true,
          });
          // Do not merge a full settings snapshot over newer local intent.
        }).catch((error) => {
          console.warn('⚠️ [updateSettings] Remote sync failed; local settings retained:', error?.message);
        });
      }

      return updatedUser;
    });
  },

  // updateSetting은 useSettings 훅으로 이관됨 (deprecated)

  updateProfile: async (data) => {
    const epoch = authEpoch;
    const session = get();
    try {
      const response = await api.post('/auth/profile', data);
      const updatedUser = normalizeAuthUser(response.data.user);
      return enqueueUserWrite(async () => {
        if (epoch !== authEpoch || getUserId(get().user) !== getUserId(session.user)) return null;
        const nextUser = { ...updatedUser, settings: get().user.settings };
        await AsyncStorage.setItem('user', JSON.stringify(nextUser));
        if (epoch !== authEpoch) return null;
        set({ user: nextUser });
        return nextUser;
      });
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

  loadAuth: () => runAuthTransition(async () => {
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
  }),

  logout: (options = {}) => runAuthTransition(async () => {
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
  }),

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
  discardGuestData: () => runAuthTransition(async () => {
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
  }),
}));

// Inject logout handler to avoid circular dependency
setLogoutHandler(() => useAuthStore.getState().logout());
