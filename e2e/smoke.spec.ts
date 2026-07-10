import { test, expect } from '@playwright/test';

// The app is auth-gated (story 30): the root redirects unauthenticated users to the Microsoft sign-in
// page — the original "hello-world heading" it used to assert was removed when the auth gate landed
// (its App.test.tsx sibling was retired for the same reason). This smoke test pins that gate; real UI
// coverage runs against /harness.html (harness.spec.ts), which bypasses MSAL.
test('unauthenticated users are redirected to the Microsoft sign-in page', async ({ page }) => {
  await page.goto('/');
  await page.waitForURL(/login\.microsoftonline\.com/, { timeout: 15000 });
  expect(page.url()).toContain('login.microsoftonline.com');
});
