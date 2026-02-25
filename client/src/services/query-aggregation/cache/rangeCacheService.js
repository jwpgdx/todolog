import { runCommonQueryForRange } from '../index';
import {
  normalizeRange,
  rangeCovers,
  rangesOverlap,
  toRangeKey,
} from './rangeKey';
import {
  computeUncoveredRanges,
  mergeRangeEntries,
  mergeRanges,
  sliceItemsByRange,
  splitRangeByInvalidation,
} from './rangeMerge';

const DEFAULT_MAX_ENTRIES = 12;
const DEFAULT_META = { isStale: false, staleReason: null, lastSyncTime: null };
const DEFAULT_STAGE = { candidate: 0, decided: 0, aggregated: 0 };
const DEFAULT_ELAPSED = { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 };
const DEFAULT_DIAGNOSTICS = { completionCandidates: 0, invalidRecurrenceCount: 0 };

const cacheState = {
  entries: [],
  inFlight: new Map(),
  stats: {
    hit: 0,
    miss: 0,
    inFlightDeduped: 0,
    loads: 0,
    invalidateAll: 0,
    invalidateRange: 0,
  },
  maxEntries: DEFAULT_MAX_ENTRIES,
};

function getLoadedRanges() {
  return cacheState.entries.map((entry) => ({
    startDate: entry.startDate,
    endDate: entry.endDate,
    sourceTag: entry.sourceTag || 'unknown',
    lastLoadedAt: entry.lastLoadedAt || 0,
  }));
}

function trimOverflowEntries() {
  if (cacheState.entries.length <= cacheState.maxEntries) return;

  const trimmed = [...cacheState.entries]
    .sort((left, right) => (right.lastLoadedAt || 0) - (left.lastLoadedAt || 0))
    .slice(0, cacheState.maxEntries)
    .sort((left, right) => left.startDate.localeCompare(right.startDate));

  cacheState.entries = trimmed;
}

function upsertEntry(entry) {
  cacheState.entries = mergeRangeEntries([...cacheState.entries, entry]);
  trimOverflowEntries();
}

function collectEntriesForRange(range) {
  return cacheState.entries.filter((entry) => rangesOverlap(entry, range));
}

function buildCacheResult(range, cacheInfo = {}) {
  const overlappedEntries = collectEntriesForRange(range);
  const sortedByLoad = [...overlappedEntries].sort(
    (left, right) => (left.lastLoadedAt || 0) - (right.lastLoadedAt || 0)
  );

  let itemsByDate = {};
  for (const entry of sortedByLoad) {
    itemsByDate = {
      ...itemsByDate,
      ...sliceItemsByRange(entry.itemsByDate, range.startDate, range.endDate),
    };
  }

  const latestEntry = [...overlappedEntries].sort(
    (left, right) => (right.lastLoadedAt || 0) - (left.lastLoadedAt || 0)
  )[0];

  return {
    ok: true,
    mode: 'range',
    range,
    itemsByDate,
    meta: latestEntry?.meta || DEFAULT_META,
    stage: latestEntry?.stage || DEFAULT_STAGE,
    elapsed: latestEntry?.elapsed || DEFAULT_ELAPSED,
    diagnostics: latestEntry?.diagnostics || DEFAULT_DIAGNOSTICS,
    cacheInfo: {
      hit: true,
      sourceTag: cacheInfo.sourceTag || latestEntry?.sourceTag || 'unknown',
      inFlightDeduped: Boolean(cacheInfo.inFlightDeduped),
      loadedRanges: getLoadedRanges(),
      uncoveredRanges: [],
    },
    error: null,
  };
}

function buildFailureResult(range, message) {
  return {
    ok: false,
    mode: 'range',
    range: range || null,
    itemsByDate: {},
    meta: DEFAULT_META,
    stage: DEFAULT_STAGE,
    elapsed: DEFAULT_ELAPSED,
    diagnostics: DEFAULT_DIAGNOSTICS,
    cacheInfo: {
      hit: false,
      sourceTag: 'unknown',
      inFlightDeduped: false,
      loadedRanges: getLoadedRanges(),
      uncoveredRanges: [],
    },
    error: message,
  };
}

function findCoveringInFlight(range) {
  for (const flight of cacheState.inFlight.values()) {
    if (rangeCovers(flight, range)) {
      return flight;
    }
  }
  return null;
}

function hasCoverage(range) {
  const merged = mergeRanges(getLoadedRanges());
  return merged.some((loadedRange) => rangeCovers(loadedRange, range));
}

async function loadRange(range, sourceTag, syncStatus, traceId = null) {
  const key = toRangeKey(range);
  if (!key) {
    throw new Error('Invalid range key');
  }
  const tracePrefix = traceId ? `[range-cache:trace] trace=${traceId} ` : null;

  const existing = cacheState.inFlight.get(key);
  if (existing) {
    if (tracePrefix) {
      console.log(
        `${tracePrefix}loadRange dedupe-hit key=${key} ` +
        `range=${range.startDate}~${range.endDate} t=${formatMs(performance.now())}ms`
      );
    }
    return existing.promise;
  }

  const promise = (async () => {
    const startedAt = tracePrefix ? performance.now() : 0;
    const handoff = await runCommonQueryForRange({
      startDate: range.startDate,
      endDate: range.endDate,
      syncStatus,
      traceId,
    });
    if (tracePrefix) {
      console.log(
        `${tracePrefix}loadRange common-layer done range=${range.startDate}~${range.endDate} ` +
        `elapsed=${formatMs(performance.now() - startedAt)}ms t=${formatMs(performance.now())}ms`
      );
    }

    if (!handoff.ok) {
      throw new Error(handoff.error || `common-layer failed: ${range.startDate}~${range.endDate}`);
    }

    upsertEntry({
      startDate: range.startDate,
      endDate: range.endDate,
      itemsByDate: handoff.itemsByDate || {},
      meta: handoff.meta || DEFAULT_META,
      stage: handoff.stage || DEFAULT_STAGE,
      elapsed: handoff.elapsed || DEFAULT_ELAPSED,
      diagnostics: handoff.diagnostics || DEFAULT_DIAGNOSTICS,
      sourceTag: sourceTag || 'unknown',
      lastLoadedAt: Date.now(),
    });

    cacheState.stats.loads += 1;
    return handoff;
  })().finally(() => {
    cacheState.inFlight.delete(key);
  });

  cacheState.inFlight.set(key, {
    startDate: range.startDate,
    endDate: range.endDate,
    sourceTag: sourceTag || 'unknown',
    startedAt: Date.now(),
    promise,
  });

  return promise;
}

function formatMs(value) {
  return Number((value || 0).toFixed(2));
}

export function covers({ startDate, endDate } = {}) {
  const range = normalizeRange(startDate, endDate);
  if (!range) return false;
  return hasCoverage(range);
}

export function peekRange({ startDate, endDate } = {}) {
  const range = normalizeRange(startDate, endDate);
  if (!range) return null;
  if (!hasCoverage(range)) return null;
  return buildCacheResult(range);
}

export async function getOrLoadRange({
  startDate,
  endDate,
  sourceTag = 'unknown',
  forceRefresh = false,
  syncStatus,
  traceId,
} = {}) {
  const range = normalizeRange(startDate, endDate);
  if (!range) {
    return buildFailureResult(null, `Invalid range: ${startDate} ~ ${endDate}`);
  }

  const tracePrefix = traceId ? `[range-cache:trace] trace=${traceId} ` : null;
  const totalStart = tracePrefix ? performance.now() : 0;
  if (tracePrefix) {
    console.log(
      `${tracePrefix}start range=${range.startDate}~${range.endDate} ` +
      `forceRefresh=${forceRefresh ? 'Y' : 'N'} entries=${cacheState.entries.length} ` +
      `inFlight=${cacheState.inFlight.size} t=${formatMs(totalStart)}ms`
    );
  }

  try {
    if (!forceRefresh) {
      const hitCheckStart = tracePrefix ? performance.now() : 0;
      const cached = peekRange(range);
      if (cached) {
        cacheState.stats.hit += 1;
        if (tracePrefix) {
          console.log(
            `${tracePrefix}cache-hit ms=${formatMs(performance.now() - hitCheckStart)} ` +
            `totalMs=${formatMs(performance.now() - totalStart)} t=${formatMs(performance.now())}ms`
          );
        }
        return {
          ...cached,
          cacheInfo: {
            ...cached.cacheInfo,
            sourceTag,
          },
        };
      }
    }

    if (!forceRefresh) {
      const coveringInFlight = findCoveringInFlight(range);
      if (coveringInFlight) {
        cacheState.stats.inFlightDeduped += 1;
        const dedupeWaitStart = tracePrefix ? performance.now() : 0;
        await coveringInFlight.promise;
        const dedupeWaitMs = tracePrefix ? formatMs(performance.now() - dedupeWaitStart) : 0;

        const deduped = peekRange(range);
        if (deduped) {
          cacheState.stats.hit += 1;
          if (tracePrefix) {
            console.log(
              `${tracePrefix}inflight-deduped waitMs=${dedupeWaitMs} ` +
              `totalMs=${formatMs(performance.now() - totalStart)} t=${formatMs(performance.now())}ms`
            );
          }
          return {
            ...deduped,
            cacheInfo: {
              ...deduped.cacheInfo,
              sourceTag,
              inFlightDeduped: true,
            },
          };
        }
      }
    }

    const uncoveredComputeStart = tracePrefix ? performance.now() : 0;
    const uncoveredRanges = forceRefresh
      ? [range]
      : computeUncoveredRanges(range, getLoadedRanges());
    const uncoveredComputeMs = tracePrefix ? formatMs(performance.now() - uncoveredComputeStart) : 0;
    if (tracePrefix) {
      console.log(
        `${tracePrefix}uncovered-count=${uncoveredRanges.length} ` +
        `computeMs=${uncoveredComputeMs} t=${formatMs(performance.now())}ms`
      );
    }

    if (uncoveredRanges.length === 0) {
      const cached = peekRange(range);
      if (cached) {
        cacheState.stats.hit += 1;
        if (tracePrefix) {
          console.log(
            `${tracePrefix}assembled-from-coverage totalMs=${formatMs(performance.now() - totalStart)} ` +
            `t=${formatMs(performance.now())}ms`
          );
        }
        return {
          ...cached,
          cacheInfo: {
            ...cached.cacheInfo,
            sourceTag,
          },
        };
      }
    }

    cacheState.stats.miss += 1;
    const loadWaitStart = tracePrefix ? performance.now() : 0;
    await Promise.all(
      uncoveredRanges.map((candidateRange) =>
        loadRange(candidateRange, sourceTag, syncStatus, traceId)
      )
    );
    const loadWaitMs = tracePrefix ? formatMs(performance.now() - loadWaitStart) : 0;

    const assembleStart = tracePrefix ? performance.now() : 0;
    const loaded = peekRange(range);
    if (!loaded) {
      return buildFailureResult(range, 'Range loaded but cache assembly failed');
    }
    const assembleMs = tracePrefix ? formatMs(performance.now() - assembleStart) : 0;
    if (tracePrefix) {
      console.log(
        `${tracePrefix}miss-resolved loadWaitMs=${loadWaitMs} assembleMs=${assembleMs} ` +
        `totalMs=${formatMs(performance.now() - totalStart)} t=${formatMs(performance.now())}ms`
      );
    }

    return {
      ...loaded,
      cacheInfo: {
        ...loaded.cacheInfo,
        hit: false,
        sourceTag,
        uncoveredRanges,
      },
    };
  } catch (error) {
    if (tracePrefix) {
      console.log(
        `${tracePrefix}failed totalMs=${formatMs(performance.now() - totalStart)} ` +
        `error=${error?.message || String(error)} t=${formatMs(performance.now())}ms`
      );
    }
    return buildFailureResult(range, error?.message || String(error));
  }
}

export function invalidateAll({ reason = 'unknown' } = {}) {
  const removedEntries = cacheState.entries.length;
  cacheState.entries = [];
  cacheState.stats.invalidateAll += 1;

  console.log(
    `[range-cache] invalidateAll reason=${reason} removedEntries=${removedEntries}`
  );

  return {
    ok: true,
    reason,
    removedEntries,
  };
}

export function invalidateByDateRange({ startDate, endDate, reason = 'unknown' } = {}) {
  const invalidRange = normalizeRange(startDate, endDate);
  if (!invalidRange) {
    return {
      ok: false,
      reason,
      removedEntries: 0,
      remainingEntries: cacheState.entries.length,
      error: `Invalid range: ${startDate} ~ ${endDate}`,
    };
  }

  const nextEntries = [];
  let removedEntries = 0;

  for (const entry of cacheState.entries) {
    const splitRanges = splitRangeByInvalidation(entry, invalidRange);

    if (splitRanges.length === 0) {
      removedEntries += 1;
      continue;
    }

    if (splitRanges.length === 1 &&
      splitRanges[0].startDate === entry.startDate &&
      splitRanges[0].endDate === entry.endDate
    ) {
      nextEntries.push(entry);
      continue;
    }

    removedEntries += 1;
    splitRanges.forEach((part) => {
      nextEntries.push({
        ...entry,
        startDate: part.startDate,
        endDate: part.endDate,
        itemsByDate: sliceItemsByRange(entry.itemsByDate, part.startDate, part.endDate),
      });
    });
  }

  cacheState.entries = mergeRangeEntries(nextEntries);
  trimOverflowEntries();
  cacheState.stats.invalidateRange += 1;

  console.log(
    `[range-cache] invalidateByDateRange reason=${reason} range=${invalidRange.startDate}~${invalidRange.endDate} ` +
    `removedEntries=${removedEntries} remainingEntries=${cacheState.entries.length}`
  );

  return {
    ok: true,
    reason,
    removedEntries,
    remainingEntries: cacheState.entries.length,
  };
}

/**
 * Cache retention helper: prune cached payloads outside a keep-range.
 *
 * Why this exists:
 * - maxEntries caps the number of entries, but adjacent/overlap merge can produce a single
 *   very large entry (e.g. long scrolling across years). This function bounds memory by date.
 *
 * NOTE:
 * - This is a cache-only operation. It must never be used for correctness, only memory control.
 * - We keep metadata (meta/stage/elapsed/diagnostics/lastLoadedAt) as-is when clipping.
 */
export function pruneOutsideDateRange({ startDate, endDate, reason = 'unknown' } = {}) {
  const keepRange = normalizeRange(startDate, endDate);
  if (!keepRange) {
    return {
      ok: false,
      reason,
      keepRange: null,
      removedEntries: 0,
      clippedEntries: 0,
      remainingEntries: cacheState.entries.length,
      error: `Invalid keep range: ${startDate} ~ ${endDate}`,
    };
  }

  if (cacheState.entries.length === 0) {
    return {
      ok: true,
      reason,
      keepRange,
      removedEntries: 0,
      clippedEntries: 0,
      remainingEntries: 0,
    };
  }

  const nextEntries = [];
  let removedEntries = 0;
  let clippedEntries = 0;

  for (const entry of cacheState.entries) {
    if (!rangesOverlap(entry, keepRange)) {
      removedEntries += 1;
      continue;
    }

    const clippedStart = entry.startDate < keepRange.startDate ? keepRange.startDate : entry.startDate;
    const clippedEnd = entry.endDate > keepRange.endDate ? keepRange.endDate : entry.endDate;

    if (clippedStart === entry.startDate && clippedEnd === entry.endDate) {
      nextEntries.push(entry);
      continue;
    }

    clippedEntries += 1;
    nextEntries.push({
      ...entry,
      startDate: clippedStart,
      endDate: clippedEnd,
      itemsByDate: sliceItemsByRange(entry.itemsByDate, clippedStart, clippedEnd),
    });
  }

  cacheState.entries = mergeRangeEntries(nextEntries);
  trimOverflowEntries();

  const changed = removedEntries > 0 || clippedEntries > 0;
  if (changed) {
    console.log(
      `[range-cache] pruneOutsideDateRange reason=${reason} ` +
      `keep=${keepRange.startDate}~${keepRange.endDate} removedEntries=${removedEntries} clippedEntries=${clippedEntries} ` +
      `remainingEntries=${cacheState.entries.length}`
    );
  }

  return {
    ok: true,
    reason,
    keepRange,
    removedEntries,
    clippedEntries,
    remainingEntries: cacheState.entries.length,
  };
}

export function getDebugStats() {
  const inFlightRanges = [...cacheState.inFlight.values()].map((flight) => ({
    startDate: flight.startDate,
    endDate: flight.endDate,
    sourceTag: flight.sourceTag || 'unknown',
    startedAt: flight.startedAt || 0,
  }));

  return {
    hit: cacheState.stats.hit,
    miss: cacheState.stats.miss,
    inFlightDeduped: cacheState.stats.inFlightDeduped,
    loads: cacheState.stats.loads,
    invalidateAll: cacheState.stats.invalidateAll,
    invalidateRange: cacheState.stats.invalidateRange,
    loadedRanges: getLoadedRanges(),
    inFlightRanges,
    maxEntries: cacheState.maxEntries,
  };
}
