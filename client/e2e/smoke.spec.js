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

test.describe('Todolog Web Smoke', () => {
  test('앱 셸 로드 및 초기 화면 노출', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(
      page.getByText(/Todolog|TODOLOG|시작하기|로그인|홈|Home|캘린더|Calendar|디버그|Debug|My/i).first()
    ).toBeVisible();
  });

  test('게스트 진입 후 디버그 탭 진입 가능', async ({ page }) => {
    await mockGuestAuth(page);
    await page.goto('/');
    await enterMainByGuest(page);

    const debugTab = page.getByText(/디버그|Debug/i).first();
    await expect(debugTab).toBeVisible();
    await debugTab.click();

    await expect(
      page.getByText(/Debug Screen \(SQLite\)|테스트 날짜|기본 상태 확인|통합 테스트/i).first()
    ).toBeVisible();
  });

  test('게스트 진입 후 Form Sheet 테스트 화면 열기/닫기', async ({ page }) => {
    await mockGuestAuth(page);
    await page.goto('/');
    await enterMainByGuest(page);

    const formSheetButton = page.getByText('Form Sheet Test').first();
    await expect(formSheetButton).toBeVisible();
    await formSheetButton.click();

    await expect(page.getByText('Scroll/keyboard stress').first()).toBeVisible();

    const closeButton = page.getByText('닫기').first();
    await expect(closeButton).toBeVisible();
    await closeButton.click();

    await expect(page.getByText('Scroll/keyboard stress').first()).toBeHidden();
  });
});
