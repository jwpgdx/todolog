import { create } from 'zustand';

// 로컬 시간대 기준으로 YYYY-MM-DD 형식 반환
const getLocalDateString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useDateStore = create((set) => ({
  currentDate: getLocalDateString(),
  
  setCurrentDate: (date) => set({ currentDate: date }),
  
  resetToToday: () => set({ 
    currentDate: getLocalDateString()
  }),
}));
