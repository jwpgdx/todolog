import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import { Platform, Pressable } from 'react-native';

export default function MyPageLayout() {
  const router = useRouter();
  const isIOS = Platform.OS === 'ios';

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          title: 'My Page',
          headerLargeTitle: isIOS,
          headerRight: () => (
            <Pressable
              onPress={() => router.push('/(app)/(tabs)/my-page/settings')}
              hitSlop={10}
              style={{ marginRight: 12 }}
            >
              <Ionicons name="settings-outline" size={22} color="#111827" />
            </Pressable>
          ),
        }}
      />

      <Stack.Screen
        name="settings/index"
        options={{
          title: '설정',
          headerLargeTitle: isIOS,
        }}
      />
      <Stack.Screen name="settings/theme" options={{ title: '테마 설정' }} />
      <Stack.Screen name="settings/language" options={{ title: '언어 설정' }} />
      <Stack.Screen name="settings/start-day" options={{ title: '주 시작 요일' }} />
      <Stack.Screen name="settings/time-zone" options={{ title: '타임존 설정' }} />
      <Stack.Screen name="settings/time-zone-selection" options={{ title: '타임존 선택' }} />
      <Stack.Screen name="settings/google-calendar" options={{ title: '구글 캘린더 연동' }} />

      <Stack.Screen
        name="profile/edit"
        options={{
          title: '프로필 수정',
          headerBackTitle: '취소',
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
        name="category/[categoryId]"
        options={{
          headerShown: true,
        }}
      />
      <Stack.Screen
        name="category/form"
        options={{
          headerShown: true,
          headerBackTitle: '취소',
          title: '',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="category/form-modal"
        options={{
          headerShown: true,
          headerBackTitle: '취소',
          title: '',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="category/form-formsheet"
        options={{
          headerShown: true,
          headerBackTitle: '취소',
          title: '',
          presentation: 'formSheet',
          sheetAllowedDetents: 'fitToContents',
          sheetGrabberVisible: true,
        }}
      />
      <Stack.Screen
        name="category/color"
        options={{
          headerShown: true,
          title: '색상 선택',
        }}
      />
      <Stack.Screen
        name="presentation/push"
        options={{
          title: 'Push 테스트',
          presentation: 'card',
        }}
      />
      <Stack.Screen
        name="presentation/modal"
        options={{
          title: 'Modal 테스트',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="presentation/formsheet"
        options={{
          title: 'FormSheet 테스트',
          presentation: 'formSheet',
          sheetAllowedDetents: [0.35, 0.7, 1],
          sheetInitialDetentIndex: 0,
          sheetGrabberVisible: true,
          sheetCornerRadius: 24,
        }}
      />
      <Stack.Screen
        name="all-todos"
        options={{
          title: '일정 관리',
          headerLargeTitle: isIOS,
        }}
      />
      <Stack.Screen
        name="favorites"
        options={{
          title: '즐겨찾기',
          headerLargeTitle: isIOS,
        }}
      />
      <Stack.Screen name="debug" options={{ title: '디버그' }} />
    </Stack>
  );
}
