import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useAuthStore } from '../store/authStore';

export default function WelcomeScreen() {
  const navigation = useNavigation();
  const { loginAsGuest } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleGetStarted = async () => {
    try {
      setIsLoading(true);
      await loginAsGuest();
      // 게스트 로그인 성공 시 자동으로 Home으로 이동 (Navigation에서 처리)
    } catch (error) {
      console.error('Guest login error:', error);

      // 네트워크 오류 처리
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        Toast.show({
          type: 'error',
          text1: '네트워크 오류',
          text2: '인터넷 연결을 확인하고 다시 시도해주세요',
        });
        setIsLoading(false);
        return;
      }

      // 타임아웃 오류
      if (error.code === 'ECONNABORTED') {
        Toast.show({
          type: 'error',
          text1: '요청 시간 초과',
          text2: '네트워크 상태를 확인하고 다시 시도해주세요',
        });
        setIsLoading(false);
        return;
      }

      // 서버 응답 에러
      const errorMessage = error.response?.data?.message;
      if (errorMessage) {
        Toast.show({
          type: 'error',
          text1: '시작 실패',
          text2: errorMessage,
        });
      } else {
        Toast.show({
          type: 'error',
          text1: '시작 실패',
          text2: '잠시 후 다시 시도해주세요',
        });
      }
      setIsLoading(false);
    }
  };

  return (
    <View className="flex-1 justify-center items-center bg-white px-6">
      {/* 앱 아이콘/로고 */}
      <Text className="text-6xl mb-4">📝</Text>
      
      {/* 앱 이름 */}
      <Text className="text-4xl font-bold text-gray-800 mb-2">
        Todolog
      </Text>
      
      {/* 설명 */}
      <Text className="text-gray-500 text-center mb-12">
        할 일을 기록하고 관리하세요
      </Text>

      {/* 시작하기 버튼 (큰 버튼) */}
      <TouchableOpacity
        className={`w-full rounded-xl py-4 mb-4 ${isLoading ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
        onPress={handleGetStarted}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white text-center font-bold text-lg">
            시작하기
          </Text>
        )}
      </TouchableOpacity>

      {/* 로그인 링크 (작은 텍스트) */}
      <TouchableOpacity 
        onPress={() => navigation.navigate('Login')}
        className="p-2"
        disabled={isLoading}
      >
        <Text className="text-gray-500 text-center">
          이미 계정이 있으신가요? <Text className="text-blue-500 font-semibold">로그인</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}
