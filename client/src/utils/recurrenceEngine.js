/**
 * Recurrence Engine Core (Phase 3 - Step 1)
 * - Engine contract + normalization
 * - Strict date-only helpers
 * - No runtime integration in this step
 */

const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const COMPACT_DATE_REGEX = /^(\d{4})(\d{2})(\d{2})$/;
const UTC_DATE_REGEX = /^(\d{4})(\d{2})(\d{2})T\d{6}Z?$/i;
const RRULE_PREFIX_REGEX = /^RRULE:/i;

const VALID_FREQUENCIES = new Set(['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']);
const VALID_DAY_CODES = new Set(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']);

export const MAX_EXPANSION_DAYS = 366;

/**
 * Normalize date-like value into YYYY-MM-DD (strict).
 * Returns null when input is invalid.
 */
export function normalizeDateOnlyString(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  let year;
  let month;
  let day;

  const dateOnly = value.match(DATE_ONLY_REGEX);
  if (dateOnly) {
    year = Number(dateOnly[1]);
    month = Number(dateOnly[2]);
    day = Number(dateOnly[3]);
  }

  if (!dateOnly) {
    const compact = value.match(COMPACT_DATE_REGEX);
    if (compact) {
      year = Number(compact[1]);
      month = Number(compact[2]);
      day = Number(compact[3]);
    }
  }

  if (!dateOnly && year == null) {
    const utcDate = value.match(UTC_DATE_REGEX);
    if (utcDate) {
      year = Number(utcDate[1]);
      month = Number(utcDate[2]);
      day = Number(utcDate[3]);
    }
  }

  if (year == null || month == null || day == null) return null;
  if (!isValidDateParts(year, month, day)) return null;

  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Compare two YYYY-MM-DD values.
 * Returns -1, 0, 1. Invalid inputs are treated as equal(0) for fail-soft behavior.
 */
export function compareDateOnly(leftDate, rightDate) {
  const left = normalizeDateOnlyString(leftDate);
  const right = normalizeDateOnlyString(rightDate);
  if (!left || !right) return 0;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

/**
 * Add days to YYYY-MM-DD.
 * Returns null for invalid inputs.
 */
export function addDaysDateOnly(dateString, days) {
  const normalized = normalizeDateOnlyString(dateString);
  if (!normalized || !Number.isInteger(days)) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  const next = new Date(utc);
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Normalize recurrence input to single internal rule contract.
 * This function is fail-soft: never throws and always returns an object.
 */
export function normalizeRecurrence(rawRecurrence, recurrenceEndDate = null, options = {}) {
  const normalized = createUnknownRule();
  normalized.rawInputType = detectInputType(rawRecurrence);
  normalized.startDate = normalizeDateOnlyString(options.startDate || null);

  const recurrencePayload = unwrapRecurrenceInput(rawRecurrence);
  if (!recurrencePayload) {
    normalized.errors.push('empty_recurrence');
    normalized.effectiveEndDate = resolveEffectiveEndDate(null, recurrenceEndDate);
    return normalized;
  }

  if (recurrencePayload.type === 'rrule') {
    applyRulePartsFromRRule(normalized, recurrencePayload.value);
  } else if (recurrencePayload.type === 'object') {
    applyRulePartsFromObject(normalized, recurrencePayload.value);
  }

  normalized.effectiveEndDate = resolveEffectiveEndDate(
    recurrencePayload.untilDate || normalized.untilDate || null,
    recurrenceEndDate
  );

  if (!normalized.frequency || !VALID_FREQUENCIES.has(normalized.frequency)) {
    normalized.errors.push('invalid_frequency');
    return normalized;
  }

  normalized.isValid = true;
  return normalized;
}

/**
 * Predicate: check whether normalized rule occurs on target date.
 * Fail-soft: returns false on invalid inputs.
 */
export function occursOnDateNormalized(normalizedRule, targetDate) {
  if (!normalizedRule || normalizedRule.isValid !== true) return false;

  const target = normalizeDateOnlyString(targetDate);
  const start = normalizeDateOnlyString(normalizedRule.startDate);
  if (!target || !start) return false;

  if (target < start) return false;

  const effectiveEndDate = normalizeDateOnlyString(normalizedRule.effectiveEndDate);
  if (effectiveEndDate && target > effectiveEndDate) return false;

  const targetParts = splitDateParts(target);
  const startParts = splitDateParts(start);
  if (!targetParts || !startParts) return false;

  if (normalizedRule.byMonth && targetParts.month !== normalizedRule.byMonth) {
    return false;
  }

  switch (normalizedRule.frequency) {
    case 'DAILY':
      return true;

    case 'WEEKLY': {
      const targetDayCode = getWeekdayCode(targetParts);
      if (!targetDayCode) return false;

      if (Array.isArray(normalizedRule.byDay) && normalizedRule.byDay.length > 0) {
        return normalizedRule.byDay.includes(targetDayCode);
      }

      const startDayCode = getWeekdayCode(startParts);
      return !!startDayCode && startDayCode === targetDayCode;
    }

    case 'MONTHLY': {
      const monthDay = normalizedRule.byMonthDay || startParts.day;
      if (!Number.isInteger(monthDay) || monthDay <= 0) return false;
      return targetParts.day === monthDay;
    }

    case 'YEARLY': {
      const month = normalizedRule.byMonth || startParts.month;
      const monthDay = normalizedRule.byMonthDay || startParts.day;
      if (!Number.isInteger(month) || !Number.isInteger(monthDay)) return false;
      if (month < 1 || month > 12 || monthDay <= 0) return false;
      return targetParts.month === month && targetParts.day === monthDay;
    }

    default:
      return false;
  }
}

/**
 * Expand normalized recurrence occurrences within [rangeStart, rangeEnd] (inclusive).
 * Fail-soft: returns [] on invalid input or guarded range overflow.
 */
export function expandOccurrencesInRange(normalizedRule, rangeStart, rangeEnd) {
  if (!normalizedRule || normalizedRule.isValid !== true) return [];

  const start = normalizeDateOnlyString(rangeStart);
  const end = normalizeDateOnlyString(rangeEnd);
  if (!start || !end) return [];
  if (end < start) return [];

  const ruleStart = normalizeDateOnlyString(normalizedRule.startDate);
  if (!ruleStart) return [];

  const ruleEnd = normalizeDateOnlyString(normalizedRule.effectiveEndDate);

  let effectiveStart = start < ruleStart ? ruleStart : start;
  let effectiveEnd = end;

  if (ruleEnd && ruleEnd < effectiveEnd) {
    effectiveEnd = ruleEnd;
  }

  if (effectiveEnd < effectiveStart) return [];

  const spanDays = diffDaysInclusive(effectiveStart, effectiveEnd);
  if (spanDays == null || spanDays > MAX_EXPANSION_DAYS) {
    return [];
  }

  const results = [];
  let cursor = effectiveStart;
  for (let i = 0; i < spanDays; i += 1) {
    if (occursOnDateNormalized(normalizedRule, cursor)) {
      results.push(cursor);
    }

    if (cursor === effectiveEnd) break;
    const next = addDaysDateOnly(cursor, 1);
    if (!next) break;
    cursor = next;
  }

  return results;
}

function createUnknownRule() {
  return {
    isValid: false,
    rawInputType: 'unknown',
    sourceType: 'unknown',
    frequency: null, // DAILY | WEEKLY | MONTHLY | YEARLY
    byDay: [],
    byMonthDay: null,
    byMonth: null,
    startDate: null,
    untilDate: null,
    effectiveEndDate: null,
    rruleText: null,
    errors: [],
  };
}

function detectInputType(rawRecurrence) {
  if (Array.isArray(rawRecurrence)) return 'array';
  if (typeof rawRecurrence === 'string') return 'string';
  if (rawRecurrence && typeof rawRecurrence === 'object') return 'object';
  return 'unknown';
}

function unwrapRecurrenceInput(rawRecurrence) {
  if (!rawRecurrence) return null;

  if (Array.isArray(rawRecurrence)) {
    for (const item of rawRecurrence) {
      const payload = unwrapRecurrenceInput(item);
      if (payload) return payload;
    }
    return null;
  }

  if (typeof rawRecurrence === 'string') {
    const trimmed = rawRecurrence.trim();
    if (!trimmed) return null;
    return {
      type: 'rrule',
      value: trimmed,
      untilDate: extractUntilFromRRule(trimmed),
    };
  }

  if (typeof rawRecurrence === 'object') {
    if (typeof rawRecurrence.rrule === 'string' && rawRecurrence.rrule.trim()) {
      const text = rawRecurrence.rrule.trim();
      return {
        type: 'rrule',
        value: text,
        untilDate: extractUntilFromRRule(text) || normalizeDateOnlyString(rawRecurrence.until || rawRecurrence.endDate || rawRecurrence.recurrenceEndDate),
      };
    }

    if (Array.isArray(rawRecurrence.rules) && rawRecurrence.rules.length) {
      const payload = unwrapRecurrenceInput(rawRecurrence.rules);
      if (payload) return payload;
    }

    return {
      type: 'object',
      value: rawRecurrence,
      untilDate: normalizeDateOnlyString(
        rawRecurrence.until ||
          rawRecurrence.endDate ||
          rawRecurrence.recurrenceEndDate ||
          rawRecurrence.end_date
      ),
    };
  }

  return null;
}

function applyRulePartsFromRRule(targetRule, rruleText) {
  targetRule.sourceType = 'rrule';
  targetRule.rruleText = rruleText;

  const clean = rruleText.replace(RRULE_PREFIX_REGEX, '');
  const sections = clean.split(';').map((token) => token.trim()).filter(Boolean);
  const kv = {};
  for (const section of sections) {
    const pivot = section.indexOf('=');
    if (pivot === -1) continue;
    const key = section.slice(0, pivot).trim().toUpperCase();
    const value = section.slice(pivot + 1).trim();
    if (key && value) {
      kv[key] = value;
    }
  }

  targetRule.frequency = (kv.FREQ || '').toUpperCase() || null;
  targetRule.byDay = parseByDay(kv.BYDAY);
  targetRule.byMonthDay = parsePositiveInteger(kv.BYMONTHDAY);
  targetRule.byMonth = parsePositiveInteger(kv.BYMONTH);
  targetRule.untilDate = normalizeDateOnlyString(kv.UNTIL);
}

function applyRulePartsFromObject(targetRule, rawObject) {
  targetRule.sourceType = 'object';
  const frequency =
    rawObject.frequency ||
    rawObject.freq ||
    rawObject.FREQ ||
    rawObject.type ||
    null;

  targetRule.frequency = typeof frequency === 'string' ? frequency.trim().toUpperCase() : null;
  targetRule.byDay = parseByDay(rawObject.byDay || rawObject.byday || rawObject.BYDAY || rawObject.weekdays);
  targetRule.byMonthDay = parsePositiveInteger(rawObject.byMonthDay ?? rawObject.bymonthday ?? rawObject.BYMONTHDAY ?? rawObject.dayOfMonth);
  targetRule.byMonth = parsePositiveInteger(rawObject.byMonth ?? rawObject.bymonth ?? rawObject.BYMONTH ?? rawObject.month);
  targetRule.untilDate = normalizeDateOnlyString(
    rawObject.until || rawObject.endDate || rawObject.recurrenceEndDate || rawObject.end_date
  );
}

function parseByDay(value) {
  if (!value) return [];

  const tokens = Array.isArray(value)
    ? value.map(String)
    : String(value)
        .split(',')
        .map((token) => token.trim());

  const normalized = [];
  for (const token of tokens) {
    if (!token) continue;
    const upper = token.toUpperCase();
    if (VALID_DAY_CODES.has(upper)) {
      normalized.push(upper);
      continue;
    }

    const numeric = Number(upper);
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 6) {
      normalized.push(['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][numeric]);
    }
  }

  return Array.from(new Set(normalized));
}

function parsePositiveInteger(value) {
  if (value == null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
}

function extractUntilFromRRule(rruleText) {
  if (typeof rruleText !== 'string') return null;
  const clean = rruleText.replace(RRULE_PREFIX_REGEX, '');
  const match = clean.match(/(?:^|;)UNTIL=([^;]+)/i);
  if (!match) return null;
  return normalizeDateOnlyString(match[1]);
}

function resolveEffectiveEndDate(untilDate, recurrenceEndDate) {
  const left = normalizeDateOnlyString(untilDate);
  const right = normalizeDateOnlyString(recurrenceEndDate);
  if (left && right) {
    // Conservative rule: when both exist, use earlier date to avoid accidental over-expansion.
    return left <= right ? left : right;
  }
  return left || right || null;
}

function splitDateParts(dateString) {
  const normalized = normalizeDateOnlyString(dateString);
  if (!normalized) return null;
  const [year, month, day] = normalized.split('-').map(Number);
  if (!isValidDateParts(year, month, day)) return null;
  return { year, month, day };
}

function getWeekdayCode(parts) {
  if (!parts) return null;
  const weekdayIndex = getWeekdayIndex(parts.year, parts.month, parts.day);
  if (weekdayIndex < 0 || weekdayIndex > 6) return null;
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][weekdayIndex];
}

/**
 * Gregorian weekday calculation (0=Sunday ... 6=Saturday), date-only safe.
 * Tomohiko Sakamoto's algorithm.
 */
function getWeekdayIndex(year, month, day) {
  if (!isValidDateParts(year, month, day)) return -1;
  const monthOffset = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4];
  let y = year;
  if (month < 3) y -= 1;
  return (
    y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) +
    monthOffset[month - 1] +
    day
  ) % 7;
}

function diffDaysInclusive(startDate, endDate) {
  const startEpoch = dateOnlyToEpochDay(startDate);
  const endEpoch = dateOnlyToEpochDay(endDate);
  if (startEpoch == null || endEpoch == null) return null;
  if (endEpoch < startEpoch) return 0;
  return endEpoch - startEpoch + 1;
}

function dateOnlyToEpochDay(dateString) {
  const parts = splitDateParts(dateString);
  if (!parts) return null;
  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day);
  return Math.floor(utcMs / 86400000);
}

function isLeapYear(year) {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}

function getLastDayOfMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  if ([4, 6, 9, 11].includes(month)) return 30;
  return 31;
}

function isValidDateParts(year, month, day) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1 || month < 1 || month > 12 || day < 1) return false;
  return day <= getLastDayOfMonth(year, month);
}
