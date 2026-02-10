import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as Localization from 'expo-localization';

import api, { setLogoutHandler } from '../api/axios';
import { authAPI } from '../api/auth';
import { clearAllData } from '../services/db/database';
import { getTodoCount, getAllTodos } from '../services/db/todoService';
import { getCategoryCount, getAllCategories } from '../services/db/categoryService';
import { getAllCompletionsArray } from '../services/db/completionService';

// QueryClient를 외부에서 주입받을 수 있도록 변수 선언
let queryClientInstance = null;

export const setQueryClient = (client) => {
  queryClientInstance = client;
};

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isLoggedIn: false, // ✅ 추가: 로그인 상태 (게스트 제외)
  shouldShowLogin: false, // 로그아웃 후 바로 로그인 화면으로 이동할지 여부

  setAuth: async (token, user) => {
    if (token && user) {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
    } else {
      // null 입력 시 로그아웃과 동일하게 처리
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    
    // isLoggedIn 계산: user && token && 게스트 아님
    const isLoggedIn = !!(user && token && !user._id?.startsWith('guest_'));
    
    set({ token, user, isLoading: false, isLoggedIn });
  },

  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
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
      const updatedUser = response.data.user;
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
      // 1. Generate UUID
      const userId = Crypto.randomUUID();

      // 2. Get device timeZone
      const timeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';

      // 3. Call server API
      const response = await authAPI.createGuest({ userId, timeZone });
      const { accessToken, refreshToken, user } = response.data;

      // 4. Store tokens and user in AsyncStorage
      await AsyncStorage.setItem('token', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('user', JSON.stringify(user));

      // 5. Update Zustand state (게스트는 isLoggedIn = false)
      set({ token: accessToken, user, isLoading: false, isLoggedIn: false });

      return user;
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

      // isLoggedIn 계산
      const isLoggedIn = !!(user && token && !user._id?.startsWith('guest_'));

      set({ token, user, isLoading: false, isLoggedIn, shouldShowLogin: false });
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
    
    set({ token: null, user: null, isLoggedIn: false, shouldShowLogin: showLogin });

    // TanStack Query 캐시 초기화
    if (queryClientInstance) {
      queryClientInstance.clear();
    }
  },

  // 게스트 데이터 확인
  checkGuestData: async () => {
    try {
      const todoCount = await getTodoCount();
      const categoryCount = await getCategoryCount();
      
      return { todos: todoCount, categories: categoryCount };
    } catch (error) {
      console.error('Check guest data error:', error);
      throw error;
    }
  },

  // 게스트 데이터 마이그레이션
  migrateGuestData: async (credentials) => {
    try {
      // 1. SQLite에서 모든 게스트 데이터 수집
      const todos = await getAllTodos();
      const categories = await getAllCategories();
      const completions = await getAllCompletionsArray();
      
      console.log(`📦 [Migration] Collected data: ${todos.length} todos, ${categories.length} categories, ${completions.length} completions`);
      
      // 2. 서버에 마이그레이션 요청
      const response = await authAPI.migrateGuestData({
        email: credentials.email,
        password: credentials.password,
        guestData: {
          todos,
          categories,
          completions,
        },
      });
      
      const { token, user } = response.data;
      
      console.log('✅ [Migration] Server migration successful');
      
      // 3. SQLite 전체 삭제
      await clearAllData();
      console.log('✅ [Migration] SQLite data cleared');
      
      // 4. 새 토큰 및 사용자 정보 저장
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      
      // isLoggedIn 계산
      const isLoggedIn = !!(user && token && !user._id?.startsWith('guest_'));
      
      set({ token, user, isLoading: false, isLoggedIn });
      
      // 5. React Query 캐시 무효화 (Full Sync 트리거)
      if (queryClientInstance) {
        queryClientInstance.invalidateQueries();
        console.log('✅ [Migration] Query cache invalidated');
      }
      
      console.log('✅ [Migration] Migration completed successfully');
      
      return user;
    } catch (error) {
      console.error('❌ [Migration] Migration failed:', error);
      throw error;
    }
  },

  // 게스트 데이터 버리기
  discardGuestData: async () => {
    try {
      await clearAllData();
      console.log('✅ [Discard] Guest data discarded');
    } catch (error) {
      console.error('❌ [Discard] Failed to discard guest data:', error);
      throw error;
    }
  },
}));

// Inject logout handler to avoid circular dependency
setLogoutHandler(() => useAuthStore.getState().logout());
