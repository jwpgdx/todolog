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

async function clickAction(page, label, statusToken) {
  await page.getByText(label, { exact: true }).click();
  await expect(page.getByText(`status: done:${statusToken}`)).toBeVisible({ timeout: 30_000 });
}

test.describe('Todo Calendar V2 Readiness Harness', () => {
  test('scenario seed, CRUD refresh, completion no-op, and coarse invalidate recover live TC2', async ({ page }) => {
    await mockGuestAuth(page);
    await page.goto('/');
    await enterMainByGuest(page);

    await page.goto('/test/todo-calendar-v2-readiness');

    await expect(page.getByText('TC2 Readiness Harness')).toBeVisible();

    await clickAction(page, 'Seed Scenario 7', 'seed-scenario7');
    await expect(page.getByText('Month Bridge').first()).toBeVisible();
    await expect(page.getByText('Quarter Sprint').first()).toBeVisible();
    await expect(page.getByText('Client Workshop').first()).toBeVisible();

    await clickAction(page, 'Create Visible Todo', 'create-visible-todo');
    await expect(page.getByText('New Visible').first()).toBeVisible();

    await clickAction(page, 'Update Visible Todo', 'update-visible-todo');
    await expect(page.getByText('Sprint X').first()).toBeVisible();

    await clickAction(page, 'Delete Visible Todo', 'delete-visible-todo');
    await expect(page.getByText('Client Workshop')).toHaveCount(0);

    await clickAction(page, 'Toggle Visible Completion', 'toggle-visible-completion');
    await expect(page.getByText('Month Bridge').first()).toBeVisible();
    await expect(page.getByText('Sprint X').first()).toBeVisible();

    await clickAction(page, 'Coarse Invalidate', 'coarse-invalidate');
    await expect(page.getByText('Month Bridge').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Sprint X').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('New Visible').first()).toBeVisible({ timeout: 30_000 });
  });
});
