import { test, expect } from '@playwright/test';

/**
 * Real-browser regression coverage for `EmailList`. The app itself is auth-gated (MSAL), so this
 * drives the component in isolation via `/harness.html` (a dev/test-only entry that mounts `EmailList`
 * with mock data). jsdom component tests assert DOM/behaviour but have no layout engine, so
 * layout/visibility defects (an inline drawer that opens at ~0 width, a wrapping badge, evenly-split
 * columns) only surface here — these assertions pin the fixes for AB#40.
 */

const width = async (locator: import('@playwright/test').Locator) => {
  const box = await locator.boundingBox();
  return box?.width ?? 0;
};

test('columns are not evenly split — Subject is the widest', async ({ page }) => {
  await page.goto('/harness.html');

  const date = await width(page.getByRole('columnheader', { name: 'Date' }));
  const subject = await width(page.getByRole('columnheader', { name: 'Subject' }));
  const type = await width(page.getByRole('columnheader', { name: 'Type' }));

  expect(subject).toBeGreaterThan(date);
  expect(subject).toBeGreaterThan(type);
});

test('the needs-review badge stays on a single line', async ({ page }) => {
  await page.goto('/harness.html');

  const badge = page.getByText('needs review');
  await expect(badge).toBeVisible();
  const box = await badge.boundingBox();
  // A single-line small badge is well under ~26px tall; a wrapped two-line badge is ~32px+.
  expect(box?.height ?? 999).toBeLessThan(26);
});

test('clicking a row opens a visibly-sized body panel', async ({ page }) => {
  await page.goto('/harness.html');

  const drawer = page.locator('.fui-InlineDrawer');
  // Closed: the inline drawer is not mounted at all.
  await expect(drawer).toHaveCount(0);

  await page.getByRole('row', { name: /Build failed on main/ }).click();

  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();
  // Open: the drawer takes real width, not the ~1px flex-shrunk sliver of the bug.
  await expect.poll(() => width(drawer)).toBeGreaterThan(300);
});

test('the panel swaps its body when another row is clicked, then closes', async ({ page }) => {
  await page.goto('/harness.html');

  await page.getByRole('row', { name: /Build failed on main/ }).click();
  await expect(page.getByTitle('E-mail body')).toBeVisible(); // html body → sandboxed iframe

  await page.getByRole('row', { name: /PR review requested/ }).click();
  await expect(page.getByText('Please review my PR.')).toBeVisible(); // text body swapped in

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Close' })).toBeHidden();
});
