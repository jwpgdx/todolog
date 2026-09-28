import { useCallback, useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import * as Localization from 'expo-localization';
import { useAuthStore } from '../store/authStore';
import { useSettings } from './queries/useSettings';

/**
 * 시간대 설정 Hook
 * 앱 실행 및 포그라운드 진입 시 시간대 자동 감지 및 업데이트
 */
export const useTimeZone = ({ autoDetect = false } = {}) => {
  const { user } = useAuthStore();
  const { data: settings = {} } = useSettings();
  const updateSettings = useAuthStore(state => state.updateSettings);
  const autoUpdateRef = useRef(null);
  const queryClient = useQueryClient();

  const updateTimeZoneMutation = useMutation({
    mutationFn: async ({ timeZone }) => {
      const updatedUser = await updateSettings('timeZone', timeZone);
      return updatedUser ? { timeZone: updatedUser.settings.timeZone } : null;
    },
    onSuccess: (data, variables) => {
      // authStore publishes only after local persistence succeeds.
      if (!data) return;

      // 할일 목록 새로고침 (시간대 변경으로 인한 표시 변경)
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['calendar-summary'] });

      if (!variables.silent) {
        Toast.show({
          type: 'success',
          text1: '시간대 자동 업데이트',
          text2: `${getTimeZoneDisplayName(data.timeZone)}로 설정되었습니다`,
        });
      }
    },
    onError: (error) => {
      console.error('TimeZone update error:', error);
      Toast.show({ type: 'error', text1: '시간대를 저장하지 못했습니다' });
    },
  });

  const { mutateAsync } = updateTimeZoneMutation;
  const updateTimeZone = useCallback((timeZone, options = {}) =>
    mutateAsync({ timeZone, silent: options.silent ?? false }), [mutateAsync]);

  // 자동 감지 로직
  useEffect(() => {
    // Only the root observer owns startup/foreground detection. Picker screens
    // use this hook for writes without registering competing auto-detect loops.
    if (!autoDetect || !user) return;

    const checkTimeZone = () => {
      // 자동 설정이 꺼져있으면 감지 중단
      const currentUser = useAuthStore.getState().user;
      if (!currentUser || autoUpdateRef.current) return;
      const isAuto = currentUser.settings?.timeZoneAuto ?? true;
      if (!isAuto) return;

      const deviceTimeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';
      const userTimeZone = currentUser.settings?.timeZone || 'Asia/Seoul';

      // 다르면 업데이트 시도
      if (deviceTimeZone && userTimeZone && deviceTimeZone !== userTimeZone) {
        console.log(`🌍 TimeZone mismatch detected (Auto: ON). Device: ${deviceTimeZone}, User: ${userTimeZone}`);
        autoUpdateRef.current = updateTimeZone(deviceTimeZone)
          .catch(() => {}) // onError reports local failure; no automatic retry loop
          .finally(() => { autoUpdateRef.current = null; });
      }
    };

    // 1. 처음 마운트 될 때 체크
    checkTimeZone();

    // 2. 앱이 포그라운드로 올 때마다 체크
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        checkTimeZone();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [autoDetect, user, settings.timeZone, settings.timeZoneAuto, updateTimeZone]);

  return {
    updateTimeZone,
    isLoading: updateTimeZoneMutation.isPending,
  };
};

/**
 * 시간대 표시명 가져오기
 * @param {string} timeZone - IANA 시간대 문자열
 * @returns {string} 사용자 친화적 표시명
 */
export const getTimeZoneDisplayName = (timeZone) => {
  const timeZoneNames = {
    'Asia/Seoul': '🇰🇷 한국 (서울)',
    'Asia/Tokyo': '🇯🇵 일본 (도쿄)',
    'Asia/Shanghai': '🇨🇳 중국 (상하이)',
    'Asia/Hong_Kong': '🇭🇰 홍콩',
    'Asia/Singapore': '🇸🇬 싱가포르',
    'Asia/Bangkok': '🇹🇭 태국 (방콕)',
    'Asia/Jakarta': '🇮🇩 인도네시아 (자카르타)',
    'Asia/Manila': '🇵🇭 필리핀 (마닐라)',
    'Asia/Kuala_Lumpur': '🇲🇾 말레이시아 (쿠알라룸푸르)',
    'Asia/Ho_Chi_Minh': '🇻🇳 베트남 (호치민)',
    'Australia/Sydney': '🇦🇺 호주 (시드니)',
    'Pacific/Auckland': '🇳🇿 뉴질랜드 (오클랜드)',
    'America/New_York': '🇺🇸 미국 동부 (뉴욕)',
    'America/Chicago': '🇺🇸 미국 중부 (시카고)',
    'America/Denver': '🇺🇸 미국 산악 (덴버)',
    'America/Los_Angeles': '🇺🇸 미국 서부 (로스앤젤레스)',
    'Europe/London': '🇬🇧 영국 (런던)',
    'Europe/Paris': '🇫🇷 프랑스 (파리)',
    'Europe/Berlin': '🇩🇪 독일 (베를린)',
    'Europe/Rome': '🇮🇹 이탈리아 (로마)',
    'Europe/Madrid': '🇪🇸 스페인 (마드리드)',
    'Europe/Moscow': '🇷🇺 러시아 (모스크바)',
    'Africa/Cairo': '🇪🇬 이집트 (카이로)',
    'UTC': '🌍 UTC (협정세계시)',
  };

  return timeZoneNames[timeZone] || timeZone;
};

/**
 * 주요 시간대 목록
 */
export const COMMON_TIMEZONES = [
  'Asia/Seoul',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Hong_Kong',
  'Asia/Singapore',
  'Asia/Bangkok',
  'Asia/Jakarta',
  'Asia/Manila',
  'Asia/Kuala_Lumpur',
  'Asia/Ho_Chi_Minh',
  'Australia/Sydney',
  'Pacific/Auckland',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Rome',
  'Europe/Madrid',
  'Europe/Moscow',
  'Africa/Cairo',
  'UTC',
];
