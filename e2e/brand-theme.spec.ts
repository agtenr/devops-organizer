import { test, expect } from '@playwright/test';

/**
 * Real-browser evidence for the new brand color scheme (AB#124). The app itself is auth-gated
 * (MSAL), so this drives the real `Organizer` layout (customer tabs + sidebar + `EmailList`)
 * through the `/harness.html` seam, in both light and dark mode (`?state=dark`), and commits a
 * screenshot of each (`.claude/rules/testing.md`). The harness's static header stand-in is not the
 * real `TopBar`, so the branded top-bar background is not visible in these shots — it is verified
 * manually in the running app instead (see `plans/124/plan.md`).
 */

test('brand colors render in light mode', async ({ page }) => {
  await page.goto('/harness.html');

  await expect(page.getByRole('tab', { name: /Contoso/ })).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/124/light.png' });
});

test('brand colors render in dark mode', async ({ page }) => {
  await page.goto('/harness.html?state=dark');

  await expect(page.getByRole('tab', { name: /Contoso/ })).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/124/dark.png' });
});
