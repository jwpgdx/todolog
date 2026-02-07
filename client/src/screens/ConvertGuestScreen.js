import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';
import api from '../api/axios';

export default function ConvertGuestScreen({ navigation }) {
  const { user, setUser } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState(user?.name || 'Guest User');
  const [isLoading, setIsLoading] = useState(false);

  const handleConvert = async () => {
    // Validation
    if (!email.trim()) {
      Toast.show({ type: 'error', text1: '이메일을 입력해주세요' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Toast.show({ type: 'error', text1: '올바른 이메일 형식이 아닙니다' });
      return;
    }

    if (!password.trim()) {
      Toast.show({ type: 'error', text1: '비밀번호를 입력해주세요' });
      return;
    }

    if (password.length < 6) {
      Toast.show({ type: 'error', text1: '비밀번호는 최소 6자 이상이어야 합니다' });
      return;
    }

    if (password !== confirmPassword) {
      Toast.show({ type: 'error', text1: '비밀번호가 일치하지 않습니다' });
      return;
    }

    try {
      setIsLoading(true);

      const response = await api.post('/auth/convert-guest', {
        email: email.trim(),
        password,
        name: name.trim(),
      });

      const updatedUser = response.data.user;
      await setUser(updatedUser);

      Toast.show({
        type: 'success',
        text1: '회원 전환 완료',
        text2: '이제 정회원으로 모든 기능을 사용할 수 있습니다',
      });

      navigation.goBack();
    } catch (error) {
      console.error('Convert guest error:', error);

      // 네트워크 오류 처리
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        Toast.show({
          type: 'error',
          text1: '네트워크 오류',
          text2: '인터넷 연결을 확인하고 다시 시도해주세요',
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

      // 서버 응답 에러 (400, 500 등)
      const errorMessage = error.response?.data?.message;
      if (errorMessage) {
        Toast.show({
          type: 'error',
          text1: '회원 전환 실패',
          text2: errorMessage,
        });
      } else {
        // 알 수 없는 오류
        Toast.show({
          type: 'error',
          text1: '회원 전환 실패',
          text2: '잠시 후 다시 시도해주세요',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200">
        <TouchableOpacity onPress={() => navigation.goBack()} className="mr-3">
          <Ionicons name="close" size={28} color="#000" />
        </TouchableOpacity>
        <Text className="text-lg font-bold">회원으로 전환</Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Info Banner */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <Ionicons name="information-circle" size={20} color="#3b82f6" className="mt-0.5" />
            <View className="flex-1 ml-2">
              <Text className="text-blue-700 font-semibold mb-1">게스트 데이터 유지</Text>
              <Text className="text-blue-600 text-sm">
                현재 저장된 모든 일정과 카테고리는 그대로 유지됩니다.
              </Text>
            </View>
          </View>
        </View>

        {/* Form */}
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
          />
        </View>

        {/* Convert Button */}
        <TouchableOpacity
          className={`rounded-xl py-4 ${isLoading ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
          onPress={handleConvert}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white text-center font-bold text-base">회원으로 전환</Text>
          )}
        </TouchableOpacity>

        {/* Social Login Options (Future) */}
        <View className="mt-6 items-center">
          <Text className="text-gray-400 text-sm mb-4">또는</Text>
          <TouchableOpacity
            className="flex-row items-center border border-gray-300 rounded-xl px-6 py-3 mb-3"
            disabled
          >
            <Ionicons name="logo-google" size={20} color="#DB4437" />
            <Text className="text-gray-400 ml-2 font-medium">구글 계정으로 전환 (준비 중)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
