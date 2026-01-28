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
  // 웹: localhost 사용
  if (Platform.OS === 'web') {
    return 'http://localhost:5001/api';
  }

  // 네이티브: 환경 변수 사용
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5001/api';
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

// Response Interceptor: Handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      console.log('Session expired, logging out via handler...');
      if (logoutHandler) {
        logoutHandler();
      }
    }
    return Promise.reject(error);
  }
);

export { API_URL };
export default api;
