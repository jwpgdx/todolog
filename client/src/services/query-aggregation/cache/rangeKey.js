import dayjs from 'dayjs';

function normalizeDateValue(dateValue) {
  if (!dateValue || typeof dateValue !== 'string') return null;
  const parsed = dayjs(dateValue);
  if (!parsed.isValid()) return null;
  return parsed.format('YYYY-MM-DD');
}

export function normalizeRange(startDate, endDate) {
  const normalizedStart = normalizeDateValue(startDate);
  const normalizedEnd = normalizeDateValue(endDate);

  if (!normalizedStart || !normalizedEnd) return null;
  if (normalizedStart > normalizedEnd) return null;

  return {
    startDate: normalizedStart,
    endDate: normalizedEnd,
  };
}

export function toRangeKey(range) {
  if (!range?.startDate || !range?.endDate) return null;
  return `${range.startDate}::${range.endDate}`;
}

export function addDaysToDate(dateValue, amount) {
  return dayjs(dateValue).add(amount, 'day').format('YYYY-MM-DD');
}

export function rangeCovers(outerRange, innerRange) {
  return (
    outerRange.startDate <= innerRange.startDate &&
    outerRange.endDate >= innerRange.endDate
  );
}

export function rangesOverlap(leftRange, rightRange) {
  return !(
    leftRange.endDate < rightRange.startDate ||
    leftRange.startDate > rightRange.endDate
  );
}

export function rangesAdjacentOrOverlap(leftRange, rightRange) {
  return rightRange.startDate <= addDaysToDate(leftRange.endDate, 1);
}

export function sortRangesByStart(leftRange, rightRange) {
  if (leftRange.startDate === rightRange.startDate) {
    return leftRange.endDate.localeCompare(rightRange.endDate);
  }
  return leftRange.startDate.localeCompare(rightRange.startDate);
}
