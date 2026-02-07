/**
 * Guest Migration Test Screen
 * 
 * 게스트 데이터 마이그레이션 통합 테스트 화면
 */

import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

import {
  createScenario1Data,
  createScenario3Data,
  createScenario6Data,
  getGuestDataStats,
  cleanupGuestData,
  createTestAccount,
} from './guestDataHelper';
import { useAuthStore } from '../store/authStore';

export default function GuestMigrationTestScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const { user, checkGuestData, logout } = useAuthStore();
  const [isWeb, setIsWeb] = useState(false);
  const [testAccount, setTestAccount] = useState(null);

  React.useEffect(() => {
    // 웹 환경 감지
    if (typeof window !== 'undefined' && window.document) {
      setIsWeb(true);
    }
    refreshStats();
  }, []);

  // 통계 새로고침
  const refreshStats = async () => {
    try {
      const data = await getGuestDataStats();
      setStats(data);
      console.log('📊 Stats refreshed:', data);
    } catch (error) {
      console.error('Failed to refresh stats:', error);
      Toast.show({
        type: 'error',
        text1: '통계 조회 실패',
        text2: error.message,
      });
    }
  };

  // Scenario 1: 기본 데이터 생성
  const handleScenario1 = async () => {
    try {
      setIsLoading(true);
      await createScenario1Data();
      await refreshStats();
      Toast.show({
        type: 'success',
        text1: 'Scenario 1 완료',
        text2: '5개 일정, 2개 카테고리, 3개 완료',
      });
    } catch (error) {
      console.error('Scenario 1 failed:', error);
      Toast.show({
        type: 'error',
        text1: 'Scenario 1 실패',
        text2: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Scenario 3: 빈 데이터
  const handleScenario3 = async () => {
    Alert.alert(
      '데이터 삭제',
      '모든 게스트 데이터를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await createScenario3Data();
              await refreshStats();
              Toast.show({
                type: 'success',
                text1: 'Scenario 3 완료',
                text2: '모든 데이터 삭제됨',
              });
            } catch (error) {
              console.error('Scenario 3 failed:', error);
              Toast.show({
                type: 'error',
                text1: 'Scenario 3 실패',
                text2: error.message,
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // Scenario 6: 대용량 데이터
  const handleScenario6 = async () => {
    Alert.alert(
      '대용량 데이터 생성',
      '100개 일정, 10개 카테고리, 50개 완료를 생성합니다. 시간이 걸릴 수 있습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '생성',
          onPress: async () => {
            try {
              setIsLoading(true);
              await createScenario6Data();
              await refreshStats();
              Toast.show({
                type: 'success',
                text1: 'Scenario 6 완료',
                text2: '100개 일정, 10개 카테고리, 50개 완료',
              });
            } catch (error) {
              console.error('Scenario 6 failed:', error);
              Toast.show({
                type: 'error',
                text1: 'Scenario 6 실패',
                text2: error.message,
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  // 게스트 데이터 확인 (authStore 메서드 테스트)
  const handleCheckGuestData = async () => {
    try {
      const data = await checkGuestData();
      Alert.alert(
        '게스트 데이터 확인',
        `일정: ${data.todos}개\n카테고리: ${data.categories}개`,
        [{ text: '확인' }]
      );
    } catch (error) {
      console.error('Check guest data failed:', error);
      Toast.show({
        type: 'error',
        text1: '확인 실패',
        text2: error.message,
      });
    }
  };

  // 로그아웃하여 로그인 화면으로
  const handleNavigateToLogin = async () => {
    if (Platform.OS === 'web') {
      // 웹에서는 confirm 사용
      const confirmed = window.confirm(
        '로그아웃하여 로그인 화면으로 이동하시겠습니까?\n\n게스트 데이터는 유지됩니다.'
      );
      
      if (confirmed) {
        try {
          await logout({ skipDataClear: true, showLogin: true });
          Toast.show({
            type: 'info',
            text1: '로그아웃 완료',
            text2: '로그인 화면으로 이동합니다',
          });
        } catch (error) {
          console.error('Logout failed:', error);
          Toast.show({
            type: 'error',
            text1: '로그아웃 실패',
            text2: error.message,
          });
        }
      }
    } else {
      // 네이티브에서는 Alert 사용
      Alert.alert(
        '로그아웃',
        '로그아웃하여 로그인 화면으로 이동하시겠습니까?\n\n게스트 데이터는 유지됩니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '로그아웃',
            onPress: async () => {
              try {
                await logout({ skipDataClear: true, showLogin: true });
                Toast.show({
                  type: 'info',
                  text1: '로그아웃 완료',
                  text2: '로그인 화면으로 이동합니다',
                });
              } catch (error) {
                console.error('Logout failed:', error);
                Toast.show({
                  type: 'error',
                  text1: '로그아웃 실패',
                  text2: error.message,
                });
              }
            },
          },
        ]
      );
    }
  };

  // 테스트 계정 생성
  const handleCreateTestAccount = async () => {
    try {
      setIsLoading(true);
      const account = await createTestAccount();
      setTestAccount(account);
      
      Alert.alert(
        '테스트 계정 생성 완료',
        `Email: ${account.email}\nPassword: ${account.password}\n\n이 정보를 복사하여 로그인에 사용하세요.`,
        [{ text: '확인' }]
      );
      
      Toast.show({
        type: 'success',
        text1: '테스트 계정 생성 완료',
        text2: account.email,
      });
    } catch (error) {
      console.error('Create test account failed:', error);
      Toast.show({
        type: 'error',
        text1: '계정 생성 실패',
        text2: error.response?.data?.message || error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 정리
  const handleCleanup = async () => {
    Alert.alert(
      '데이터 정리',
      '모든 게스트 데이터를 삭제하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await cleanupGuestData();
              await refreshStats();
              Toast.show({
                type: 'success',
                text1: '정리 완료',
                text2: '모든 데이터 삭제됨',
              });
            } catch (error) {
              console.error('Cleanup failed:', error);
              Toast.show({
                type: 'error',
                text1: '정리 실패',
                text2: error.message,
              });
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <ScrollView className="flex-1 p-4">
        {/* Header */}
        <View className="mb-6">
          <Text className="text-2xl font-bold mb-2">
            Guest Migration Test
          </Text>
          <Text className="text-gray-600">
            통합 테스트 시나리오 실행
          </Text>
        </View>

        {/* Web Warning */}
        {isWeb && (
          <View className="bg-yellow-50 p-4 rounded-lg mb-6 border border-yellow-200">
            <Text className="text-sm font-semibold text-yellow-900 mb-1">
              ⚠️ 웹 환경 제한
            </Text>
            <Text className="text-yellow-700 text-xs">
              SQLite는 웹 브라우저에서 제한적으로 작동합니다.{'\n'}
              실제 테스트는 iOS 시뮬레이터나 Android 에뮬레이터에서 진행해주세요.
            </Text>
          </View>
        )}

        {/* Current User */}
        <View className="bg-blue-50 p-4 rounded-lg mb-6">
          <Text className="text-sm font-semibold text-blue-900 mb-1">
            Current User
          </Text>
          <Text className="text-blue-700">
            {user?.email || user?.name || 'Guest'}
          </Text>
          <Text className="text-xs text-blue-600 mt-1">
            Account Type: {user?.accountType || 'anonymous'}
          </Text>
        </View>

        {/* Test Account Info */}
        {testAccount && (
          <View className="bg-green-50 p-4 rounded-lg mb-6 border border-green-200">
            <Text className="text-sm font-semibold text-green-900 mb-2">
              ✅ 테스트 계정 생성됨
            </Text>
            <Text className="text-green-700 text-xs mb-1">
              Email: {testAccount.email}
            </Text>
            <Text className="text-green-700 text-xs">
              Password: {testAccount.password}
            </Text>
          </View>
        )}

        {/* Stats */}
        {stats && (
          <View className="bg-gray-50 p-4 rounded-lg mb-6">
            <Text className="text-sm font-semibold text-gray-900 mb-2">
              Current Data
            </Text>
            <View className="flex-row justify-between">
              <View>
                <Text className="text-2xl font-bold text-gray-900">
                  {stats.todoCount}
                </Text>
                <Text className="text-xs text-gray-600">Todos</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-gray-900">
                  {stats.categoryCount}
                </Text>
                <Text className="text-xs text-gray-600">Categories</Text>
              </View>
              <View>
                <Text className="text-2xl font-bold text-gray-900">
                  {stats.completionCount}
                </Text>
                <Text className="text-xs text-gray-600">Completions</Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={refreshStats}
              className="mt-3 py-2 bg-gray-200 rounded-lg"
            >
              <Text className="text-center text-gray-700 font-medium">
                새로고침
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Scenarios */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3">Test Scenarios</Text>

          <TestButton
            title="Scenario 1: 기본 데이터"
            description="5개 일정, 2개 카테고리, 3개 완료"
            onPress={handleScenario1}
            disabled={isLoading}
            color="blue"
          />

          <TestButton
            title="Scenario 3: 빈 데이터"
            description="모든 데이터 삭제"
            onPress={handleScenario3}
            disabled={isLoading}
            color="orange"
          />

          <TestButton
            title="Scenario 6: 대용량 데이터"
            description="100개 일정, 10개 카테고리, 50개 완료"
            onPress={handleScenario6}
            disabled={isLoading}
            color="purple"
          />
        </View>

        {/* Actions */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3">Actions</Text>

          <TestButton
            title="게스트 데이터 확인"
            description="authStore.checkGuestData() 테스트"
            onPress={handleCheckGuestData}
            disabled={isLoading}
            color="green"
          />

          <TestButton
            title="데이터 정리"
            description="모든 게스트 데이터 삭제"
            onPress={handleCleanup}
            disabled={isLoading}
            color="red"
          />
        </View>

        {/* Navigation */}
        <View className="mb-6">
          <Text className="text-lg font-semibold mb-3">Navigation</Text>

          <TestButton
            title="테스트 계정 생성"
            description="자동으로 테스트용 회원 계정 생성"
            onPress={handleCreateTestAccount}
            disabled={isLoading}
            color="green"
          />

          <TestButton
            title="로그인 화면으로"
            description="로그아웃 후 마이그레이션 테스트"
            onPress={handleNavigateToLogin}
            disabled={isLoading}
            color="indigo"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// Test Button Component
function TestButton({ title, description, onPress, disabled, color = 'blue' }) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    orange: 'bg-orange-500',
    red: 'bg-red-500',
    purple: 'bg-purple-500',
    indigo: 'bg-indigo-500',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`mb-3 p-4 rounded-lg ${
        disabled ? 'bg-gray-300' : colorClasses[color]
      }`}
    >
      <Text className="text-white font-semibold mb-1">{title}</Text>
      <Text className="text-white text-xs opacity-90">{description}</Text>
    </TouchableOpacity>
  );
}
