import { test, expect } from '@playwright/test';

/**
 * Real-browser evidence for the app-title change (AB#59, AC1). The real `TopBar` is behind the MSAL
 * gate, so this drives the app title through the `/harness.html` seam — whose static header stand-in
 * mirrors the fixed top bar with mock data (no real mailbox content). The shot is the committed
 * review evidence (`.claude/rules/testing.md`). AC2 (clicking the title reloads and clears filters)
 * is verified by the TopBar component test + by-construction reasoning, not here: the harness models
 * filters via URL params (not live React state) and reload() preserves the query string, so a harness
 * reload would re-seed rather than clear filters (see plans/59/plan.md OQ3).
 */

test('the top-bar title reads "E-mail Organizer" (AC1)', async ({ page }) => {
  await page.goto('/harness.html');

  await expect(page.getByRole('heading', { name: 'E-mail Organizer' })).toBeVisible();

  // Committed visual evidence for the PR (documentary screenshot, not a regression baseline).
  await page.screenshot({ path: 'e2e/screenshots/59/app-title.png' });
});
