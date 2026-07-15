# Plan — AB#55: E-mail preview resizing

## Context
The e-mail preview is a non-blocking `InlineDrawer` docked to the right of the list
(`src/components/EmailList/EmailList.tsx`), opened by clicking a row. Today it has a **fixed**
width (`size="medium"`) that end-users find too small, and there is no way to widen it. This story
adds two behaviours:

1. **Resizing** — the user can drag the preview wider/narrower.
2. **Close-on-delete** — deleting the e-mail that is currently previewed (including deleting the
   last e-mail in the list) leaves the preview open showing a now-deleted message. It should close.

The intended outcome is a preview the user can size to taste, that never lingers on a message that
no longer exists.

## Keep it simple
- **No width persistence.** Width lives in in-memory React state and resets on reload — the story
  asks only to *resize*, not to *remember* a size. (Surfaced as an open question in case the
  reviewer wants `localStorage`.)
- **No new dependency / no third-party resizable-panel library.** Fluent v9 has no resizable
  drawer, but a single drag handle over a controlled width is a few lines — a library is
  unjustified for one panel.
- **Preview width is not synchronised with the list layout / column widths.** The list already
  scrolls (`main` has `overflowX: auto`) when the drawer narrows the view, so nothing downstream
  needs to react to the width.
- **`useEmailList` keeps its story-40 "keep showing until closed across filter changes"
  behaviour.** This plan does **not** reverse that; close-on-delete is scoped to *removal from the
  corpus* (deletion), not to filtering. (The literal wording of AC2's "(also when switching
  filters)" is raised as OQ1 rather than silently reinterpreted.)

## AC coverage
| AC | Status | Where |
|---|---|---|
| As an end-user I can resize the e-mail preview panel | covered | Task 1 (resize handle + controlled width) |
| When I delete an e-mail whose panel is open, the preview closes (incl. deleting the last e-mail); "also when switching filters" | narrowed | Task 2 covers the **delete** case (incl. last e-mail); the **"switching filters"** sub-clause is deliberately **not** implemented because it reverses ratified story-40 behaviour → **OQ1** |

## Implementation approach
Both changes are confined to the `EmailList` component folder; no service, hook-hoisting, or
Organizer change is needed (`allEmails` is already passed into `EmailList`).

**AC1 — resizable preview.** Introduce a colocated hook `useResizablePanel.ts` that owns the panel
width and the drag interaction. The drag uses the **Pointer Events capture** API on a thin handle
element (no `window` listeners, no `useEffect` → no `react-hooks/set-state-in-effect` risk):
`onPointerDown` captures the pointer and records the start X + start width; `onPointerMove` (while
captured) computes `startWidth + (startX - clientX)` — the drawer is docked `position="end"`, so
dragging left widens it — clamped to `[MIN, MAX]`; `onPointerUp` releases capture. The handle is
rendered as a thin `col-resize` bar **between** the list (`styles.main`) and the `InlineDrawer`,
mounted only while the panel is open. The `InlineDrawer` drops `size="medium"` and instead gets its
width from the hook via the documented CSS custom property
`style={{ ['--fui-Drawer--size']: `${width}px` }}`.

**AC2 — close on delete.** `useEmailList` already captures `selectedEmail` by value and keeps
`isPanelOpen` as raw state. Add `allEmails: CategorizedEmail[]` as a second argument and derive the
**effective** open state during render (mirroring the existing `selectedIds` derived-intersection
pattern at `useEmailList.ts:110`): the panel is open iff the raw open flag is set **and** the
selected e-mail's id is still present in `allEmails`. When the previewed e-mail is deleted it leaves
`allEmails`, so `isPanelOpen` derives `false` and the drawer closes — with **no** `setState` in an
effect. Because the check is against the **full corpus** (`allEmails`), not the filtered `emails`, a
mere filter change still leaves the e-mail in the corpus and the panel persists (story-40 behaviour
and its locked test at `useEmailList.test.ts:67` are preserved).

## Data contracts
`Organizer` → `EmailList` prop shape is unchanged; only the internal
`useEmailList(emails)` → `useEmailList(emails, allEmails)` signature changes. Both are
`CategorizedEmail[]` (`src/models/categorization.ts`), already the props `EmailList` receives.

## Task breakdown
1. **Add the resizable-panel hook and wire the handle + controlled width.**
   *(rule: `.claude/rules/frontend-architecture.md`)*
   - New `src/components/EmailList/useResizablePanel.ts` — a real custom hook: `useState` for
     `width` (init `592`, matching today's `medium`), `useRef` for drag start values, and
     `useCallback` pointer handlers using `setPointerCapture` / `releasePointerCapture`. Clamp to
     `MIN_WIDTH = 320` and `MAX_WIDTH = Math.min(window.innerWidth * 0.8, 960)` (evaluated at drag
     time). Returns `{ width, handleProps }` where `handleProps` spreads onto the handle element.
   - Edit `EmailList.tsx`: call the hook; render a thin handle `<div>` (a `makeStyles` `resizeHandle`
     class — `flexShrink: 0`, `cursor: 'col-resize'`, a `tokens`-based hairline) between
     `styles.main` and the `InlineDrawer`, mounted only when `isPanelOpen`; give it
     `role="separator"` + `aria-orientation="vertical"` + `aria-label`. Remove `size="medium"` from
     `InlineDrawer` and set `style={{ ['--fui-Drawer--size']: `${width}px` }}`.
2. **Close the preview when the previewed e-mail is deleted.**
   *(rule: `.claude/rules/frontend-architecture.md`)*
   - Edit `useEmailList.ts`: add `allEmails: CategorizedEmail[]` param; build an id `Set` from
     `allEmails` (`useMemo`); derive `isPanelOpen` during render as
     `rawIsPanelOpen && selectedEmail != null && allIds.has(selectedEmail.message.id)` (rename the
     existing `isPanelOpen` state to `rawIsPanelOpen`). Update the doc comment.
   - Edit `EmailList.tsx`: pass `allEmails` into `useEmailList(emails, allEmails)`.
3. **Tests** *(rule: `.claude/rules/testing.md`)* — see Testing recommendations.

## Assumptions & open questions
- **OQ1 — the "(also when switching filters)" clause of AC2.** Story 40 ratified that the preview
  **keeps showing** an e-mail even after a filter change removes it from the list (documented at
  `useEmailList.ts:63` and locked by the test at `useEmailList.test.ts:67`). AC2's parenthetical
  reads literally as "also close on filter switch", which would reverse that. This plan implements
  **Option A**: close only when the e-mail is **deleted** (removed from the corpus), preserving the
  story-40 persist-across-filter behaviour — because the story's narrative is entirely about the
  *delete* bug. **Option B** would additionally close the preview whenever a filter change removes
  the previewed row (checking the filtered `emails` instead of `allEmails`), reversing story 40 and
  updating that test. Which is intended — **A** (recommended; delete-only, keeps story 40) **or**
  **B** (also close on filter switch)? Reply A or B.
- **OQ2 — width persistence.** Width is in-memory and resets on reload (recommended — matches the
  story's "resize", adds nothing). Alternatively persist the last width to `localStorage` so it
  survives reloads. In-memory (**A**) **or** localStorage (**B**)? Reply A or B.
- **OQ3 — keyboard resizing of the handle.** The handle is a pointer/drag target only. For full
  keyboard accessibility it could also handle Arrow keys (step the width) with
  `aria-valuenow/min/max`. Pointer-only (**A**, recommended — simplest, satisfies the AC) **or**
  add keyboard resize (**B**, better a11y)? Reply A or B.

## Considerations
- **jsdom cannot verify the resize visually** (no layout engine) — per `.claude/rules/testing.md`
  the drag/resize acceptance must be exercised in **Playwright**; the existing `harness.spec.ts`
  already mounts the real `EmailList` and asserts drawer width, so the resize test extends that.
- **Existing E2E stays green:** default width stays `592` (> the `> 300` assertion at
  `harness.spec.ts:51`) and the full-height assertion is width-independent.
- **Close-on-delete is pure logic** (derived open state), so it is unit-tested at the hook level;
  a full-browser delete-closes-preview check is not added because the harness's `deleteEmails` is a
  static no-op (it would need a stateful mock) and the behaviour has no layout dimension.

## Testing recommendations
The project has an established test practice — **Vitest** (`npm run test`) and **Playwright**
(`npm run test:e2e`) — so tests are expected.
- **Unit (jsdom, `renderHook`) — `useEmailList.test.ts`:** the close-on-delete derivation.
  - Open e-mail `a`, then rerender with `allEmails` no longer containing `a` (deletion) →
    `isPanelOpen` is `false`.
  - Open e-mail `a`, then rerender with `a` removed from the filtered `emails` **but still present
    in `allEmails`** (filter change) → `isPanelOpen` stays `true` (story-40 preserved).
  - Update the existing signature-dependent tests to pass `allEmails` (may pass `emails` as
    `allEmails` where corpus == filtered).
- **E2E (Playwright) — `harness.spec.ts`:** open the preview, drag the resize handle, and assert
  the drawer's width changed (wider after dragging outward, and respects a sensible bound). This is
  the visual/interactive acceptance that jsdom cannot see.
- **Must-cover:** previewed-e-mail-deleted → panel closes; filter-only change → panel persists;
  drag handle changes drawer width in a real browser.

## Definition of done
- [ ] The preview panel can be dragged to a new width in a real browser (Playwright), clamped to
      sensible min/max bounds. (AC1)
- [ ] Deleting the previewed e-mail — including when it is the last e-mail — closes the preview.
      (AC2, delete case)
- [ ] A filter change that removes the previewed row keeps the preview open (story-40 behaviour and
      `useEmailList.test.ts:67` still pass). (regression guard / OQ1 Option A)
- [ ] Logic lives in hooks (`useResizablePanel`, `useEmailList`), not inline in JSX; no derived
      state synced via an effect. (`.claude/rules/frontend-architecture.md`)
- [ ] New/updated unit tests pass and the resize E2E passes; `npm run test`, `npm run test:e2e`,
      `npm run lint`, and `npm run build` are all clean. (`.claude/rules/testing.md`)
- [ ] All new/changed files are git-tracked and included in the PR (incl. `useResizablePanel.ts`).

## Files/areas affected
- `src/components/EmailList/useResizablePanel.ts` *(new)*
- `src/components/EmailList/EmailList.tsx` *(edit — handle, controlled width, pass `allEmails`)*
- `src/components/EmailList/useEmailList.ts` *(edit — `allEmails` param, derived open state)*
- `src/components/EmailList/useEmailList.test.ts` *(edit — close-on-delete + signature)*
- `e2e/harness.spec.ts` *(edit — resize drag test)*
