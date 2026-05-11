const { test, expect } = require('@playwright/test');

async function mockGuestAuth(page) {
  return page;
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

  await startButton.click();
  await expect(mainTab).toBeVisible({ timeout: 30_000 });
}

test.describe('Todo Calendar V2 Fixture Matrix', () => {
  test('deterministic adapter matrix passes all frozen baseline cases', async ({ page }) => {
    await mockGuestAuth(page);
    await page.goto('/');
    await enterMainByGuest(page);

    await page.goto('/test/todo-calendar-v2-fixtures');

    await expect(page.getByText('Fixture Matrix')).toBeVisible();
    await expect(page.getByText('Passed 7 / 7')).toBeVisible();
    await expect(page.getByText('ALL PASS')).toBeVisible();
    await expect(page.getByText(/FAIL ·/)).toHaveCount(0);
  });
});
