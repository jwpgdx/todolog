// ===== GOOGLE AUTH TEMPORARILY DISABLED =====
// TODO: Re-enable when implementing Google Auth feature

/*
let GoogleSignin;

try {
  // Try to load the native module using require to catch initialization errors
  const googleSigninModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSigninModule.GoogleSignin;

  // 구글 로그인 설정
  GoogleSignin.configure({
    webClientId: '399488138188-e5ee5mj2jpedtc1ojv3p1paus11sg1mn.apps.googleusercontent.com',
    offlineAccess: true, // 리프레시 토큰 받기
    scopes: [
      // 로그인 시에는 기본 권한만
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile',
    ],
  });
} catch (error) {
  console.warn('GoogleSignin initialization failed (running in Expo Go/Web mode). Using Mock.');

  // Mock Implementation for Expo Go
  GoogleSignin = {
*/

// Mock Implementation (always used when Google Auth is disabled)
const GoogleSignin = {
    configure: () => { },
    hasPlayServices: async () => true,
    signIn: async () => {
      throw new Error('Expo Go에서는 Google 로그인을 사용할 수 없습니다. "Guest Login"을 이용해주세요.');
    },
    signOut: async () => { },
    isSignedIn: async () => false,
    getCurrentUser: async () => null,
    getTokens: async () => ({ accessToken: 'mock_token', refreshToken: 'mock_refresh' }),
    addScopes: async () => { },
  };
// }

export default GoogleSignin;
