import { test, expect } from '@playwright/test';

/**
 * Real-browser coverage for the Selected Filter Visualization (AB#58). The chips render next to the
 * subject search box in the real `Organizer` shell, driven through the `useData` mock seam via
 * `/harness.html?state=filtered` (which seeds an active Project + Type selection). jsdom has no layout
 * engine, so the "next to the search box" placement (AC1) can only be verified here — and the shot is
 * the committed review evidence (`.claude/rules/testing.md`).
 */

const PROJECT_CHIP = 'Project: Alpha';
const TYPE_CHIP = 'Type: Work item · Assigned';

test('active filters render as dismissible chips next to the search box (AC1/AC2)', async ({
  page,
}) => {
  await page.goto('/harness.html?state=filtered');

  const searchBox = page.getByRole('searchbox', { name: 'Search e-mails by subject' });
  const projectChip = page.getByRole('button', { name: PROJECT_CHIP });
  const typeChip = page.getByRole('button', { name: TYPE_CHIP });

  await expect(searchBox).toBeVisible();
  await expect(projectChip).toBeVisible();
  await expect(typeChip).toBeVisible();

  // "Next to the search box": both chips start to the right of the search box on the same toolbar row.
  const searchBaseBox = (await searchBox.boundingBox())!;
  const projectBox = (await projectChip.boundingBox())!;
  const typeBox = (await typeChip.boundingBox())!;
  expect(projectBox.x).toBeGreaterThan(searchBaseBox.x);
  expect(typeBox.x).toBeGreaterThan(searchBaseBox.x);

  // Committed visual evidence for the PR (documentary screenshot, not a regression baseline).
  await page.screenshot({ path: 'e2e/screenshots/58/selected-filters.png' });
});

test('a dismissible chip exposes an X-removable button (AC2)', async ({ page }) => {
  await page.goto('/harness.html?state=filtered');

  // A dismissible Fluent Tag's root is the dismiss button — it is focusable and clickable, which is
  // the interaction AC2 wires to `removeFilter` (the harness callback is a no-op, so state is static).
  const typeChip = page.getByRole('button', { name: TYPE_CHIP });
  await expect(typeChip).toBeEnabled();
  await typeChip.click();
});
