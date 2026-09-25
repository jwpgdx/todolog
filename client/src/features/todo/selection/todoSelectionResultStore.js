import { create } from 'zustand';

export const useTodoSelectionResultStore = create((set) => ({
  resultsBySessionId: {},
  publishResult: (result) => {
    if (!result?.sessionId) {
      return;
    }

    set((state) => ({
      resultsBySessionId: {
        ...state.resultsBySessionId,
        [result.sessionId]: { ...result },
      },
    }));
  },
  clearResult: (sessionId) => {
    if (!sessionId) {
      return;
    }

    set((state) => {
      if (!state.resultsBySessionId[sessionId]) {
        return state;
      }

      const nextResults = { ...state.resultsBySessionId };
      delete nextResults[sessionId];
      return { resultsBySessionId: nextResults };
    });
  },
}));
