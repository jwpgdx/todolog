const { test, expect } = require('@playwright/test');

const REAL_API_BASE_URL = process.env.PW_REAL_API_BASE_URL;

async function registerFreshUser() {
  const stamp = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const email = `e2e_recovery_${stamp}@example.com`;
  const password = 'password123';
  const name = `E2E Recovery ${stamp}`;

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
  await expect(page.getByText('카테고리 추가').first()).toBeVisible();
}

async function createCategory(page, name) {
  await page.getByText('카테고리 추가').first().click();
  await page.getByPlaceholder('카테고리 이름을 입력하세요').fill(name);
  await page.getByText('완료').click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

async function getCategoryRow(page, name) {
  return page.getByRole('button', { name: new RegExp(name) }).first();
}

async function clickDeleteHotspot(page, name) {
  const row = await getCategoryRow(page, name);
  await row.scrollIntoViewIfNeeded();
  const rowBox = await row.boundingBox();
  if (!rowBox) {
    throw new Error(`Could not resolve delete hotspot for category: ${name}`);
  }

  await page.mouse.click(rowBox.x + 34, rowBox.y + (rowBox.height / 2));
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

async function waitForPendingRetryWindow(page) {
  await page.waitForTimeout(31_000);
  await page.reload();
}

test.describe('Category Recovery Real Server', () => {
  test.skip(!REAL_API_BASE_URL, 'PW_REAL_API_BASE_URL is required');

  test('로그인 사용자 기준 API 장애 중 생성/삭제가 복구 후 서버에 수렴된다', async ({ page }) => {
    test.slow();

    const auth = await registerFreshUser();
    const categoryName = `Recovery Category ${Date.now()}`;
    const abortApi = (route) => route.abort('internetdisconnected');

    await loginViaUi(page, auth);
    await openMyPage(page);

    await expect(page.getByText('Inbox', { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.route('**/api/**', abortApi);
    await createCategory(page, categoryName);

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openMyPage(page);

    await expect
      .poll(async () => {
        const categories = await fetchCategoriesFromServer(auth.token);
        return categories.some((category) => category?.name === categoryName);
      }, { timeout: 20_000 })
      .toBeTruthy();

    await expect(page.getByText(categoryName, { exact: true }).first()).toBeVisible({ timeout: 15_000 });

    await page.route('**/api/**', abortApi);
    await page.getByText('편집', { exact: true }).click();
    await Promise.all([
      page.waitForEvent('dialog', { timeout: 5_000 }).then((dialog) => dialog.accept()),
      clickDeleteHotspot(page, categoryName),
    ]);
    await expect(page.getByText(categoryName, { exact: true }).first()).toBeHidden({ timeout: 10_000 });

    await page.unroute('**/api/**', abortApi);
    await waitForPendingRetryWindow(page);
    await openMyPage(page);

    await expect
      .poll(async () => {
        const categories = await fetchCategoriesFromServer(auth.token);
        return categories.some((category) => category?.name === categoryName);
      }, { timeout: 20_000 })
      .toBeFalsy();
  });
});
