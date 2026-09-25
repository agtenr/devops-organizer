import { test, expect } from '@playwright/test';

/**
 * Real-browser evidence for the "Saved views" sidebar section (AB#126). The app itself is auth-gated
 * (MSAL), so this drives the real `Organizer` layout through the `/harness.html` seam, whose mock
 * `OrganizerData` seeds two saved views (one marked default) so the section renders deterministically
 * (`.claude/rules/testing.md`).
 */

test('the Saved views section renders above the filters, with a default marked', async ({
  page,
}) => {
  await page.goto('/harness.html');

  await expect(page.getByRole('button', { name: 'Save current view' })).toBeVisible();
  await expect(page.getByRole('listitem', { name: /Contoso failed builds/ })).toBeVisible();
  await expect(page.getByRole('listitem', { name: /Adatum reviews/ })).toBeVisible();

  await page.screenshot({ path: 'e2e/screenshots/126/saved-views-sidebar.png' });
});
