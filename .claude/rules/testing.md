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
  directly**. Convert each `.msg` into a **machine-readable fixture** the suite loads — a
  per-message file (e.g. JSON) capturing the fields categorization consumes (**subject, body,
  the ADO URL, and expected `(Customer, Project, Type)` triple** plus `needsReview` where it
  applies).
- **Fixtures are local-only (gitignored), derived from the real corpus — never committed.** By
  privacy design the fixture JSON is **`.gitignore`d** and is **not** checked in; it is generated
  **locally** from the `.msg` corpus. The categorization suite therefore depends on
  **locally-generated fixtures**: a **fresh clone must (re)generate the fixtures locally before the
  suite can run** — do not assume they arrive with the checkout, and do not commit them to make the
  suite pass. (The raw `.msg` files and the generated fixtures both stay out of git.)
- **Anonymisation (any durable artifact that quotes corpus content).** Whenever real corpus content
  is captured into a **durable/committed artifact** — not just fixtures, but also **plan documents
  and PR descriptions** — it must be **anonymised**: strip real recipient identities and personal
  data, keeping only the ADO signals the rules key on (org/project in the URL, the action sentence,
  message type). Real personal mailbox content never lands in a committed repo artifact. (Fixtures
  are gitignored per the note above, but stay anonymised too; plans/PRs that quote a sample message
  must anonymise it — story 44.)
- Prefer testing the pure service logic directly over testing it through the UI.
- **Render component tests through the app's provider wrapper.** React component tests
  mount the component inside the same `FluentProvider` (with `webLightTheme`) the app mounts
  under — not the bare component. Fluent UI v9 components read theme/context from
  `FluentProvider`, so a bare render diverges from real mounting and can emit context
  warnings. Once more component tests exist, factor this into a shared test render helper.
  (This complements — does not replace — testing the categorization service directly as
  pure logic.)
  - **Layout-aware Fluent v9 components need jsdom API polyfills in `src/setupTests.ts`.**
    jsdom implements no layout/observer APIs, so a Fluent v9 component that observes layout
    crashes on mount (e.g. `MessageBar` via `useMessageBarReflow` throws
    `ResizeObserver is not a constructor`). The fix is a no-op polyfill added **once** in
    `src/setupTests.ts` — extend that shared setup (it already stubs `ResizeObserver`;
    add `matchMedia`/`IntersectionObserver` there too as new components need them) rather
    than working around the crash per test. (Story 48.)

## UI / end-to-end testing
- **Playwright** is **set up** (no longer aspirational). Config is `playwright.config.ts`;
  specs live under `e2e/`; run with `npm run test:e2e`. The config's `webServer` boots the
  app (`npm run dev`) automatically, so no separate dev server is needed.
- First run on a fresh machine needs `npx playwright install` to fetch browser binaries.
- Current coverage is a single hello-world smoke test (`e2e/smoke.spec.ts`); grow E2E
  coverage as real UI stabilizes.
- **Driving the auth-gated whole-app shell under Playwright.** The app's real shell is behind the
  **MSAL sign-in gate**, and component harnesses mount a single piece in isolation (e.g. `EmailList`
  with mock props) — neither drives the *full* layout. To E2E an auth-gated, whole-app layout story,
  reuse the established **seam** rather than reinventing one per story: **bypass MSAL with a
  mock-auth path** and **inject the data hook** on the shell/`Organizer` (plus a static header
  stand-in) so Playwright renders the real gated shell with deterministic data. Prefer this shared
  seam over a new per-story hack. (Story 46.)
- **jsdom has no layout/CSS engine — it cannot verify visual acceptance.** A jsdom component
  test happily passes DOM/role/text assertions for an element that is present but **0px wide**,
  a panel that never actually became visible, or columns rendered at the wrong widths. So a story
  whose acceptance is inherently **visual or interactive** (layout, sizing, a panel becoming
  visible, drag/resize) must be exercised in a **real browser** (Playwright E2E — already set up)
  before it is called done; jsdom component tests alone are **insufficient** for such acceptance.
  (Stories 40 coder/reviewer.)

## UI screenshots (committed visual evidence for review)
- **A UI change ships with a committed Playwright screenshot of what was built.** When a change's
  acceptance is **UI-facing** (new or changed layout, component, panel, styling, states such as
  loading/empty), capture **at least one** screenshot of the implemented UI with Playwright and
  **commit it** in the same PR. This makes the real-browser verification the section above already
  requires into **durable review evidence** — a reviewer validates the look/layout from the PR
  without checking out and running the app. Logic-only / non-UI changes (e.g. the categorization
  service) need no screenshot.
- **Screenshots MUST be taken through the mock-data harness seam — never the real signed-in app.**
  Drive `/harness.html` (and `?state=…` for other states), the same **`useData` mock seam** the E2E
  specs use (`e2e/harness.spec.ts`), so the shot renders the real `Organizer` shell with
  **deterministic mock data**. This is **mandatory, not stylistic**: a committed screenshot is a
  committed artifact, and the anonymisation rule above forbids **real mailbox content in any committed
  artifact** — shooting the signed-in app would leak real DevOps-notification content into git. The
  harness path is both **anonymised** (mock data only) and **reproducible** (stable data + fixed
  viewport → the same pixels every run). Capture with `page.screenshot({ path })` (documentary
  evidence) — **not** `toHaveScreenshot` visual-regression baselines, which add flaky pixel-diff
  gating this rule does not want.
  - **Keep the harness mock in lockstep with the hook's return shape.** The harness mock
    (`src/harness.tsx` `mockData`, typed as `ReturnType<typeof useOrganizer>`) is a **hand-kept
    parallel** of the real hook's return shape. Any UI story that **adds a field** to `useOrganizer`'s
    return **must seed that field in the harness mock in the same change**, or the harness **build
    breaks** (and the screenshot/E2E seam with it). The proper structural fix — a shared
    factory/default for the return shape — is **app code and out of scope for this rule**; until it
    exists, treat this as a **same-change reminder** whenever the hook's return grows.
- **Where they live: committed, joined on the work-item ID.** Save under
  **`e2e/screenshots/<work-item-id>/<slug>.png`** — a **tracked** location (not the gitignored
  `test-results/` / `playwright-report/`), joined on the work-item ID exactly as plans are
  (`/plans/<work-item-id>/`). Name each shot for what it depicts (e.g. `list-with-preview.png`,
  `loading-state.png`). Confirm they are **git-tracked** before marking done (see the untracked-file
  trap below).
- **The code PR references every screenshot.** The generated code PR description must **embed or link
  each committed screenshot**, grouped so the reviewer can tie each shot to the acceptance criterion
  it evidences. A screenshot committed but not referenced from the PR is an **incomplete** change —
  the reviewer must not have to go hunting for it. (Real corpus content that appears in a shot is
  impossible when the harness seam is used as required above; if a shot ever quotes corpus content,
  anonymise it like any other PR artifact.)
  - **Use a raw-bytes image URL — a repo-relative path or a plain blob URL will NOT render.** In a
    GitHub PR **description** a repo-relative path (`e2e/screenshots/…/x.png`) resolves against the PR
    URL and **breaks**, and a plain blob URL (`github.com/<owner>/<repo>/blob/<branch>/<path>`) renders
    the GitHub **file page**, not the image. Only a **raw-bytes** URL renders inline: append
    **`?raw=true`** to the blob URL, use the **`/raw/<branch>/<path>`** path form, or a
    **`raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>`** URL. (Human corrected this twice on
    one PR.)

## What "done" looks like
- A change to categorization behavior ships with new/updated unit tests, and the full
  Vitest suite passes (`npm run test`).
- A change whose acceptance is **visual/layout/interactive** is verified in a **real browser**
  (Playwright E2E) — not by jsdom component tests alone, which cannot see layout or sizing.
- **A UI change ships with a committed Playwright screenshot** taken through the mock-data harness
  seam, saved under `e2e/screenshots/<work-item-id>/`, git-tracked, and **referenced from the code
  PR** so the reviewer can validate the implementation visually (see "UI screenshots" above).
- **A green local `npm run test` does not prove a required file shipped.** Vitest runs every test
  file **on disk** regardless of git tracking, so a new/required test (or source) file that was
  never `git add`ed can pass locally while being **absent from the PR**. Before marking done,
  verify that all new/required test and source files are **git-tracked and included in the change**
  (e.g. `git status` shows nothing untracked that the change needs). (Story 43.)
- **Swapping a component's underlying primitive means sweeping the suite for stale role assertions.**
  When a story swaps the Fluent primitive under a component (e.g. **Table → DataGrid**, which changes
  the ARIA role from `table` to `grid`), sweep the **full Vitest suite** for role-based assertions
  (`getByRole('table'|'grid'|…)`) tied to the **old** primitive and update them in the **same change**.
  Role-based assertions drift **silently** when the underlying primitive changes: story 54's
  Table→DataGrid migration left an `Organizer.test.tsx` `getByRole('table', {name:'E-mails'})`
  assertion red on `main` until an unrelated story (57) had to fix it. (Stories 54, 57.)
