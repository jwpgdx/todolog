import { create } from 'zustand';
import dayjs from 'dayjs';

import {
  createMonthMetadataFromDayjs,
  generateFutureMonths,
  generatePastMonths,
} from '../../../utils/calendarMonthHelpers';

const INITIAL_MONTH_WINDOW = 2;

export const useTodoCalendarV2Store = create((set, get) => ({
  months: [],
  monthLayoutsById: {},
  visibleContext: null,
  reensureSeq: 0,

  initializeMonths: () => {
    const now = dayjs();
    const months = [];

    for (let offset = -INITIAL_MONTH_WINDOW; offset <= INITIAL_MONTH_WINDOW; offset += 1) {
      months.push(createMonthMetadataFromDayjs(now.add(offset, 'month')));
    }

    set({ months });
  },

  addFutureMonths: (count) => {
    const months = get().months || [];
    if (months.length === 0) return;

    const next = generateFutureMonths(months[months.length - 1], count);
    set((state) => ({
      months: [...state.months, ...next],
    }));
  },

  addPastMonths: (count) => {
    const months = get().months || [];
    if (months.length === 0) return;

    const next = generatePastMonths(months[0], count);
    set((state) => ({
      months: [...next, ...state.months],
    }));
  },

  setMonthLayouts: (layouts = {}) => {
    if (!layouts || Object.keys(layouts).length === 0) return;

    set((state) => ({
      monthLayoutsById: {
        ...(state.monthLayoutsById || {}),
        ...layouts,
      },
    }));
  },

  setVisibleContext: (context = null) => {
    set({ visibleContext: context || null });
  },

  clearMonthLayouts: () => {
    set({ monthLayoutsById: {} });
  },

  invalidateMonthLayouts: (monthIds = []) => {
    const ids = Array.isArray(monthIds)
      ? [...new Set(monthIds.filter(Boolean))]
      : [];

    if (ids.length === 0) return;

    set((state) => {
      const current = state.monthLayoutsById || {};
      let changed = false;
      const next = { ...current };

      ids.forEach((monthId) => {
        if (next[monthId] == null) return;
        delete next[monthId];
        changed = true;
      });

      return changed ? { monthLayoutsById: next } : state;
    });
  },

  pruneMonthLayouts: (startMonthId, endMonthId) => {
    if (!startMonthId || !endMonthId || startMonthId > endMonthId) return;

    set((state) => {
      const current = state.monthLayoutsById || {};
      const next = {};

      for (const [monthId, layout] of Object.entries(current)) {
        if (monthId < startMonthId || monthId > endMonthId) continue;
        next[monthId] = layout;
      }

      if (Object.keys(current).length === Object.keys(next).length) {
        return state;
      }

      return { monthLayoutsById: next };
    });
  },

  hasMonthLayout: (monthId) => get().monthLayoutsById?.[monthId] != null,
  getMonthLayout: (monthId) => get().monthLayoutsById?.[monthId] || null,
  requestIdleReensure: () =>
    set((state) => ({ reensureSeq: Number(state.reensureSeq || 0) + 1 })),
}));
