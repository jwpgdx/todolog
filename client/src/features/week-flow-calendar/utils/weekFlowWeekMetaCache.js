import dayjs from 'dayjs';

import { WEEKDAY_COUNT } from './weekFlowConstants';
import { formatShortMonthLabel, resolveCalendarLanguage } from './weekFlowLocaleUtils';

// LRU cache: weekStart(YYYY-MM-DD) + language -> 7-day static metadata.
// Keep this bounded to avoid unbounded memory growth with infinite scroll.
const MAX_WEEKS = 320; // bounded for perf/memory (approx 6 years of weeks)
const cache = new Map(); // key -> days[]

function lruGet(key) {
  const value = cache.get(key);
  if (!value) return null;
  // Refresh insertion order for LRU semantics.
  cache.delete(key);
  cache.set(key, value);
  return value;
}

function lruSet(key, value) {
  cache.set(key, value);
  while (cache.size > MAX_WEEKS) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey == null) break;
    cache.delete(oldestKey);
  }
}

function buildWeekMeta(weekStartYmd, resolvedLanguage) {
  const base = dayjs(weekStartYmd);
  if (!base.isValid()) return [];

  const days = new Array(WEEKDAY_COUNT);
  let previousMonth0 = null;

  for (let i = 0; i < WEEKDAY_COUNT; i += 1) {
    const d = base.add(i, 'day');
    const month0 = d.month(); // 0..11
    const month1 = month0 + 1;
    const dayNumber = d.date();

    let monthLabel = null;
    if (dayNumber === 1 || (previousMonth0 !== null && previousMonth0 !== month0)) {
      monthLabel = formatShortMonthLabel(month1, resolvedLanguage);
    }

    days[i] = {
      date: d.format('YYYY-MM-DD'),
      dayNumber,
      month0,
      monthLabel,
      isEvenMonth: month1 % 2 === 0,
    };

    previousMonth0 = month0;
  }

  return days;
}

export function getWeekMeta(weekStartYmd, language) {
  if (!weekStartYmd) return [];
  const resolvedLanguage = resolveCalendarLanguage(language);
  const key = `${resolvedLanguage}|${weekStartYmd}`;

  const cached = lruGet(key);
  if (cached) return cached;

  const built = buildWeekMeta(weekStartYmd, resolvedLanguage);
  lruSet(key, built);
  return built;
}
