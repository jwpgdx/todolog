import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * API URL 설정
 * - 개발: .env의 EXPO_PUBLIC_API_URL 사용
 * - 프로덕션: 환경 변수 또는 하드코딩
 * 
 * 네트워크 바뀔 때 .env의 IP 주소를 수동으로 업데이트해야 함
 */
const getBaseUrl = () => {
  // 플랫폼 공통: 환경 변수가 있으면 최우선 사용
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // 웹/네이티브 공통 fallback
  return 'http://localhost:5001/api';
};

const API_URL = getBaseUrl();
console.log('🔗 Connected API URL:', API_URL);

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 5000, // 5초 타임아웃 (오프라인 대기 시간 단축)
});

let logoutHandler = null;

export const setLogoutHandler = (handler) => {
  logoutHandler = handler;
};

// Request Interceptor: Add Token
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 with Refresh Token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 401 에러이고, 재시도하지 않은 요청인 경우
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh Token 가져오기
        const refreshToken = await AsyncStorage.getItem('refreshToken');
        
        if (!refreshToken) {
          // Refresh Token이 없으면 로그아웃
          if (logoutHandler) {
            logoutHandler();
          }
          return Promise.reject(error);
        }

        // Refresh Token으로 새 Access Token 발급
        const response = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const { accessToken } = response.data;

        // 새 Access Token 저장
        await AsyncStorage.setItem('token', accessToken);

        // 원래 요청에 새 토큰 적용
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;

        // 원래 요청 재시도
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh Token도 만료되었으면 로그아웃
        console.log('Refresh token expired, logging out...');
        if (logoutHandler) {
          logoutHandler();
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export { API_URL };
export default api;
