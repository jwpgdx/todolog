// ===== GOOGLE AUTH TEMPORARILY DISABLED =====
// TODO: Re-enable when implementing Google Auth feature

/*
import { useState } from 'react';
import { Platform } from 'react-native';
import GoogleSignin from '../config/googleSignIn';
import api from '../api/axios';

export const useGoogleSignIn = () => {
  const [isLoading, setIsLoading] = useState(false);

  // 모바일용 구글 로그인
  const signInMobile = async () => {
    // 구글 Play Services 확인 (Android)
    await GoogleSignin.hasPlayServices();
    
    // 구글 로그인 (기본 권한만)
    const userInfo = await GoogleSignin.signIn();
    
    // 서버로 토큰 전송
    const response = await api.post('/auth/google', {
      idToken: userInfo.idToken,
    });
    
    return response.data;
  };

  // 웹용 구글 로그인 (access token + userInfo)
  const signInWeb = async (accessToken, userInfo) => {
    // 서버로 사용자 정보 전송
    const response = await api.post('/auth/google/web', {
      accessToken,
      email: userInfo.email,
      name: userInfo.name,
      googleId: userInfo.sub,
    });
    
    return response.data;
  };

  const signIn = async (credentialOrToken, userInfo) => {
    try {
      setIsLoading(true);
      
      if (Platform.OS === 'web') {
        // 웹: access token + userInfo
        if (!credentialOrToken || !userInfo) {
          throw new Error('Google credential is required');
        }
        return await signInWeb(credentialOrToken, userInfo);
      } else {
        // 모바일: 직접 로그인
        return await signInMobile();
      }
    } catch (error) {
      console.error('Google Sign In Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await GoogleSignin.signOut();
    } catch (error) {
      console.error('Google Sign Out Error:', error);
    }
  };

  // 캘린더 권한 요청 (설정에서 연동 ON 시 호출)
  const requestCalendarAccess = async () => {
    try {
      setIsLoading(true);
      
      // 추가 권한 요청
      await GoogleSignin.addScopes({
        scopes: ['https://www.googleapis.com/auth/calendar.events'],
      });
      
      // 새로운 Access Token 가져오기
      const tokens = await GoogleSignin.getTokens();
      
      // 서버에 토큰 업데이트
      const response = await api.post('/auth/google/calendar', {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
      
      return response.data;
    } catch (error) {
      console.error('Calendar Access Request Error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  return { signIn, signOut, requestCalendarAccess, isLoading };
};
*/

// Mock implementation when Google Auth is disabled
export const useGoogleSignIn = () => {
  return {
    signIn: async () => {
      throw new Error('Google Auth is temporarily disabled');
    },
    signOut: async () => {
      console.log('Google Auth is disabled - signOut mock');
    },
    requestCalendarAccess: async () => {
      throw new Error('Google Calendar sync is temporarily disabled');
    },
    isLoading: false,
  };
};
