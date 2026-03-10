import dayjs from 'dayjs';

export function normalizeStartDayOfWeek(startDayOfWeek) {
  return startDayOfWeek === 'monday' ? 'monday' : 'sunday';
}

export function toWeekStart(dateYmd, startDayOfWeek) {
  const normalized = normalizeStartDayOfWeek(startDayOfWeek);
  const d = dayjs(dateYmd);
  if (!d.isValid()) return null;

  const day = d.day(); // 0 (Sun) .. 6 (Sat)
  if (normalized === 'monday') {
    const subtract = day === 0 ? 6 : day - 1;
    return d.subtract(subtract, 'day').format('YYYY-MM-DD');
  }

  return d.subtract(day, 'day').format('YYYY-MM-DD');
}

export function toMonthStart(dateYmd) {
  const d = dayjs(dateYmd);
  if (!d.isValid()) return null;
  return d.startOf('month').format('YYYY-MM-DD');
}

export function addDays(ymd, amount) {
  const d = dayjs(ymd);
  if (!d.isValid()) return null;
  return d.add(amount, 'day').format('YYYY-MM-DD');
}

export function addWeeks(ymd, amount) {
  return addDays(ymd, amount * 7);
}

export function addMonths(monthStartYmd, amount) {
  const d = dayjs(monthStartYmd);
  if (!d.isValid()) return null;
  return d.add(amount, 'month').startOf('month').format('YYYY-MM-DD');
}

export function getWeekdayIndex(dateYmd, startDayOfWeek) {
  const d = dayjs(dateYmd);
  if (!d.isValid()) return 0;

  const day = d.day(); // 0..6 (Sun..Sat)
  if (normalizeStartDayOfWeek(startDayOfWeek) === 'monday') {
    return day === 0 ? 6 : day - 1; // Mon=0..Sun=6
  }

  return day; // Sun=0..Sat=6
}

