import React from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import CategoryGroupList from '../components/domain/category/CategoryGroupList';
import { useFloatingTabBarScrollPadding } from '../navigation/useFloatingTabBarInset';
import { useAllTodos } from '../hooks/queries/useAllTodos';
import { useTodos } from '../hooks/queries/useTodos';
import { useTodayDate } from '../hooks/useTodayDate';

export default function MyPageScreen() {
  const router = useRouter();
  const [isRNModalVisible, setIsRNModalVisible] = React.useState(false);
  const { user, openLoginScreen } = useAuthStore();
  const bottomInset = useFloatingTabBarScrollPadding(16);
  const { todayDate } = useTodayDate();
  const { data: allTodos = [] } = useAllTodos(todayDate);
  const { data: currentDateTodos = [] } = useTodos(todayDate);

  const totalTodos = allTodos.length;
  const todayTodos = currentDateTodos.length;

  const handleEditProfilePress = () => {
    // 소셜 로그인 유저는 비밀번호 검증 없이 바로 이동 (비밀번호가 없으므로)
    if (user?.provider === 'google') {
      router.push('/(app)/(tabs)/my-page/profile/edit');
      return;
    }
    // 이메일 가입 유저는 비밀번호 확인 화면으로 이동
    router.push('/(app)/(tabs)/my-page/profile/verify-password');
  };

  return (
    <>
      <ScrollView
        className="flex-1 bg-white"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: bottomInset }}
      >
        {/* Guest Banner */}
        {user?.accountType === 'anonymous' && (
          <View className="mx-4 mt-4 mb-2 bg-gray-50 border border-gray-200 rounded-xl p-4">
            <View className="flex-row items-center mb-2">
              <Ionicons name="information-circle" size={20} color="#6b7280" />
              <Text className="text-gray-800 font-semibold ml-2">게스트로 사용 중입니다</Text>
            </View>
            <Text className="text-gray-600 text-sm mb-3">
              회원으로 전환하면 여러 기기에서 데이터를 동기화할 수 있습니다.
            </Text>
            
            {/* 회원가입 버튼 */}
            <TouchableOpacity
              className="bg-gray-900 py-3 px-4 rounded-lg active:bg-blue-600 mb-2"
              onPress={() => router.push('/(app)/guest/convert')}
            >
              <Text className="text-white font-semibold text-center">회원가입</Text>
            </TouchableOpacity>
            
            {/* 기존 회원 로그인 버튼 */}
            <TouchableOpacity
              className="bg-white border border-gray-300 py-3 px-4 rounded-lg active:bg-blue-50"
              onPress={openLoginScreen}
            >
              <Text className="text-gray-700 font-semibold text-center">기존 회원 로그인</Text>
            </TouchableOpacity>
          </View>
        )}

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
            onPress={() => router.push('/(app)/(tabs)')}
          >
            <Text className="text-gray-500 text-sm mb-1">전체 할 일</Text>
            <Text className="text-2xl font-bold">{totalTodos}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-1 items-center"
            onPress={() => router.push('/(app)/(tabs)')}
          >
            <Text className="text-gray-500 text-sm mb-1">오늘 할 일</Text>
            <Text className="text-2xl font-bold text-gray-900">{todayTodos}</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Content Menu */}
        <View className="px-4">
          <Text className="text-lg font-bold mb-3">콘텐츠</Text>

          <MenuLink
            title="일정 관리"
            onPress={() => router.push('/(app)/(tabs)/my-page/all-todos')}
          />
          <MenuLink
            title="즐겨찾기"
            onPress={() => router.push('/(app)/(tabs)/my-page/favorites')}
          />
          <MenuLink
            title="구글 캘린더 연동"
            onPress={() => router.push('/(app)/(tabs)/my-page/settings/google-calendar')}
            isLast
          />
        </View>

        <CategoryGroupList />

        {/* Fake Presentation Sandbox */}
        <View className="px-4 mt-8">
          <Text className="text-lg font-bold mb-3">가짜 Presentation 비교</Text>

          <MenuLink
            title="Fake - push(card)"
            onPress={() => router.push('/(app)/(tabs)/my-page/presentation/push')}
          />
          <MenuLink
            title="Fake - modal"
            onPress={() => router.push('/(app)/(tabs)/my-page/presentation/modal')}
          />
          <MenuLink
            title="Fake - formSheet"
            onPress={() => router.push('/(app)/(tabs)/my-page/presentation/formsheet')}
          />
          <MenuLink
            title="Fake - RN Modal"
            onPress={() => setIsRNModalVisible(true)}
            isLast
          />
        </View>

        {/* Presentation Test */}
        <View className="px-4 mt-8">
          <Text className="text-lg font-bold mb-3">Presentation 테스트</Text>

          <MenuLink
            title="카테고리 form - modal"
            onPress={() => router.push('/(app)/(tabs)/my-page/category/form-modal')}
          />
          <MenuLink
            title="카테고리 form - formSheet"
            onPress={() => router.push('/(app)/(tabs)/my-page/category/form-formsheet')}
            isLast
          />
        </View>

        {/* Settings & Others */}
        <View className="px-4 mt-8">
          <Text className="text-lg font-bold mb-3">설정 및 기타</Text>

          <MenuLink
            title="앱 설정"
            onPress={() => router.push('/(app)/(tabs)/my-page/settings')}
          />
          <MenuLink
            title="Native Settings Catalog"
            onPress={() => router.push('/native-settings-catalog')}
          />
          <MenuLink
            title="디버그 (DB 초기화)"
            onPress={() => router.push('/(app)/(tabs)/my-page/debug')}
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

      <Modal
        visible={isRNModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsRNModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <View className="rounded-t-3xl bg-white px-6 pb-10 pt-5">
            <View className="self-center mb-4 h-1 w-12 rounded-full bg-gray-300" />
            <Text className="text-2xl font-bold text-gray-950">RN Modal 테스트</Text>
            <Text className="mt-3 text-base leading-6 text-gray-600">
              route가 아닌 임시 overlay입니다. 삭제 확인, 짧은 경고, 커스텀 액션시트 후보로 비교하세요.
            </Text>
            <TouchableOpacity
              className="mt-6 rounded-2xl bg-gray-900 px-4 py-4"
              onPress={() => setIsRNModalVisible(false)}
            >
              <Text className="text-center text-base font-semibold text-white">닫기</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

function MenuLink({ title, onPress, isLast }) {
  return (
    <TouchableOpacity
      onPress={() => {
        onPress?.();
      }}
      className={`flex-row justify-between items-center py-4 ${!isLast ? 'border-b border-gray-100' : ''}`}
    >
      <Text className="text-base text-gray-800">{title}</Text>
      <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
    </TouchableOpacity>
  );
}
