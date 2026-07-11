import { create } from 'zustand';

export const useAppChromeStore = create((set) => ({
  isBottomTabBarHidden: false,
  setBottomTabBarHidden: (isHidden) =>
    set({ isBottomTabBarHidden: Boolean(isHidden) }),
}));
