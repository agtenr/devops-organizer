# UI review screenshots

Committed visual evidence for UI-facing changes. See the **"UI screenshots"** section of
`.claude/rules/testing.md` for the full rule; the essentials:

- **One folder per work item:** `e2e/screenshots/<work-item-id>/<slug>.png`, joined on the ADO
  work-item ID exactly as `/plans/<work-item-id>/` is. Name each shot for what it depicts
  (`list-with-preview.png`, `loading-state.png`).
- **Taken through the mock-data harness only.** Drive `/harness.html` (and `?state=…`) via the
  `useData` mock seam — the same entry the E2E specs use. This keeps the shot **anonymised** (no
  real mailbox content ever lands in git) and **reproducible** (deterministic mock data + fixed
  viewport). Never screenshot the real signed-in app.
- **Documentary, not regression.** Capture with `page.screenshot({ path })`, not
  `toHaveScreenshot` baselines.
- **Referenced from the code PR.** Every committed shot is embedded or linked in the PR
  description so a reviewer can validate the implementation without running the app.

These PNGs are **committed** (unlike the gitignored `test-results/` and `playwright-report/`).
