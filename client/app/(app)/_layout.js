import { Stack } from 'expo-router';

import { useTimeZone } from '../../src/hooks/useTimeZone';
import { useAuthStore } from '../../src/store/authStore';

export default function AppLayout() {
  const { user, isLoading } = useAuthStore();

  useTimeZone();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      <Stack.Screen
        name="category/[categoryId]"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="category/form"
        options={{
          headerBackTitle: '취소',
          headerShown: true,
          title: '',
        }}
      />
      <Stack.Screen
        name="category/color"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: '색상 선택',
        }}
      />

      <Stack.Screen
        name="profile/edit"
        options={{
          headerBackTitle: '취소',
          headerShown: true,
          title: '프로필 수정',
        }}
      />
      <Stack.Screen
        name="profile/verify-password"
        options={{
          headerShown: false,
          presentation: 'card',
        }}
      />

      <Stack.Screen
        name="settings/index"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: '앱 설정',
        }}
      />
      <Stack.Screen
        name="settings/theme"
        options={{
          headerBackTitleVisible: false,
          headerShown: true,
          title: '테마 설정',
        }}
      />
      <Stack.Screen
        name="settings/language"
        options={{
          headerBackTitleVisible: false,
          headerShown: true,
          title: '언어 설정',
        }}
      />
      <Stack.Screen
        name="settings/start-day"
        options={{
          headerBackTitleVisible: false,
          headerShown: true,
          title: '주 시작 요일',
        }}
      />
      <Stack.Screen
        name="settings/time-zone"
        options={{
          headerBackTitleVisible: false,
          headerShown: true,
          title: '타임존 설정',
        }}
      />
      <Stack.Screen
        name="settings/time-zone-selection"
        options={{
          headerBackTitleVisible: false,
          headerShown: true,
          title: '타임존 선택',
        }}
      />
      <Stack.Screen
        name="settings/google-calendar"
        options={{
          headerBackTitleVisible: false,
          headerShown: true,
          title: '구글 캘린더 연동',
        }}
      />

      <Stack.Screen
        name="guest/convert"
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="guest/migration-test"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Guest Migration Test',
        }}
      />

      <Stack.Screen
        name="test/recurrence-engine"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Recurrence Engine Test',
        }}
      />

      <Stack.Screen
        name="todo-calendar"
        options={{
          headerShown: true,
          title: '무한 스크롤 캘린더',
        }}
      />
    </Stack>
  );
}
