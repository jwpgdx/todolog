import { create } from 'zustand';

export const useAppChromeStore = create((set) => ({
  isBottomTabBarHidden: false,
  legacyBottomTabBarHidden: false,
  bottomTabBarHiddenOwners: {},
  setBottomTabBarHidden: (isHidden) =>
    set((state) => {
      const legacyBottomTabBarHidden = Boolean(isHidden);
      return {
        legacyBottomTabBarHidden,
        isBottomTabBarHidden:
          legacyBottomTabBarHidden ||
          Object.keys(state.bottomTabBarHiddenOwners).length > 0,
      };
    }),
  setBottomTabBarHiddenForOwner: (ownerId, isHidden) => {
    if (!ownerId) {
      return;
    }

    set((state) => {
      const nextOwners = { ...state.bottomTabBarHiddenOwners };
      if (isHidden) {
        nextOwners[ownerId] = true;
      } else {
        delete nextOwners[ownerId];
      }

      return {
        bottomTabBarHiddenOwners: nextOwners,
        isBottomTabBarHidden:
          state.legacyBottomTabBarHidden || Object.keys(nextOwners).length > 0,
      };
    });
  },
}));
