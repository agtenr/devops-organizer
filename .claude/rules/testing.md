# Testing rules

## Unit testing
- **Vitest** is the unit-test runner (Vite-native). Config lives in `vite.config.ts`
  (`test` block: jsdom, globals, `setupFiles: ./src/setupTests.ts`, and an `include` scoped
  to `src/**/*.{test,spec}.{ts,tsx}` so it does not run the Playwright specs). Run with
  `npm run test`.
- The **categorization service MUST be unit-tested**. Tests are driven by **real sample
  emails** captured as fixtures — each categorization rule is pinned by a test.
- Prefer testing the pure service logic directly over testing it through the UI.
- **Render component tests through the app's provider wrapper.** React component tests
  mount the component inside the same `FluentProvider` (with `webLightTheme`) the app mounts
  under — not the bare component. Fluent UI v9 components read theme/context from
  `FluentProvider`, so a bare render diverges from real mounting and can emit context
  warnings. Once more component tests exist, factor this into a shared test render helper.
  (This complements — does not replace — testing the categorization service directly as
  pure logic.)

## UI / end-to-end testing
- **Playwright** is **set up** (no longer aspirational). Config is `playwright.config.ts`;
  specs live under `e2e/`; run with `npm run test:e2e`. The config's `webServer` boots the
  app (`npm run dev`) automatically, so no separate dev server is needed.
- First run on a fresh machine needs `npx playwright install` to fetch browser binaries.
- Current coverage is a single hello-world smoke test (`e2e/smoke.spec.ts`); grow E2E
  coverage as real UI stabilizes.

## What "done" looks like
- A change to categorization behavior ships with new/updated unit tests, and the full
  Vitest suite passes (`npm run test`).
