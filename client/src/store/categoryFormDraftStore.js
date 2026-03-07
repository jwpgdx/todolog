import { create } from 'zustand';

import { DEFAULT_COLOR } from '../constants/categoryColors';

export const useCategoryFormDraftStore = create((set) => ({
  selectedColor: DEFAULT_COLOR,
  setSelectedColor: (color) => set({ selectedColor: color }),
  reset: () => set({ selectedColor: DEFAULT_COLOR }),
}));

