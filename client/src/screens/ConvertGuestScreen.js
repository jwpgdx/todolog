import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  ActionSheetIOS,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useRouter } from 'expo-router';
import * as Localization from 'expo-localization';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

function formatGuestDataSummary(guestData) {
  const parts = [];

  if (guestData.todos > 0) parts.push(`일정 ${guestData.todos}개`);
  if (guestData.completions > 0) parts.push(`완료 기록 ${guestData.completions}개`);
  if (guestData.categories > 0) parts.push(`카테고리 ${guestData.categories}개`);

  return parts.length > 0 ? parts.join(', ') : '게스트 데이터';
}

function buildMigrationMessage(guestData) {
  const summary = formatGuestDataSummary(guestData);
  return `${summary}가 있습니다.\n가져오면 모든 일정은 Inbox로 이동하고 게스트 카테고리 구조는 유지되지 않습니다.`;
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

export default function ConvertGuestScreen() {
  const router = useRouter();
  const { user, setAuth, checkGuestData, migrateGuestData, discardGuestData, openLoginScreen } =
    useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(user?.name || 'Guest User');
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingGuestData, setIsCheckingGuestData] = useState(false);

  const validateForm = () => {
    if (!name.trim()) {
      Toast.show({ type: 'error', text1: '이름을 입력해주세요' });
      return false;
    }

    if (!email.trim()) {
      Toast.show({ type: 'error', text1: '이메일을 입력해주세요' });
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Toast.show({ type: 'error', text1: '올바른 이메일 형식이 아닙니다' });
      return false;
    }

    if (!password.trim()) {
      Toast.show({ type: 'error', text1: '비밀번호를 입력해주세요' });
      return false;
    }

    if (password.length < 6) {
      Toast.show({ type: 'error', text1: '비밀번호는 최소 6자 이상이어야 합니다' });
      return false;
    }

    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: '비밀번호가 일치하지 않습니다' });
      return false;
    }

    return true;
  };

  const performRegister = async ({ clearLocalData }) => {
    const timeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';

    const response = await api.post('/auth/register', {
      email: email.trim(),
      password,
      name: name.trim(),
      timeZone,
    });

    const { token, user: regularUser } = response.data;

    if (clearLocalData) {
      await setAuth(token, regularUser, { clearLocalData: true });
    }

    return { token, user: regularUser };
  };

  const handleDiscard = async () => {
    try {
      setIsLoading(true);
      await discardGuestData();
      await performRegister({ clearLocalData: true });

      Toast.show({
        type: 'success',
        text1: '회원가입 성공',
        text2: '새 계정으로 시작합니다.',
      });

      setIsLoading(false);
      router.replace('/(app)/(tabs)');
    } catch (error) {
      setIsLoading(false);
      showRequestError(error, '회원가입 실패');
    }
  };

  const handleMigrate = async () => {
    try {
      setIsLoading(true);
      await performRegister({ clearLocalData: false });
      await migrateGuestData({
        email: email.trim(),
        password,
      });

      Toast.show({
        type: 'success',
        text1: '회원가입 및 가져오기 완료',
        text2: '게스트 일정이 Inbox로 이동했습니다.',
      });

      setIsLoading(false);
      router.replace('/(app)/(tabs)');
    } catch (error) {
      setIsLoading(false);
      showRequestError(error, '회원가입 또는 가져오기 실패');
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
    if (!validateForm()) {
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
      await performRegister({ clearLocalData: true });

      Toast.show({
        type: 'success',
        text1: '회원가입 성공',
        text2: '새 계정이 준비되었습니다.',
      });

      setIsLoading(false);
      router.replace('/(app)/(tabs)');
    } catch (error) {
      setIsCheckingGuestData(false);
      setIsLoading(false);
      showRequestError(error, '회원가입 실패');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-bold">회원가입</Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3b82f6" />
            <View className="flex-1 ml-2">
              <Text className="text-blue-700 font-semibold mb-1">게스트 데이터 안내</Text>
              <Text className="text-blue-600 text-sm leading-5">
                가져오기를 선택하면 게스트 일정은 새 계정 Inbox로 이동하고, 게스트 카테고리 구조는 유지되지 않습니다.
              </Text>
            </View>
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-gray-700 font-semibold mb-2">이름</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="이름을 입력하세요"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />
        </View>

        <View className="mb-6">
          <Text className="text-gray-700 font-semibold mb-2">이메일</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="email@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View className="mb-6">
          <Text className="text-gray-700 font-semibold mb-2">비밀번호</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="최소 6자 이상"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : 'none'}
            importantForAutofill={Platform.OS === 'android' ? 'no' : 'auto'}
          />
        </View>

        <View className="mb-8">
          <Text className="text-gray-700 font-semibold mb-2">비밀번호 확인</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 text-base"
            placeholder="비밀번호를 다시 입력하세요"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="off"
            textContentType={Platform.OS === 'ios' ? 'oneTimeCode' : 'none'}
            importantForAutofill={Platform.OS === 'android' ? 'no' : 'auto'}
          />
        </View>

        <TouchableOpacity
          className={`rounded-xl py-4 ${isLoading || isCheckingGuestData ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
          onPress={handleSubmit}
          disabled={isLoading || isCheckingGuestData}
        >
          {isLoading || isCheckingGuestData ? (
            <View className="flex-row items-center justify-center">
              <ActivityIndicator color="white" />
              <Text className="text-white text-center font-bold text-base ml-2">
                {isCheckingGuestData ? '게스트 데이터 확인 중...' : '회원가입 처리 중...'}
              </Text>
            </View>
          ) : (
            <Text className="text-white text-center font-bold text-base">회원가입</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-4 items-center"
          onPress={openLoginScreen}
          disabled={isLoading || isCheckingGuestData}
        >
          <Text className="text-blue-500 font-medium">이미 계정이 있으신가요? 로그인</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
