---
name: e2e
description: Run the Playwright end-to-end UI tests. Use to verify the app end-to-end in a browser.
allowed-tools: Bash
---

# End-to-end UI tests (Playwright)

The `test:e2e` script is defined in `package.json`: `playwright test` (verified 2026-07-08).
Playwright is **set up** — no longer aspirational.

```bash
npx playwright install chromium   # one-time: download the browser binary
npm run test:e2e                  # Playwright test run (config: playwright.config.ts)
```

- `playwright.config.ts` boots the app itself via `webServer` (`npm run dev` on
  http://localhost:5173), so you do not need to start the dev server separately.
- Specs live under `e2e/` (currently `e2e/smoke.spec.ts`, a hello-world smoke test).
- First run on a fresh machine needs `npx playwright install` to fetch browser binaries.
