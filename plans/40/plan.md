# Plan — Story 40: E-mail overview list

## Context
The app triages a daily flood of Azure DevOps notification e-mails
(`.claude/rules/categorization-domain.md`). The data path is done: on load `useCategorizedMail`
(`src/hooks/useCategorizedMail.ts`) fetches every raw Graph `Message` from the `DevOps` folder and
the pure engine tags each into a `(Customer, Project, Type)` triple (story 37). Story 38 added the
organization tab strip and the permanent `Organizer` container; story 39 added the left sidebar
Project/Type facet filters. Throughout, the actual center surface has been the **temporary
`MailDebug`** visualizer, which `Organizer` feeds the composed `filtered` set.

**This story replaces `MailDebug` with the real center list view** and adds the **e-mail body side
panel** — the "Center: a simple list view of the (filtered) emails" invariant in
`.claude/rules/frontend-architecture.md`. Concretely (from the AC and description):

- A **list view** of the currently-filtered e-mails, one **row** per e-mail showing five columns:
  **date, subject, organization, project, type**.
- Clicking a row opens a **side panel** with that e-mail's **formatted body**.
- The panel is **closable**, **re-opens** whenever a row is clicked, and is **non-blocking**: while
  it is open the list stays interactive and clicking a different row swaps the shown body.
- **No sorting and no search** — just a clear, readable overview.

This is exactly the removal `MailDebug`'s own doc comment anticipated ("must be removed once the
real list/categorization UI lands — deleting this folder and swapping the visualizer inside
`Organizer` is the whole removal").

## Keep it simple
- **No sorting, search, filtering, or pagination in the list.** The AC explicitly declines sorting
  and search; filtering already lives in the tabs + sidebar (`useOrganizer`), which hands this view
  the final `filtered` set. The list is purely presentational over that set.
- **Plain Fluent `Table`, not `DataGrid`.** With no sort/select/resize/virtualization needed and a
  bounded (~100) in-memory set, `Table`/`TableRow`/`TableCell` with a click handler is sufficient;
  `DataGrid` would add machinery the story doesn't call for.
- **No data-layer change.** `mailService` already selects `body` and `receivedDateTime`
  (`src/services/mail/mailService.ts`), and `useCategorizedMail` already exposes the tagged set —
  this story only adds a view. No changes to the mail service, the categorization engine, or the
  filter composition.
- **View-only selection state stays local to the new component's hook** — no React Context, no
  store, no URL/persistence (the "state approach" in `frontend-architecture.md` is still
  deliberately undecided; local state suffices, same call stories 38/39 made). Filter state stays in
  `useOrganizer`, untouched.
- **No new dependencies (recommended path).** The list uses Fluent v9 `Table`; the panel uses Fluent
  v9 `Drawer`, both already in `@fluentui/react-components@9.74.3`. (The body-sanitisation open
  question below is the one place a dependency *could* enter — see it.)
- **Non-goal: a `needsReview` column.** The AC pins exactly five columns; whether to still surface
  the engine's `needsReview` flag (which `MailDebug` showed as a badge) is raised as an open
  question rather than silently added or dropped.

## Implementation approach
Add a new **`EmailList`** component in its own folder, following the established
presentational-component + colocated-logic-hook split (`CustomerTabs`/`SidebarFilters`):

- **`src/components/EmailList/EmailList.tsx`** — renders the loading/error/empty/success states and,
  on success, a Fluent `Table` of rows plus the body `Drawer`. Purely presentational apart from
  delegating selection to its hook. Styling via `makeStyles`/`tokens` only.
- **`src/components/EmailList/useEmailList.ts`** — owns the **view-only** selection state (which
  e-mail's body is shown, whether the panel is open) and any **pure, unit-testable** helpers (date
  formatting; resolving the body's `{ contentType, content }`). Takes the `emails` array so it can
  resolve the selected e-mail by id and react when the filtered set changes.

**Table.** A `Table` with a `TableHeader` row (Date, Subject, Organization, Project, Type) and one
`TableRow` per e-mail. Each row is clickable (`onClick`, plus keyboard affordance — `tabIndex`/role
or an `appearance`-styled row) and calls `openEmail(id)`. Cells:
- **Date** — `formatReceivedDate(email.message.receivedDateTime)` (pure helper, see below).
- **Subject** — `email.message.subject ?? '(no subject)'` (mirror `MailDebug`'s fallback).
- **Organization** — `email.customer`.
- **Project** — `email.project`.
- **Type** — `typeLabel(email.type)` — **reuse** the existing helper from
  `../SidebarFilters/facetFilters`, do not re-format inline (keeps the label identical to the
  sidebar/badges and honours "consume tags verbatim").

Row identity/selection keys on `email.message.id` (Graph returns `id` on every message even though
it is not in the `$select`; `MailDebug` already relies on it, falling back to the array index for the
React `key`).

**Body panel.** A Fluent `Drawer` (see the inline-vs-overlay open question) opened from
`useEmailList`'s `isPanelOpen`, with a header showing the selected e-mail's subject and a close
button (`DrawerHeader`/`DrawerHeaderTitle` + a dismiss `Button`), and a body region rendering the
formatted message body (see the body-rendering open question for *how* the HTML is rendered safely).
Because selection lives in state and the drawer is non-modal/inline, clicking another row while the
drawer is open simply updates the selected id and the body re-renders — satisfying the non-blocking
requirement with no extra wiring.

**Selection logic in `useEmailList`.**
- `selectedId: string | null` (default `null`), `isPanelOpen: boolean` (default `false`).
- `openEmail(id)`: set `selectedId = id`, `isPanelOpen = true` (re-clicking an already-open row is a
  no-op-equivalent — same id, stays open).
- `closePanel()`: `isPanelOpen = false` (keeps `selectedId` so the drawer's close animation has
  content; a later open overwrites it).
- `selectedEmail` = `emails.find(e => e.message.id === selectedId) ?? null`, memoised.
- See the "selected e-mail filtered out" open question for what happens when `selectedEmail`
  resolves to `null` while the panel is open.

**Pure helpers (colocated, exported for direct unit test).**
- `formatReceivedDate(iso: string | null | undefined): string` — format an ISO `receivedDateTime`
  for display via `Intl.DateTimeFormat`/`toLocaleString`; return `''` for missing/unparseable input
  (never throw).
- `resolveBody(message): { html: string } | { text: string }` — read `message.body?.contentType`
  and `message.body?.content`, returning a discriminated result the component renders (`html` →
  isolated/sanitised HTML per the open question; `text` → escaped preformatted text). Empty/missing
  body → `{ text: '' }`.

**Wire-up.** In `src/components/Organizer/Organizer.tsx`, swap the `MailDebug` import/usage for
`EmailList`, passing the same `{ status, error, folderName, emails: filtered }` props. Then remove
the `src/components/MailDebug/` folder (pending the removal open question). No change to
`CustomerTabs`, `SidebarFilters`, `useOrganizer`, or the data hook.

## Data contracts
Module boundaries introduced by this change: `Organizer → EmailList` (props) and
`EmailList → useEmailList` (hook). Field names/types both sides must agree on:

```ts
// src/components/EmailList/EmailList.tsx — mirrors the existing MailDebugProps so the Organizer
// swap is effectively a rename (same status/error/folderName/emails contract).
export interface EmailListProps {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  /** The already-filtered categorized set to render (org ∩ project ∩ types), from useOrganizer. */
  emails: CategorizedEmail[];
}

// src/components/EmailList/useEmailList.ts
export function formatReceivedDate(iso: string | null | undefined): string; // '' when absent/invalid
export type ResolvedBody = { kind: 'html'; content: string } | { kind: 'text'; content: string };
export function resolveBody(message: Message): ResolvedBody; // empty/missing body -> { kind:'text', content:'' }

export interface UseEmailListResult {
  selectedEmail: CategorizedEmail | null; // the row whose body is shown, or null
  isPanelOpen: boolean;
  openEmail: (id: string) => void;        // called with email.message.id
  closePanel: () => void;
}
export function useEmailList(emails: CategorizedEmail[]): UseEmailListResult;
```

Row fields read from each `CategorizedEmail`: `message.id` (identity/key), `message.receivedDateTime`
(string | undefined), `message.subject` (string | undefined), `customer`, `project`, `type`
(→ `typeLabel`), `message.body` (`{ contentType?: 'text' | 'html'; content?: string }`). No field is
renamed or transformed across the boundary beyond the two pure formatters above;
`CategorizedEmail`/`Message`, `useCategorizedMail`, and `useOrganizer`'s returned shape are
**unchanged**.

## Task breakdown
1. **Add `src/components/EmailList/useEmailList.ts`.** The pure helpers (`formatReceivedDate`,
   `resolveBody`) and the `useEmailList(emails)` hook (selection state + `selectedEmail`/`openEmail`/
   `closePanel`). Keep all logic here, none in JSX. *Rules: `frontend-architecture.md` (logic in a
   colocated hook, not JSX; reuse utilities; bounded in-memory set — no re-fetch),
   `categorization-domain.md` (consume the engine's tags verbatim; filter/read only in memory).*
2. **Add the presentational `src/components/EmailList/EmailList.tsx`.** Loading (`Spinner`) / error /
   empty states, and on success a Fluent `Table` (five columns, clickable rows) plus the body
   `Drawer`. Reuse `typeLabel` from `../SidebarFilters/facetFilters` for the Type column; style with
   `makeStyles`/`tokens`. Render the body per the resolved body-rendering decision (open question).
   *Rules: `frontend-architecture.md` (own folder; presentational component + colocated hook; Fluent
   components/tokens over hand-rolled CSS; "Center: a simple list view" layout invariant).*
3. **Swap the view in `src/components/Organizer/Organizer.tsx`.** Replace the `MailDebug`
   import/usage with `EmailList` (same `{ status, error, folderName, emails: filtered }` props);
   adjust the `view` container only if the drawer layout needs it. Leave `CustomerTabs`,
   `SidebarFilters`, and `useOrganizer` untouched. *Rules: `frontend-architecture.md` (UI layout
   invariants: fixed top bar, tabs across the top, left sidebar, center list; logic/rendering split).*
4. **Remove `src/components/MailDebug/`** (pending the removal open question) — its doc comment
   marks it temporary and deletion-on-real-UI as the whole removal. *Rules:
   `frontend-architecture.md` (keep the tree honest — no dead temporary components).*
5. **Tests.** `useEmailList.test.ts` (`renderHook`) for the pure helpers and selection behavior;
   `EmailList.test.tsx` rendering through the `FluentProvider`/`webLightTheme` wrapper (rows +
   columns render; click opens the panel; close closes; clicking another row swaps the body while
   open; empty set → empty state). *Rules: `testing.md` (Vitest; test pure logic directly; render
   component tests through the provider wrapper).*
6. **Verify done.** `npm run build`, `npm run lint`, `npm run format:check`, `npm run test` all
   clean. *Rules: `frontend-architecture.md` ("what done looks like"), `testing.md`.*

## Assumptions & open questions
- **HTML body rendering — recommend a sandboxed `<iframe>`.** ADO notification bodies are HTML
  (`body.contentType === 'html'`). Rendering untrusted HTML via `dangerouslySetInnerHTML` is an XSS
  vector. Recommendation: render `html` bodies inside a **sandboxed `<iframe srcDoc={content}>`**
  with a restrictive `sandbox` attribute (no `allow-scripts`, no `allow-same-origin`) — this
  neutralises embedded scripts and isolates the e-mail's CSS **without adding a dependency**; `text`
  bodies render as escaped preformatted text. The considered alternative is adding **DOMPurify**
  (a new pinned dependency) to sanitise into in-page HTML, which integrates styling better but pulls
  in a dependency and still needs care. Chosen the iframe for zero-dependency isolation; the
  reviewer may prefer DOMPurify.
- **Side-panel component — recommend Fluent v9 `InlineDrawer`.** The panel must be **non-blocking**
  (list stays interactive; clicking rows swaps the body). Recommendation: `InlineDrawer` (part of the
  layout, no modal backdrop) opened on the right of the view — the simplest thing that is inherently
  non-blocking. The alternative is `OverlayDrawer` with `modalType="non-modal"` (floats over content,
  no blocking backdrop). Chose inline for simplicity; the reviewer may prefer the overlay style.
- **Selected e-mail filtered out while the panel is open — recommend keep showing it until closed.**
  If filters change so the open e-mail leaves the `filtered` set, the recommendation is to **leave
  the panel showing the last-selected body** until the user closes it or clicks another row (no
  effect that force-closes it) — simplest and least surprising mid-read. The alternative is to
  auto-close the panel when `selectedEmail` becomes `null`. Chose keep-open; the reviewer may prefer
  auto-close.
- **Remove `MailDebug` entirely — recommend yes.** This story is the real list view, which is the
  condition `MailDebug`'s own doc comment sets for its removal. Recommendation: delete
  `src/components/MailDebug/` and its usage. The alternative is keeping it around (behind nothing, or
  a toggle) as a raw-payload debugging aid during the transition. Chose removal to keep the tree
  clean; the reviewer may want to retain it briefly.
- **Surface `needsReview` in the list — recommend a subtle per-row marker, not a sixth column.** The
  AC lists exactly five columns, but `MailDebug` currently shows a "needs review" badge and dropping
  it silently loses signal (`categorization-domain.md` values visibility of flagged rows).
  Recommendation: keep the five AC columns and add a **small, unobtrusive `needsReview` indicator**
  on the row (e.g. a warning badge/icon in the subject cell), not a new column. Alternatives:
  omit it entirely (strict AC), or add a dedicated column. Chose the subtle marker; the reviewer may
  prefer strict-AC omission.

## Considerations
- **Bounded, in-memory set.** The list renders the already-fetched ≤~100-e-mail `filtered` set with
  no re-fetch; row mapping and selection lookups are trivial and memoised where useful
  (`frontend-architecture.md`).
- **Body isolation caveat under the iframe approach.** A sandboxed iframe means the e-mail body's own
  CSS is isolated from the app theme (it will look like the raw e-mail, not Fluent-styled) — this is
  the intended trade-off for safety, noted so it is not mistaken for a bug.
- **jsdom cannot render iframe `srcDoc`.** If the iframe approach is taken, component tests can assert
  the drawer opens and the iframe carries the expected `srcDoc`/title and the subject header — not
  the *rendered* body text (jsdom does not lay out iframe content). Tests should target panel
  open/close/swap state and the row content, not inner-body layout.
- **Keyboard/accessibility of clickable rows.** Making a `TableRow` activate on click needs a
  keyboard affordance too (Enter/Space + focusability, or a focusable control in the row) so the row
  is not mouse-only; keep the row's accessible name meaningful (subject).

## Testing recommendations
The project has an established test practice (Vitest, `npm run test`; `testing.md` requires logic to
be unit-tested and component tests mounted through the provider wrapper), so this story ships tests.

- **Altitude:** unit tests for the pure helpers (`formatReceivedDate`, `resolveBody`) in
  `useEmailList.ts`; a hook test (`renderHook`) for `useEmailList` selection behavior; one
  component/behavioral test for `EmailList` through `FluentProvider` + `webLightTheme`.
- **Must-cover:**
  - `formatReceivedDate(undefined)` / `''` / an unparseable string → returns `''` (never throws); a
    valid ISO string → a non-empty formatted string.
  - `resolveBody` — `contentType: 'html'` → `{ kind: 'html', content }`; `contentType: 'text'` →
    `{ kind: 'text', content }`; missing/empty body → `{ kind: 'text', content: '' }`.
  - `useEmailList`: `openEmail(id)` sets `selectedEmail` to that e-mail and `isPanelOpen` true;
    `openEmail` with a different id swaps `selectedEmail` while `isPanelOpen` stays true (non-blocking
    swap); `closePanel()` sets `isPanelOpen` false; when `emails` no longer contains the selected id,
    `selectedEmail` resolves per the ratified filtered-out decision.
  - `EmailList` (through the provider): renders one row per e-mail with all five columns (date,
    subject, organization, project, type via `typeLabel`); an **empty** `emails` set → a readable
    empty state (not a crash, no header-only confusion); loading → `Spinner`, error → the error
    message; clicking a row opens the panel (subject shown in the header); the close control closes
    it; clicking a second row while open updates the panel to that e-mail.

## Definition of done
- [ ] The center shows a **list view** of the filtered e-mails, **one row per e-mail** (AC §1),
      replacing `MailDebug` as the view surface (`frontend-architecture.md` "center: a simple list").
- [ ] Each row shows **date, subject, organization, project, and type** (AC §2), with `type` rendered
      via the reused `typeLabel` helper.
- [ ] Clicking a row opens a **side panel** showing that e-mail's **formatted body** (AC §3).
- [ ] The panel is **closable**, **re-opens** on any row click, and is **non-blocking** — while open,
      clicking a different row swaps the shown body (AC §3).
- [ ] No sorting and no search are introduced (AC — explicitly out of scope).
- [ ] `EmailList` is its own folder with a colocated `useEmailList` hook; view logic (selection, date/
      body helpers) lives in the hook, not inline in JSX; UI uses Fluent components/tokens
      (`frontend-architecture.md`).
- [ ] The list consumes the engine's `(customer, project, type)` tags **verbatim**; no
      re-categorization and no changes to the engine, mail service, or filter composition
      (`categorization-domain.md`, `frontend-architecture.md`).
- [ ] HTML bodies are rendered **safely** (no unsanitised `dangerouslySetInnerHTML`), per the
      ratified body-rendering decision.
- [ ] `MailDebug` is removed (pending its open question) and nothing references it.
- [ ] New tests cover the pure helpers, the `useEmailList` selection behavior, and an `EmailList`
      render/interaction test through the `FluentProvider` wrapper; the full `npm run test` suite
      passes (`testing.md`).
- [ ] Type-checks and builds cleanly (`npm run build`); no ESLint errors and Prettier-clean
      (`npm run lint`, `npm run format:check`).
- [ ] No new dependencies beyond any explicitly ratified for body sanitisation; no persistence/
      backend/URL state introduced (`frontend-architecture.md`).

## Files/areas affected
- `src/components/EmailList/useEmailList.ts` — **new** (`formatReceivedDate`, `resolveBody`,
  `useEmailList` selection hook, `EmailListProps`/`ResolvedBody`/`UseEmailListResult` types).
- `src/components/EmailList/EmailList.tsx` — **new** (presentational `Table` list + body `Drawer`).
- `src/components/EmailList/useEmailList.test.ts` — **new** (pure helpers + hook selection tests).
- `src/components/EmailList/EmailList.test.tsx` — **new** (render/interaction via provider wrapper).
- `src/components/Organizer/Organizer.tsx` — **edit** (swap `MailDebug` → `EmailList`).
- `src/components/MailDebug/MailDebug.tsx` (+ folder) — **remove** (pending the removal open question).
</content>
</invoke>
