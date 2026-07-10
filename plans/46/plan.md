# Plan — AB#46: Project general improvements

## Context

Three small, related UX/layout defects make the organizer harder to use as the mail list grows.
The story bundles them deliberately (the author acknowledges they could be separate stories):

1. **Scrolling.** Today the whole page under the header scrolls (there is no height constraint —
   `TopBar` is merely `position: sticky` and everything else flows). With a long list you must
   scroll back up to reach the tabs, filters, or the preview. Desired: the app fills the viewport
   and **only the e-mail list scrolls**; the top bar, customer tabs, sidebar filters, and the body
   preview all stay put. The preview panel should always be **full viewport height**.
2. **Filter styling.** The sidebar filter buttons wrap to two lines and centre their text when a
   project/type name is long, which is hard to scan. Desired: each filter option stays on **one
   line, left-aligned**, with the value text at a **smaller 12px** font so values read as distinct
   from the (larger, semibold) group titles.
3. **Loading state.** While mail is loading the tabs show `All (0)` and the filters show `None`,
   which is confusing. Desired: during load render **only the header and a spinner** — do not mount
   the tabs or filters until data is ready.

Intended outcome: a fixed app frame with a single scrolling list, tidy single-line filters, and a
clean loading screen. This is a **presentation-only** change — no data flow, categorization, or
auth/scope change (`.claude/rules/authentication.md` and `categorization-domain.md` are untouched).

## Keep it simple

- **No routing or state library.** Local React state stays as-is; the loading gate is a plain
  conditional render in `Organizer`. (Non-goal: TanStack Query / Context — still undecided per
  `frontend-architecture.md`.)
- **No table/DataGrid migration and no sticky table header.** The existing plain `Table` stays; the
  toolbar + table header scroll together with the rows as one "list view". Making only the `<tbody>`
  scroll under a pinned header is out of scope.
- **Keep the existing `InlineDrawer` as the preview.** The story's "preview modal" is the existing
  inline drawer; we make it full-height, we do **not** convert it to a `Dialog`/overlay modal.
- **Do not refactor `EmailList`'s data/status handling.** The recommended loading approach gates in
  `Organizer` and leaves `EmailList`'s own loading/error branches intact (still exercised by its
  unit tests and the harness) rather than re-plumbing its props. (See open question 1.)
- **Minimal global CSS.** The only hand-rolled/global CSS is a small `makeStaticStyles` reset making
  the `html/body/#root` chain full-height (griffel, per `frontend-architecture.md` — griffel over
  hand-rolled CSS). Everything else stays in colocated `makeStyles`.
- **No MSAL mocking for E2E.** Instead of faking auth to drive the real app, introduce one tiny
  hook-injection seam on `Organizer` so a Playwright harness can render the **real** layout with
  mock data (see Implementation approach + open question 2). Desktop layout only — no new responsive
  breakpoints.

## Implementation approach

The core is establishing an unbroken **full-height flex chain** so a single inner region scrolls:

```
html/body/#root (height:100%)  →  FluentProvider (height:100%)
  → App shell  (height:100%, display:flex, flex-direction:column, overflow:hidden)
      → TopBar            (flex-shrink:0 — fixed band)
      → Organizer root    (flex:1, min-height:0, display:flex, flex-direction:column)
          → [loading] centered Spinner   (tabs/filters NOT mounted)
          → [success] CustomerTabs (flex-shrink:0)
                       body (flex:1, min-height:0, display:flex, row)
                         → sidebar (flex-shrink:0, fixed width, overflow-y:auto)
                         → view    (flex:1, min-width:0, display:flex)
                             → EmailList root (height:100%, min-height:0)
                                 → main   (flex:1, OVERFLOW-Y:AUTO ← the one scroller)
                                 → InlineDrawer (flex-shrink:0 → full height)
```

Everything above `main` is `flex-shrink:0` or a bounded flex parent with `min-height:0`, so `main`
is the only element that overflows and scrolls; the drawer, being a full-height flex sibling of
`main`, is automatically full viewport height.

**Loading gate:** `Organizer` already receives `status`/`error`/`folderName` from `useOrganizer`.
Return early: `status === 'loading'` → a centered `Spinner` filling the Organizer region;
`status === 'error'` → the error text; otherwise render tabs + body. Because tabs/filters are simply
not mounted until `success`, the `All (0)`/`None` flash is gone.

**E2E seam:** `Organizer` gains an optional prop `useData?: () => OrganizerData` defaulting to the
real `useOrganizer`. Production usage (`App`) passes nothing. The Playwright harness passes a mock
hook returning static emails and a chosen `status`, so it drives the **real** `Organizer`/
`EmailList`/`SidebarFilters` CSS in a browser without MSAL. `App` continues to render the real
`TopBar` (which needs MSAL); the harness renders a lightweight static header stand-in.

**Files to change:** `src/App/App.tsx` (shell + global reset), `src/main.tsx` (provider full-height),
`src/components/TopBar/TopBar.tsx` (fixed band), `src/components/Organizer/Organizer.tsx` (fill +
loading gate + `useData` seam), `src/components/EmailList/EmailList.tsx` (fill + list scroller),
`src/components/SidebarFilters/SidebarFilters.tsx` (single-line/left/12px), `src/harness.tsx` +
`harness.html` (drive real layout with mock data), `e2e/harness.spec.ts` (layout assertions).

## Data contracts

One in-module contract — the injected-hook seam between `Organizer` and its data source:

```ts
// src/components/Organizer/useOrganizer.ts
export type OrganizerData = ReturnType<typeof useOrganizer>;

// src/components/Organizer/Organizer.tsx
export interface OrganizerProps {
  /** Data source; defaults to the real useOrganizer. Overridden only by the test/e2e harness. */
  useData?: () => OrganizerData;
}
```

The mock hook in the harness and any Organizer component test must return the **full** `OrganizerData`
shape (all fields consumed in `Organizer.tsx`: `status`, `error`, `folderName`, `categorized`,
`filtered`, `resolveProjectGuid`, `deleteEmails`, `selectedCustomer`, `selectCustomer`,
`projectOptions`, `selectedProject`, `onSelectProject`, `typeOptions`, `selectedTypeKeys`,
`onToggleType`). Deriving the type via `ReturnType` keeps the mock honest if the hook changes.

## Task breakdown

Ordered so the height chain exists before the pieces that rely on it.

1. **Global full-height reset + app shell.** In `src/App/App.tsx`, add a module-scope
   `makeStaticStyles` setting `html, body, #root { height: 100%; margin: 0 }` and `body { overflow:
   hidden }`; call its hook in `App`. Wrap `<TopBar/><Organizer/>` in a shell `div`
   (`height:100%`, `display:flex`, `flexDirection:column`, `overflow:hidden`). In `src/main.tsx`
   give `<FluentProvider>` full height so the shell can fill (see open question 3 for the exact
   mechanism). *Rule:* `.claude/rules/frontend-architecture.md` (griffel over CSS; the fixed-top
   nav + layout invariants).
2. **TopBar as a fixed band.** In `TopBar.tsx`, drop `position: sticky`/`top`/`zIndex` (the shell
   now fixes it) and make the header a non-shrinking flex child (`flexShrink: 0`); update the
   styling comment. Keep the centered title + right-aligned user group unchanged. *Rule:*
   `frontend-architecture.md` (top nav fixed to top).
3. **Organizer: fill + loading/error gate + `useData` seam.** In `Organizer.tsx`: make the root a
   filling flex column (`flex:1`, `minHeight:0`); add `OrganizerProps.useData` (default
   `useOrganizer`) and call `const {...} = (useData ?? useOrganizer)()`; export
   `OrganizerData = ReturnType<typeof useOrganizer>` from `useOrganizer.ts`. Return a centered
   `Spinner` (label `Loading mail from "${folderName}"…`) when `status==='loading'` and the error
   text when `status==='error'`, mounting `CustomerTabs`/`SidebarFilters`/`EmailList` only on
   `success`. Make the `body` region fill (`flex:1`, `minHeight:0`) and the sidebar own its overflow
   (`overflow-y:auto`, see open question 4). *Rules:* `frontend-architecture.md` (logic-in-hook
   boundary; sidebar/tabs invariants), `testing.md`.
4. **EmailList: fill + single list scroller.** In `EmailList.tsx` styles, replace `root`'s
   `minHeight: '70vh'` with `height: '100%'` + `minHeight: 0`; give `main` `flex:1`, `minHeight:0`
   and `overflowY: 'auto'` (keep `overflowX:'auto'`). The drawer already has `flexShrink:0`, so it
   now spans full height. No logic/props change. *Rule:* `frontend-architecture.md`.
5. **SidebarFilters: single-line, left-aligned, 12px value.** In `SidebarFilters.tsx`, restructure
   each `ToggleButton` so its content is a full-width row: a value-text span (`flex:1`,
   `whiteSpace:nowrap`, `overflow:hidden`, `textOverflow:ellipsis`, `minWidth:0`, `textAlign:left`,
   font-size 12px) and the `CounterBadge` pinned right (`flexShrink:0`); button
   `justifyContent:'space-between'`, no wrapping. Keep group headings at their current
   size (300 / 14px, semibold) so titles stay visually larger than values. Use
   `tokens.fontSizeBase200` for 12px (see open question 5). *Rule:* `frontend-architecture.md`
   (facet counters; griffel).
6. **Harness drives the real layout.** Rework `src/harness.tsx` to mount `<Organizer useData={…}>`
   with a mock hook returning the `OrganizerData` shape, inside a `100vh` flex-column shell with a
   static header stand-in. Read `?state=loading` from the URL to return `status:'loading'` (else
   `success`). Include mock emails with at least one **long** project/type name so the filter-wrap
   fix is observable, plus the existing two sample emails so the current EmailList assertions still
   pass. Update `harness.html` title/comment as needed. *Rule:* `testing.md` (E2E for visual
   acceptance).
7. **Tests.** Add/extend per Testing recommendations below. *Rule:* `testing.md`.

## Assumptions & open questions

- **OQ1 — Loading-gate placement.** Recommended: gate loading/error in `Organizer` (early return)
  and leave `EmailList`'s own loading/error branches intact (harmless; still covered by its unit
  tests and the harness). Alternative the reviewer may prefer: slim `EmailList` to a success-only
  list view (drop `status`/`error`/`folderName`), moving those tests to `Organizer`.
- **OQ2 — E2E strategy for the auth-gated app.** Recommended: a one-line `useData` hook-injection
  seam on `Organizer` so the Playwright harness renders the real layout with mock data. Alternatives:
  mock the MSAL cache in Playwright (flaky), or duplicate the layout JSX in the harness (diverges
  from real CSS). Is the injection seam acceptable?
- **OQ3 — Full-height mechanism for `FluentProvider`.** `FluentProvider` sits in `main.tsx` (outside
  any component that can use a `makeStyles` hook). Recommended: pass `style={{ height: '100%' }}`
  (one structural inline style). Alternatives: a `makeStaticStyles` global targeting its rendered
  class, or restructuring so a component owns it. Acceptable to use the inline style here?
- **OQ4 — Sidebar overflow when many facets.** Recommended: give the sidebar its own
  `overflow-y:auto` so a long facet list scrolls **within** the sidebar and never grows the frame,
  keeping the e-mail list the primary scroller. Alternative: require all filters always visible with
  no sidebar scroll. Given the ~100-email cap facets are few, so this rarely triggers — confirm the
  independent-scroll fallback is fine.
- **OQ5 — 12px as token vs literal.** The story says "12px". Recommended: `tokens.fontSizeBase200`
  (equals 12px, matches the token-first convention). Alternative: a literal `'12px'`. Preference?

## Considerations

- **jsdom cannot verify layout** (`testing.md`): "only the list scrolls", "preview full height", and
  "filters on one line" are visual and must be checked in Playwright, not jsdom. The loading-gate
  *presence* (tabs/filters absent while loading) is DOM-only and is fine in jsdom.
- **Full real-app coverage is limited by the auth gate.** The harness drives the real `Organizer`
  layout but not the real `TopBar`/data path; the end-to-end "in the signed-in app, only the list
  scrolls and loading shows only header + spinner" is covered by a manual live-verification DoD line.
- **`overflow:hidden` on `body`** removes the page scrollbar globally; confirm no other view relied
  on page scrolling (currently only this app shell renders, so this is safe).
- **StrictMode** double-invokes render in dev; the mock harness hook must be pure/idempotent.

## Testing recommendations

The project has an established test practice — **Vitest** unit/component tests
(`npm run test`) and **Playwright** E2E (`npm run test:e2e`, via the `e2e` skill). Both apply here.

- **Component (jsdom)** — new `src/components/Organizer/Organizer.test.tsx`, rendered through
  `FluentProvider` (`testing.md`), using the `useData` seam with a mock hook (no MSAL):
  - `status:'loading'` → the spinner is shown **and** no `Organizations` tablist / no `Filters`
    region is in the DOM.
  - `status:'success'` → tabs, filters, and the list are all present.
  - `status:'error'` → the error text is shown and tabs/filters are absent.
- **E2E (Playwright)** — extend `e2e/harness.spec.ts` (keep the existing EmailList assertions):
  - **Preview full height:** open a row; the `.fui-InlineDrawer` boundingBox height ≈ viewport
    height (e.g. ≥ 90% of `viewport.height`).
  - **List is the sole scroller:** with enough rows, the `EmailList` `main` region has
    `scrollHeight > clientHeight` and scrolls, while the shell/`document.body` does not grow
    (body/`window` scrollY stays 0 after scrolling the list).
  - **Filter single-line + left-aligned:** with a long facet label, the option row height is
    single-line (`< ~40px`, i.e. not the ~2-line wrapped height) and the value text's left edge ≈
    the sidebar's content left edge (not centered).
  - **Filter value font size:** the option value text computed `font-size` is `12px`.
  - **Loading state:** load the harness with `?state=loading` → the spinner is visible and the
    `Organizations` tablist / `Filters` region are **absent**.
- **Live verification (manual, DoD):** run the real signed-in app and confirm only the list scrolls
  with tabs/filters/preview fixed, and that loading shows only header + spinner.

## Definition of done

- [ ] The app fills the viewport; only the e-mail list scrolls — top bar, customer tabs, sidebar
      filters, and the preview stay fixed while scrolling the list (E2E + manual).
- [ ] The preview panel is full viewport height when open (E2E).
- [ ] Each sidebar filter option renders on a single line, left-aligned (never centered/wrapped),
      even with a long label (E2E).
- [ ] Filter value text is 12px and visibly smaller than the group titles (E2E).
- [ ] While mail is loading, only the header and a spinner are shown — no tabs and no filters mount
      (jsdom presence + E2E `?state=loading`).
- [ ] `Organizer` gates loading/error and the `useData` seam is typed via `OrganizerData`; the
      harness drives the real layout with mock data.
- [ ] Type-checks and builds cleanly; no ESLint errors; Prettier-formatted (`frontend-architecture.md`
      "what done looks like").
- [ ] Layout/rendering logic sits in components' `makeStyles`/hooks, not ad-hoc inline styles beyond
      the one documented structural provider-height case (`frontend-architecture.md`).
- [ ] Full Vitest suite passes (`npm run test`) and the Playwright suite passes (`npm run test:e2e`)
      (`testing.md`).

## Files/areas affected

- `src/main.tsx` — `FluentProvider` full-height.
- `src/App/App.tsx` — global full-height reset (`makeStaticStyles`) + app shell wrapper.
- `src/components/TopBar/TopBar.tsx` — fixed band (drop sticky).
- `src/components/Organizer/Organizer.tsx` — fill layout + loading/error gate + `useData` seam.
- `src/components/Organizer/useOrganizer.ts` — export `OrganizerData` type.
- `src/components/EmailList/EmailList.tsx` — fill height; `main` becomes the list scroller.
- `src/components/SidebarFilters/SidebarFilters.tsx` — single-line, left-aligned, 12px value.
- `src/harness.tsx`, `harness.html` — drive the real `Organizer` layout with mock data + `?state`.
- `e2e/harness.spec.ts` — layout/scroll/filter/loading assertions.
- `src/components/Organizer/Organizer.test.tsx` (new) — loading-gate component tests.
