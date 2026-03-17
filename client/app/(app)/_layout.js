import { Stack } from 'expo-router';
import { Button, Platform, View } from 'react-native';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';

import { useTimeZone } from '../../src/hooks/useTimeZone';
import { useAuthStore } from '../../src/store/authStore';

export const unstable_settings = {
  anchor: '(tabs)',
};

const TAB_TITLES = {
  index: '홈',
  calendar: '캘린더',
  strip: '스트립',
  test: '테스트',
  debug: '디버그',
  'my-page': 'My Page',
  'week-flow': 'Week Flow',
};

function getTabTitleFromRoute(route) {
  const focusedRouteName = getFocusedRouteNameFromRoute(route);
  const title = TAB_TITLES[focusedRouteName];
  return title || TAB_TITLES.index;
}

const ANDROID_FORM_SHEET_FOOTER =
  Platform.OS === 'android'
    ? () => (
        <View
          style={{
            padding: 16,
            backgroundColor: 'white',
            borderTopWidth: 1,
            borderTopColor: '#e5e7eb',
          }}
        >
          <Button title="Confirm" onPress={() => {}} />
        </View>
      )
    : undefined;

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
          sheetAllowedDetents: [0.75, 1],
          sheetInitialDetentIndex: 0,
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

      <Stack.Screen
        name="test/recurrence-engine"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Recurrence Engine Test',
        }}
      />
      <Stack.Screen
        name="test/modals"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Modals Test Hub',
        }}
      />
      <Stack.Screen
        name="test/presentation-modal"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: "presentation: 'modal'",
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="test/presentation-page-sheet"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: "presentation: 'pageSheet'",
          presentation: 'pageSheet',
        }}
      />
      <Stack.Screen
        name="test/presentation-transparent-modal"
        options={{
          headerShown: false,
          title: "presentation: 'transparentModal'",
          presentation: 'transparentModal',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="test/presentation-fullscreen-modal"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: "presentation: 'fullScreenModal'",
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="test/presentation-contained-modal"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: "presentation: 'containedModal'",
          presentation: 'containedModal',
        }}
      />
      <Stack.Screen
        name="test/presentation-contained-transparent-modal"
        options={{
          headerShown: false,
          title: "presentation: 'containedTransparentModal'",
          presentation: 'containedTransparentModal',
          contentStyle: { backgroundColor: 'transparent' },
        }}
      />
      <Stack.Screen
        name="test/form-sheet"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Form Sheet Test',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.25, 0.5, 1],
          sheetInitialDetentIndex: 1,
          sheetGrabberVisible: Platform.OS === 'ios',
          sheetCornerRadius: 24,
          sheetLargestUndimmedDetentIndex: 1,
          unstable_sheetFooter: ANDROID_FORM_SHEET_FOOTER,
        }}
      />
      <Stack.Screen
        name="test/form-sheet-fit"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'FormSheet fitToContents',
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: Platform.OS === 'ios',
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen
        name="test/page-sheet"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Page Sheet Test',
        }}
      />
      <Stack.Screen
        name="test/quick-bar-native"
        options={{
          headerBackTitle: '뒤로',
          headerShown: true,
          title: 'Quick Bar Native Test',
        }}
      />

    </Stack>
  );
}
