const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function sourceModule(relativePath, mocks) {
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
    if (name === 'dayjs') return require('dayjs');
    throw new Error(`Unmocked import ${name} in ${relativePath}`);
  };
  new Function('require', 'module', 'exports', 'console', code)(mockedRequire, module, module.exports, quiet);
  return module.exports;
}

function hookHarness() {
  const slots = [];
  let cursor = 0;
  let effects = [];
  const same = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = { current: initial };
      return slots[i];
    },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: factory(), deps };
      return slots[i].value;
    },
    useCallback(fn, deps) { return react.useMemo(() => fn, deps); },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        const previous = slots[i];
        slots[i] = { deps };
        effects.push(() => { previous?.cleanup?.(); slots[i].cleanup = effect(); });
      }
    },
  };
  return {
    react,
    render(fn) {
      cursor = 0;
      const value = fn();
      const pending = effects;
      effects = [];
      pending.forEach(effect => effect());
      return value;
    },
  };
}

function formHarness(todo) {
  const hooks = hookHarness();
  const payloads = [];
  const toasts = [];
  const user = { settings: { timeZone: 'Asia/Seoul', defaultIsAllDay: true } };
  const mod = sourceModule('src/features/todo/form/useTodoFormLogic.js', {
    react: hooks.react,
    '../../../store/dateStore': { useDateStore: () => ({ currentDate: '2026-09-28' }) },
    '../../../store/authStore': { useAuthStore: () => ({ user }) },
    '../../../hooks/queries/useSettings': { useSettings: () => ({ data: user.settings }), useUpdateSetting: () => ({ mutate() {} }) },
    '../../../hooks/queries/useCreateTodo': { useCreateTodo: () => ({ mutate: (data) => payloads.push(data) }) },
    '../../../hooks/queries/useUpdateTodo': { useUpdateTodo: () => ({ mutate: ({ data }) => payloads.push(data) }) },
    '../../../hooks/queries/useCategories': { useCategories: () => ({ data: [{ _id: 'category-a' }] }) },
    '../../../hooks/queries/useCreateCategory': { useCreateCategory: () => ({ mutate() {} }) },
    'react-native-toast-message': { show: value => toasts.push(value) },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    '../../../constants/categoryColors': { DEFAULT_COLOR: '#808080' },
    '../../../utils/timeZoneDate': {
      getCurrentTimeInTimeZone: () => '10:20',
      getCurrentDateInTimeZone: () => '2026-09-28',
      addDaysToYmd: (value, days) => require('dayjs')(value).add(days, 'day').format('YYYY-MM-DD'),
    },
  });
  const render = () => hooks.render(() => mod.useTodoFormLogic(todo, () => {}, true));
  render();
  return { render, payloads, toasts };
}

const base = {
  _id: 'todo-a',
  title: 'Existing',
  memo: '',
  categoryId: 'category-a',
  isAllDay: true,
  startDate: '2026-09-28',
  endDate: '2026-09-28',
  startTime: null,
  endTime: null,
  recurrence: null,
  recurrenceEndDate: null,
};

test('editing a legacy nullable-date todo does not silently replace null with today and blocks save until repaired', () => {
  const { render, payloads, toasts } = formHarness({ ...base, startDate: null, endDate: null });
  const logic = render();
  assert.equal(logic.formState.startDate, null);
  assert.equal(logic.formState.endDate, null);
  assert.equal(logic.quickModeLabels.dateLabel, '날짜 선택');
  logic.handleChange('title', 'Rename only');
  logic.handleSubmit();
  assert.equal(payloads.length, 0);
  assert.match(toasts.at(-1)?.text1 || '', /시작 날짜/);
});

test('nullable endDate stays null on a title-only edit', () => {
  const { render } = formHarness({ ...base, endDate: null });
  const logic = render();
  assert.equal(logic.formState.endDate, null);
  logic.handleChange('title', 'Rename only');
  const payload = logic.buildPayload();
  assert.equal(payload.endDate, null);
});

test('title-only edit preserves a richer RRULE byte-for-byte instead of simplifying it', () => {
  const rich = 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;WKST=SU;COUNT=7';
  const { render, payloads } = formHarness({ ...base, recurrence: [rich] });
  const logic = render();
  logic.handleChange('title', 'Rename only');
  logic.handleSubmit();
  assert.equal(payloads.length, 1);
  assert.deepEqual(payloads[0].recurrence, [rich]);
  assert.equal(payloads[0].recurrenceEndDate, null);
});

test('embedded RRULE UNTIL is visible in the form but title-only save preserves the original recurrence contract', () => {
  const raw = 'RRULE:FREQ=DAILY;INTERVAL=3;UNTIL=20261231T235959Z';
  const { render, payloads } = formHarness({ ...base, recurrence: [raw], recurrenceEndDate: null });
  const logic = render();
  assert.equal(logic.formState.recurrenceEndDate, '2026-12-31');
  logic.handleChange('memo', 'memo edit');
  logic.handleSubmit();
  assert.deepEqual(payloads[0].recurrence, [raw]);
  assert.equal(payloads[0].recurrenceEndDate, null);
});

test('changing recurrence controls intentionally rebuilds the supported canonical subset', () => {
  const rich = 'RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=MO,WE;WKST=SU';
  const { render } = formHarness({ ...base, recurrence: [rich] });
  const logic = render();
  logic.handleChange('weekdays', [2, 4]);
  const payload = logic.buildPayload();
  assert.deepEqual(payload.recurrence, ['RRULE:FREQ=WEEKLY;BYDAY=TU,TH']);
});
