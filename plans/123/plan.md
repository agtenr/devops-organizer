# Plan — AB#123: E-mail search box improvement

## Context

The subject search box above the e-mail list is too narrow: its `searchBox` griffel style in
`src/components/EmailList/EmailList.tsx` is `{ width: '280px', maxWidth: '50%' }`. The `maxWidth: '50%'`
cap is the real culprit — on a narrow toolbar it shrinks the box to half the available row, which clips
the `"Search by subject"` placeholder and leaves too little room to read a typed query. The story asks
for a box that (a) always shows its placeholder, (b) comfortably fits ~25 characters / 3 words of typed
text, and (c) takes the full available width on smaller screens.

The fix is a **single griffel style change** to `searchBox`: make the box fluid (`width: '100%'`) with a
pixel `maxWidth` cap, and drop the percentage cap. Fluid width + a px cap gives "full width on small
screens, bounded on wide screens" **with no `@media` query and no JS breakpoint** — the container's own
width does the work.

**Decisions settled live during attended planning (provenance: decided with the dev, 2026-09-16):**
- **Max width cap = `400px`.** Roomier than today's 280px; fits the placeholder and ≥25 chars with margin.
- **Placeholder text is unchanged** (`"Search by subject"`). The AC's `"DevOps e-mail organizer"` is a
  *length* example (~23 chars), not new copy.
- **Pure CSS**, via `width: '100%'` + `maxWidth: '400px'` — no media query, no JS breakpoint.
- **No `minWidth` floor** — on very narrow screens the box shrinks with its container (true full width),
  accepted as the desired behavior for AC3.

## Keep it simple

- **Non-goal: no media queries or responsive JS.** Fluid `width: '100%'` + a px `maxWidth` already yields
  full-width-when-narrow / capped-when-wide from the container size alone. The project has no existing
  breakpoint pattern; this story does not introduce one.
- **Non-goal: no `minWidth` floor.** Deliberately omitted (decided live) so the box goes edge-to-edge on
  the smallest screens.
- **Non-goal: placeholder copy and search behaviour are untouched.** Only the box's width styling changes;
  the controlled value/onChange, clear button, and subject-filtering logic (`useEmailList` / `emailSearch`)
  stay exactly as they are.
- **Non-goal: no change to the surrounding toolbar layout.** `toolbar` / `toolbarLeft` (the flex row that
  wraps the chips beside the box) already wrap correctly; the box remains a flex child of `toolbarLeft`.

## AC coverage

| AC | Status | Where |
|----|--------|-------|
| Placeholder is visible | covered | Task 1 — fluid width means the box is never squeezed below its container; the 400px desktop cap comfortably fits `"Search by subject"`. Verified in the browser (Task 2). |
| Box handles ≥3 words / ~25 chars (e.g. `DevOps e-mail organizer`) | covered | Task 1 — 400px cap fits ≥25 chars; on small screens full container width. Verified (Task 2). |
| On smaller screens the box takes the full width | covered | Task 1 — `width: '100%'` (no `minWidth`); the box fills its container when narrow. Verified in the browser (Task 2), which is the only place layout can actually be asserted. |

## Implementation approach

One change, one file:

- **`src/components/EmailList/EmailList.tsx`** — in the `useStyles` block, change the `searchBox` rule
  from `{ width: '280px', maxWidth: '50%' }` to `{ width: '100%', maxWidth: '400px' }`, and update the
  adjacent comment to reflect the new fluid-with-cap intent. The `SearchBox` JSX (`className={styles.searchBox}`,
  `placeholder="Search by subject"`, `aria-label="Search e-mails by subject"`) is unchanged.

Because acceptance is inherently visual (widths, full-width-when-narrow, placeholder visibility), the real
verification is a **Playwright E2E assertion in a real browser plus a committed screenshot** — jsdom has no
layout engine and cannot see width. Both go through the existing mock-data **harness seam** (`/harness.html`),
never the signed-in app.

## Task breakdown

1. **Widen the search box (the CSS change).** Edit the `searchBox` griffel rule in
   `src/components/EmailList/EmailList.tsx` to `{ width: '100%', maxWidth: '400px' }` and refresh its
   comment. *Rules: `.claude/rules/frontend-architecture.md`* — styling stays in griffel/Fluent tokens
   (a fixed px cap is acceptable here; there is no Fluent token for an arbitrary max width), logic-free,
   type-checks/builds/lints/formats clean ("what done looks like").

2. **Real-browser verification + committed screenshot.** *Rules: `.claude/rules/testing.md`.*
   - Add a Playwright assertion to `e2e/harness.spec.ts` that drives `/harness.html` and asserts the
     box's responsive behaviour at two viewports: at a **wide** viewport the box's rendered width is
     **≤ ~400px** (the cap holds) and the placeholder is present/visible; at a **narrow** viewport
     (e.g. 380px wide) the box's width is **> its wide-viewport width** and effectively fills the
     toolbar's left cluster (fluid — AC3). Locate it via the existing `getByLabel('Search e-mails by
     subject')`. Keep assertions tolerance-based (bounding-box widths), consistent with the existing
     width tests in this spec.
   - Capture a screenshot with `page.screenshot({ path })` (documentary evidence — **not**
     `toHaveScreenshot`) through the harness seam, saved to **`e2e/screenshots/123/search-box-widened.png`**
     (git-tracked location, joined on the work-item ID). A second narrow-viewport shot
     (`search-box-small-screen.png`) is encouraged to evidence AC3 but one shot is the minimum.
   - `git add` the screenshot(s) and confirm they are **tracked** before marking done (the untracked-file
     trap).

## Considerations

- **Flex interaction (FYI, already handled by the design).** The box is a flex child of `toolbarLeft`
  (`display: flex; flexWrap: wrap; gap; minWidth: 0`). `width: '100%'` + `maxWidth: '400px'` resolves to
  `min(container, 400px)`: on desktop the box is 400px and the filter chips sit beside it; when the row is
  too narrow the box goes full width and the chips wrap below — the existing wrap behaviour, preserved. No
  change to `toolbar`/`toolbarLeft` is needed.
- **No unit-test impact.** The categorization service and search *logic* (`emailSearch.ts`,
  `useEmailList.ts`) are untouched; existing Vitest suites should stay green. The only new automated
  coverage is the E2E width assertion, since width is not observable in jsdom.

## Testing recommendations

- **Whether to test:** yes — the project has a real test practice (Vitest unit + Playwright E2E, with the
  established harness seam and the `test`/`e2e` skills).
- **At what altitude:** **E2E (Playwright), real browser.** This is the correct and *only* altitude that
  can verify the acceptance here — jsdom component tests cannot see width or full-width-when-narrow, so no
  new jsdom component test is warranted for this change.
- **Must-cover (each with expected outcome):**
  - Wide viewport → search box rendered width **≤ ~400px** (cap holds) and placeholder visible.
  - Narrow viewport (~380px) → search box width **> the wide-viewport width** and fills the toolbar's left
    cluster (fluid full-width — AC3).
- **Live verification:** the committed harness screenshot(s) are the durable visual evidence; no separate
  manual live-verification gate is required beyond running `npm run test:e2e`.

## Definition of done

- [ ] `searchBox` style in `EmailList.tsx` is `{ width: '100%', maxWidth: '400px' }`; the `50%` cap is gone.
- [ ] Placeholder `"Search by subject"` is fully visible (AC1), verified in a real browser.
- [ ] The box fits ≥25 chars / 3 words on desktop within the 400px cap (AC2), verified in a real browser.
- [ ] On a narrow viewport the box takes the full available width (AC3), verified by the E2E assertion.
- [ ] New Playwright assertion added to `e2e/harness.spec.ts` and passing (`npm run test:e2e`).
- [ ] At least one screenshot committed under `e2e/screenshots/123/`, git-tracked, taken through the
      `/harness.html` seam, and referenced from the code PR description with a raw-bytes image URL.
- [ ] `npm run build` (type-check + Vite) and `npm run lint` (ESLint + Prettier) pass clean.
- [ ] Existing Vitest suite (`npm run test`) stays green.

## Files/areas affected

- `src/components/EmailList/EmailList.tsx` — the `searchBox` griffel rule (and its comment).
- `e2e/harness.spec.ts` — new responsive-width assertion for the search box.
- `e2e/screenshots/123/` — new committed screenshot(s) of the widened box.

## Assumptions & open questions

None — every design choice (max-width cap, placeholder text, pure-CSS/no-breakpoint approach, no minWidth
floor) was resolved live with the dev during attended planning and folded into **Context** above as a
decision. There are no open questions gating this plan.
