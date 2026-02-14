import { useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import { useSettings } from './queries/useSettings';
import { getCurrentDateInTimeZone } from '../utils/timeZoneDate';

/**
 * 사용자 설정 시간대 기준 "오늘" 날짜(YYYY-MM-DD) 공통 훅
 * - timeZone 변경 시 즉시 재계산
 * - 앱 포그라운드 복귀 시 재계산 (자정 경과 대응)
 */
export function useTodayDate() {
  const { data: settings = {} } = useSettings();
  const timeZone = settings.timeZone || 'Asia/Seoul';

  const computeTodayDate = useCallback(
    () => getCurrentDateInTimeZone(timeZone),
    [timeZone]
  );

  const [todayDate, setTodayDate] = useState(() => computeTodayDate());

  useEffect(() => {
    setTodayDate(computeTodayDate());
  }, [computeTodayDate]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        setTodayDate(computeTodayDate());
      }
    });

    return () => {
      subscription.remove();
    };
  }, [computeTodayDate]);

  return {
    todayDate,
    timeZone,
  };
}

