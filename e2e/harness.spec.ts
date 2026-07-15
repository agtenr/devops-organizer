import { test, expect } from '@playwright/test';

/**
 * Real-browser regression coverage for the app layout. The app itself is auth-gated (MSAL), so this
 * drives the real `Organizer` layout (tabs + sidebar + `EmailList`) via `/harness.html` — a dev/test
 * entry that mounts it with mock data through the `useData` seam (and `?state=loading` for the loading
 * branch). jsdom component tests assert DOM/behaviour but have no layout engine, so layout/visibility
 * defects (an inline drawer at ~0 width, a wrapping badge, evenly-split columns — AB#40; and the
 * only-the-list-scrolls, full-height preview, single-line filters, loading gate — AB#46) only surface
 * here.
 */

const width = async (locator: import('@playwright/test').Locator) => {
  const box = await locator.boundingBox();
  return box?.width ?? 0;
};

test('columns are not evenly split — Subject is the widest', async ({ page }) => {
  await page.goto('/harness.html');

  // Under DataGrid every header is a columnheader (the primitive Table marked the first data column
  // as a rowheader; the selection column is now the first column, so Date is a plain columnheader).
  const date = await width(page.getByRole('columnheader', { name: 'Date' }));
  const subject = await width(page.getByRole('columnheader', { name: 'Subject' }));
  const type = await width(page.getByRole('columnheader', { name: 'Type' }));

  expect(subject).toBeGreaterThan(date);
  expect(subject).toBeGreaterThan(type);
});

test('a data column is resizable — dragging its handle widens it (AC1)', async ({ page }) => {
  await page.goto('/harness.html');

  const subject = page.getByRole('columnheader', { name: 'Subject' });
  const before = (await subject.boundingBox())!.width;

  // Each header cell carries DataGrid's resize handle (fui-TableResizeHandle) when resizableColumns
  // is on; drag Subject's handle to the right and it should widen.
  const handle = subject.locator('.fui-TableResizeHandle');
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2 + 120, hb.y + hb.height / 2, { steps: 10 });
  await page.mouse.up();

  const after = (await subject.boundingBox())!.width;
  expect(after).toBeGreaterThan(before + 40);
});

test('hovering a truncated subject reveals the full subject in a tooltip (AC2)', async ({ page }) => {
  await page.goto('/harness.html');

  const full = 'Build failed on main for a rather long subject line that keeps going and going';
  // The visible cell is ellipsized; hovering the subject text surfaces the full text in a tooltip.
  await page.getByRole('row', { name: full }).getByText(full).hover();
  await expect(page.getByRole('tooltip')).toHaveText(full);
});

test('the date column is compact — narrower than Subject and near its text width (AC3)', async ({
  page,
}) => {
  await page.goto('/harness.html');

  const date = await width(page.getByRole('columnheader', { name: 'Date' }));
  const subject = await width(page.getByRole('columnheader', { name: 'Subject' }));
  // Date fits its fixed-length text (≈140px default) and stays well under Subject.
  expect(date).toBeLessThan(200);
  expect(date).toBeLessThan(subject);
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

test('the preview panel can be resized by dragging its handle', async ({ page }) => {
  // This test does the same open-the-drawer preamble as the others plus a multi-step drag; give it
  // headroom so it isn't tripped by the one-time cold Vite dep-optimization the first wave blocks on.
  test.slow();
  await page.goto('/harness.html');

  await page.getByRole('row', { name: /Build failed on main/ }).click();
  const drawer = page.locator('.fui-InlineDrawer');
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();

  const before = await width(drawer);

  // The drawer is docked right, so dragging the handle LEFT widens it. Pointer capture on the handle
  // means the moves are tracked even as the cursor leaves the 6px bar (story 55).
  const handle = page.getByRole('separator', { name: 'Resize e-mail preview' });
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x - 200, box!.y + box!.height / 2, { steps: 10 });
  await page.mouse.up();

  const after = await width(drawer);
  expect(after).toBeGreaterThan(before + 100);
});

test('the preview panel spans the full height of the content region', async ({ page }) => {
  await page.goto('/harness.html');

  await page.getByRole('row', { name: /Build failed on main/ }).click();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();

  const viewport = page.viewportSize()!;
  const box = await page.locator('.fui-InlineDrawer').boundingBox();
  // Tall (fills the fixed content area) and flush to the bottom of the viewport — no scrolling to see it.
  expect(box!.height).toBeGreaterThan(viewport.height * 0.8);
  expect(box!.y + box!.height).toBeGreaterThan(viewport.height - 4);
});

test('only the e-mail list scrolls — the page itself does not', async ({ page }) => {
  await page.goto('/harness.html');

  const list = page.getByTestId('email-scroll-region');
  const [scrollH, clientH] = await list.evaluate((el) => [el.scrollHeight, el.clientHeight]);
  // With the filler rows the list overflows its fixed region, so it is itself scrollable.
  expect(scrollH).toBeGreaterThan(clientH);

  await list.evaluate((el) => el.scrollTo(0, el.scrollHeight));
  const listScrollTop = await list.evaluate((el) => el.scrollTop);
  const pageScrollTop = await page.evaluate(() => window.scrollY);
  expect(listScrollTop).toBeGreaterThan(0); // the list actually scrolled
  expect(pageScrollTop).toBe(0); // the page/frame did not
});

test('a long filter option stays on one line, left-aligned, at 12px', async ({ page }) => {
  await page.goto('/harness.html');

  const option = page.getByRole('button', { name: /Alpha-very-long-project-name/ });
  const value = option.locator('span').filter({ hasText: 'Alpha-very-long-project-name' });

  const optionBox = await option.boundingBox();
  const valueBox = await value.boundingBox();
  // Single line: a wrapped 2-line option is ~2x taller; one line stays well under 40px.
  expect(optionBox!.height).toBeLessThan(40);
  // Left-aligned: the value starts near the option's left edge, not centered.
  expect(valueBox!.x - optionBox!.x).toBeLessThan(24);
  // Smaller 12px value font (vs the 14px group titles).
  const fontSize = await value.evaluate((el) => getComputedStyle(el).fontSize);
  expect(fontSize).toBe('12px');
});

test('while loading, only a spinner shows — no tabs or filters', async ({ page }) => {
  await page.goto('/harness.html?state=loading');

  await expect(page.getByText(/Loading mail from "DevOps"/)).toBeVisible();
  await expect(page.getByRole('tablist', { name: 'Organizations' })).toHaveCount(0);
  await expect(page.getByRole('complementary', { name: 'Filters' })).toHaveCount(0);
});
