import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen({ navigation }) {
  const { user } = useAuthStore();

  // Mock data for activity summary
  const totalTodos = 0;
  const todayTodos = 0;

  const handleEditProfilePress = () => {
    // 소셜 로그인 유저는 비밀번호 검증 없이 바로 이동 (비밀번호가 없으므로)
    if (user?.provider === 'google') {
      navigation.navigate('EditProfile');
      return;
    }
    // 이메일 가입 유저는 비밀번호 확인 화면으로 이동
    navigation.navigate('VerifyPassword');
  };

  return (
    <SafeAreaView className="flex-1 bg-white" edges={['top']}>


      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* 2. Profile Card */}
        <View className="items-center py-8">
          <View className="w-24 h-24 bg-gray-200 rounded-full mb-4 items-center justify-center overflow-hidden">
            {/* Fallback for now, plan to add image later */}
            <Ionicons name="person" size={48} color="#9ca3af" />
          </View>
          <Text className="text-xl font-bold mb-1">{user?.name || '사용자'}</Text>
          <Text className="text-gray-500 mb-4">{user?.email || 'email@example.com'}</Text>

          <TouchableOpacity
            className="flex-row items-center bg-gray-100 px-4 py-2 rounded-full"
            onPress={handleEditProfilePress}
          >
            <Text className="text-sm font-medium mr-1 text-gray-700">프로필 수정</Text>
            <Ionicons name="chevron-forward" size={16} color="#4b5563" />
          </TouchableOpacity>
        </View>

        {/* 3. Activity Summary */}
        <View className="flex-row mx-4 mb-8 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <TouchableOpacity
            className="flex-1 items-center border-r border-gray-200"
            onPress={() => navigation.navigate('ManageTodos')}
          >
            <Text className="text-gray-500 text-sm mb-1">전체 할 일</Text>
            <Text className="text-2xl font-bold">{totalTodos}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 items-center"
            onPress={() => navigation.navigate('Home')}
          >
            <Text className="text-gray-500 text-sm mb-1">오늘 할 일</Text>
            <Text className="text-2xl font-bold text-blue-500">{todayTodos}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Content Menu */}
        <View className="px-4">
          <Text className="text-lg font-bold mb-3">콘텐츠</Text>

          <MenuLink
            title="일정 관리"
            onPress={() => navigation.navigate('ManageTodos')}
          />
          <MenuLink
            title="카테고리 관리"
            onPress={() => navigation.navigate('CategoryManagement')}
          />
          <MenuLink
            title="구글 캘린더 연동"
            onPress={() => navigation.navigate('GoogleCalendarSettings')}
            isLast
          />
        </View>

        {/* Settings & Others */}
        <View className="px-4 mt-8">
          <Text className="text-lg font-bold mb-3">설정 및 기타</Text>

          <MenuLink
            title="앱 설정"
            onPress={() => navigation.navigate('Settings')}
            isLast
          />
        </View>

        {/* Information & Support */}
        <View className="px-4 mt-8">
          <Text className="text-lg font-bold mb-3">정보 및 지원</Text>

          <MenuLink
            title="공지사항"
            onPress={() => console.log('공지사항 클릭됨')}
          />
          <MenuLink
            title="리뷰 남기기"
            onPress={() => console.log('리뷰 남기기 클릭됨')}
          />
          <MenuLink
            title="이용약관"
            onPress={() => console.log('이용약관 클릭됨')}
          />
          <MenuLink
            title="개인정보 처리방침"
            onPress={() => console.log('개인정보 처리방침 클릭됨')}
            isLast
          />
        </View>

        {/* Bottom Section */}
        <View className="px-4 mt-8 mb-8 items-center">
          <TouchableOpacity
            onPress={() => useAuthStore.getState().logout()}
            className="mb-4"
          >
            <Text className="text-red-500 font-bold text-base">로그아웃</Text>
          </TouchableOpacity>
          <Text className="text-gray-400 text-xs">Ver 1.0.0</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

function MenuLink({ title, onPress, isLast }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={`flex-row justify-between items-center py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
      <Text className="text-base text-gray-800">{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
    </TouchableOpacity>
  );
}
