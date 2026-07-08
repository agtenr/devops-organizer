<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->

# Testing rules

## Unit testing
- **Vitest** is the unit-test runner (Vite-native).
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
- **Playwright** for automated UI testing — **aspirational**.
- TODO (undecided): Playwright is not set up yet; add it (and an `e2e` script) when the UI
  stabilizes. Until then the `e2e` skill is a placeholder.

## What "done" looks like
- A change to categorization behavior ships with new/updated unit tests, and the full
  Vitest suite passes.
