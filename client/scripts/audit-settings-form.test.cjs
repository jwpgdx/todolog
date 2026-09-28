// Source-executing Node regression harness. Native services and React scheduling
// are mocked; this is not an iOS/Android UI or real AsyncStorage/SQLite test.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function sourceModule(relativePath, mocks) {
  const filename = path.join(root, relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename, babelrc: false, configFile: false,
    plugins: [
      [require.resolve('@babel/plugin-transform-react-jsx'), { runtime: 'automatic' }],
      require.resolve('@babel/plugin-transform-modules-commonjs'),
    ],
  });
  const module = { exports: {} };
  const mockedRequire = name => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    if (name === 'dayjs') return require('dayjs');
    if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
    throw new Error(`Unmocked import ${name} in ${relativePath}`);
  };
  new Function('require', 'module', 'exports', 'console', code)(mockedRequire, module, module.exports, quiet);
  return module.exports;
}

function hookHarness() {
  const slots = [];
  let cursor = 0, effects = [];
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
    render(fn) { cursor = 0; const value = fn(); const pending = effects; effects = []; pending.forEach(effect => effect()); return value; },
  };
}

function storeHook(initial) {
  let state = initial;
  const hook = selector => selector ? selector(state) : state;
  hook.getState = () => state;
  hook.setState = value => { state = { ...state, ...(typeof value === 'function' ? value(state) : value) }; };
  return hook;
}

function authHarness({ signedIn = false, patch = async () => ({ data: { settings: {} } }), post, storageWrite } = {}) {
  const data = new Map();
  let useStore;
  const storage = {
    getItem: async key => data.get(key) ?? null,
    removeItem: async key => { data.delete(key); },
    setItem: async (key, value) => { if (storageWrite) await storageWrite(key, value); data.set(key, value); },
  };
  const exports = sourceModule('src/store/authStore.js', {
    zustand: { create: initializer => { useStore = storeHook({}); useStore.setState(initializer(useStore.setState, useStore.getState)); return useStore; } },
    '@react-native-async-storage/async-storage': storage,
    'expo-localization': { getCalendars: () => [{ timeZone: 'Asia/Seoul' }] },
    '../api/axios': { __esModule: true, default: { patch, post }, setLogoutHandler() {} },
    '../api/auth': { authAPI: {} },
    '../services/db/database': { clearAllData: async () => {} },
    '../services/db/todoService': {},
    '../services/db/categoryService': { ensureInboxCategory: async () => {} },
    '../services/db/completionService': {},
  });
  useStore.setState({
    user: { _id: signedIn ? 'account-a' : 'guest_local', accountType: signedIn ? 'regular' : 'anonymous', settings: { timeZone: 'Asia/Seoul', theme: 'system', language: 'system' } },
    token: signedIn ? 'token-a' : null, isLoggedIn: signedIn, isLoading: false,
  });
  return { store: exports.useAuthStore, data };
}

test('concurrent local setting writes preserve both keys', async () => {
  const { store, data } = authHarness();
  await Promise.all([
    store.getState().updateSettings('timeZoneAuto', false),
    store.getState().updateSettings('timeZone', 'America/New_York'),
  ]);
  assert.equal(store.getState().user.settings.timeZoneAuto, false);
  assert.equal(store.getState().user.settings.timeZone, 'America/New_York');
  assert.deepEqual(JSON.parse(data.get('user')).settings, store.getState().user.settings);
});

test('server settings snapshot cannot overwrite local choices', async () => {
  const { store, data } = authHarness({ signedIn: true, patch: async () => ({ data: { settings: { timeZone: 'Asia/Seoul', theme: 'dark' } } }) });
  await store.getState().updateSettings('timeZone', 'America/New_York');
  await tick();
  assert.equal(store.getState().user.settings.timeZone, 'America/New_York');
  assert.equal(store.getState().user.settings.theme, 'system');
  assert.equal(JSON.parse(data.get('user')).settings.timeZone, 'America/New_York');
});

test('local setting persistence failure preserves state and does not send', async () => {
  let sends = 0;
  const { store } = authHarness({ signedIn: true, patch: async () => { sends++; }, storageWrite: async () => { throw new Error('disk-full'); } });
  await assert.rejects(store.getState().updateSettings('theme', 'dark'), /disk-full/);
  assert.equal(store.getState().user.settings.theme, 'system');
  assert.equal(sends, 0);
});

test('network failure leaves committed settings intact', async () => {
  const { store } = authHarness({ signedIn: true, patch: async () => { throw new Error('offline'); } });
  await store.getState().updateSettings('theme', 'dark');
  await tick();
  assert.equal(store.getState().user.settings.theme, 'dark');
});

test('late setting response cannot write into a replacement account', async () => {
  const response = deferred();
  const { store, data } = authHarness({ signedIn: true, patch: () => response.promise });
  const update = store.getState().updateSettings('theme', 'dark');
  await tick();
  await store.getState().setAuth('token-b', { _id: 'account-b', settings: { theme: 'dark', timeZone: 'UTC' } });
  response.resolve({ data: { settings: { theme: 'dark', timeZone: 'Asia/Seoul' } } });
  await update;
  await tick();
  assert.equal(store.getState().user._id, 'account-b');
  assert.equal(store.getState().user.settings.timeZone, 'UTC');
  assert.equal(JSON.parse(data.get('user')).settings.timeZone, 'UTC');
});

test('timezone change uses local settings and sends no guest-only endpoint', async () => {
  const hooks = hookHarness();
  let calls = 0;
  const store = storeHook({ user: { _id: 'guest_local', settings: { timeZone: 'Asia/Seoul', timeZoneAuto: false } } });
  store.setState({ updateSettings: async (key, value) => {
    const user = { ...store.getState().user, settings: { ...store.getState().user.settings, [key]: value } };
    store.setState({ user });
    return user;
  } });
  const module = sourceModule('src/hooks/useTimeZone.js', {
    react: hooks.react,
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    '@tanstack/react-query': {
      useQueryClient: () => ({ invalidateQueries() {} }),
      useMutation: config => ({ isPending: false, mutateAsync: async value => {
        try { const result = await config.mutationFn(value); config.onSuccess?.(result, value); return result; }
        catch (error) { config.onError?.(error); throw error; }
      } }),
    },
    'react-native-toast-message': { show() {} },
    'expo-localization': { getCalendars: () => [{ timeZone: 'Asia/Seoul' }] },
    '../api/axios': { post: async () => { calls++; return { data: { timeZone: 'America/New_York' } }; } },
    '../store/authStore': { useAuthStore: store },
    './queries/useSettings': { useSettings: () => ({ data: store.getState().user.settings }), useUpdateSetting: () => ({ mutate() {} }) },
  });
  const hook = hooks.render(() => module.useTimeZone());
  await hook.updateTimeZone('America/New_York', { silent: true });
  assert.equal(store.getState().user.settings.timeZone, 'America/New_York');
  assert.equal(calls, 0);
});

function formHarness(todo, draft = null, settings = {}) {
  const hooks = hookHarness();
  const payloads = [];
  const user = { settings: { timeZone: 'Asia/Seoul', defaultIsAllDay: true, ...settings } };
  const exports = sourceModule('src/features/todo/form/useTodoFormLogic.js', {
    react: hooks.react,
    '../../../store/dateStore': { useDateStore: () => ({ currentDate: '2026-09-28' }) },
    '../../../store/authStore': { useAuthStore: () => ({ user }) },
    '../../../hooks/queries/useSettings': { useSettings: () => ({ data: user.settings }), useUpdateSetting: () => ({ mutate() {} }) },
    '../../../hooks/queries/useCreateTodo': { useCreateTodo: () => ({ mutate: data => payloads.push(data) }) },
    '../../../hooks/queries/useUpdateTodo': { useUpdateTodo: () => ({ mutate: data => payloads.push(data.data) }) },
    '../../../hooks/queries/useCategories': { useCategories: () => ({ data: [] }) },
    '../../../hooks/queries/useCreateCategory': { useCreateCategory: () => ({}) },
    'react-native-toast-message': { show() {} },
    '@react-native-async-storage/async-storage': { getItem: async () => null, setItem: async () => {} },
    '../../../constants/categoryColors': { DEFAULT_COLOR: '#808080' },
    '../../../utils/timeZoneDate': {
      getCurrentTimeInTimeZone: () => '23:20', getCurrentDateInTimeZone: () => '2026-09-28',
      addDaysToYmd: (value, days) => require('dayjs')(value).add(days, 'day').format('YYYY-MM-DD'),
    },
  });
  const render = () => hooks.render(() => exports.useTodoFormLogic(todo, () => {}, true, draft));
  render();
  return { render, payloads };
}
const timed = { _id: 'todo-a', title: 'Keep time', categoryId: 'category-a', isAllDay: false, startDate: '2026-09-28', endDate: '2026-09-28', startTime: '09:15', endTime: '10:45' };

test('editing canonical todo preserves saved floating times', () => {
  const { render } = formHarness(timed);
  const logic = render();
  assert.equal(logic.formState.startTime, '09:15');
  assert.equal(logic.formState.endTime, '10:45');
  assert.equal(logic.buildPayload().startTime, '09:15');
});

test('all-day payload explicitly clears both times and omits timezone metadata', () => {
  const { render } = formHarness(timed);
  render().handleChange('isAllDay', true);
  const payload = render().buildPayload();
  assert.equal(payload.startTime, null);
  assert.equal(payload.endTime, null);
  for (const key of ['date', 'timeZone', 'userTimeZone', 'startDateTime', 'endDateTime']) assert.equal(key in payload, false, key);
});

test('quick submit explicitly clears old timed values', () => {
  const { render, payloads } = formHarness(timed);
  render().handleSubmit({ quickMode: true });
  assert.equal(payloads[0].isAllDay, true);
  assert.equal(payloads[0].startTime, null);
  assert.equal(payloads[0].endTime, null);
});

test('end time later within the same hour stays on the same date', () => {
  const { render } = formHarness(timed);
  render().handleChange('startTime', '09:15');
  render().handleChange('endTime', '09:45');
  assert.equal(render().formState.endDate, '2026-09-28');
});

test('repeated late-night start edits do not keep adding days', () => {
  const { render } = formHarness(timed);
  render().handleChange('startTime', '23:10');
  render().handleChange('startTime', '23:20');
  assert.equal(render().formState.endDate, '2026-09-29');
  assert.equal(render().formState.endTime, '00:20');
});

test('late-night start edits preserve an explicit longer date range', () => {
  const { render } = formHarness({ ...timed, endDate: '2026-10-03' });
  render().handleChange('startTime', '23:10');
  assert.equal(render().formState.endDate, '2026-10-03');
});

test('timed create default at 23h ends on the next date', () => {
  const { render } = formHarness(null, null, { defaultIsAllDay: false });
  assert.equal(render().formState.endDate, '2026-09-29');
});

test('canonical recurrence end date and nullable end time survive edit', () => {
  const { render } = formHarness({ ...timed, endTime: null, recurrence: ['RRULE:FREQ=WEEKLY;BYDAY=MO,WE'], recurrenceEndDate: '2026-10-31' });
  const payload = render().buildPayload();
  assert.equal(payload.endTime, null);
  assert.equal(payload.recurrenceEndDate, '2026-10-31');
  assert.match(payload.recurrence[0], /BYDAY=MO,WE/);
});

test('quick-to-detail handoff preserves edits when activeTodo is also present', () => {
  const { render } = formHarness(timed, { ...timed, title: 'Unsaved quick edit', startTime: '13:20' });
  assert.equal(render().formState.title, 'Unsaved quick edit');
  assert.equal(render().formState.startTime, '13:20');
});

test('local completion does not wait for a remote response and remote patches stay ordered', async () => {
  const first = deferred();
  const requests = [];
  const { store } = authHarness({ signedIn: true, patch: (url, data, config) => {
    requests.push({ data, config });
    return requests.length === 1 ? first.promise : Promise.resolve({ data: { settings: {} } });
  } });
  let locallyDone = false;
  const update = store.getState().updateSettings('theme', 'dark').then(() => { locallyDone = true; });
  await tick();
  assert.equal(locallyDone, true);
  await store.getState().updateSettings('theme', 'light');
  assert.equal(requests.length, 1);
  assert.equal(store.getState().user.settings.theme, 'light');
  first.resolve({ data: { settings: { theme: 'dark' } } });
  await update;
  await tick();
  assert.deepEqual(requests.map(request => request.data.theme), ['dark', 'light']);
  assert.equal(requests[1].config.headers.Authorization, 'Bearer token-a');
  assert.equal(requests[1].config.skipAuthRecovery, true);
});

test('failed local write does not poison later settings writes', async () => {
  let fail = true;
  const { store } = authHarness({ storageWrite: async () => { if (fail) throw new Error('disk-full'); } });
  await assert.rejects(store.getState().updateSettings('theme', 'dark'), /disk-full/);
  fail = false;
  await store.getState().updateSettings('language', 'ko');
  assert.equal(store.getState().user.settings.theme, 'system');
  assert.equal(store.getState().user.settings.language, 'ko');
});

test('auth transition drains an in-flight storage write before replacing the user record', async () => {
  const gate = deferred();
  let writes = 0;
  const { store, data } = authHarness({ storageWrite: async key => { if (key === 'user' && ++writes === 1) await gate.promise; } });
  const update = store.getState().updateSettings('theme', 'dark');
  await tick();
  const replacement = store.getState().setAuth('token-b', { _id: 'account-b', settings: { theme: 'light', timeZone: 'UTC' } });
  gate.resolve();
  await Promise.all([update, replacement]);
  assert.equal(store.getState().user._id, 'account-b');
  assert.deepEqual(JSON.parse(data.get('user')).settings, { theme: 'light', timeZone: 'UTC' });
});

test('queued remote settings are discarded after an auth transition', async () => {
  const response = deferred();
  let requests = 0;
  const { store } = authHarness({ signedIn: true, patch: () => { requests++; return response.promise; } });
  await store.getState().updateSettings('theme', 'dark');
  await tick();
  await store.getState().updateSettings('language', 'ko');
  await store.getState().setAuth('token-b', { _id: 'account-b', settings: { timeZone: 'UTC' } });
  response.resolve({ data: { settings: {} } });
  await tick();
  assert.equal(requests, 1);
});

test('axios preserves the bound settings bearer and rejects a late 401 without logout', async () => {
  let requestInterceptor, responseErrorInterceptor, logouts = 0;
  const module = sourceModule('src/api/axios.js', {
    axios: { create: () => ({ interceptors: {
      request: { use: handler => { requestInterceptor = handler; } },
      response: { use: (handler, onError) => { responseErrorInterceptor = onError; } },
    } }) },
    '@react-native-async-storage/async-storage': { getItem: async () => 'token-b' },
    'react-native': { Platform: { OS: 'android' } },
  });
  module.setLogoutHandler(() => { logouts++; });
  const config = await requestInterceptor({ headers: { Authorization: 'Bearer token-a' }, skipAuthRecovery: true });
  assert.equal(config.headers.Authorization, 'Bearer token-a');
  await assert.rejects(responseErrorInterceptor({ config, response: { status: 401 } }));
  assert.equal(logouts, 0);
});

test('auto timezone observer handles startup, foreground, dedupe, and auto-off', async () => {
  const hooks = hookHarness();
  const listeners = [];
  let deviceZone = 'America/New_York', writes = 0;
  const store = storeHook({ user: { settings: { timeZone: 'Asia/Seoul', timeZoneAuto: true } } });
  store.setState({ updateSettings: async (key, value) => {
    writes++;
    const user = { settings: { ...store.getState().user.settings, [key]: value } };
    store.setState({ user });
    return user;
  } });
  const module = sourceModule('src/hooks/useTimeZone.js', {
    react: hooks.react,
    'react-native': { AppState: { addEventListener: (event, fn) => { listeners.push(fn); return { remove() {} }; } } },
    '@tanstack/react-query': { useQueryClient: () => ({ invalidateQueries() {} }), useMutation: config => ({ isPending: false, mutateAsync: async value => {
      const result = await config.mutationFn(value); config.onSuccess?.(result, value); return result;
    } }) },
    'react-native-toast-message': { show() {} },
    'expo-localization': { getCalendars: () => [{ timeZone: deviceZone }] },
    '../store/authStore': { useAuthStore: store },
    './queries/useSettings': { useSettings: () => ({ data: store.getState().user.settings }) },
  });
  hooks.render(() => module.useTimeZone({ autoDetect: true }));
  listeners[0]('active');
  assert.equal(writes, 1);
  await tick();
  assert.equal(store.getState().user.settings.timeZone, 'America/New_York');
  store.setState({ user: { settings: { timeZone: 'America/New_York', timeZoneAuto: false } } });
  deviceZone = 'UTC';
  listeners[0]('active');
  assert.equal(writes, 1);
  store.setState({ user: { settings: { timeZone: 'America/New_York', timeZoneAuto: true } } });
  listeners[0]('active');
  await tick();
  assert.equal(writes, 2);
  assert.equal(store.getState().user.settings.timeZone, 'UTC');
});

function rootHarness() {
  const hooks = hookHarness();
  const jsx = (type, props) => ({ type, props });
  let date = '2026-09-28', mode = 'CLOSED', draft = null, segments = ['(app)', '(tabs)'];
  const setCurrentDate = value => { date = value; };
  const store = storeHook({ user: { settings: { timeZone: 'Asia/Seoul' } }, isLoading: false, isLoggedIn: false, loadAuth() {} });
  const module = sourceModule('app/_layout.js', {
    react: hooks.react, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native-gesture-handler': { GestureHandlerRootView: 'GestureRoot' },
    '../global.css': {}, '../src/utils/i18n': { changeLanguage: async () => {} },
    'expo-localization': { getLocales: () => [{ languageCode: 'ko' }] },
    'react-native': { Platform: { OS: 'ios' }, Appearance: {}, View: 'View' },
    'expo-status-bar': { StatusBar: 'StatusBar' },
    '@tanstack/react-query': { QueryClient: class {}, QueryClientProvider: 'QueryProvider' },
    'react-native-safe-area-context': { SafeAreaProvider: 'SafeAreaProvider' },
    'react-native-toast-message': 'Toast', '@gorhom/bottom-sheet': { BottomSheetModalProvider: 'BottomSheetProvider' },
    '@expo/react-native-action-sheet': { ActionSheetProvider: 'ActionSheetProvider' },
    'react-native-keyboard-controller': { KeyboardProvider: 'KeyboardProvider' },
    nativewind: { useColorScheme: () => ({ setColorScheme() {} }) },
    'expo-router': { Slot: 'Slot', useRouter: () => ({ replace() {} }), useSegments: () => segments },
    '../src/store/authStore': { useAuthStore: store, setQueryClient() {} },
    '../src/store/dateStore': { useDateStore: () => ({ currentDate: date, setCurrentDate }) },
    '../src/store/todoFormStore': { useTodoFormStore: () => ({ mode }) },
    '../src/store/todoFormV2Store': { useTodoFormV2Store: selector => selector({ draft }) },
    '../src/hooks/useTimeZone': { useTimeZone: options => { assert.equal(options.autoDetect, true); } },
    '../src/config/toastConfig': { toastConfig: {} },
    '../src/features/todo/form/GlobalFormOverlay': 'GlobalFormOverlay',
    '../src/providers/SyncProvider': { SyncProvider: 'SyncProvider' },
    '../src/services/db/database': { ensureDatabase: () => new Promise(() => {}) },
    '../src/services/query-aggregation': {},
    '../src/utils/timeZoneDate': { getCurrentDateInTimeZone: zone => zone === 'America/New_York' ? '2026-09-27' : '2026-09-28' },
  });
  const render = () => hooks.render(() => module.default());
  render();
  return {
    render, date: () => date,
    zone: value => store.setState({ user: { settings: { timeZone: value } } }),
    selected: value => { date = value; },
    form: (nextMode, nextDraft = null, nextSegments = ['(app)', '(tabs)']) => { mode = nextMode; draft = nextDraft; segments = nextSegments; },
  };
}

test('root date realigns previous today but preserves a browsed date', () => {
  const today = rootHarness();
  today.zone('America/New_York'); today.render();
  assert.equal(today.date(), '2026-09-27');
  const browsing = rootHarness();
  browsing.selected('2026-08-01'); browsing.zone('America/New_York'); browsing.render();
  assert.equal(browsing.date(), '2026-08-01');
});

test('root timezone realignment waits for quick, detail route, and pending handoff to close', () => {
  for (const form of [['QUICK'], ['CLOSED', null, ['(app)', 'todo-form', 'v2']], ['CLOSED', { formState: {} }]]) {
    const root = rootHarness();
    root.form(...form); root.zone('America/New_York'); root.render();
    assert.equal(root.date(), '2026-09-28');
    root.form('CLOSED'); root.render();
    assert.equal(root.date(), '2026-09-27');
  }
});

test('DetailContent does not close before handleSubmit reports local success', () => {
  let save, submitted = 0, prematurelyClosed = 0;
  const jsx = (type, props) => { if (type === 'FormHeader') save = props.onSave; return null; };
  const module = sourceModule('src/features/todo/form/content/DetailContent.js', {
    react: {}, 'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', ScrollView: 'ScrollView' },
    'react-native-safe-area-context': { useSafeAreaInsets: () => ({ bottom: 0 }) },
    '../components/FormHeader': 'FormHeader', '../components/DetailedForm': 'DetailedForm',
  });
  module.default({ logic: { formState: { title: 'Title' }, viewMode: 'default', handleSubmit: () => { submitted++; } }, onSubmit: () => { prematurelyClosed++; } });
  save();
  assert.equal(submitted, 1);
  assert.equal(prematurelyClosed, 0);
});

test('switching an all-day todo to timed initializes nullable fields and midnight carry', () => {
  const { render } = formHarness({ ...timed, isAllDay: true, startTime: null, endTime: null });
  render().handleChange('isAllDay', false);
  assert.equal(render().formState.startTime, '23:00');
  assert.equal(render().formState.endTime, '00:00');
  assert.equal(render().formState.endDate, '2026-09-29');
});

test('profile response preserves settings committed while the request was in flight', async () => {
  const response = deferred();
  const { store, data } = authHarness({ signedIn: true, post: () => response.promise });
  const profile = store.getState().updateProfile({ name: 'New name' });
  await store.getState().updateSettings('timeZone', 'America/New_York');
  response.resolve({ data: { user: { _id: 'account-a', name: 'New name', settings: { timeZone: 'Asia/Seoul' } } } });
  await profile;
  assert.equal(store.getState().user.name, 'New name');
  assert.equal(store.getState().user.settings.timeZone, 'America/New_York');
  assert.equal(JSON.parse(data.get('user')).settings.timeZone, 'America/New_York');
});

test('logout and guest rehydration remain serialized with the user storage lane', async () => {
  const { store, data } = authHarness({ signedIn: true });
  await store.getState().updateSettings('theme', 'dark');
  await store.getState().logout({ skipDataClear: true });
  assert.equal(store.getState().user._id, 'guest_local');
  assert.equal(store.getState().isLoggedIn, false);
  assert.equal(data.has('token'), false);
  assert.equal(JSON.parse(data.get('user')).settings.theme, 'dark');
  await store.getState().loadAuth();
  assert.equal(store.getState().user._id, 'guest_local');
  await store.getState().updateSettings('language', 'ko');
  assert.equal(JSON.parse(data.get('user')).settings.language, 'ko');
});
