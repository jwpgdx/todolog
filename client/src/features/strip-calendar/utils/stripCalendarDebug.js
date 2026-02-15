import {
  DEBUG_STRIP_CALENDAR,
  STRIP_CALENDAR_DETAIL_LOG_ENABLED,
  STRIP_CALENDAR_LOG_PRIORITY_KEYS,
} from './stripCalendarConstants';

let logSequence = 0;
let lastLogAtMs = null;
const scopeFirstSeenAtMs = new Map();
function getTimestamp() {
  return new Date().toISOString();
}

function formatValue(value) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return `[array:${value.length}]`;
  return '[object]';
}

export function logStripCalendar(scope, event, payload = {}) {
  if (!DEBUG_STRIP_CALENDAR) return;

  const nowMs = Date.now();
  const at = getTimestamp();
  logSequence += 1;

  if (!scopeFirstSeenAtMs.has(scope)) {
    scopeFirstSeenAtMs.set(scope, nowMs);
  }

  const prevMs = lastLogAtMs ?? nowMs;
  const dtPrevMs = nowMs - prevMs;
  const dtScopeMs = nowMs - scopeFirstSeenAtMs.get(scope);
  const tPerfMs = typeof globalThis?.performance?.now === 'function'
    ? Number(globalThis.performance.now().toFixed(3))
    : null;

  lastLogAtMs = nowMs;

  const usedKeys = new Set();
  const orderedPayloadParts = [];

  for (const key of STRIP_CALENDAR_LOG_PRIORITY_KEYS) {
    if (!(key in payload)) continue;
    usedKeys.add(key);
    orderedPayloadParts.push(`${key}=${formatValue(payload[key])}`);
  }

  for (const key of Object.keys(payload)) {
    if (usedKeys.has(key)) continue;
    orderedPayloadParts.push(`${key}=${formatValue(payload[key])}`);
  }

  const summaryLine = [
    `seq=${logSequence}`,
    `at=${at}`,
    `tMs=${nowMs}`,
    `dtPrevMs=${dtPrevMs}`,
    `dtScopeMs=${dtScopeMs}`,
    `scope=${scope}`,
    `event=${event}`,
    ...orderedPayloadParts,
  ].join(' ');

  console.log('[strip-calendar]', summaryLine);
  if (STRIP_CALENDAR_DETAIL_LOG_ENABLED) {
    console.log('[strip-calendar][detail]', {
      at,
      tMs: nowMs,
      tPerfMs,
      seq: logSequence,
      dtPrevMs,
      dtScopeMs,
      scope,
      event,
      ...payload,
    });
  }
}
