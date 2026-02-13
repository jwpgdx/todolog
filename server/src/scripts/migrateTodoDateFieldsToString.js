/**
 * Todo date field migration script (Phase 2.5 / Task 25)
 *
 * 목적:
 * - legacy Date fields(startDateTime/endDateTime)을 string fields로 분해
 * - recurrenceEndDate를 YYYY-MM-DD | null로 정규화
 * - user.settings.timeZone 단일 기준으로 변환
 * - dry-run / backup / batch write / report 지원
 *
 * 사용 예시:
 * - Dry run:
 *   node server/src/scripts/migrateTodoDateFieldsToString.js --dry-run
 * - Live migration (default):
 *   node server/src/scripts/migrateTodoDateFieldsToString.js
 * - Batch size 지정:
 *   node server/src/scripts/migrateTodoDateFieldsToString.js --batch-size 300
 * - 일부만 테스트:
 *   node server/src/scripts/migrateTodoDateFieldsToString.js --dry-run --limit 100
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');

const DEFAULT_TIME_ZONE = 'Asia/Seoul';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function printUsage() {
  console.log(`
Usage:
  node server/src/scripts/migrateTodoDateFieldsToString.js [options]

Options:
  --dry-run                  변환 결과만 집계하고 DB write는 수행하지 않음
  --batch-size <number>      bulkWrite 배치 크기 (기본값: 500)
  --limit <number>           대상 문서 처리 개수 제한 (테스트용)
  --backup <collectionName>  백업 컬렉션 이름 지정
  --help                     도움말 출력
`);
}

function parseArgs(argv) {
  const options = {
    dryRun: false,
    batchSize: 500,
    limit: null,
    backupCollection: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }

    if (arg === '--help') {
      options.help = true;
      continue;
    }

    if (arg === '--batch-size') {
      const next = argv[i + 1];
      const parsed = Number.parseInt(next, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('--batch-size must be a positive integer');
      }
      options.batchSize = parsed;
      i += 1;
      continue;
    }

    if (arg === '--limit') {
      const next = argv[i + 1];
      const parsed = Number.parseInt(next, 10);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error('--limit must be a positive integer');
      }
      options.limit = parsed;
      i += 1;
      continue;
    }

    if (arg === '--backup') {
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        throw new Error('--backup requires collection name');
      }
      options.backupCollection = next;
      i += 1;
      continue;
    }

    throw new Error(`Unknown option: ${arg}`);
  }

  return options;
}

function isValidDateString(value) {
  return typeof value === 'string' && DATE_PATTERN.test(value);
}

function isValidTimeString(value) {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

function areEqualNullable(a, b) {
  if (a === b) return true;
  if ((a === undefined || a === null) && (b === undefined || b === null)) return true;
  return false;
}

function stringifyUserId(userId) {
  if (userId === undefined || userId === null) return null;
  if (typeof userId === 'string') return userId;
  if (typeof userId === 'object' && typeof userId.toString === 'function') {
    return userId.toString();
  }
  return String(userId);
}

function safeDateFromUnknown(value) {
  if (value === undefined || value === null) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

function formatDateInTimeZone(date, timeZone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value;
  const month = parts.find(part => part.type === 'month')?.value;
  const day = parts.find(part => part.type === 'day')?.value;

  if (!year || !month || !day) return null;
  return `${year}-${month}-${day}`;
}

function formatTimeInTimeZone(date, timeZone) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone,
  }).formatToParts(date);

  const hour = parts.find(part => part.type === 'hour')?.value;
  const minute = parts.find(part => part.type === 'minute')?.value;

  if (!hour || !minute) return null;
  return `${hour}:${minute}`;
}

function splitDateTimeByTimeZone(value, timeZone) {
  const dateObj = safeDateFromUnknown(value);
  if (!dateObj) return null;

  const date = formatDateInTimeZone(dateObj, timeZone);
  const time = formatTimeInTimeZone(dateObj, timeZone);

  if (!date || !time) return null;
  return { date, time };
}

function normalizeDateOnlyString(input) {
  if (typeof input !== 'string') return null;
  const value = input.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  const yyyymmdd = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (yyyymmdd) {
    return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
  }

  const yyyymmddTime = value.match(/^(\d{4})(\d{2})(\d{2})T\d{6}Z?$/i);
  if (yyyymmddTime) {
    return `${yyyymmddTime[1]}-${yyyymmddTime[2]}-${yyyymmddTime[3]}`;
  }

  return null;
}

function extractUntilFromRRuleString(rrule) {
  if (typeof rrule !== 'string') return null;
  const match = rrule.match(/(?:^|;)UNTIL=([^;]+)/i);
  if (!match) return null;
  return normalizeDateOnlyString(match[1]);
}

function extractUntilFromRecurrence(recurrence) {
  if (!recurrence) return null;

  if (Array.isArray(recurrence)) {
    for (const rule of recurrence) {
      const until = extractUntilFromRRuleString(rule);
      if (until) return until;
    }
    return null;
  }

  if (typeof recurrence === 'string') {
    return extractUntilFromRRuleString(recurrence);
  }

  return null;
}

function normalizeRecurrenceEndDate(value, timeZone) {
  if (value === undefined || value === null || value === '') return null;

  if (typeof value === 'string') {
    const normalized = normalizeDateOnlyString(value);
    if (normalized) return normalized;

    const asDate = safeDateFromUnknown(value);
    if (!asDate) return null;
    return formatDateInTimeZone(asDate, timeZone);
  }

  const asDate = safeDateFromUnknown(value);
  if (!asDate) return null;
  return formatDateInTimeZone(asDate, timeZone);
}

function getTargetQuery() {
  return {
    $or: [
      { startDateTime: { $exists: true } },
      { endDateTime: { $exists: true } },
      { timeZone: { $exists: true } },
      { recurrence: { $exists: true, $ne: null } },
      { recurrenceEndDate: { $type: 'date' } },
    ],
  };
}

async function resolveUserTimeZone(usersCollection, userId, cache, stats) {
  const userIdKey = stringifyUserId(userId);

  if (!userIdKey) {
    stats.timeZoneFallbackCount += 1;
    stats.timeZoneFallbackReasons.missingUserId += 1;
    return DEFAULT_TIME_ZONE;
  }

  if (cache.has(userIdKey)) {
    stats.timeZoneCacheHit += 1;
    return cache.get(userIdKey);
  }

  stats.timeZoneCacheMiss += 1;

  const user = await usersCollection.findOne(
    { _id: userIdKey },
    { projection: { _id: 1, settings: 1 } }
  );

  const timeZone = user?.settings?.timeZone;
  if (typeof timeZone !== 'string' || !timeZone.trim()) {
    stats.timeZoneFallbackCount += 1;
    if (!user) {
      stats.timeZoneFallbackReasons.userNotFound += 1;
    } else {
      stats.timeZoneFallbackReasons.emptyUserTimeZone += 1;
    }
  }

  const resolved = (typeof timeZone === 'string' && timeZone.trim()) ? timeZone : DEFAULT_TIME_ZONE;
  cache.set(userIdKey, resolved);
  return resolved;
}

function buildUpdateForTodo(todo, timeZone) {
  const setOps = {};
  const unsetOps = {};
  const errors = [];

  const hasOwn = key => Object.prototype.hasOwnProperty.call(todo, key);
  const assignIfChanged = (key, value) => {
    if (!areEqualNullable(todo[key], value)) {
      setOps[key] = value;
    }
  };
  const unsetIfExists = (key) => {
    if (hasOwn(key)) {
      unsetOps[key] = '';
    }
  };

  const hasLegacyStart = hasOwn('startDateTime');
  const hasLegacyEnd = hasOwn('endDateTime');

  if (hasLegacyStart && todo.startDateTime !== null) {
    const startSplit = splitDateTimeByTimeZone(todo.startDateTime, timeZone);
    if (!startSplit) {
      errors.push('invalid_startDateTime');
    } else {
      assignIfChanged('startDate', startSplit.date);
      if (todo.isAllDay === true) {
        assignIfChanged('startTime', null);
      } else {
        assignIfChanged('startTime', startSplit.time);
      }
    }
  }

  if (hasLegacyEnd && todo.endDateTime !== null) {
    const endSplit = splitDateTimeByTimeZone(todo.endDateTime, timeZone);
    if (!endSplit) {
      errors.push('invalid_endDateTime');
    } else {
      assignIfChanged('endDate', endSplit.date);
      if (todo.isAllDay === true) {
        assignIfChanged('endTime', null);
      } else {
        assignIfChanged('endTime', endSplit.time);
      }
    }
  }

  // recurrenceEndDate 정규화:
  // 1) RRULE UNTIL 우선
  // 2) 없으면 기존 recurrenceEndDate 변환
  const untilFromRRule = extractUntilFromRecurrence(todo.recurrence);
  if (untilFromRRule) {
    assignIfChanged('recurrenceEndDate', untilFromRRule);
  } else if (hasOwn('recurrenceEndDate')) {
    const normalizedRecurrenceEndDate = normalizeRecurrenceEndDate(todo.recurrenceEndDate, timeZone);
    assignIfChanged('recurrenceEndDate', normalizedRecurrenceEndDate);
  }

  if (hasOwn('timeZone')) {
    unsetIfExists('timeZone');
  }
  if (hasLegacyStart) {
    unsetIfExists('startDateTime');
  }
  if (hasLegacyEnd) {
    unsetIfExists('endDateTime');
  }

  // 최종 검증 (문자열 계약)
  const finalStartDate = setOps.startDate ?? todo.startDate;
  const finalEndDate = setOps.endDate ?? todo.endDate;
  const finalStartTime = setOps.startTime ?? todo.startTime;
  const finalEndTime = setOps.endTime ?? todo.endTime;
  const finalRecurrenceEndDate = setOps.recurrenceEndDate ?? todo.recurrenceEndDate;
  const finalIsAllDay = (setOps.isAllDay !== undefined) ? setOps.isAllDay : todo.isAllDay;

  if (!isValidDateString(finalStartDate)) {
    errors.push('invalid_startDate');
  }
  if (finalEndDate !== undefined && finalEndDate !== null && !isValidDateString(finalEndDate)) {
    errors.push('invalid_endDate');
  }
  if (finalStartTime !== undefined && finalStartTime !== null && !isValidTimeString(finalStartTime)) {
    errors.push('invalid_startTime');
  }
  if (finalEndTime !== undefined && finalEndTime !== null && !isValidTimeString(finalEndTime)) {
    errors.push('invalid_endTime');
  }
  if (
    finalRecurrenceEndDate !== undefined
    && finalRecurrenceEndDate !== null
    && !isValidDateString(finalRecurrenceEndDate)
  ) {
    errors.push('invalid_recurrenceEndDate');
  }
  if (finalIsAllDay === false && (finalStartTime === undefined || finalStartTime === null)) {
    errors.push('missing_startTime_for_timed_todo');
  }

  if (errors.length > 0) {
    return {
      status: 'failed',
      errors,
    };
  }

  const update = {};
  if (Object.keys(setOps).length > 0) {
    update.$set = setOps;
  }
  if (Object.keys(unsetOps).length > 0) {
    update.$unset = unsetOps;
  }

  if (Object.keys(update).length === 0) {
    return {
      status: 'skipped',
      reason: 'no_changes',
    };
  }

  return {
    status: 'updated',
    update,
  };
}

function timestampForCollectionName() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const mi = String(now.getUTCMinutes()).padStart(2, '0');
  const ss = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

async function backupTargetDocuments({
  todosCollection,
  backupCollection,
  query,
  batchSize,
  limit,
}) {
  const cursor = todosCollection.find(query);
  if (Number.isInteger(limit) && limit > 0) {
    cursor.limit(limit);
  }

  let copied = 0;
  let buffer = [];

  for await (const doc of cursor) {
    buffer.push(doc);

    if (buffer.length >= batchSize) {
      await backupCollection.insertMany(buffer, { ordered: false });
      copied += buffer.length;
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    await backupCollection.insertMany(buffer, { ordered: false });
    copied += buffer.length;
  }

  return copied;
}

function printReport({
  mode,
  options,
  report,
}) {
  console.log('\n================ Migration Report ================');
  console.log(`Mode: ${mode}`);
  console.log(`Batch Size: ${options.batchSize}`);
  console.log(`Limit: ${options.limit ?? 'none'}`);
  console.log(`Backup Collection: ${report.backupCollection || 'not_created'}`);
  console.log('-----------------------------------------------');
  console.log(`Target Count (query): ${report.targetCount}`);
  console.log(`Processed: ${report.processedCount}`);
  console.log(`Updated: ${report.updatedCount}`);
  console.log(`Failed: ${report.failedCount}`);
  console.log(`Skipped(no_changes): ${report.skippedCount}`);
  console.log('-----------------------------------------------');
  console.log(`Timezone Cache Hit: ${report.timeZoneCacheHit}`);
  console.log(`Timezone Cache Miss: ${report.timeZoneCacheMiss}`);
  console.log(`Timezone Fallback: ${report.timeZoneFallbackCount}`);
  console.log(`  - missingUserId: ${report.timeZoneFallbackReasons.missingUserId}`);
  console.log(`  - userNotFound: ${report.timeZoneFallbackReasons.userNotFound}`);
  console.log(`  - emptyUserTimeZone: ${report.timeZoneFallbackReasons.emptyUserTimeZone}`);
  console.log('-----------------------------------------------');
  console.log(`Bulk Batches Executed: ${report.bulkBatches}`);
  console.log(`Matched Count: ${report.matchedCount}`);
  console.log(`Modified Count: ${report.modifiedCount}`);
  console.log('=================================================\n');

  if (report.failedSamples.length > 0) {
    console.log('Failed Samples (up to 20):');
    for (const sample of report.failedSamples) {
      console.log(`- _id=${sample._id}, userId=${sample.userId}, reason=${sample.reason}`);
    }
    console.log('');
  }
}

async function run() {
  let options;

  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`❌ Invalid arguments: ${error.message}`);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  const mode = options.dryRun ? 'dry-run' : 'live';
  console.log(`🚀 Starting Todo date-field migration (${mode})`);

  const report = {
    targetCount: 0,
    processedCount: 0,
    updatedCount: 0,
    failedCount: 0,
    skippedCount: 0,
    bulkBatches: 0,
    matchedCount: 0,
    modifiedCount: 0,
    failedSamples: [],
    backupCollection: null,
    timeZoneCacheHit: 0,
    timeZoneCacheMiss: 0,
    timeZoneFallbackCount: 0,
    timeZoneFallbackReasons: {
      missingUserId: 0,
      userNotFound: 0,
      emptyUserTimeZone: 0,
    },
  };

  try {
    if (!process.env.MONGODB_URI || typeof process.env.MONGODB_URI !== 'string') {
      throw new Error('MONGODB_URI is missing. Check server/.env');
    }

    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    const db = mongoose.connection.db;
    const todosCollection = db.collection('todos');
    const usersCollection = db.collection('users');

    const targetQuery = getTargetQuery();
    report.targetCount = await todosCollection.countDocuments(targetQuery);

    if (report.targetCount === 0) {
      console.log('✨ No target documents found. Nothing to migrate.');
      printReport({ mode, options, report });
      process.exit(0);
    }

    console.log(`📊 Target documents: ${report.targetCount}`);

    if (!options.dryRun) {
      const backupName = options.backupCollection || `todos_backup_before_date_string_${timestampForCollectionName()}`;
      report.backupCollection = backupName;
      const backupCollection = db.collection(backupName);

      console.log(`💾 Creating backup collection: ${backupName}`);
      const backedUpCount = await backupTargetDocuments({
        todosCollection,
        backupCollection,
        query: targetQuery,
        batchSize: options.batchSize,
        limit: options.limit,
      });

      console.log(`✅ Backup completed: ${backedUpCount} documents copied`);
    }

    const timeZoneCache = new Map();
    const cursor = todosCollection.find(targetQuery);
    if (Number.isInteger(options.limit) && options.limit > 0) {
      cursor.limit(options.limit);
    }

    let bulkOps = [];

    for await (const todo of cursor) {
      report.processedCount += 1;

      const timeZone = await resolveUserTimeZone(
        usersCollection,
        todo.userId,
        timeZoneCache,
        report
      );

      const result = buildUpdateForTodo(todo, timeZone);

      if (result.status === 'failed') {
        report.failedCount += 1;
        if (report.failedSamples.length < 20) {
          report.failedSamples.push({
            _id: todo._id,
            userId: stringifyUserId(todo.userId),
            reason: result.errors.join(','),
          });
        }
        continue;
      }

      if (result.status === 'skipped') {
        report.skippedCount += 1;
        continue;
      }

      report.updatedCount += 1;

      if (options.dryRun) {
        continue;
      }

      bulkOps.push({
        updateOne: {
          filter: { _id: todo._id },
          update: result.update,
        },
      });

      if (bulkOps.length >= options.batchSize) {
        const writeResult = await todosCollection.bulkWrite(bulkOps, { ordered: false });
        report.bulkBatches += 1;
        report.matchedCount += writeResult.matchedCount || 0;
        report.modifiedCount += writeResult.modifiedCount || 0;
        bulkOps = [];
      }
    }

    if (!options.dryRun && bulkOps.length > 0) {
      const writeResult = await todosCollection.bulkWrite(bulkOps, { ordered: false });
      report.bulkBatches += 1;
      report.matchedCount += writeResult.matchedCount || 0;
      report.modifiedCount += writeResult.modifiedCount || 0;
    }

    printReport({ mode, options, report });

    if (!options.dryRun && report.failedCount > 0) {
      console.log('⚠️ Migration completed with row-level failures. Check failed samples.');
      process.exit(2);
    }

    console.log('✅ Migration finished successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    printReport({ mode, options, report });
    process.exit(1);
  } finally {
    try {
      await mongoose.disconnect();
    } catch (disconnectError) {
      console.error('⚠️ Failed to disconnect mongoose:', disconnectError.message);
    }
  }
}

if (require.main === module) {
  run();
}

module.exports = {
  parseArgs,
  splitDateTimeByTimeZone,
  normalizeDateOnlyString,
  extractUntilFromRRuleString,
  normalizeRecurrenceEndDate,
  buildUpdateForTodo,
};
