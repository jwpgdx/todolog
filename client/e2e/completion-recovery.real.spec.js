const { test, expect } = require('@playwright/test');

const REAL_API_BASE_URL = process.env.PW_REAL_API_BASE_URL;

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

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
  const myPageTab = page.getByRole('tab', { name: /My Page/i });
  await expect(myPageTab).toBeVisible();
  await myPageTab.click({ force: true });
  await expect(page.getByText('카테고리 추가').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('Inbox', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
}

async function createCategory(page, name) {
  await page.getByText('카테고리 추가').first().click();
  await expect(page.getByText(/새 카테고리|카테고리 수정/).first()).toBeVisible({ timeout: 15_000 });
  await page.getByPlaceholder('카테고리 이름을 입력하세요').fill(name);
  await page.getByText('완료', { exact: true }).last().click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

async function openHome(page) {
  const homeTab = page.getByRole('tab', { name: /홈|Home/i });
  await expect(homeTab).toBeVisible();
  await homeTab.click({ force: true });
  await expect(page.getByText(/Form Sheet Test|등록된 할 일이 없습니다|완료:/).first()).toBeVisible({ timeout: 15_000 });
}

async function openDebug(page) {
  const debugTab = page.getByRole('tab', { name: /디버그/i });
  await expect(debugTab).toBeVisible();
  await debugTab.click({ force: true });
  await expect(page.getByText('🔧 Debug Screen (SQLite)').first()).toBeVisible({ timeout: 15_000 });
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

async function fetchCategoriesFromServer(token) {
  const response = await fetch(`${REAL_API_BASE_URL}/categories`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`getCategories failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function createTodoOnServer(token, data) {
  const response = await fetch(`${REAL_API_BASE_URL}/todos`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`createTodo failed: ${response.status} ${await response.text()}`);
  }

  return response.json();
}

async function updateTodoOnServer(token, todoId, data) {
  const response = await fetch(`${REAL_API_BASE_URL}/todos/${todoId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`updateTodo failed: ${response.status} ${await response.text()}`);
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

async function deleteFirstTodo(page) {
  await page.getByText('🗑️').first().click();
}

async function getCategoryRow(page, name) {
  return page.getByRole('button', { name: new RegExp(escapeRegExp(name)) }).first();
}

async function clickDeleteHotspot(page, name) {
  const row = await getCategoryRow(page, name);
  const rowBox = await row.boundingBox();
  if (!rowBox) {
    throw new Error(`Could not resolve delete hotspot for category: ${name}`);
  }

  await page.mouse.click(rowBox.x + 18, rowBox.y + (rowBox.height / 2));
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

  test('future-retry failed completion create는 더 최신 intent에 의해 supersede되어 재생되지 않는다', async ({ page }) => {
    test.slow();
    test.setTimeout(180_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Completion Coalesce Todo ${Date.now()}`;

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

    let abortedCreateSeen = false;
    let resolveAbortedCreate = null;
    const abortedCreatePromise = new Promise((resolve) => {
      resolveAbortedCreate = resolve;
    });

    const abortFirstCreateCompletion = async (route) => {
      const request = route.request();
      if (!abortedCreateSeen && request.method() === 'POST') {
        abortedCreateSeen = true;
        resolveAbortedCreate?.();
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    };

    await page.route('**/api/completions', abortFirstCreateCompletion);

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });
    await abortedCreatePromise;
    await page.waitForTimeout(500);

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ❌').first()).toBeVisible({ timeout: 10_000 });

    await page.unroute('**/api/completions', abortFirstCreateCompletion);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === false);
      }, { timeout: 20_000 })
      .toBeTruthy();

    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === false);
      }, { timeout: 20_000 })
      .toBeTruthy();
  });

  test('raw ready 200개를 넘는 same-key completion backlog도 마지막 intent 1개로 압축되어 첫 성공 run에 수렴한다', async ({ page }) => {
    test.slow();
    test.setTimeout(360_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Completion Backlog Todo ${Date.now()}`;
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

    let expectCompleted = false;
    for (let index = 0; index < 201; index += 1) {
      expectCompleted = !expectCompleted;
      await toggleCompletionByTitle(page, todoTitle);
      await expect(page.getByText(expectCompleted ? '완료: ✅' : '완료: ❌').first()).toBeVisible({ timeout: 10_000 });
    }

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === true);
      }, { timeout: 20_000 })
      .toBeTruthy();
  });

  test('기간 일정은 완료 후 삭제해도 전체 기간에서 제거되고 완료 상태가 되살아나지 않는다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const tomorrow = addDays(today, 1);
    const todoTitle = `Period Completion Delete Todo ${Date.now()}`;

    await loginViaUi(page, auth);
    await openMyPage(page);

    const categories = await fetchCategoriesFromServer(auth.token);
    const inboxCategoryId = categories.find((item) => item?.systemKey === 'inbox')?._id || categories[0]?._id;
    expect(inboxCategoryId).toBeTruthy();

    const todo = await createTodoOnServer(auth.token, {
      title: todoTitle,
      categoryId: inboxCategoryId,
      startDate: today,
      endDate: tomorrow,
      isAllDay: true,
    });

    await page.reload();
    await openHome(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(async () => {
        const [todayTodos, tomorrowTodos] = await Promise.all([
          fetchTodosByDateFromServer(auth.token, today),
          fetchTodosByDateFromServer(auth.token, tomorrow),
        ]);

        return {
          todayCompleted: todayTodos.some((item) => item?._id === todo._id && item?.completed === true),
          tomorrowCompleted: tomorrowTodos.some((item) => item?._id === todo._id && item?.completed === true),
        };
      }, { timeout: 20_000 })
      .toEqual({
        todayCompleted: true,
        tomorrowCompleted: true,
      });

    await deleteFirstTodo(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeHidden({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const [todayTodos, tomorrowTodos] = await Promise.all([
          fetchTodosByDateFromServer(auth.token, today),
          fetchTodosByDateFromServer(auth.token, tomorrow),
        ]);

        return {
          todayPresent: todayTodos.some((item) => item?._id === todo._id),
          tomorrowPresent: tomorrowTodos.some((item) => item?._id === todo._id),
        };
      }, { timeout: 20_000 })
      .toEqual({
        todayPresent: false,
        tomorrowPresent: false,
      });
  });

  test('시간 일정은 완료 후 시간/제목 수정에도 완료 상태를 유지한다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Timed Completion Update Todo ${Date.now()}`;
    const updatedTitle = `${todoTitle} Updated`;

    await loginViaUi(page, auth);
    await openMyPage(page);

    const categories = await fetchCategoriesFromServer(auth.token);
    const inboxCategoryId = categories.find((item) => item?.systemKey === 'inbox')?._id || categories[0]?._id;
    expect(inboxCategoryId).toBeTruthy();

    const todo = await createTodoOnServer(auth.token, {
      title: todoTitle,
      categoryId: inboxCategoryId,
      startDate: today,
      endDate: today,
      isAllDay: false,
      startTime: '09:00',
      endTime: '10:00',
    });

    await page.reload();
    await openHome(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });

    await updateTodoOnServer(auth.token, todo._id, {
      title: updatedTitle,
      startTime: '10:30',
      endTime: '11:30',
    });

    await page.reload();
    await openHome(page);
    await expect(page.getByText(updatedTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        const matched = todos.find((item) => item?._id === todo._id);
        return {
          title: matched?.title || null,
          completed: matched?.completed === true,
          startTime: matched?.startTime || null,
          endTime: matched?.endTime || null,
        };
      }, { timeout: 20_000 })
      .toEqual({
        title: updatedTitle,
        completed: true,
        startTime: '10:30',
        endTime: '11:30',
      });
  });

  test('카테고리 추가 후 완료된 일정의 카테고리를 바꿔도 completion 상태는 유지된다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const sourceCategoryName = `Completion Source Category ${Date.now()}`;
    const targetCategoryName = `Completion Target Category ${Date.now()}`;
    const todoTitle = `Completion Category Change Todo ${Date.now()}`;

    await loginViaUi(page, auth);
    await openMyPage(page);
    await createCategory(page, sourceCategoryName);
    await createCategory(page, targetCategoryName);

    const categories = await fetchCategoriesFromServer(auth.token);
    const sourceCategory = categories.find((item) => item?.name === sourceCategoryName);
    const targetCategory = categories.find((item) => item?.name === targetCategoryName);
    expect(sourceCategory?._id).toBeTruthy();
    expect(targetCategory?._id).toBeTruthy();

    const todo = await createTodoOnServer(auth.token, {
      title: todoTitle,
      categoryId: sourceCategory._id,
      startDate: today,
      endDate: today,
      isAllDay: true,
    });

    await page.reload();
    await openHome(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });

    await updateTodoOnServer(auth.token, todo._id, {
      categoryId: targetCategory._id,
    });

    await page.reload();
    await openHome(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        const matched = todos.find((item) => item?._id === todo._id);
        return {
          categoryId: matched?.categoryId || null,
          completed: matched?.completed === true,
        };
      }, { timeout: 20_000 })
      .toEqual({
        categoryId: targetCategory._id,
        completed: true,
      });
  });

  test('완료된 일정이 들어있는 카테고리를 삭제하면 todo와 completion이 함께 사라진다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const categoryName = `Cascade Completion Category ${Date.now()}`;
    const todoTitle = `Cascade Completion Todo ${Date.now()}`;

    await loginViaUi(page, auth);
    await openMyPage(page);
    await createCategory(page, categoryName);

    const categories = await fetchCategoriesFromServer(auth.token);
    const targetCategory = categories.find((item) => item?.name === categoryName);
    expect(targetCategory?._id).toBeTruthy();

    const todo = await createTodoOnServer(auth.token, {
      title: todoTitle,
      categoryId: targetCategory._id,
      startDate: today,
      endDate: today,
      isAllDay: true,
    });

    await page.reload();
    await openHome(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });

    await openMyPage(page);
    await page.getByText('편집', { exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept());
    await clickDeleteHotspot(page, categoryName);
    await expect(page.getByText(categoryName, { exact: true }).first()).toBeHidden({ timeout: 15_000 });

    await openHome(page);
    await expect(page.getByText(todoTitle, { exact: true }).first()).toBeHidden({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const [todayTodos, liveCategories] = await Promise.all([
          fetchTodosByDateFromServer(auth.token, today),
          fetchCategoriesFromServer(auth.token),
        ]);

        return {
          todoPresent: todayTodos.some((item) => item?._id === todo._id),
          categoryPresent: liveCategories.some((item) => item?._id === targetCategory._id),
        };
      }, { timeout: 20_000 })
      .toEqual({
        todoPresent: false,
        categoryPresent: false,
      });
  });

  test('반복 completion은 같은 todo라도 날짜 key가 다르면 서로 coalescing되지 않는다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const tomorrow = addDays(today, 1);
    const todoTitle = `Recurring Split Todo ${Date.now()}`;

    await loginViaUi(page, auth);
    await openDebug(page);

    const categories = await fetchCategoriesFromServer(auth.token);
    const inboxCategoryId = categories[0]?._id;
    expect(inboxCategoryId).toBeTruthy();

    const recurringTodo = await createTodoOnServer(auth.token, {
      title: todoTitle,
      categoryId: inboxCategoryId,
      startDate: today,
      endDate: today,
      isAllDay: true,
      recurrence: ['RRULE:FREQ=DAILY'],
      recurrenceEndDate: addDays(today, 7),
    });

    await page.getByText('초기화', { exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept(recurringTodo._id));
    await page.getByText('🧪 반복 split pending seed', { exact: true }).click();

    await page.getByText('⏳ Pending Changes 확인', { exact: true }).click();
    await expect(page.getByText('✅ Completion Pending: 2개').first()).toBeVisible({ timeout: 10_000 });

    await page.getByText('🚀 Pending Push 1회 실행', { exact: true }).click();
    await expect(page.getByText('succeeded=2').first()).toBeVisible({ timeout: 15_000 });

    await expect
      .poll(async () => {
        const [todayTodos, tomorrowTodos] = await Promise.all([
          fetchTodosByDateFromServer(auth.token, today),
          fetchTodosByDateFromServer(auth.token, tomorrow),
        ]);

        return {
          todayCompleted: todayTodos.some((item) => item?._id === recurringTodo._id && item?.completed === true),
          tomorrowCompleted: tomorrowTodos.some((item) => item?._id === recurringTodo._id && item?.completed === true),
        };
      }, { timeout: 20_000 })
      .toEqual({
        todayCompleted: true,
        tomorrowCompleted: true,
      });
  });

  test('todo/category/completion mixed queue에서도 completion만 compaction되고 다른 pending은 정상 수렴한다', async ({ page }) => {
    test.slow();
    test.setTimeout(240_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const existingTodoTitle = `Mixed Queue Base Todo ${Date.now()}`;
    const offlineTodoTitle = `Mixed Queue Pending Todo ${Date.now()}`;
    const offlineCategoryName = `Mixed Queue Category ${Date.now()}`;
    const abortApi = (route) => route.abort('internetdisconnected');

    await loginViaUi(page, auth);
    await openMyPage(page);
    await openHome(page);
    await createTodo(page, existingTodoTitle);

    let existingTodoId = null;
    await expect
      .poll(async () => {
        const todos = await fetchAllTodosFromServer(auth.token);
        const matched = todos.find((item) => item?.title === existingTodoTitle);
        existingTodoId = matched?._id || null;
        return !!existingTodoId;
      }, { timeout: 20_000 })
      .toBeTruthy();

    await page.route('**/api/**', abortApi);

    await openMyPage(page);
    await createCategory(page, offlineCategoryName);

    await openHome(page);
    await createTodo(page, offlineTodoTitle);
    await toggleCompletionByTitle(page, existingTodoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const [todos, categories] = await Promise.all([
          fetchTodosByDateFromServer(auth.token, today),
          fetchCategoriesFromServer(auth.token),
        ]);

        const baseTodo = todos.find((item) => item?._id === existingTodoId);
        const pendingTodo = todos.find((item) => item?.title === offlineTodoTitle);
        const pendingCategory = categories.find((item) => item?.name === offlineCategoryName);

        return {
          baseCompleted: baseTodo?.completed === true,
          pendingTodo: Boolean(pendingTodo),
          pendingCategory: Boolean(pendingCategory),
        };
      }, { timeout: 20_000 })
      .toEqual({
        baseCompleted: true,
        pendingTodo: true,
        pendingCategory: true,
      });
  });

  test('dead_letter completion row가 있어도 신규 ready row는 그대로 replay되고 dead_letter는 유지된다', async ({ page }) => {
    test.slow();
    test.setTimeout(120_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Dead Letter Coexist Todo ${Date.now()}`;

    await loginViaUi(page, auth);
    await openDebug(page);

    const categories = await fetchCategoriesFromServer(auth.token);
    const inboxCategoryId = categories[0]?._id;
    expect(inboxCategoryId).toBeTruthy();

    const todo = await createTodoOnServer(auth.token, {
      title: todoTitle,
      categoryId: inboxCategoryId,
      startDate: today,
      endDate: today,
      isAllDay: true,
    });

    await page.getByText('초기화', { exact: true }).click();
    page.once('dialog', (dialog) => dialog.accept(todo._id));
    await page.getByText('🧪 dead_letter coexist seed', { exact: true }).click();

    await page.getByText('⏳ Pending Changes 확인', { exact: true }).click();
    await expect(page.getByText('📊 상태 요약: pending=1, failed=0, dead_letter=1').first()).toBeVisible({ timeout: 10_000 });

    await page.getByText('🚀 Pending Push 1회 실행', { exact: true }).click();
    await expect(page.getByText('succeeded=1').first()).toBeVisible({ timeout: 15_000 });

    await page.getByText('⏳ Pending Changes 확인', { exact: true }).click();
    await expect(page.getByText('📊 상태 요약: pending=0, failed=0, dead_letter=1').first()).toBeVisible({ timeout: 10_000 });

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todo._id && item?.completed === true);
      }, { timeout: 20_000 })
      .toBeTruthy();
  });

  test('superseded cleanup 이후 retained replay 전 재시작해도 마지막 intent가 유지된다', async ({ page }) => {
    test.slow();
    test.setTimeout(240_000);

    const auth = await registerFreshUser();
    const today = getTodayInSeoul();
    const todoTitle = `Completion Restart Todo ${Date.now()}`;

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

    let abortedCreateSeen = false;
    let resolveAbortedCreate = null;
    const abortedCreatePromise = new Promise((resolve) => {
      resolveAbortedCreate = resolve;
    });

    const abortFirstCreateCompletion = async (route) => {
      if (!abortedCreateSeen && route.request().method() === 'POST') {
        abortedCreateSeen = true;
        resolveAbortedCreate?.();
        await route.abort('internetdisconnected');
        return;
      }
      await route.continue();
    };

    let resolveDeleteStarted = null;
    const deleteStartedPromise = new Promise((resolve) => {
      resolveDeleteStarted = resolve;
    });
    let deleteRequestCount = 0;

    const delayDeleteCompletion = async (route) => {
      deleteRequestCount += 1;
      resolveDeleteStarted?.();
      await new Promise((resolve) => setTimeout(resolve, 60_000));
      await route.continue();
    };

    await page.route('**/api/completions', abortFirstCreateCompletion);
    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ✅').first()).toBeVisible({ timeout: 10_000 });
    await abortedCreatePromise;
    await page.unroute('**/api/completions', abortFirstCreateCompletion);

    await page.route(`**/api/completions/${todoId}**`, delayDeleteCompletion);
    await toggleCompletionByTitle(page, todoTitle);
    await expect(page.getByText('완료: ❌').first()).toBeVisible({ timeout: 10_000 });
    await deleteStartedPromise;

    await page.reload();
    await page.unroute(`**/api/completions/${todoId}**`, delayDeleteCompletion);
    await waitForPendingRetryWindow(page);
    await openHome(page);

    await expect
      .poll(async () => {
        const todos = await fetchTodosByDateFromServer(auth.token, today);
        return todos.some((item) => item?._id === todoId && item?.completed === false);
      }, { timeout: 20_000 })
      .toBeTruthy();

    expect(deleteRequestCount).toBeGreaterThan(0);
  });
});
