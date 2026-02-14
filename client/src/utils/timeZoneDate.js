const DEFAULT_TIME_ZONE = 'Asia/Seoul';

const pad2 = (value) => String(value).padStart(2, '0');

const buildYmd = (year, month, day) => `${year}-${pad2(month)}-${pad2(day)}`;

function parsePartValue(parts, type, fallback) {
  const value = parts.find((p) => p.type === type)?.value;
  return value ? Number(value) : fallback;
}

function formatPartsInTimeZone(date, timeZone) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const year = parsePartValue(parts, 'year', date.getFullYear());
  const month = parsePartValue(parts, 'month', date.getMonth() + 1);
  const day = parsePartValue(parts, 'day', date.getDate());
  let hour = parsePartValue(parts, 'hour', date.getHours());
  const minute = parsePartValue(parts, 'minute', date.getMinutes());

  if (hour === 24) {
    hour = 0;
  }

  return { year, month, day, hour, minute };
}

export function resolveTimeZone(timeZone) {
  if (timeZone && typeof timeZone === 'string') {
    return timeZone;
  }

  const systemTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return systemTimeZone || DEFAULT_TIME_ZONE;
}

export function getDateTimePartsInTimeZone(date = new Date(), timeZone) {
  const resolvedTimeZone = resolveTimeZone(timeZone);

  try {
    return formatPartsInTimeZone(date, resolvedTimeZone);
  } catch (error) {
    return formatPartsInTimeZone(date, DEFAULT_TIME_ZONE);
  }
}

export function getCurrentDateInTimeZone(timeZone) {
  const { year, month, day } = getDateTimePartsInTimeZone(new Date(), timeZone);
  return buildYmd(year, month, day);
}

export function getCurrentTimeInTimeZone(timeZone) {
  const { hour, minute } = getDateTimePartsInTimeZone(new Date(), timeZone);
  return `${pad2(hour)}:${pad2(minute)}`;
}

export function addDaysToYmd(ymd, days) {
  const [year, month, day] = ymd.split('-').map(Number);
  const base = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  base.setUTCDate(base.getUTCDate() + days);

  return buildYmd(
    base.getUTCFullYear(),
    base.getUTCMonth() + 1,
    base.getUTCDate()
  );
}

