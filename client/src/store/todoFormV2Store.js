import { create } from 'zustand';

/**
 * Detail Mode V2 handoff store
 *
 * Quick -> Detail V2 전환 시 현재 draft를 잠깐 보관하는 용도입니다.
 * 화면 제어는 router가 담당하고, 이 store는 payload 전달만 담당합니다.
 */
export const useTodoFormV2Store = create((set) => ({
  draft: null,

  setDraft: (draft) => {
    if (!draft) {
      set({ draft: null });
      return;
    }

    set({
      draft: {
        ...draft,
        formState: draft.formState ? { ...draft.formState } : null,
      },
    });
  },

  clearDraft: () => {
    set({ draft: null });
  },
}));
