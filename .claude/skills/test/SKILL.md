---
name: test
description: Run the Vitest unit tests. Use to verify logic (notably the categorization service, once it exists).
allowed-tools: Bash
---

# Unit tests

The `test` script is defined in `package.json`: `vitest run` (verified 2026-07-08).

```bash
npm run test   # Vitest, single run (jsdom environment, globals enabled)
```

- Vitest config lives in `vite.config.ts` (`test` block): `environment: 'jsdom'`,
  `globals: true`, `setupFiles: './src/setupTests.ts'`, and `include: ['src/**/*.{test,spec}.{ts,tsx}']`
  so it does **not** pick up the Playwright specs under `e2e/`.
- **Current state:** only a smoke test exists (`src/App/App.test.tsx`). The categorization
  service is the primary intended subject of unit tests once it is built — see
  `.claude/rules/categorization-domain.md` and `.claude/rules/testing.md`.
- Component tests render through the app's `FluentProvider`/`webLightTheme` wrapper (see
  `testing.md`).
