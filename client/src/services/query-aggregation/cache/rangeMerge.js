import {
  addDaysToDate,
  rangesAdjacentOrOverlap,
  rangesOverlap,
  sortRangesByStart,
} from './rangeKey';

export function mergeRanges(ranges = []) {
  if (!Array.isArray(ranges) || ranges.length === 0) return [];

  const sorted = [...ranges]
    .filter((range) => range?.startDate && range?.endDate)
    .sort(sortRangesByStart)
    .map((range) => ({ ...range }));

  if (sorted.length === 0) return [];

  const merged = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (rangesAdjacentOrOverlap(last, current)) {
      if (current.endDate > last.endDate) {
        last.endDate = current.endDate;
      }
    } else {
      merged.push(current);
    }
  }

  return merged;
}

export function computeUncoveredRanges(targetRange, coveredRanges = []) {
  const normalizedCovered = mergeRanges(coveredRanges);
  if (normalizedCovered.length === 0) {
    return [targetRange];
  }

  const uncoveredRanges = [];
  let cursor = targetRange.startDate;

  for (const covered of normalizedCovered) {
    if (covered.endDate < cursor) continue;
    if (covered.startDate > targetRange.endDate) break;

    if (covered.startDate > cursor) {
      uncoveredRanges.push({
        startDate: cursor,
        endDate: addDaysToDate(covered.startDate, -1),
      });
    }

    const nextCursor = addDaysToDate(covered.endDate, 1);
    if (nextCursor > cursor) {
      cursor = nextCursor;
    }

    if (cursor > targetRange.endDate) break;
  }

  if (cursor <= targetRange.endDate) {
    uncoveredRanges.push({
      startDate: cursor,
      endDate: targetRange.endDate,
    });
  }

  return uncoveredRanges;
}

export function sliceItemsByRange(itemsByDate = {}, startDate, endDate) {
  const sliced = {};
  const entries = Object.entries(itemsByDate || {});

  for (const [dateKey, items] of entries) {
    if (dateKey < startDate || dateKey > endDate) continue;
    sliced[dateKey] = items;
  }

  return sliced;
}

export function splitRangeByInvalidation(sourceRange, invalidationRange) {
  if (!rangesOverlap(sourceRange, invalidationRange)) {
    return [sourceRange];
  }

  const nextRanges = [];

  if (sourceRange.startDate < invalidationRange.startDate) {
    const leftEnd = addDaysToDate(invalidationRange.startDate, -1);
    if (sourceRange.startDate <= leftEnd) {
      nextRanges.push({
        startDate: sourceRange.startDate,
        endDate: leftEnd,
      });
    }
  }

  if (sourceRange.endDate > invalidationRange.endDate) {
    const rightStart = addDaysToDate(invalidationRange.endDate, 1);
    if (rightStart <= sourceRange.endDate) {
      nextRanges.push({
        startDate: rightStart,
        endDate: sourceRange.endDate,
      });
    }
  }

  return nextRanges;
}

function mergeEntryPair(leftEntry, rightEntry) {
  const leftLoadedAt = leftEntry.lastLoadedAt || 0;
  const rightLoadedAt = rightEntry.lastLoadedAt || 0;
  const preferRight = rightLoadedAt >= leftLoadedAt;

  const primary = preferRight ? rightEntry : leftEntry;
  const secondary = preferRight ? leftEntry : rightEntry;
  const mergedItemsByDate = {
    ...(secondary.itemsByDate || {}),
    ...(primary.itemsByDate || {}),
  };

  return {
    ...secondary,
    ...primary,
    startDate: leftEntry.startDate < rightEntry.startDate ? leftEntry.startDate : rightEntry.startDate,
    endDate: leftEntry.endDate > rightEntry.endDate ? leftEntry.endDate : rightEntry.endDate,
    itemsByDate: mergedItemsByDate,
    lastLoadedAt: Math.max(leftLoadedAt, rightLoadedAt),
  };
}

export function mergeRangeEntries(entries = []) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const sorted = [...entries]
    .filter((entry) => entry?.startDate && entry?.endDate)
    .sort((left, right) => sortRangesByStart(left, right))
    .map((entry) => ({ ...entry }));

  if (sorted.length === 0) return [];

  const merged = [sorted[0]];
  for (let index = 1; index < sorted.length; index += 1) {
    const current = sorted[index];
    const last = merged[merged.length - 1];

    if (rangesAdjacentOrOverlap(last, current)) {
      merged[merged.length - 1] = mergeEntryPair(last, current);
    } else {
      merged.push(current);
    }
  }

  return merged;
}
