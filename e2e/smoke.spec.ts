import { test, expect } from '@playwright/test';

test('shows the hello-world heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /hello, devops organizer/i })).toBeVisible();
});
