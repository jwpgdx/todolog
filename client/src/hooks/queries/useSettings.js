import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

/**
 * 기본 설정 반환
 */
const getDefaultSettings = () => ({
  theme: 'system',
  language: 'system',
  startDayOfWeek: 'sunday',
  showCompleted: true,
  calendarSyncEnabled: false,
  timeZone: 'Asia/Seoul',
  timeZoneAuto: true,
  defaultIsAllDay: true,
  notification: {
    enabled: false,
    time: '09:00',
  },
});

/**
 * 설정 조회 (authStore 기반)
 * @returns {Object} { data: UserSettings, isLoading, isError }
 */
export const useSettings = () => {
  const user = useAuthStore(state => state.user);
  
  return {
    data: user?.settings || getDefaultSettings(),
    isLoading: false,
    isError: false,
  };
};

/**
 * 설정 업데이트 (authStore 위임)
 * @returns {Object} { mutate, mutateAsync, isPending }
 */
export const useUpdateSetting = () => {
  const updateSettings = useAuthStore(state => state.updateSettings);
  const [isPending, setIsPending] = useState(false);
  
  return {
    mutate: ({ key, value }) => {
      setIsPending(true);
      updateSettings(key, value).finally(() => setIsPending(false));
    },
    mutateAsync: async ({ key, value }) => {
      setIsPending(true);
      try {
        await updateSettings(key, value);
      } finally {
        setIsPending(false);
      }
    },
    isPending,
  };
};
