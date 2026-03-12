const { test, expect } = require('@playwright/test');

async function mockGuestAuth(page) {
  await page.route('**/api/auth/guest', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-access-token',
        refreshToken: 'e2e-refresh-token',
        user: {
          _id: 'guest_e2e_user',
          id: 'guest_e2e_user',
          accountType: 'anonymous',
          name: 'E2E Guest',
          settings: {
            theme: 'system',
            language: 'ko',
            timeZone: 'Asia/Seoul',
          },
        },
      }),
    });
  });

  await page.route('**/api/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        accessToken: 'e2e-access-token',
      }),
    });
  });
}

async function enterMainByGuest(page) {
  const mainTab = page.getByText(/홈|Home|캘린더|Calendar|디버그|Debug|My/i).first();
  const startButton = page.getByText(/시작하기|Get Started/i).first();

  await Promise.any([
    mainTab.waitFor({ state: 'visible', timeout: 30_000 }),
    startButton.waitFor({ state: 'visible', timeout: 30_000 }),
  ]).catch(() => {
    throw new Error('Timed out waiting for main tabs or the guest start button');
  });

  if (await mainTab.isVisible().catch(() => false)) {
    return;
  }

  const guestResponse = page.waitForResponse((response) => {
    return response.request().method() === 'POST' && /\/api\/auth\/guest$/.test(response.url());
  }, { timeout: 10_000 });

  await startButton.click();
  await guestResponse;
  await expect(mainTab).toBeVisible({ timeout: 30_000 });
}

async function openMyPage(page) {
  const myPageTab = page.getByText(/My Page/i).first();
  await expect(myPageTab).toBeVisible();
  await myPageTab.click();
  await expect(page.getByText('카테고리 추가').first()).toBeVisible();
}

async function createCategory(page, name) {
  await page.getByText('카테고리 추가').first().click();
  await expect(page.getByText(/새 카테고리|카테고리 수정/).first()).toBeVisible();
  await page.getByPlaceholder('카테고리 이름을 입력하세요').fill(name);
  await page.getByText('완료').click();
  await expect(page.getByText(name, { exact: true }).first()).toBeVisible({ timeout: 10_000 });
}

async function getCategoryY(page, name) {
  const row = await getCategoryRow(page, name);
  const box = await row.boundingBox();
  if (!box) {
    throw new Error(`Could not resolve bounding box for category: ${name}`);
  }
  return box.y;
}

async function getCategoryRow(page, name) {
  return page.getByRole('button', { name: new RegExp(name) }).first();
}

async function dragCategoryAbove(page, sourceName, targetName) {
  const sourceRow = await getCategoryRow(page, sourceName);
  const targetRow = await getCategoryRow(page, targetName);
  const sourceBox = await sourceRow.boundingBox();
  const targetBox = await targetRow.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error(`Could not resolve drag boxes: ${sourceName} -> ${targetName}`);
  }

  await page.mouse.move(
    sourceBox.x + (sourceBox.width / 2),
    sourceBox.y + (sourceBox.height / 2)
  );
  await page.mouse.down();
  await page.mouse.move(
    sourceBox.x + (sourceBox.width / 2),
    sourceBox.y + 5,
    { steps: 5 }
  );
  await page.mouse.move(
    targetBox.x + (targetBox.width / 2),
    targetBox.y + 8,
    { steps: 20 }
  );
  await page.mouse.up();
}

async function clickDeleteHotspot(page, name) {
  const row = await getCategoryRow(page, name);
  const rowBox = await row.boundingBox();
  if (!rowBox) {
    throw new Error(`Could not resolve delete hotspot for category: ${name}`);
  }

  await page.mouse.click(rowBox.x + 18, rowBox.y + (rowBox.height / 2));
}

test.describe('Category Web Flow', () => {
  test('게스트 기준 카테고리 생성/수정/정렬/삭제가 로컬에서 즉시 반영된다', async ({ page }) => {
    await mockGuestAuth(page);
    await page.goto('/');
    await enterMainByGuest(page);
    await openMyPage(page);

    await createCategory(page, 'Alpha');
    await createCategory(page, 'Beta');

    await page.getByText('Alpha', { exact: true }).first().click();
    await expect(page).toHaveURL(/\/my-page\/category\/.+$/);

    const detailUrl = new URL(page.url());
    const categoryId = detailUrl.pathname.split('/').filter(Boolean).pop();
    expect(categoryId).toBeTruthy();

    await page.goto(`/my-page/category/form?categoryId=${categoryId}`);
    await expect(page.getByText('카테고리 수정').first()).toBeVisible();
    await page.getByPlaceholder('카테고리 이름을 입력하세요').fill('Alpha Prime');
    await page.getByText('완료').click();

    await page.goto('/my-page');
    await expect(page.getByText('Alpha Prime', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Beta', { exact: true }).first()).toBeVisible();

    await page.getByText('편집', { exact: true }).click();
    const alphaBeforeY = await getCategoryY(page, 'Alpha Prime');
    const betaBeforeY = await getCategoryY(page, 'Beta');
    expect(alphaBeforeY).toBeLessThan(betaBeforeY);

    await dragCategoryAbove(page, 'Beta', 'Alpha Prime');

    await expect
      .poll(async () => {
        const betaY = await getCategoryY(page, 'Beta');
        const alphaY = await getCategoryY(page, 'Alpha Prime');
        return betaY < alphaY;
      })
      .toBeTruthy();

    page.once('dialog', (dialog) => dialog.accept());
    await clickDeleteHotspot(page, 'Beta');

    await expect(page.getByText('Beta', { exact: true }).first()).toBeHidden({ timeout: 10_000 });
    await expect(page.getByText('Alpha Prime', { exact: true }).first()).toBeVisible();
  });
});
