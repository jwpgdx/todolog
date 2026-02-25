// App.js
import 'react-native-gesture-handler';
import "./global.css";
import './src/services/db/database'; // ⚡ DB 조기 초기화 (모듈 로드 시 자동 시작)
import './src/utils/i18n';
import i18n from './src/utils/i18n';
import * as Localization from 'expo-localization';
import { useEffect, useRef } from 'react';
import { InteractionManager, Platform, View } from 'react-native';
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
import { runCommonQueryForRange } from './src/services/query-aggregation';
import { getCurrentDateInTimeZone } from './src/utils/timeZoneDate';

const queryClient = new QueryClient();

setQueryClient(queryClient);

let hasRunCommonRangePrewarm = false;

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(dateOnly) {
  if (typeof dateOnly !== 'string') return null;
  const match = dateOnly.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function buildPrewarmRange(anchorDateOnly) {
  const anchorDate = parseDateOnly(anchorDateOnly) || new Date();
  const startDate = formatDateOnly(addDays(anchorDate, -90));
  const endDate = formatDateOnly(addDays(anchorDate, 90));
  return { startDate, endDate };
}

export default function App() {
  const { user, isLoading, loadAuth } = useAuthStore();
  const { currentDate, setCurrentDate } = useDateStore();
  const { mode } = useTodoFormStore();
  const { setColorScheme } = useColorScheme();
  const hasInitializedCurrentDateRef = useRef(false);
  const previousTimeZoneRef = useRef(null);

  // ⚡ SQLite 초기화 및 워밍업 완료 대기
  useEffect(() => {
    let cancelled = false;
    let prewarmTimerId = null;
    let interactionTask = null;
    const scheduleAfterInteractions =
      typeof InteractionManager?.runAfterInteractions === 'function'
        ? InteractionManager.runAfterInteractions.bind(InteractionManager)
        : (task) => {
            task?.();
            return { cancel: () => {} };
          };

    const initializeDatabase = async () => {
      const startTime = performance.now();
      console.log('🚀 [App] SQLite 초기화 시작 (워밍업 포함)...');

      try {
        await ensureDatabase(); // 워밍업 완료까지 대기
        const endTime = performance.now();
        console.log(`✅ [App] SQLite 초기화 완료 (${(endTime - startTime).toFixed(2)}ms)`);

        if (hasRunCommonRangePrewarm || cancelled) {
          return;
        }
        hasRunCommonRangePrewarm = true;

        interactionTask = scheduleAfterInteractions(() => {
          prewarmTimerId = setTimeout(async () => {
            if (cancelled) {
              return;
            }

            const prewarmStart = performance.now();
            const traceId = `app-prewarm-${Date.now().toString(36)}`;
            const anchorDate = getCurrentDateInTimeZone();
            const { startDate, endDate } = buildPrewarmRange(anchorDate);
            console.log(
              `[App] Common range prewarm start: ${startDate} ~ ${endDate} ` +
              `(trace=${traceId}, anchor=${anchorDate})`
            );

            try {
              const result = await runCommonQueryForRange({
                startDate,
                endDate,
                syncStatus: {
                  isSyncing: false,
                  error: null,
                  lastSyncTime: null,
                },
                traceId,
              });
              const elapsedMs = (performance.now() - prewarmStart).toFixed(2);
              if (!result.ok) {
                console.warn(
                  `[App] Common range prewarm failed (${elapsedMs}ms, trace=${traceId}): ${result.error || 'unknown'}`
                );
                return;
              }
              console.log(
                `[App] Common range prewarm done (${elapsedMs}ms, trace=${traceId}) ` +
                `stage(c=${result.stage.candidate},d=${result.stage.decided},a=${result.stage.aggregated})`
              );
            } catch (prewarmError) {
              console.warn(
                `[App] Common range prewarm error (trace=${traceId}):`,
                prewarmError?.message || prewarmError
              );
            }
          }, 0);
        });
      } catch (err) {
        console.error('❌ [App] DB 초기화 실패:', err);
      }
    };

    initializeDatabase();

    return () => {
      cancelled = true;
      if (prewarmTimerId != null) {
        clearTimeout(prewarmTimerId);
      }
      interactionTask?.cancel?.();
    };
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
