const { test, expect } = require('@playwright/test');

const REAL_API_BASE_URL = process.env.PW_REAL_API_BASE_URL;

function getTodayInSeoul() {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
  }).format(new Date());
}

async function registerFreshUser() {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const email = `e2e_completion_recovery_${stamp}@example.com`;
  const password = 'password123';
  const name = `E2E Completion Recovery ${stamp}`;

  const response = await fetch(`${REAL_API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      name,
      timeZone: 'Asia/Seoul',
    }),
  });

  if (!response.ok) {
    throw new Error(`register failed: ${response.status} ${await response.text()}`);
  }

  const payload = await response.json();
  return {
    email,
    password,
    token: payload.token,
    user: payload.user,
  };
}

async function loginViaUi(page, { email, password }) {
  await page.goto('/login');
  await page.getByPlaceholder('이메일').fill(email);
  await page.getByPlaceholder('비밀번호 (6자 이상)').fill(password);
  await page.getByText('로그인', { exact: true }).last().click();
  await expect(page.getByText(/홈|Home|캘린더|Calendar|My Page/i).first()).toBeVisible({ timeout: 30_000 });
}

async function openMyPage(page) {
  const myPageTab = page.getByText(/My Page/i).first();
  await expect(myPageTab).toBeVisible();
  await myPageTab.click();
  await expect(page.getByText('카테고리 추가').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Inbox', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function openHome(page) {
  const homeTab = page.getByText(/홈|Home/i).first();
  await expect(homeTab).toBeVisible();
  await homeTab.click();
  await expect(page.getByText(/Form Sheet Test|등록된 할 일이 없습니다|완료:/).first()).toBeVisible({ timeout: 15_000 });
}

async function ensureInboxCategorySelected(page) {
  const inboxLabel = page.getByText('Inbox', { exact: true }).last();
  if (await inboxLabel.isVisible().catch(() => false)) {
    return;
  }

  await page.getByText('선택', { exact: true }).last().click();
  await expect(page.getByText('Inbox', { exact: true }).last()).toBeVisible({ timeout: 15_000 });
  await page.getByText('Inbox', { exact: true }).last().click();
  await expect(page.getByText('Inbox', { exact: true }).last()).toBeVisible({ timeout: 15_000 });
}

async function openAddTodoDialog(page) {
  const addTab = page.getByRole('tab').last();
  await expect(addTab).toBeVisible();
  await addTab.click();
  await expect(page.getByText('이벤트 추가').first()).toBeVisible({ timeout: 15_000 });
  await ensureInboxCategorySelected(page);
}

async function saveTodoInDetail(page, title) {
  const titleInput = page.getByPlaceholder('제목').last();
  await expect(titleInput).toBeVisible();
  await titleInput.fill(title);
  await page.waitForTimeout(400);
  await page.getByText('저장', { exact: true }).last().click();
}

async function createTodo(page, title) {
  await openAddTodoDialog(page);
  await saveTodoInDetail(page, title);
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

async function fetchTodosByDateFromServer(token, date) {
  const response = await fetch(`${REAL_API_BASE_URL}/todos?date=${encodeURIComponent(date)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`getTodosByDate failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function fetchAllTodosFromServer(token) {
  const response = await fetch(`${REAL_API_BASE_URL}/todos/all`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`getAllTodos failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function waitForPendingRetryWindow(page) {
  await page.waitForTimeout(31_000);
  await page.reload();
}

async function toggleCompletionByTitle(page, title) {
  await page.getByText(title, { exact: true }).first().click();
}

test.describe('Completion Recovery Real Server', () => {
  test.skip(!REAL_API_BASE_URL, 'PW_REAL_API_BASE_URL is required');

  test('로그인 사용자 기준 API 장애 중 completion on/off가 복구 후 서버에 수렴된다', async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Recovery Completion Todo ${Date.now()}`;
    const abortApi = (route) => route.abort('internetdisconnected');

    await loginViaUi(page, auth);
    await openMyPage(page);
    await openHome(page);

    await createTodo(page, todoTitle);

    let todoId = null;
    await expect
      .poll(async () => {
        const todos = await fetchAllTodosFromServer(auth.token);
        const matched = todos.find((item) => item?.title === todoTitle);
        todoId = matched?._id || null;
        return !!todoId;
      }, { timeout: 20_000 })
      .toBeTruthy();

    await page.route('**/api/**', abortApi);
    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === true);
      }, { timeout: 20_000 })
      .toBeTruthy();

    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 15_000 });

    await page.route('**/api/**', abortApi);
    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ❌').first()).toBeVisible({ timeout: 10_000 });

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === false);
      }, { timeout: 20_000 })
      .toBeTruthy();
  });

  test('sync 진행 중 두 번째 completion toggle도 후속 sync로 자동 반영된다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Completion Latch Todo ${Date.now()}`;

    await loginViaUi(page, auth);
    await openMyPage(page);
    await openHome(page);
    await createTodo(page, todoTitle);

    let todoId = null;
    await expect
      .poll(async () => {
        const todos = await fetchAllTodosFromServer(auth.token);
        const matched = todos.find((item) => item?.title === todoTitle);
        todoId = matched?._id || null;
        return !!todoId;
      }, { timeout: 20_000 })
      .toBeTruthy();

    let releaseDelayedSync = null;
    let sawBlockedDelta = false;
    let resolveBlockedDeltaSeen = null;

    const blockedDeltaSeen = new Promise((resolve) => {
      resolveBlockedDeltaSeen = resolve;
    });
    const delayedSyncGate = new Promise((resolve) => {
      releaseDelayedSync = resolve;
    });

    const delaySyncOnce = async (route) => {
      if (!sawBlockedDelta) {
        sawBlockedDelta = true;
        resolveBlockedDeltaSeen?.();
        await delayedSyncGate;
      }
      await route.continue();
    };

    await page.route('**/api/todos/delta-sync**', delaySyncOnce);
    await page.route('**/api/completions/delta-sync**', delaySyncOnce);

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });
    await blockedDeltaSeen;

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ❌').first()).toBeVisible({ timeout: 10_000 });

    releaseDelayedSync?.();
    await page.unroute('**/api/todos/delta-sync**', delaySyncOnce);
    await page.unroute('**/api/completions/delta-sync**', delaySyncOnce);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === false);
      }, { timeout: 20_000 })
      .toBeTruthy();
  });
});
