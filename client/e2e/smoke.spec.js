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

  // 실제 서버가 켜져 있어도 mock 토큰의 401 -> refresh 단계에서 로그아웃되지 않도록 고정 응답
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
  if (await mainTab.isVisible({ timeout: 2_000 }).catch(() => false)) return;

  const startButton = page.getByText(/시작하기|Get Started/i).first();
  if (await startButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    const guestResponse = page.waitForResponse((response) => {
      return response.request().method() === 'POST' && /\/api\/auth\/guest$/.test(response.url());
    }, { timeout: 10_000 }).catch(() => null);

    await startButton.click();
    await guestResponse;
  }

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
});
