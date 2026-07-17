import { test, expect } from '@playwright/test';

/**
 * Committed visual evidence for the updated app title (AB#60). Driven through the `/harness.html`
 * mock-data seam — the real `TopBar` is behind the MSAL gate, so the harness mounts a static header
 * stand-in that mirrors it (with the same title text). jsdom cannot see rendered layout, so this
 * real-browser shot is the reviewer's evidence that the top bar reads "ADO E-mail Organizer"
 * (`.claude/rules/testing.md`). The click-to-refresh behavior (AC2) is a full page reload the harness
 * stand-in does not model; it is verified by the unit test + manual live verification.
 */

const TITLE = 'ADO E-mail Organizer';

test('the top bar shows the updated app title (AC1)', async ({ page }) => {
  await page.goto('/harness.html');

  await expect(page.getByRole('heading', { level: 1, name: TITLE })).toBeVisible();

  // Documentary screenshot for the PR (not a pixel-diff baseline).
  await page.screenshot({ path: 'e2e/screenshots/60/top-bar-title.png' });
});
