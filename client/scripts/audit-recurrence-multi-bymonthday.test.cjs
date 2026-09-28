const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function sourceModule(relativePath, mocks = {}) {
  const filename = path.join(root, relativePath);
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

const engine = sourceModule('src/utils/recurrenceEngine.js');

test('RRULE monthly BYMONTHDAY list normalizes as every authored positive day', () => {
  const rule = engine.normalizeRecurrence(
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15,31',
    null,
    { startDate: '2026-01-01' }
  );
  assert.equal(rule.isValid, true);
  assert.deepEqual(rule.byMonthDay, [1, 15, 31]);
});

test('monthly multi-day recurrence occurs on each listed day and not unlisted days', () => {
  const rule = engine.normalizeRecurrence(
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15',
    null,
    { startDate: '2026-01-01' }
  );
  assert.equal(engine.occursOnDateNormalized(rule, '2026-02-01'), true);
  assert.equal(engine.occursOnDateNormalized(rule, '2026-02-15'), true);
  assert.equal(engine.occursOnDateNormalized(rule, '2026-02-14'), false);
});

test('monthly multi-day expansion skips impossible short-month days without remapping', () => {
  const rule = engine.normalizeRecurrence(
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=15,31',
    null,
    { startDate: '2026-01-01' }
  );
  assert.deepEqual(
    engine.expandOccurrencesInRange(rule, '2026-02-01', '2026-03-31'),
    ['2026-02-15', '2026-03-15', '2026-03-31']
  );
});

test('JSON recurrence dayOfMonth arrays normalize to the same monthly contract', () => {
  const rule = engine.normalizeRecurrence(
    { frequency: 'monthly', dayOfMonth: [5, 20] },
    null,
    { startDate: '2026-01-05' }
  );
  assert.equal(rule.isValid, true);
  assert.deepEqual(rule.byMonthDay, [5, 20]);
  assert.equal(engine.occursOnDateNormalized(rule, '2026-04-20'), true);
});

test('single BYMONTHDAY remains compatible while using the normalized list shape', () => {
  const rule = engine.normalizeRecurrence(
    'RRULE:FREQ=MONTHLY;BYMONTHDAY=12',
    null,
    { startDate: '2026-01-12' }
  );
  assert.deepEqual(rule.byMonthDay, [12]);
  assert.equal(engine.occursOnDateNormalized(rule, '2026-02-12'), true);
  assert.equal(engine.occursOnDateNormalized(rule, '2026-02-13'), false);
});

test('yearly single BYMONTHDAY remains compatible with the normalized list shape', () => {
  const rule = engine.normalizeRecurrence(
    'RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29',
    null,
    { startDate: '2024-02-29' }
  );
  assert.deepEqual(rule.byMonthDay, [29]);
  assert.equal(engine.occursOnDateNormalized(rule, '2028-02-29'), true);
  assert.equal(engine.occursOnDateNormalized(rule, '2027-02-28'), false);
});

test('active occurrence decision path includes a todo on the second authored monthly day', () => {
  const decision = sourceModule('src/services/query-aggregation/occurrenceDecisionService.js', {
    '../../utils/recurrenceEngine': engine,
  });
  const todo = {
    _id: 'todo-multi-monthday',
    startDate: '2026-01-01',
    endDate: '2026-01-01',
    recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15'],
    recurrenceEndDate: null,
  };
  const result = decision.decideForDate({ todos: [todo] }, '2026-04-15');
  assert.equal(result.ok, true);
  assert.deepEqual(result.passedTodoIds, ['todo-multi-monthday']);
  assert.equal(result.reasonsByTodoId['todo-multi-monthday'], 'recurrence');
});
