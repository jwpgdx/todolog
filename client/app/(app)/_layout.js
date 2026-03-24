import { Stack } from 'expo-router';
import { Platform } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { useTimeZone } from '../../src/hooks/useTimeZone';
import { useAuthStore } from '../../src/store/authStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

const TAB_TITLES = {
  index: 'Todo',
  calendar: 'Calendar',
  'my-page': 'My Page',
};

function getTabTitleFromRoute(route) {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  const title = TAB_TITLES[focusedRouteName];
  return title || TAB_TITLES.index;
}

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
      <Stack.Screen
        name="(tabs)"
        options={({ route }) => ({
          headerShown: false,
          title: getTabTitleFromRoute(route),
        })}
      />

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
          presentation: 'modal',
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
        name="todo-form/v2"
        options={{
          headerShown: false,
          presentation: 'formSheet',
          sheetAllowedDetents: [1],
          sheetInitialDetentIndex: 'last',
          sheetGrabberVisible: Platform.OS === 'ios',
          sheetCornerRadius: 28,
          webModalStyle: {
            width: 'min(960px, 94vw)',
            minWidth: 360,
            minHeight: 'min(760px, 88vh)',
            border: '1px solid #E5E7EB',
            overlayBackground: 'rgba(15, 23, 42, 0.24)',
            shadow: 'drop-shadow(0 24px 80px rgba(15, 23, 42, 0.18))',
          },
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

    </Stack>
  );
}
