import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Platform,
  ScrollView,
  ActionSheetIOS,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

import api from '../api/axios';
import { useAuthStore } from '../store/authStore';
import Input from '../components/ui/Input';

function formatGuestDataSummary(guestData) {
  const parts = [];

  if (guestData.todos > 0) parts.push(`일정 ${guestData.todos}개`);
  if (guestData.completions > 0) parts.push(`완료 기록 ${guestData.completions}개`);
  if (guestData.categories > 0) parts.push(`카테고리 ${guestData.categories}개`);

  return parts.length > 0 ? parts.join(', ') : '게스트 데이터';
}

function buildMigrationMessage(guestData) {
  const summary = formatGuestDataSummary(guestData);
  return `${summary}가 있습니다.\n가져오면 모든 일정은 Inbox로 이동하고, 게스트 카테고리 구조는 유지되지 않습니다.`;
}

function showRequestError(error, title) {
  console.error(`❌ [${title}]`, error);

  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    Toast.show({
      type: 'error',
      text1: '네트워크 오류',
      text2: '인터넷 연결을 확인하고 다시 시도해주세요',
    });
    return;
  }

  if (error.code === 'ECONNABORTED') {
    Toast.show({
      type: 'error',
      text1: '요청 시간 초과',
      text2: '네트워크 상태를 확인하고 다시 시도해주세요',
    });
    return;
  }

  Toast.show({
    type: 'error',
    text1: title,
    text2: error.response?.data?.message || error.message || '잠시 후 다시 시도해주세요',
  });
}

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingGuestData, setIsCheckingGuestData] = useState(false);

  const {
    setAuth,
    checkGuestData,
    migrateGuestData,
    discardGuestData,
  } = useAuthStore();

  const performLogin = async () => {
    const response = await api.post('/auth/login', {
      email: email.trim(),
      password,
    });

    const { token, user } = response.data;
    await setAuth(token, user, { clearLocalData: true });

    Toast.show({
      type: 'success',
      text1: '로그인 성공',
      text2: `${user.name}님 환영합니다!`,
    });

    setIsLoading(false);
    router.replace('/(app)/(tabs)');
  };

  const handleMigrate = async () => {
    try {
      setIsLoading(true);
      await migrateGuestData({
        email: email.trim(),
        password,
      });

      Toast.show({
        type: 'success',
        text1: '가져오기 완료',
        text2: '게스트 일정이 Inbox로 이동했습니다.',
      });

      setIsLoading(false);
      router.replace('/(app)/(tabs)');
    } catch (error) {
      setIsLoading(false);
      showRequestError(error, '가져오기 실패');
    }
  };

  const handleDiscard = async () => {
    try {
      setIsLoading(true);
      await discardGuestData();
      await performLogin();
    } catch (error) {
      setIsLoading(false);
      showRequestError(error, '로그인 실패');
    }
  };

  const showMigrationOptions = (guestData) => {
    const message = buildMigrationMessage(guestData);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: '게스트 데이터 발견',
          message,
          options: ['취소', '버리기', '가져오기'],
          cancelButtonIndex: 0,
          destructiveButtonIndex: 1,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) {
            handleDiscard();
            return;
          }
          if (buttonIndex === 2) {
            handleMigrate();
          }
        }
      );
      return;
    }

    if (Platform.OS === 'web') {
      const input = window.prompt(
        `게스트 데이터 발견\n\n${message}\n\n1: 가져오기\n2: 버리기\n3: 취소`,
        '1'
      );
      const normalized = input?.trim();

      if (normalized === '1') {
        handleMigrate();
      } else if (normalized === '2') {
        handleDiscard();
      }
      return;
    }

    Alert.alert(
      '게스트 데이터 발견',
      message,
      [
        { text: '취소', style: 'cancel' },
        { text: '버리기', style: 'destructive', onPress: handleDiscard },
        { text: '가져오기', onPress: handleMigrate },
      ]
    );
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '이메일과 비밀번호를 입력해주세요',
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
      setIsCheckingGuestData(true);
      const guestData = await checkGuestData();
      setIsCheckingGuestData(false);

      if (guestData?.hasGuestData) {
        showMigrationOptions(guestData);
        return;
      }

      setIsLoading(true);
      await performLogin();
    } catch (error) {
      setIsCheckingGuestData(false);
      setIsLoading(false);
      showRequestError(error, '로그인 실패');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: 'white' }}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {typeof router.canGoBack === 'function' && router.canGoBack() && (
        <TouchableOpacity onPress={() => router.back()} className="self-start mb-6">
          <Ionicons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
      )}

      <Text className="text-3xl font-bold mb-8 text-center text-gray-800">
        TODOLOG
      </Text>

      <Text className="text-xl font-bold mb-2 text-center text-gray-600">
        기존 회원 로그인
      </Text>
      <Text className="text-sm text-gray-500 text-center mb-6 leading-5">
        가져오기를 선택하면 게스트 일정은 Inbox로 이동하고 카테고리 구조는 유지되지 않습니다.
      </Text>

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

      <Input
        icon="lock-closed-outline"
        placeholder="비밀번호 (6자 이상)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      <TouchableOpacity
        className={`rounded-xl py-4 mb-4 mt-2 ${(isLoading || isCheckingGuestData) ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
        onPress={handleSubmit}
        disabled={isLoading || isCheckingGuestData}
      >
        {(isLoading || isCheckingGuestData) ? (
          <View className="flex-row items-center justify-center">
            <ActivityIndicator color="white" size="small" />
            <Text className="text-white text-center font-semibold text-lg ml-2">
              {isCheckingGuestData ? '게스트 데이터 확인 중...' : '로그인 중...'}
            </Text>
          </View>
        ) : (
          <Text className="text-white text-center font-semibold text-lg">
            로그인
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => router.push('/(app)/guest/convert')}
        className="p-2 mb-8"
      >
        <Text className="text-blue-500 text-center font-medium">
          계정이 없으신가요? 회원가입
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`rounded-xl py-3 mb-3 border ${(isLoading || isCheckingGuestData) ? 'bg-gray-100 border-gray-300' : 'bg-white border-amber-300 active:bg-amber-50'}`}
        onPress={() => router.push('/test-menu-reorder')}
        disabled={isLoading || isCheckingGuestData}
      >
        <Text className="text-amber-700 text-center font-semibold">
          Menu + Reorder 테스트 화면
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        className={`rounded-xl py-3 mb-2 border ${(isLoading || isCheckingGuestData) ? 'bg-gray-100 border-gray-300' : 'bg-white border-emerald-300 active:bg-emerald-50'}`}
        onPress={() => router.push('/native-list-interactions')}
        disabled={isLoading || isCheckingGuestData}
      >
        <Text className="text-emerald-700 text-center font-semibold">
          Native List Interactions 테스트 화면
        </Text>
      </TouchableOpacity>

      <Text className="text-xs text-gray-400 text-center mt-3 mb-6 leading-5">
        위 테스트 화면들은 public route라서 로그인 없이도 바로 확인할 수 있습니다.
      </Text>
    </ScrollView>
  );
}
