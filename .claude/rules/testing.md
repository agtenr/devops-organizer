# Testing rules

## Unit testing
- **Vitest** is the unit-test runner (Vite-native). Config lives in `vite.config.ts`
  (`test` block: jsdom, globals, `setupFiles: ./src/setupTests.ts`, and an `include` scoped
  to `src/**/*.{test,spec}.{ts,tsx}` so it does not run the Playwright specs). Run with
  `npm run test`.
- The **categorization service MUST be unit-tested**. Tests are driven by **real sample
  emails** captured as fixtures — each categorization rule is pinned by a test.
- **Sample-email corpus (canonical source).** The reference corpus is the **14 Outlook `.msg`
  files under `design/demo-messages/`** — one per row of story #37's reference-examples table.
  This is the single source planners/coders draw fixtures from; do **not** invent an ad-hoc
  capture path per story.
- **Fixture format & conversion.** `.msg` is binary and the Vitest suite **cannot read it
  directly**. Convert each `.msg` into a **machine-readable, tracked fixture** the suite loads —
  a per-message file (e.g. JSON) capturing the fields categorization consumes (**subject, body,
  the ADO URL, and expected `(Customer, Project, Type)` triple** plus `needsReview` where it
  applies). The committed fixtures — not the raw `.msg` files — are what the tests import.
- **Anonymisation.** Committed fixtures must be **anonymised**: strip real recipient identities
  and personal data, keeping only the ADO signals the rules key on (org/project in the URL, the
  action sentence, message type). Real personal mailbox content is not committed to the repo.
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
- **jsdom has no layout/CSS engine — it cannot verify visual acceptance.** A jsdom component
  test happily passes DOM/role/text assertions for an element that is present but **0px wide**,
  a panel that never actually became visible, or columns rendered at the wrong widths. So a story
  whose acceptance is inherently **visual or interactive** (layout, sizing, a panel becoming
  visible, drag/resize) must be exercised in a **real browser** (Playwright E2E — already set up)
  before it is called done; jsdom component tests alone are **insufficient** for such acceptance.
  (Stories 40 coder/reviewer.)

## What "done" looks like
- A change to categorization behavior ships with new/updated unit tests, and the full
  Vitest suite passes (`npm run test`).
- A change whose acceptance is **visual/layout/interactive** is verified in a **real browser**
  (Playwright E2E) — not by jsdom component tests alone, which cannot see layout or sizing.
