import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, ScrollView, ActionSheetIOS, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
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
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingGuestData, setIsCheckingGuestData] = useState(false);

  const { setAuth, checkGuestData, migrateGuestData, discardGuestData } = useAuthStore();

  const handleSubmit = async () => {
    console.log('🔵 [Login] handleSubmit called');
    
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

    console.log('✅ [Login] Validation passed');

    try {
      // 로그인 시 게스트 데이터 확인
      if (isLogin) {
        console.log('🔍 [Login] Checking guest data...');
        setIsCheckingGuestData(true);
        const guestData = await checkGuestData();
        setIsCheckingGuestData(false);
        console.log('📊 [Login] Guest data:', guestData);

        if (guestData && (guestData.todos > 0 || guestData.categories > 0)) {
          // 게스트 데이터 존재 → ActionSheet 표시
          console.log('🎯 [Login] Guest data found, showing migration options');
          showMigrationOptions(guestData);
          return;
        }
        
        console.log('✅ [Login] No guest data, proceeding with normal login');
      }

      // 게스트 데이터 없음 또는 회원가입 → 정상 진행
      await performAuth();
    } catch (error) {
      console.error('❌ [Login] Auth error:', error);
      console.error('❌ [Login] Error details:', {
        code: error.code,
        message: error.message,
        response: error.response?.data,
      });
      
      setIsCheckingGuestData(false);
      setIsLoading(false);

      // 네트워크 오류 처리
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        Toast.show({
          type: 'error',
          text1: '네트워크 오류',
          text2: '서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.',
        });
        return;
      }

      // 타임아웃 오류
      if (error.code === 'ECONNABORTED') {
        Toast.show({
          type: 'error',
          text1: '요청 시간 초과',
          text2: '네트워크 상태를 확인하고 다시 시도해주세요',
        });
        return;
      }

      // 서버 응답 에러
      const errorMessage = error.response?.data?.message;
      if (errorMessage) {
        Toast.show({
          type: 'error',
          text1: isLogin ? '로그인 실패' : '회원가입 실패',
          text2: errorMessage,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: isLogin ? '로그인 실패' : '회원가입 실패',
          text2: error.message || '잠시 후 다시 시도해주세요',
        });
      }
    }
  };

  // 게스트 데이터 마이그레이션 옵션 표시
  const showMigrationOptions = (count) => {
    const message = `${count.todos}개의 일정과 ${count.categories}개의 카테고리를 가져오시겠습니까?`;

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: '게스트 데이터 발견',
          message,
          options: ['취소', '버리기', '가져오기'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) {
            // 취소: 아무것도 안함
            console.log('🚫 [Login] User cancelled migration');
          } else if (buttonIndex === 1) {
            console.log('🗑️ [Login] User chose to discard guest data');
            handleDiscard();
          } else if (buttonIndex === 2) {
            console.log('📥 [Login] User chose to migrate guest data');
            handleMigrate();
          }
        }
      );
    } else if (Platform.OS === 'web') {
      // 웹에서는 window.confirm 사용
      console.log('🌐 [Login] Showing web confirmation dialog');
      const confirmed = window.confirm(
        `게스트 데이터 발견\n\n${message}\n\n확인: 가져오기\n취소: 버리기`
      );
      
      if (confirmed) {
        console.log('📥 [Login] User chose to migrate guest data');
        handleMigrate();
      } else {
        console.log('🗑️ [Login] User chose to discard guest data');
        handleDiscard();
      }
    } else {
      // Android
      Alert.alert(
        '게스트 데이터 발견',
        message,
        [
          { text: '취소', style: 'cancel', onPress: () => console.log('🚫 [Login] User cancelled migration') },
          { text: '버리기', style: 'destructive', onPress: () => {
            console.log('🗑️ [Login] User chose to discard guest data');
            handleDiscard();
          }},
          { text: '가져오기', onPress: () => {
            console.log('📥 [Login] User chose to migrate guest data');
            handleMigrate();
          }},
        ]
      );
    }
  };

  // 실제 인증 수행 (로그인/회원가입)
  const performAuth = async () => {
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

      setIsLoading(false);
      router.replace('/(app)/(tabs)');
    } catch (error) {
      setIsLoading(false);
      console.error('performAuth error:', error);
      throw error; // 에러를 상위로 전달
    }
  };

  // 마이그레이션 처리
  const handleMigrate = async () => {
    try {
      setIsLoading(true);
      console.log('📥 [Login] Starting migration...');
      await migrateGuestData({ email, password });
      console.log('✅ [Login] Migration completed successfully');
      Toast.show({
        type: 'success',
        text1: '마이그레이션 완료',
        text2: '게스트 데이터를 가져왔습니다',
      });
    } catch (error) {
      setIsLoading(false);
      console.error('❌ [Login] Migration failed:', error);
      console.error('❌ [Login] Error response:', error.response?.data);

      if (error.code === 'ERR_NETWORK') {
        Toast.show({
          type: 'error',
          text1: '네트워크 오류',
          text2: '인터넷 연결을 확인해주세요',
        });
      } else {
        const errorMsg = error.response?.data?.message || error.message || '다시 시도해주세요';
        Toast.show({
          type: 'error',
          text1: '마이그레이션 실패',
          text2: errorMsg,
          visibilityTime: 5000,
        });
        
        // 서버 에러 상세 정보 콘솔 출력
        if (error.response?.data?.error) {
          console.error('❌ [Login] Server error details:', error.response.data.error);
        }
      }
    }
  };

  // 게스트 데이터 버리기
  const handleDiscard = async () => {
    try {
      setIsLoading(true);
      await discardGuestData();
      await performAuth();
    } catch (error) {
      setIsLoading(false);
      Toast.show({
        type: 'error',
        text1: '로그인 실패',
        text2: error.message,
      });
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
      {typeof router.canGoBack === 'function' && router.canGoBack() && (
        <TouchableOpacity
          onPress={() => router.back()}
          className="self-start mb-6"
        >
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
      )}

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
        autoCorrect={false}
        autoComplete={Platform.OS === 'android' ? 'off' : 'email'}
        textContentType={Platform.OS === 'android' ? 'none' : 'emailAddress'}
        importantForAutofill={Platform.OS === 'android' ? 'no' : 'auto'}
        showSoftInputOnFocus={true}
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
        className={`rounded-xl py-4 mb-4 mt-2 ${(isLoading || isCheckingGuestData) ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
        onPress={handleSubmit}
        disabled={isLoading || isCheckingGuestData}
      >
        {(isLoading || isCheckingGuestData) ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator color="white" size="small" />
            <Text className="text-white text-center font-semibold text-lg ml-2">
              {isCheckingGuestData ? '데이터 확인 중...' : '데이터를 가져오는 중...'}
            </Text>
          </View>
        ) : (
          <Text className="text-white text-center font-semibold text-lg">
            {isLogin ? '로그인' : '회원가입'}
          </Text>
        )}
      </TouchableOpacity>

      {/* 모드 전환 */}
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)} className="p-2 mb-8">
        <Text className="text-blue-500 text-center font-medium">
          {isLogin ? '계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
        </Text>
      </TouchableOpacity>
    </KeyboardAwareScrollView>
  );
}
