import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

import api, { setLogoutHandler } from '../api/axios';

// QueryClient를 외부에서 주입받을 수 있도록 변수 선언
let queryClientInstance = null;

export const setQueryClient = (client) => {
  queryClientInstance = client;
};

export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isLoading: true,

  setAuth: async (token, user) => {
    if (token && user) {
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
    } else {
      // null 입력 시 로그아웃과 동일하게 처리
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
    }
    set({ token, user, isLoading: false });
  },

  setUser: async (user) => {
    await AsyncStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  // updateSetting은 useSettings 훅으로 이관됨

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
    const guestUser = {
      _id: 'guest',
      name: 'Guest User',
      email: 'guest@example.com',
    };
    const guestToken = 'guest-token';
    await AsyncStorage.setItem('token', guestToken);
    await AsyncStorage.setItem('user', JSON.stringify(guestUser));
    set({ token: guestToken, user: guestUser, isLoading: false });
  },

  loadAuth: async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const userStr = await AsyncStorage.getItem('user');
      const user = userStr ? JSON.parse(userStr) : null;

      set({ token, user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    set({ token: null, user: null });

    // TanStack Query 캐시 초기화
    if (queryClientInstance) {
      queryClientInstance.clear();
    }
  },
}));

// Inject logout handler to avoid circular dependency
setLogoutHandler(() => useAuthStore.getState().logout());
