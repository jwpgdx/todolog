// ===== GOOGLE AUTH TEMPORARILY DISABLED =====
// TODO: Re-enable when implementing Google Auth feature

/*
import { useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useGoogleLogin } from '@react-oauth/google';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import GoogleSignin from '../config/googleSignIn';
import api from '../api/axios';

export const useCalendarSync = () => {
  const { user, setAuth } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  // 모바일: 추가 권한 요청
  const requestCalendarAccessMobile = async () => {
    try {
      await GoogleSignin.addScopes({
        scopes: ['https://www.googleapis.com/auth/calendar'],
      });

      const tokens = await GoogleSignin.getTokens();
      const userInfo = await GoogleSignin.signInSilently();

      const response = await api.post('/auth/google/calendar', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        googleId: userInfo.user.id,
      });

      // authStore 업데이트
      const updatedUser = { ...user, hasCalendarAccess: true };
      await setAuth(user.token, updatedUser);

      return true;
    } catch (error) {
      console.error('Mobile calendar access error:', error);
      throw error;
    }
  };

  // 웹: 구글 로그인 (캘린더 권한 포함)
  const webGoogleLogin = useGoogleLogin({
    scope: 'openid email profile https://www.googleapis.com/auth/calendar',
    flow: 'auth-code', // refresh_token을 받기 위해 필요
    onSuccess: async (codeResponse) => {
      try {
        console.log('🔑 [useCalendarSync] 구글 인증 코드 받음:', codeResponse);
        
        // 서버에 인증 코드 전송 (서버에서 토큰 교환)
        const response = await api.post('/auth/google/calendar/code', {
          code: codeResponse.code,
        });

        // authStore 업데이트
        const updatedUser = response.data.user;
        const token = await AsyncStorage.getItem('token');
        await setAuth(token, updatedUser);
        
        Toast.show({
          type: 'success',
          text1: '구글 캘린더 연동 완료',
        });
      } catch (error) {
        console.error('Web calendar access error:', error);
        Toast.show({
          type: 'error',
          text1: '캘린더 연동 실패',
        });
        throw error;
      }
    },
    onError: (error) => {
      console.error('Google login error:', error);
      Toast.show({
        type: 'error',
        text1: '구글 로그인 실패',
      });
    },
  });

  // 토글 핸들러
  const handleToggleCalendarSync = async (value) => {
    if (value) {
      // ON으로 변경
      if (user?.hasCalendarAccess) {
        // 이미 인증 정보 있음 - 서버에 토글만 변경
        try {
          setIsLoading(true);
          const response = await api.post('/auth/google/calendar/toggle', { enabled: true });

          const updatedUser = response.data.user;
          const token = await AsyncStorage.getItem('token');
          await setAuth(token, updatedUser);

          Toast.show({
            type: 'success',
            text1: '캘린더 동기화 활성화',
          });
        } catch (error) {
          console.error('Toggle calendar sync error:', error);
          Toast.show({
            type: 'error',
            text1: '토글 실패',
          });
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // 권한 없음 - 요청 필요
      setIsLoading(true);
      try {
        if (Platform.OS === 'web') {
          // 웹: 구글 로그인 팝업
          webGoogleLogin();
        } else {
          // 모바일: 추가 권한 요청
          if (user?.provider === 'google') {
            await requestCalendarAccessMobile();
            Toast.show({
              type: 'success',
              text1: '구글 캘린더 연동 완료',
            });
          } else {
            // 비구글 로그인 사용자
            Toast.show({
              type: 'info',
              text1: '구글 계정 연결 기능 준비 중',
            });
          }
        }
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: '캘린더 연동 실패',
        });
      } finally {
        setIsLoading(false);
      }
    } else {
      // OFF로 변경 (인증 정보는 유지)
      try {
        setIsLoading(true);
        const response = await api.post('/auth/google/calendar/toggle', { enabled: false });

        const updatedUser = response.data.user;
        const token = await AsyncStorage.getItem('token');
        await setAuth(token, updatedUser);

        Toast.show({
          type: 'success',
          text1: '캘린더 동기화 비활성화',
        });
      } catch (error) {
        console.error('Toggle calendar sync error:', error);
        Toast.show({
          type: 'error',
          text1: '토글 실패',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return {
    handleToggleCalendarSync,
    isLoading,
  };
};
*/

import { useState } from 'react';
import Toast from 'react-native-toast-message';

// Mock implementation when Google Auth is disabled
export const useCalendarSync = () => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleCalendarSync = async (value) => {
    Toast.show({
      type: 'info',
      text1: '구글 캘린더 연동 기능 준비 중',
      text2: '추후 업데이트에서 제공될 예정입니다',
    });
  };

  return {
    handleToggleCalendarSync,
    isLoading,
  };
};
