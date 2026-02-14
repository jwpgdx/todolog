// App.js
import 'react-native-gesture-handler';
import "./global.css";
import './src/services/db/database'; // ⚡ DB 조기 초기화 (모듈 로드 시 자동 시작)
import './src/utils/i18n';
import i18n from './src/utils/i18n';
import * as Localization from 'expo-localization';
import { useEffect, useRef } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { ActionSheetProvider } from '@expo/react-native-action-sheet';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useColorScheme } from 'nativewind';

import { useAuthStore, setQueryClient } from './src/store/authStore';
import { useDateStore } from './src/store/dateStore';
import { useTodoFormStore } from './src/store/todoFormStore';
import { toastConfig } from './src/config/toastConfig';
import MainStack from './src/navigation/MainStack';
import AuthStack from './src/navigation/AuthStack';
import GlobalFormOverlay from './src/features/todo/form/GlobalFormOverlay';
import { SyncProvider } from './src/providers/SyncProvider';
import { ensureDatabase } from './src/services/db/database';
import { getCurrentDateInTimeZone } from './src/utils/timeZoneDate';

const queryClient = new QueryClient();

setQueryClient(queryClient);

export default function App() {
  const { user, isLoading, loadAuth } = useAuthStore();
  const { currentDate, setCurrentDate } = useDateStore();
  const { mode } = useTodoFormStore();
  const { setColorScheme } = useColorScheme();
  const hasInitializedCurrentDateRef = useRef(false);
  const previousTimeZoneRef = useRef(null);

  // ⚡ SQLite 초기화 및 워밍업 완료 대기
  useEffect(() => {
    const initializeDatabase = async () => {
      const startTime = performance.now();
      console.log('🚀 [App] SQLite 초기화 시작 (워밍업 포함)...');

      try {
        await ensureDatabase(); // 워밍업 완료까지 대기
        const endTime = performance.now();
        console.log(`✅ [App] SQLite 초기화 완료 (${(endTime - startTime).toFixed(2)}ms)`);
      } catch (err) {
        console.error('❌ [App] DB 초기화 실패:', err);
      }
    };

    initializeDatabase();
  }, []);

  useEffect(() => {
    loadAuth();
  }, []);

  useEffect(() => {
    if (isLoading || hasInitializedCurrentDateRef.current) {
      return;
    }

    const userTimeZone = user?.settings?.timeZone;
    const todayInCurrentTimeZone = getCurrentDateInTimeZone(userTimeZone);
    setCurrentDate(todayInCurrentTimeZone);
    previousTimeZoneRef.current = userTimeZone || null;
    hasInitializedCurrentDateRef.current = true;
  }, [isLoading, user?.settings?.timeZone, setCurrentDate]);

  useEffect(() => {
    if (isLoading || !hasInitializedCurrentDateRef.current) {
      return;
    }

    const nextTimeZone = user?.settings?.timeZone || null;
    const previousTimeZone = previousTimeZoneRef.current;

    // timeZone 변경이 없으면 무시
    if (nextTimeZone === previousTimeZone) {
      return;
    }

    // 폼 편집 중에는 날짜 점프를 보류
    if (mode !== 'CLOSED') {
      return;
    }

    const oldToday = getCurrentDateInTimeZone(previousTimeZone || undefined);
    const newToday = getCurrentDateInTimeZone(nextTimeZone || undefined);

    // 사용자가 "오늘"을 보고 있을 때만 자동 정렬
    if (currentDate === oldToday) {
      setCurrentDate(newToday);
    }

    previousTimeZoneRef.current = nextTimeZone;
  }, [isLoading, user?.settings?.timeZone, currentDate, mode, setCurrentDate]);

  useEffect(() => {
    const theme = user?.settings?.theme || 'system';
    console.log('🎨 Applied Theme:', theme);
    setColorScheme(theme);
  }, [user?.settings?.theme, setColorScheme]);

  useEffect(() => {
    const syncLanguage = async () => {
      const language = user?.settings?.language || 'system';
      console.log('🌐 Applied Language:', language);

      if (language === 'system') {
        const systemLang = Localization.getLocales()[0]?.languageCode || 'en';
        console.log('   ↳ System Language Detected:', systemLang);
        await i18n.changeLanguage(systemLang);
      } else {
        await i18n.changeLanguage(language);
      }
    };
    syncLanguage();
  }, [user?.settings?.language]);

  if (isLoading) {
    return null;
  }

  const appContent = (
    <QueryClientProvider client={queryClient}>
      <SyncProvider>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            <ActionSheetProvider>
              <View style={{ flex: 1 }}>
                <NavigationContainer>
                  <StatusBar style="auto" />
                  {user ? <MainStack /> : <AuthStack />}
                </NavigationContainer>

                <Toast config={toastConfig} topOffset={10} visibilityTime={3000} style={{ zIndex: 9999 }} />
                <GlobalFormOverlay />
              </View>
            </ActionSheetProvider>
          </BottomSheetModalProvider>
        </SafeAreaProvider>
      </SyncProvider>
    </QueryClientProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider statusBarTranslucent={Platform.OS !== 'web'}>
        {appContent}
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
