# Plan — AB#43: Delete Actions and bulk delete

## Context

The organizer gives a triage overview of ADO notification e-mails, but it is read-only. The value
this story adds is **acting** on that overview: deleting an e-mail directly from a row, and bulk
deleting several selected e-mails at once — "closing the circle" on triage. Deletion goes through
Microsoft Graph (the same signed-in account that reads the mail) and the in-memory list refreshes so
the deleted rows disappear. A confirmation dialog guards every delete, shows a spinner while the
Graph calls are in flight, and surfaces any failure inline instead of closing.

This is the app's **first write scope** — deleting mail requires escalating the Graph permission from
read-only `Mail.Read` to `Mail.ReadWrite` (the story explicitly accepts a new write scope). Per
`.claude/rules/authentication.md`, that escalation stays scoped to mail and is folded into the
existing sign-in consent so tokens are still acquired silently.

## Keep it simple

- **No new table framework.** Keep the existing plain `Table` in `EmailList.tsx` and add a leading
  checkbox column + a toolbar Delete button. Do **not** migrate to `useTableFeatures`/`DataGrid`
  just to get selection — the bounded (~100) in-memory set does not need it.
- **No permanent-delete / trash management.** A Graph `DELETE /me/messages/{id}` moves the message
  to Deleted Items; that is the delete this story implements. No "empty trash", no hard delete, no
  undo.
- **One shared confirm dialog.** Row delete and bulk delete use the **same** `ConfirmDeleteDialog`
  (single-item vs. count-based text) rather than two dialogs.
- **Selection is transient, keyed by message id.** No cross-session persistence, no select-across-
  pages. Selection lives in the list view hook and is cleared after a successful bulk delete.
- **Reuse the established dialog pattern.** `ConfirmDeleteDialog` mirrors the existing
  `ResolveProjectDialog` (colocated component + `use*` hook owning the in-flight/error state); no new
  patterns are invented.

## Implementation approach

Deletion is Graph I/O plus in-memory state pruning, so it follows the app's existing service →
data-hook → view layering:

- **Graph I/O** — add a single-message `deleteMailMessage(client, id)` to the existing
  `src/services/mail/mailService.ts` (one `DELETE /me/messages/{id}` call). One message per call keeps
  the service trivial and unit-testable, mirroring `projectMapService`.
- **Data path + state** — add `deleteEmails(ids)` to the shared `src/hooks/useCategorizedMail.ts`,
  next to the existing `resolveProjectGuid`. It creates the Graph client, deletes the ids with
  `Promise.allSettled`, prunes every **successfully** deleted id from the `messages` state (which
  re-derives `categorized` for free), and rejects with a summarizing error if any deletion failed.
  This is the permanent container for the fetch/delete data path (`.claude/rules/frontend-
  architecture.md` — state that outlives a transitional component lives here, not in the view).
- **Threading** — `useOrganizer` already destructures `useCategorizedMail`; add `deleteEmails` to
  what it returns, `Organizer` passes it to `EmailList`, `EmailList` forwards it to the confirm
  dialog's confirm handler.
- **List view** — `useEmailList` gains the multi-select state (`selectedIds`) and the
  delete-dialog target (`deleteTarget`). `EmailList.tsx` gains: a leading checkbox column (header
  select-all + per-row), a Delete toolbar button above the table, a per-row delete **icon** button,
  the existing "Resolve project GUID" button converted to an **icon** button, and the
  `ConfirmDeleteDialog` render.
- **Confirm dialog** — new `src/components/ConfirmDeleteDialog/` (`.tsx` + `useConfirmDeleteDialog.ts`
  + test), copying `ResolveProjectDialog`'s structure: primary "Yes" shows a spinner while deleting,
  secondary "No" dismisses, a failure keeps the dialog open with the error text.
- **Icons** — add `@fluentui/react-icons` as a direct dependency (already present transitively at
  `2.0.332`; install with `npm install --save-exact` per `.npmrc`). Use `Delete16Regular` /
  `Delete24Regular` for the delete actions and e.g. `TagSearch16Regular` for the resolve icon.
- **Scope** — bump `Mail.Read` → `Mail.ReadWrite` in `src/auth/msalConfig.ts` (`loginRequest.scopes`)
  and `src/services/graph/graphClient.ts` (`GRAPH_SCOPES`).

## Data contracts

- **`useCategorizedMail` → `useOrganizer` → `EmailList` (module↔module).** New action:
  ```ts
  // added to UseCategorizedMailResult and threaded through EmailListProps
  deleteEmails: (ids: string[]) => Promise<void>;
  ```
  Resolves once every id was deleted **and** pruned from the in-memory set; rejects with an `Error`
  whose `message` names how many of `ids.length` failed (already-succeeded ids are still pruned
  before it rejects).

- **`ConfirmDeleteDialog` props (module↔module).**
  ```ts
  interface ConfirmDeleteDialogProps {
    count: number;              // number of items to delete (1 for a row delete)
    subject?: string;           // shown only when count === 1 (the single e-mail's subject)
    onConfirm: () => Promise<void>; // performs the delete + cleanup; rejects on failure
    onCancel: () => void;       // dismiss without deleting
  }
  ```

- **`mailService` → Microsoft Graph (client↔service).**
  ```ts
  deleteMailMessage(client: Client, id: string): Promise<void>;
  // -> client.api(`/me/messages/${id}`).delete()  (DELETE, moves to Deleted Items)
  ```

## Task breakdown

1. **Escalate the Graph scope to `Mail.ReadWrite`.** In `src/auth/msalConfig.ts` change
   `loginRequest.scopes` `Mail.Read` → `Mail.ReadWrite` and update the adjacent comment; in
   `src/services/graph/graphClient.ts` change `GRAPH_SCOPES` likewise. Obeys
   `.claude/rules/authentication.md` (least privilege, per-stage; write stays scoped to mail; folded
   into sign-in so acquisition stays silent).

2. **Add `deleteMailMessage(client, id)` to `src/services/mail/mailService.ts`.** One
   `client.api('/me/messages/' + id).delete()` call; no batching here. Defensively add `id` to
   `MESSAGE_FIELDS`'s `.select(...)` so the delete key is always present. Obeys
   `.claude/rules/authentication.md` (never call Graph without a token — reuses `createGraphClient`).

3. **Add `deleteEmails(ids)` to `src/hooks/useCategorizedMail.ts`.** Mirror `resolveProjectGuid`:
   build the client from `account`, `Promise.allSettled(ids.map((id) => deleteMailMessage(client,
   id)))`, prune fulfilled ids from `messages` via `setMessages`, and `throw` a summarizing `Error`
   when any settled result rejected. Add `deleteEmails` to `UseCategorizedMailResult`. Obeys
   `.claude/rules/frontend-architecture.md` (data path in the permanent hook) and
   `.claude/rules/categorization-domain.md` (filtering/refresh stays in-memory; tags never re-derived).

4. **Thread `deleteEmails` through the container.** `src/components/Organizer/useOrganizer.ts` returns
   it; `src/components/Organizer/Organizer.tsx` passes it to `EmailList`; add it to `EmailListProps` in
   `src/components/EmailList/EmailList.tsx`. Obeys `.claude/rules/frontend-architecture.md`.

5. **Create `src/components/ConfirmDeleteDialog/`.** `ConfirmDeleteDialog.tsx` (presentational, via
   `Dialog`/`DialogSurface`/`DialogBody`/`DialogActions`) + `useConfirmDeleteDialog.ts` (owns
   `deleting` + `error`; `confirm` awaits `onConfirm`, calls `onCancel` on success, sets `error` and
   stays open on failure). Text: `count === 1` → `Are you sure you want to delete "<subject>"?`,
   otherwise `Are you sure you want to delete <count> items?`. "Yes" is primary with a `Spinner`
   while deleting and disabled during the call; "No" is secondary and disabled while deleting. Obeys
   `.claude/rules/frontend-architecture.md` (logic in the hook) and `.claude/rules/testing.md`.

6. **Extend `src/components/EmailList/useEmailList.ts` with selection + delete-target state.** Add
   `selectedIds: ReadonlySet<string>`, `toggleSelected(id)`, `toggleSelectAll(ids)`,
   `clearSelection()`, a derived `selectedCount`; and `deleteTarget: { ids: string[]; subject?: string }
   | null` with `openDeleteRow(email)`, `openDeleteBulk()`, `closeDelete()`. Prune `selectedIds` to
   the ids currently present in `emails` (so a filter change cannot leave hidden rows selected). Obeys
   `.claude/rules/frontend-architecture.md`.

7. **Update `src/components/EmailList/EmailList.tsx`.** Add a leading `TableSelectionCell` checkbox
   column (header select-all bound to the visible rows; per-row bound to `selectedIds`), with the
   checkbox `onClick` calling `stopPropagation` so it does not open the body drawer. Add a Delete
   toolbar button above the `Table`, **enabled only when `selectedCount >= 2`** (see open question),
   labelled with the count, opening the bulk confirm. In the Actions cell, add a delete **icon**
   button (opens the row confirm) for every row and convert the existing "Resolve project GUID"
   button to an **icon** button (`icon` + `aria-label="Resolve project GUID"`), both with
   `stopPropagation`. Render `ConfirmDeleteDialog` when `deleteTarget` is set; its `onConfirm` is
   `async () => { await deleteEmails(deleteTarget.ids); clearSelection(); }` and `onCancel` is
   `closeDelete`. Obeys `.claude/rules/frontend-architecture.md` (no logic in JSX) and the UI layout
   invariants.

8. **Add the `@fluentui/react-icons` dependency.** `npm install --save-exact @fluentui/react-icons`
   (exact-pin per `.claude/rules/frontend-architecture.md` deterministic-install convention).

9. **Tests (see Testing recommendations).** Add/extend: `mailService` delete test,
   `useEmailList` selection/target tests, `ConfirmDeleteDialog` component test, `EmailList` component
   tests (checkbox column, bulk-button enablement, delete icon opens dialog, resolve is now an icon).
   Obeys `.claude/rules/testing.md`.

10. **Record the scope escalation in `.claude/rules/authentication.md`** (see open question). Append a
    "story 43" bullet to the **Scope staging** section documenting the `Mail.Read` → `Mail.ReadWrite`
    change and its rationale, matching the existing per-story staging log (stories 30/36/42).

## Assumptions & open questions

- **Bulk-delete threshold is 2+.** The story says the toolbar Delete button enables when "more then 1"
  is selected and the AC says "when multiple mails are selected", so I gate it at `selectedCount >= 2`
  and leave single-row deletion to the per-row icon. Alternative the reviewer may prefer: enable at
  `>= 1` so a single checked row is actionable without the row icon. Which threshold?
- **Partial bulk-delete failure prunes the successes and reports the rest.** If some ids delete and
  others fail, I remove the succeeded ones from the list and reject with an error naming the failed
  count (view reflects reality; visibility over silent inconsistency, per the domain rules).
  Alternative: all-or-nothing (remove none unless every delete succeeds). Which behavior?
- **This PR updates `.claude/rules/authentication.md`'s scope-staging log (task 10).** The rule
  currently says "never broaden beyond read-only mail access"; leaving it stale would contradict the
  shipped code, and the rule already keeps a per-story staging log. Assumption: the coder appends the
  story-43 entry. Alternative: rule-doc maintenance is out of scope for a feature PR and left to the
  human / dreaming phase. Should the coder edit the rule?
- **Delete uses Graph's default `DELETE` (move to Deleted Items), not permanent delete.** This is
  recoverable from the mailbox's Deleted Items. Assumption this is the intended "delete"; flag if a
  hard/permanent delete is wanted.
- **Icons: official `@fluentui/react-icons`.** Assumed as the delete/resolve glyph source (first-party,
  already transitive). Alternative: avoid the new dependency with a hand-rolled/text glyph. OK to add
  the dependency?

## Considerations

- **Destructive action.** Delete permanently changes the user's mailbox (moves messages to Deleted
  Items). The confirm dialog is the guard; there is no in-app undo. The scope escalation to
  `Mail.ReadWrite` is the minimum that enables it and stays mail-scoped.
- **`message.id` is the delete key.** Graph returns `id` even when `$select` omits it, and the code
  already relies on `message.id`; task 2 adds it to the select defensively since delete now depends
  on it critically.
- **Row-click vs. control-click.** The row already opens the body drawer on click; every added
  control (checkbox, delete icon, resolve icon) must `stopPropagation` so triaging controls do not
  also open the drawer. Covered by a component test.
- **Automated E2E of a real delete is impractical/destructive** (it would require a signed-in live
  mailbox and would delete real mail), so acceptance is verified by jsdom component tests for the
  interaction wiring plus a manual live check (see Testing).

## Testing recommendations

The project has an established test practice — Vitest unit/component tests (`npm run test`, `test`
skill) and Playwright E2E (`npm run test:e2e`, `e2e` skill) — so this ships with automated tests.

- **Altitude:** unit (pure service + hooks) and component (through the `FluentProvider` wrapper, per
  `.claude/rules/testing.md`). No new categorization rules, so the categorization suite is untouched.
- **Must-cover (edge cases beyond the ACs):**
  - `deleteMailMessage` issues `DELETE` against `/me/messages/{id}` for the given id (mock the client,
    mirror `projectMapService.test.ts`).
  - Bulk Delete button: **disabled at 0 and 1 selected, enabled at 2** → asserts the chosen threshold.
  - Delete failure → `ConfirmDeleteDialog` stays open, shows the error, and the row(s) remain in the
    list (nothing pruned on a total failure).
  - Partial bulk failure → succeeded ids pruned, error names the failed count (pending the open
    question; if all-or-nothing is chosen instead, assert nothing is pruned on any failure).
  - Confirm text: `count === 1` renders the subject; `count > 1` renders the count.
  - "No" dismisses without calling `deleteEmails`.
  - Selection is cleared after a successful bulk delete.
  - Checkbox / delete-icon / resolve-icon clicks do **not** open the body drawer (stopPropagation).
- **Live verification (Definition-of-done line below):** because acceptance is interactive
  (checkboxes, dialog spinner, button enabling, list refresh) and deletion hits the real mailbox,
  do a manual browser check against the demo mailbox before merge — jsdom cannot see the spinner
  timing, the real Graph round-trip, or the list refresh (`.claude/rules/testing.md`).

## Definition of done

- [ ] Each e-mail row has a delete **icon** button in the Actions column that opens a confirm dialog;
      "Yes" deletes via Graph and removes the row, "No" dismisses. (AC 1)
- [ ] The list view has per-row checkboxes and multiple e-mails can be selected. (AC 2)
- [ ] A bulk Delete button above the list becomes available/enabled when multiple e-mails are
      selected and bulk-deletes them via Graph. (AC 3)
- [ ] Every delete (row or bulk) is guarded by the confirm dialog ("Are you sure…", Yes/No). (AC 4)
- [ ] A spinner is shown in the dialog while items are being deleted. (AC 5)
- [ ] On failure the error is shown in the dialog and it stays open; on success the dialog closes and
      the list refreshes. (AC 6)
- [ ] The existing "Resolve project GUID" button is now an icon button.
- [ ] Graph scope escalated to `Mail.ReadWrite`, folded into sign-in, tokens still acquired silently;
      no scope broadened beyond mail. (`.claude/rules/authentication.md`)
- [ ] Logic lives in hooks/services, not in JSX; new component tests render through `FluentProvider`.
      (`.claude/rules/frontend-architecture.md`, `.claude/rules/testing.md`)
- [ ] New dependency `@fluentui/react-icons` pinned to an exact version.
      (`.claude/rules/frontend-architecture.md`)
- [ ] `npm run test` passes; `npm run lint` and `npm run format:check` are clean; the build succeeds.
- [ ] Manual live verification against the demo mailbox: delete a single e-mail and a multi-selection,
      observing the spinner, the error path, and the list refresh.

## Files/areas affected

- `src/auth/msalConfig.ts` — scope `Mail.Read` → `Mail.ReadWrite`.
- `src/services/graph/graphClient.ts` — `GRAPH_SCOPES` `Mail.Read` → `Mail.ReadWrite`.
- `src/services/mail/mailService.ts` — new `deleteMailMessage`; add `id` to the select.
- `src/hooks/useCategorizedMail.ts` — new `deleteEmails` action + result type.
- `src/components/Organizer/useOrganizer.ts`, `src/components/Organizer/Organizer.tsx` — thread
  `deleteEmails`.
- `src/components/EmailList/EmailList.tsx` — checkbox column, bulk toolbar, delete icon, resolve icon,
  confirm dialog render.
- `src/components/EmailList/useEmailList.ts` — selection + delete-target state.
- `src/components/ConfirmDeleteDialog/` — new `ConfirmDeleteDialog.tsx`, `useConfirmDeleteDialog.ts`,
  `ConfirmDeleteDialog.test.tsx`.
- `src/services/mail/mailService.test.ts` (new), `src/components/EmailList/useEmailList.test.ts`,
  `src/components/EmailList/EmailList.test.tsx` — tests.
- `package.json` / `package-lock.json` — `@fluentui/react-icons` dependency.
- `.claude/rules/authentication.md` — scope-staging log entry (pending open question).
