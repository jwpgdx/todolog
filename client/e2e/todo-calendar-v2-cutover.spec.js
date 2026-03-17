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

test.describe('Todo Calendar V2 Cutover', () => {
  test('calendar tab is promoted to TC2 without exposing a duplicate TC2 tab', async ({ page }) => {
    await mockGuestAuth(page);
    await page.goto('/');
    await enterMainByGuest(page);

    await page.goto('/test/todo-calendar-v2-readiness');
    await page.getByText('Seed Scenario 7', { exact: true }).click();
    await expect(page.getByText('status: done:seed-scenario7')).toBeVisible({ timeout: 30_000 });

    await page.goto('/');
    await expect(page.getByText('TC2', { exact: true })).toHaveCount(0);

    const calendarTab = page.getByText(/캘린더|Calendar/i).first();
    await calendarTab.click();

    await expect(page.getByText('Month Bridge').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Quarter Sprint').first()).toBeVisible({ timeout: 30_000 });
  });
});
