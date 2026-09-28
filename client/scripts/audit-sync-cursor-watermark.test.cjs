const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const repoRoot = path.resolve(__dirname, '..', '..');
const clientRoot = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function loadCommonJs(relativePath, mocks, globals = {}) {
  const filename = path.join(repoRoot, relativePath);
  const code = fs.readFileSync(filename, 'utf8');
  const module = { exports: {} };
  const mockedRequire = (name) => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw new Error(`Unmocked require ${name} in ${relativePath}`);
  };
  new Function('require', 'module', 'exports', 'console', 'Date', code)(
    mockedRequire,
    module,
    module.exports,
    quiet,
    globals.Date || Date
  );
  return module.exports;
}

function loadClientModule(relativePath, mocks) {
  const filename = path.join(clientRoot, relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  const mockedRequire = (name) => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw new Error(`Unmocked import ${name} in ${relativePath}`);
  };
  new Function('require', 'module', 'exports', 'console', code)(mockedRequire, module, module.exports, quiet);
  return module.exports;
}

function createFakeDate(initialIso, lateIso = initialIso) {
  class FakeDate extends Date {
    static currentMs = Date.parse(initialIso);
    static lateMs = Date.parse(lateIso);
    constructor(value) {
      super(value === undefined ? FakeDate.currentMs : value);
    }
    static now() {
      return FakeDate.currentMs;
    }
    static advanceToLate() {
      FakeDate.currentMs = FakeDate.lateMs;
    }
  }
  return FakeDate;
}

function thenableQuery(results, onAwait) {
  const query = {
    populate() { return query; },
    select() { return query; },
    then(resolve, reject) {
      onAwait?.();
      return Promise.resolve(results).then(resolve, reject);
    },
  };
  return query;
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function todoControllerHarness({ startIso, lateIso, lastSyncTime, results = [[], []] }) {
  const FakeDate = createFakeDate(startIso, lateIso);
  const queries = [];
  let call = 0;
  const Todo = {
    find(query) {
      queries.push(query);
      const rows = results[call++] || [];
      return thenableQuery(rows, () => FakeDate.advanceToLate());
    },
  };
  const controller = loadCommonJs('server/src/controllers/todoController.js', {
    '../models/Todo': Todo,
    '../models/Completion': {},
    '../services/googleCalendar': {},
    '../models/User': {},
    '../utils/recurrenceUtils': { occursOnDate: () => false },
  }, { Date: FakeDate });
  const req = { query: { lastSyncTime }, userId: 'user-a' };
  const res = responseRecorder();
  return { run: () => controller.getDeltaSync(req, res), res, queries };
}

function completionControllerHarness({ startIso, lateIso, lastSyncTime, results = [[], []] }) {
  const FakeDate = createFakeDate(startIso, lateIso);
  const queries = [];
  let call = 0;
  const Completion = {
    find(query) {
      queries.push(query);
      const rows = results[call++] || [];
      return thenableQuery(rows, () => FakeDate.advanceToLate());
    },
  };
  const controller = loadCommonJs('server/src/controllers/completionController.js', {
    '../models/Completion': Completion,
    '../utils/idGenerator': { generateId: () => 'generated' },
  }, { Date: FakeDate });
  const req = { query: { lastSyncTime }, userId: 'user-a' };
  const res = responseRecorder();
  return { run: () => controller.getDeltaSync(req, res), res, queries };
}

function assertBoundedInclusiveRange(range, lowerIso, upperIso) {
  assert.ok(range?.$gte instanceof Date, 'lower bound must be Date');
  assert.ok(range?.$lte instanceof Date, 'upper bound must be Date');
  assert.equal(range.$gte.toISOString(), lowerIso);
  assert.equal(range.$lte.toISOString(), upperIso);
}

test('todo delta captures request-start boundary before async reads and uses an inclusive bounded window', async () => {
  const lower = '2026-09-28T06:00:00.000Z';
  const start = '2026-09-28T06:00:00.100Z';
  const late = '2026-09-28T06:00:00.900Z';
  const h = todoControllerHarness({ startIso: start, lateIso: late, lastSyncTime: lower });
  await h.run();
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body.syncTime, start);
  assertBoundedInclusiveRange(h.queries[0].updatedAt, lower, start);
  assertBoundedInclusiveRange(h.queries[1].deletedAt, lower, start);
});

test('completion delta captures request-start boundary before async reads and uses an inclusive bounded window', async () => {
  const lower = '2026-09-28T06:00:00.000Z';
  const start = '2026-09-28T06:00:00.100Z';
  const late = '2026-09-28T06:00:00.900Z';
  const h = completionControllerHarness({ startIso: start, lateIso: late, lastSyncTime: lower });
  await h.run();
  assert.equal(h.res.statusCode, 200);
  assert.equal(h.res.body.syncTime, start);
  assertBoundedInclusiveRange(h.queries[0].updatedAt, lower, start);
  assertBoundedInclusiveRange(h.queries[1].deletedAt, lower, start);
});

test('inclusive lower bound replays same-millisecond writes rather than dropping the cursor boundary', async () => {
  const boundary = '2026-09-28T06:00:00.100Z';
  const h = todoControllerHarness({ startIso: '2026-09-28T06:00:00.200Z', lateIso: '2026-09-28T06:00:00.900Z', lastSyncTime: boundary });
  await h.run();
  assert.equal(h.queries[0].updatedAt.$gte.toISOString(), boundary);
  assert.equal(h.queries[1].deletedAt.$gte.toISOString(), boundary);
});

test('server clock rollback never moves the todo cursor behind the supplied cursor', async () => {
  const cursor = '2026-09-28T06:00:00.500Z';
  const h = todoControllerHarness({ startIso: '2026-09-28T06:00:00.100Z', lateIso: '2026-09-28T06:00:00.200Z', lastSyncTime: cursor });
  await h.run();
  assert.equal(h.res.body.syncTime, cursor);
  assertBoundedInclusiveRange(h.queries[0].updatedAt, cursor, cursor);
});

test('todo delta rejects an invalid cursor before querying Mongo', async () => {
  const h = todoControllerHarness({ startIso: '2026-09-28T06:00:00.100Z', lateIso: '2026-09-28T06:00:00.900Z', lastSyncTime: 'not-a-date' });
  await h.run();
  assert.equal(h.res.statusCode, 400);
  assert.equal(h.queries.length, 0);
});

function clientDeltaHarness(todoSyncTime, completionSyncTime) {
  const transaction = { tag: 'tx' };
  const mod = loadClientModule('src/services/sync/deltaPull.js', {
    '../../api/todos': {
      todoAPI: { getDeltaSync: async () => ({ data: { updated: [], deleted: [], syncTime: todoSyncTime } }) },
      completionAPI: { getDeltaSync: async () => ({ data: { updated: [], deleted: [], syncTime: completionSyncTime } }) },
    },
    '../../api/categories': { getCategories: async () => [] },
    '../db/database': { ensureDatabase: async () => {}, withWriteTransaction: async task => task(transaction) },
    '../db/pendingService': { getPendingChanges: async () => [] },
    '../db/categoryService': { getAllCategories: async () => [], upsertCategories: async () => {}, deleteCategory: async () => {} },
    '../db/todoService': { upsertTodos: async () => {}, deleteTodos: async () => {} },
    '../db/completionService': { upsertCompletions: async () => {}, deleteCompletionsByKeys: async () => {} },
  });
  return mod.runDeltaPull({ cursor: '2026-09-28T05:59:59.000Z' });
}

test('client commits the earliest endpoint watermark so sequential requests cannot skip the gap between endpoints', async () => {
  const early = '2026-09-28T06:00:00.100Z';
  const late = '2026-09-28T06:00:00.900Z';
  const forward = await clientDeltaHarness(early, late);
  const reverse = await clientDeltaHarness(late, early);
  assert.equal(forward.ok, true);
  assert.equal(reverse.ok, true);
  assert.equal(forward.serverSyncTime, early);
  assert.equal(reverse.serverSyncTime, early);
});
