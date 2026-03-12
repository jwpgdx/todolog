const { test, expect } = require('@playwright/test');

const REAL_API_BASE_URL = process.env.PW_REAL_API_BASE_URL;

async function registerFreshUser() {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const email = `e2e_todo_recovery_${stamp}@example.com`;
  const password = 'password123';
  const name = `E2E Todo Recovery ${stamp}`;

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

async function openHome(page) {
  const homeTab = page.getByText(/홈|Home/i).first();
  await expect(homeTab).toBeVisible();
  await homeTab.click();
  await expect(page.getByText(/Form Sheet Test|등록된 할 일이 없습니다/).first()).toBeVisible({ timeout: 15_000 });
}

async function openMyPage(page) {
  const myPageTab = page.getByText(/My Page/i).first();
  await expect(myPageTab).toBeVisible();
  await myPageTab.click();
  await expect(page.getByText('카테고리 추가').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Inbox', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function openAddTodoDialog(page) {
  const addTab = page.getByRole('tab').last();
  await expect(addTab).toBeVisible();
  await addTab.click();
  await expect(page.getByText('이벤트 추가').first()).toBeVisible({ timeout: 15_000 });
  await ensureInboxCategorySelected(page);
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

async function openEditTodoDialog(page, title) {
  await expect(page.getByText(title, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await page.getByText('✏️').first().click();
  await expect(page.getByText('이벤트 추가').first()).toBeVisible({ timeout: 15_000 });
}

async function updateTodoTitle(page, nextTitle) {
  await saveTodoInDetail(page, nextTitle);
  await expect(page.getByText(nextTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
}

async function deleteFirstTodo(page) {
  await page.getByText('🗑️').first().click();
}

async function fetchTodosFromServer(token) {
  const response = await fetch(`${REAL_API_BASE_URL}/todos/all`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`getTodos failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function waitForPendingRetryWindow(page) {
  await page.waitForTimeout(31_000);
  await page.reload();
}

test.describe('Todo Recovery Real Server', () => {
  test.skip(!REAL_API_BASE_URL, 'PW_REAL_API_BASE_URL is required');

  test('로그인 사용자 기준 API 장애 중 생성/수정/삭제가 복구 후 서버에 수렴된다', async ({ page }) => {
    test.slow();
    test.setTimeout(240_000);

    const auth = await registerFreshUser();
    const createTitle = `Recovery Todo ${Date.now()}`;
    const updateTitle = `${createTitle} Updated`;
    const abortApi = (route) => route.abort('internetdisconnected');

    await loginViaUi(page, auth);
    await openMyPage(page);
    await openHome(page);

    await page.route('**/api/**', abortApi);
    await createTodo(page, createTitle);

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    let createdTodoId = null;
    await expect
      .poll(async () => {
        const todos = await fetchTodosFromServer(auth.token);
        const todo = todos.find((item) => item?.title === createTitle);
        createdTodoId = todo?._id || null;
        return !!createdTodoId;
      }, { timeout: 20_000 })
      .toBeTruthy();

    await expect(page.getByText(createTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.route('**/api/**', abortApi);
    await openEditTodoDialog(page, createTitle);
    await updateTodoTitle(page, updateTitle);

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosFromServer(auth.token);
        return todos.some((item) => item?._id === createdTodoId && item?.title === updateTitle);
      }, { timeout: 20_000 })
      .toBeTruthy();

    await expect(page.getByText(updateTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.route('**/api/**', abortApi);
    await deleteFirstTodo(page);
    await expect(page.getByText(updateTitle, { exact: true }).first()).toBeHidden({ timeout: 15_000 });

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosFromServer(auth.token);
        return todos.some((item) => item?._id === createdTodoId);
      }, { timeout: 20_000 })
      .toBeFalsy();
  });
});
