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

const recurrenceUtils = sourceModule('src/utils/recurrenceUtils.js');
const recurrenceEngine = sourceModule('src/utils/recurrenceEngine.js');

test('monthly multi-BYMONTHDAY description lists every authored day', () => {
  assert.equal(
    recurrenceUtils.getRecurrenceDescription('RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15,31'),
    '매월 1일, 15일, 31일'
  );
});

test('description accepts persisted recurrence arrays and uses the first non-empty rule', () => {
  assert.equal(
    recurrenceUtils.getRecurrenceDescription(['', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=5,20']),
    '매월 5일, 20일'
  );
  assert.equal(
    recurrenceUtils.getRecurrenceDescription(['RRULE:FREQ=WEEKLY;BYDAY=MO,WE']),
    '매주 월, 수요일'
  );
});

test('empty or malformed recurrence description fails soft without throwing', () => {
  assert.equal(recurrenceUtils.getRecurrenceDescription([]), '반복 없음');
  assert.equal(recurrenceUtils.getRecurrenceDescription(['not-an-rrule']), '반복 규칙 오류');
  assert.equal(recurrenceUtils.getRecurrenceDescription({ bad: true }), '반복 규칙 오류');
});

test('single monthly and yearly descriptions remain unchanged', () => {
  assert.equal(
    recurrenceUtils.getRecurrenceDescription('RRULE:FREQ=MONTHLY;BYMONTHDAY=12'),
    '매월 12일'
  );
  assert.equal(
    recurrenceUtils.getRecurrenceDescription('RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29'),
    '매년 2월 29일'
  );
});

test('active managed todo adapter renders persisted recurrence arrays without crashing', () => {
  const adapter = sourceModule('src/features/todo/native/managedTodoItemAdapter.js', {
    '../../../utils/recurrenceUtils': recurrenceUtils,
    '../../../utils/recurrenceEngine': recurrenceEngine,
  });
  const item = adapter.buildManagedTodoItem({
    _id: 'todo-a',
    title: 'Multi monthly',
    isAllDay: true,
    startDate: '2026-01-01',
    recurrence: ['RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15'],
  });
  const recurrenceLabel = item.subLabels.find(label => label.id === 'recurrence');
  assert.equal(recurrenceLabel?.text, '매월 1일, 15일');
});
