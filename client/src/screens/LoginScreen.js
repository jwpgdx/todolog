import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView } from 'react-native';
import Toast from 'react-native-toast-message';
import * as Localization from 'expo-localization';

// 네이티브: KeyboardAwareScrollView, 웹: 일반 ScrollView
let KeyboardAwareScrollView;
if (Platform.OS !== 'web') {
  KeyboardAwareScrollView = require('react-native-keyboard-controller').KeyboardAwareScrollView;
} else {
  KeyboardAwareScrollView = ScrollView;
}

import api, { API_URL } from '../api/axios';
import { useAuthStore } from '../store/authStore';
import Input from '../components/ui/Input';

export default function LoginScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { setAuth } = useAuthStore();

  const handleSubmit = async () => {
    // Validation
    if (!email || !password) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '이메일과 비밀번호를 입력해주세요',
      });
      return;
    }

    if (!isLogin && !name) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '이름을 입력해주세요',
      });
      return;
    }

    if (!isLogin && password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '비밀번호가 일치하지 않습니다',
      });
      return;
    }

    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '비밀번호는 6자 이상이어야 합니다',
      });
      return;
    }

    try {
      setIsLoading(true);

      const endpoint = isLogin ? '/auth/login' : '/auth/register';

      let payload = { email, password };

      if (!isLogin) {
        // 회원가입 시 타임존 자동 감지
        const timeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';
        console.log('Detected TimeZone for Register:', timeZone);

        payload = {
          email,
          password,
          name,
          timeZone // 타임존 추가
        };
      }

      console.log('Sending request to:', endpoint);
      console.log('Payload:', payload);

      const response = await api.post(endpoint, payload);

      const { token, user } = response.data;
      await setAuth(token, user);

      Toast.show({
        type: 'success',
        text1: isLogin ? '로그인 성공' : '회원가입 성공',
        text2: `${user.name}님 환영합니다!`,
      });
    } catch (error) {
      console.error('Auth error:', error);
      console.error('Error response:', error.response?.data);

      Toast.show({
        type: 'error',
        text1: isLogin ? '로그인 실패' : '회원가입 실패',
        text2: error.response?.data?.message || '다시 시도해주세요',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 비밀번호 확인 에러
  const confirmPasswordError =
    !isLogin && confirmPassword.length > 0 && password !== confirmPassword
      ? '비밀번호가 일치하지 않습니다'
      : undefined;

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: 'white' }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      bottomOffset={50}
      keyboardShouldPersistTaps="handled"
    >
      <Text className="text-3xl font-bold mb-8 text-center text-gray-800">
        TODOLOG
      </Text>

      <Text className="text-xl font-bold mb-6 text-center text-gray-600">
        {isLogin ? '로그인' : '회원가입'}
      </Text>

      {/* 이름 (회원가입 시에만) */}
      {!isLogin && (
        <Input
          icon="person-outline"
          placeholder="이름"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
      )}

      {/* 이메일 */}
      <Input
        icon="mail-outline"
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
      />

      {/* 비밀번호 */}
      <Input
        icon="lock-closed-outline"
        placeholder="비밀번호 (6자 이상)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      {/* 비밀번호 확인 (회원가입 시에만) */}
      {!isLogin && (
        <Input
          icon="lock-closed-outline"
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="password"
          error={confirmPasswordError}
        />
      )}

      {/* 제출 버튼 */}
      <TouchableOpacity
        className={`rounded-xl py-4 mb-4 mt-2 ${isLoading ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
        onPress={handleSubmit}
        disabled={isLoading}
      >
        <Text className="text-white text-center font-semibold text-lg">
          {isLoading
            ? (isLogin ? '로그인 중...' : '가입 중...')
            : (isLogin ? '로그인' : '회원가입')
          }
        </Text>
      </TouchableOpacity>

      {/* 모드 전환 */}
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} className="p-2">
        <Text className="text-blue-500 text-center font-medium">
          {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </Text>
      </TouchableOpacity>

      {/* 개발용 빠른 로그인 */}
      <View className="mt-8 p-4 bg-gray-100 rounded-xl">
        <Text className="text-sm text-gray-600 text-center mb-2">개발용 빠른 로그인</Text>
        <View className="flex-row justify-around">
          <TouchableOpacity
            className="bg-gray-500 px-4 py-2 rounded-lg"
            onPress={() => {
              setEmail('admin@test.com');
              setPassword('123456');
              setName('Admin User');
              setIsLogin(true);
              setTimeout(handleSubmit, 100);
            }}
          >
            <Text className="text-white text-sm font-medium">Admin</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-500 px-4 py-2 rounded-lg"
            onPress={() => {
              setEmail('user1@test.com');
              setPassword('123456');
              setName('User One');
              setIsLogin(true);
              setTimeout(handleSubmit, 100);
            }}
          >
            <Text className="text-white text-sm font-medium">User1</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="bg-gray-500 px-4 py-2 rounded-lg"
            onPress={() => {
              setEmail('user2@test.com');
              setPassword('123456');
              setName('User Two');
              setIsLogin(true);
              setTimeout(handleSubmit, 100);
            }}
          >
            <Text className="text-white text-sm font-medium">User2</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Network Debug Info */}
      <View className="mt-4 p-3 bg-yellow-100 rounded-xl border border-yellow-300 mb-8">
        <Text className="text-xs text-center text-gray-500 font-bold mb-1">Network Debug Info</Text>
        <Text className="text-xs text-center text-gray-700">API URL: {API_URL}</Text>
      </View>
    </KeyboardAwareScrollView>
  );
}