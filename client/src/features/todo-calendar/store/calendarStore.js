import { create } from 'zustand';
import dayjs from 'dayjs';
import {
  createMonthMetadataFromDayjs,
  generateFutureMonths,
  generatePastMonths,
} from '../utils/calendarHelpers';

const MEMORY_LIMIT = 100;
const RETENTION_COUNT = 50;

/**
 * Zustand Store for Infinite Scroll Calendar
 * 
 * State:
 * - months: Array<MonthMetadata> - Primitive state only (no Date/Day.js objects)
 * 
 * Actions:
 * - initializeMonths(): Initialize with current month ±2 months (total 5 months)
 * - addFutureMonths(count): Append N future months
 * - addPastMonths(count): Prepend N past months
 * - trimMonths(): Enforce memory limit (keep recent 50 months if > 100)
 */
export const useCalendarStore = create((set, get) => ({
  months: [],

  /**
   * Initialize months array with current month ±2 months (total 5 months)
   * Validates: Requirements 1.1
   */
  initializeMonths: () => {
    const now = dayjs();
    const months = [];

    // Generate current month ±2 months
    for (let offset = -2; offset <= 2; offset++) {
      const targetMonth = now.add(offset, 'month');
      months.push(createMonthMetadataFromDayjs(targetMonth));
    }

    set({ months });
    console.log('[CalendarStore] Initialized with 5 months:', months.map(m => m.id));
  },

  /**
   * Append N future months to the end of months array
   * Validates: Requirements 1.2
   * 
   * @param {number} count - Number of months to add
   */
  addFutureMonths: (count) => {
    const { months } = get();
    
    if (months.length === 0) {
      console.warn('[CalendarStore] Cannot add future months: months array is empty');
      return;
    }

    const lastMonth = months[months.length - 1];
    const newMonths = generateFutureMonths(lastMonth, count);

    set((state) => {
      const updated = [...state.months, ...newMonths];
      
      // Enforce memory limit
      if (updated.length > MEMORY_LIMIT) {
        console.warn(`[CalendarStore] Memory limit exceeded (${updated.length} months), trimming to ${RETENTION_COUNT} months`);
        return { months: updated.slice(-RETENTION_COUNT) };
      }

      return { months: updated };
    });

    console.log(`[CalendarStore] Added ${count} future months, total: ${get().months.length}`);
  },

  /**
   * Prepend N past months to the beginning of months array
   * Validates: Requirements 1.3
   * 
   * @param {number} count - Number of months to add
   */
  addPastMonths: (count) => {
    const { months } = get();
    
    if (months.length === 0) {
      console.warn('[CalendarStore] Cannot add past months: months array is empty');
      return;
    }

    const firstMonth = months[0];
    const newMonths = generatePastMonths(firstMonth, count);

    set((state) => {
      const updated = [...newMonths, ...state.months];
      
      // Enforce memory limit
      if (updated.length > MEMORY_LIMIT) {
        console.warn(`[CalendarStore] Memory limit exceeded (${updated.length} months), trimming to ${RETENTION_COUNT} months`);
        return { months: updated.slice(-RETENTION_COUNT) };
      }

      return { months: updated };
    });

    console.log(`[CalendarStore] Added ${count} past months, total: ${get().months.length}`);
  },

  /**
   * Trim months array to RETENTION_COUNT if exceeds MEMORY_LIMIT
   * Validates: Requirements 1.5, 2.1, 2.2
   * 
   * Note: This is automatically called in addFutureMonths/addPastMonths,
   * but can be called manually if needed.
   */
  trimMonths: () => {
    const { months } = get();

    if (months.length > MEMORY_LIMIT) {
      console.warn(`[CalendarStore] Trimming ${months.length} months to ${RETENTION_COUNT} months`);
      set({ months: months.slice(-RETENTION_COUNT) });
    }
  },

  /**
   * Debug helper: Get serialized state size
   * Validates: Requirements 2.3
   */
  getStateSize: () => {
    const { months } = get();
    const serialized = JSON.stringify(months);
    const sizeKB = (serialized.length / 1024).toFixed(2);
    console.log(`[CalendarStore] State size: ${months.length} months = ${sizeKB} KB`);
    return sizeKB;
  },
}));
