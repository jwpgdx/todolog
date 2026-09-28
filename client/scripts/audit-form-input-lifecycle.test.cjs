const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function sourceModule(relativePath, mocks, jsxRuntime = null) {
  const filename = path.join(root, relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [
      [require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  });
  const module = { exports: {} };
  const mockedRequire = (name) => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    if (name === 'dayjs') return require('dayjs');
    if (name === 'react/jsx-runtime' && jsxRuntime) return jsxRuntime;
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
      return [slots[i], (value) => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
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

function findNodes(node, type, found = []) {
  if (!node || typeof node !== 'object') return found;
  if (node.type === type) found.push(node);
  const children = node.props?.children;
  if (Array.isArray(children)) children.forEach(child => findNodes(child, type, found));
  else findNodes(children, type, found);
  return found;
}

test('DetailedForm forwards title and memo input immediately without delayed timers', () => {
  const hooks = hookHarness();
  const jsx = (type, props) => ({ type, props: props || {} });
  const dropdown = function Dropdown() {};
  dropdown.Item = 'DropdownItem';
  dropdown.Separator = 'DropdownSeparator';
  const changes = [];
  const scheduled = [];
  const oldSetTimeout = global.setTimeout;
  const oldClearTimeout = global.clearTimeout;
  global.setTimeout = (fn) => { scheduled.push(fn); return scheduled.length; };
  global.clearTimeout = () => {};
  try {
    const mod = sourceModule('src/features/todo/form/components/DetailedForm.js', {
      react: { __esModule: true, default: hooks.react, ...hooks.react },
      'react-native': {
        ScrollView: 'ScrollView', View: 'View', Text: 'Text', TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput',
        LayoutAnimation: { configureNext() {}, Presets: { easeInEaseOut: {} } },
      },
      '../../../../components/ui/bottom-sheet': { BottomSheetInput: 'BottomSheetInput' },
      '../../../../components/ui/BaseInput': { __esModule: true, default: 'BaseInput' },
      '../../../../components/ui/ListRow': { __esModule: true, default: 'ListRow' },
      '../../../../components/ui/Dropdown': { __esModule: true, default: dropdown },
      '../../../../components/ui/Switch': { __esModule: true, default: 'Switch' },
      './DateTimeSection': { __esModule: true, default: 'DateTimeSection' },
      './RecurrenceOptions': { __esModule: true, default: 'RecurrenceOptions' },
      '../../../../components/domain/category/CategoryForm': { __esModule: true, default: 'CategoryForm' },
      '../../../../components/domain/category/CategoryColorList': { __esModule: true, default: 'CategoryColorList' },
      '@expo/vector-icons': { Ionicons: 'Ionicons' },
      '../../../../store/authStore': { useAuthStore: () => ({ user: null }) },
      '../../../../hooks/queries/useSettings': { useSettings: () => ({ data: {} }), useUpdateSetting: () => ({ mutate() {} }) },
    }, { jsx, jsxs: jsx, Fragment: 'Fragment' });

    const formState = {
      title: 'Old title', memo: 'Old memo', categoryId: 'category-a', isAllDay: true,
      startDate: '2026-09-28', endDate: '2026-09-28', startTime: null, endTime: null,
      frequency: 'none', weekdays: [], dayOfMonth: [1], yearlyDate: null, recurrenceEndDate: null,
    };
    const tree = hooks.render(() => mod.default({
      formState,
      handleChange: (key, value) => changes.push([key, value]),
      categories: [{ _id: 'category-a', name: 'A', color: '#000' }],
    }));
    const inputs = findNodes(tree, 'BaseInput');
    assert.equal(inputs.length, 2);
    inputs[0].props.onChangeText('Fast title');
    inputs[1].props.onChangeText('Fast memo');
    assert.deepEqual(changes, [['title', 'Fast title'], ['memo', 'Fast memo']]);
    assert.equal(scheduled.length, 0, 'text input must not leave delayed writes that can fire after close/reopen');
  } finally {
    global.setTimeout = oldSetTimeout;
    global.clearTimeout = oldClearTimeout;
  }
});

function formHarness(todo) {
  const hooks = hookHarness();
  const payloads = [];
  const user = { settings: { timeZone: 'Asia/Seoul', defaultIsAllDay: true } };
  const mod = sourceModule('src/features/todo/form/useTodoFormLogic.js', {
    react: { __esModule: true, default: hooks.react, ...hooks.react },
    '../../../store/dateStore': { useDateStore: () => ({ currentDate: '2026-09-28' }) },
    '../../../store/authStore': { useAuthStore: () => ({ user }) },
    '../../../hooks/queries/useSettings': { useSettings: () => ({ data: user.settings }), useUpdateSetting: () => ({ mutate() {} }) },
    '../../../hooks/queries/useCreateTodo': { useCreateTodo: () => ({ mutate: data => payloads.push(data) }) },
    '../../../hooks/queries/useUpdateTodo': { useUpdateTodo: () => ({ mutate: data => payloads.push(data.data) }) },
    '../../../hooks/queries/useCategories': { useCategories: () => ({ data: [{ _id: 'category-a' }] }) },
    '../../../hooks/queries/useCreateCategory': { useCreateCategory: () => ({ mutate() {} }) },
    'react-native-toast-message': { show() {} },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    '../../../constants/categoryColors': { DEFAULT_COLOR: '#808080' },
    '../../../utils/timeZoneDate': {
      getCurrentTimeInTimeZone: () => '10:20',
      getCurrentDateInTimeZone: () => '2026-09-28',
      addDaysToYmd: (value, days) => require('dayjs')(value).add(days, 'day').format('YYYY-MM-DD'),
    },
  }, { jsx: () => null, jsxs: () => null, Fragment: 'Fragment' });
  const render = () => hooks.render(() => mod.useTodoFormLogic(todo, () => {}, true));
  render();
  return { render, payloads };
}

test('handleSubmit consumes the latest text change even before a rerender', () => {
  const todo = {
    _id: 'todo-a', title: 'Old title', memo: 'Old memo', categoryId: 'category-a', isAllDay: true,
    startDate: '2026-09-28', endDate: '2026-09-28', startTime: null, endTime: null,
  };
  const { render, payloads } = formHarness(todo);
  const logic = render();
  logic.handleChange('title', 'Fast title');
  logic.handleChange('memo', 'Fast memo');
  logic.handleSubmit();
  assert.equal(payloads.length, 1);
  assert.equal(payloads[0].title, 'Fast title');
  assert.equal(payloads[0].memo, 'Fast memo');
});
