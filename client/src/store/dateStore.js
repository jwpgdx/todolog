import { create } from 'zustand';
import { getCurrentDateInTimeZone } from '../utils/timeZoneDate';

// 사용자(또는 시스템) 시간대 기준으로 YYYY-MM-DD 형식 반환
const getDateString = (timeZone) => getCurrentDateInTimeZone(timeZone);

export const useDateStore = create((set) => ({
  currentDate: getDateString(),
  
  setCurrentDate: (date) => set({ currentDate: date }),

  setCurrentDateByTimeZone: (timeZone) => set({
    currentDate: getDateString(timeZone),
  }),
  
  resetToToday: (timeZone) => set({
    currentDate: getDateString(timeZone),
  }),
}));
