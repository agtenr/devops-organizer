# Plan — Story 42: Resolve project GUIDs

## Context
Azure DevOps work-item and release notifications carry only the **project GUID** in their URLs, not
a friendly name. The categorization engine (`src/services/categorization/categorizationService.ts`,
story 37) therefore emits the project **as the raw GUID** and flags the row `needsReview: true` — the
ratified "emit the GUID *and* flag, never invent a name" fallback in
`.claude/rules/categorization-domain.md`. In practice this happens for a large share of the corpus
(6 of the 14 demo messages), so raw GUIDs dominate the Project column and the filters.

This story lets the user **map a GUID to a friendly project name once**, **persist** that mapping, and
have **every** e-mail carrying that GUID re-resolve to the name — on this session and on every future
load. Concretely (from the AC and description):

- A persistent **GUID → friendly-name** mapping is **stored in the signed-in user's OneDrive** (via
  Microsoft Graph) and **loaded on app start**; the categorization then resolves mapped GUIDs to
  their names. An unmapped GUID is unchanged (still shown as the GUID, still flagged).
- The overview list (`EmailList`, story 40) gains an **"Actions"** column. A row whose project is an
  **unresolved GUID** shows a **"Resolve project GUID"** action.
- That action opens a **"Resolve Project GUID"** dialog showing the GUID and a **project picker** —
  pick an already-discovered project name for that e-mail's organization, **or type your own**.
  Cancel dismisses it; Save writes the mapping (showing a **spinner**), then closes and the whole
  set **re-categorizes** so every row with that GUID now shows the name.

The data path is already centralized: `useCategorizedMail` (`src/hooks/useCategorizedMail.ts`)
fetches the raw Graph messages once and memoizes `categorizeEmails(messages)`; `useOrganizer` layers
filtering; `EmailList` renders the (filtered) set and consumes the engine's tags **verbatim**. This
story threads a **project map** through that same path.

## Keep it simple
- **Non-goal: an ADO GUID→name lookup.** A front-end-only app has no GUID→name source
  (`categorization-domain.md`). The name comes **only** from the user via the dialog; nothing is
  inferred or fetched from ADO.
- **Non-goal: editing or deleting existing mappings, or a "manage all mappings" screen.** The AC
  covers only *adding* a resolution from a row's action. Mappings are added per-row; there is no
  list/edit/remove UI. (A GUID that is already resolved shows the name and no longer offers the
  action, so re-mapping is out of scope too.)
- **Non-goal: a generic actions framework.** The column is named "Actions" (the description
  anticipates future actions) but this story adds exactly **one** action; no plugin/registry
  abstraction.
- **Mapping key = the bare GUID, not `(org, GUID)`.** ADO project GUIDs are globally unique, and the
  description says "simple json file with key-value pairs," so the store is a flat `{ guid: name }`.
  (The *picker* is still org-scoped for UX — see *Assumptions*.)
- **The engine stays pure.** The map is passed **into** `categorizeEmails` as data (a parameter),
  not read via I/O inside it — the service remains deterministic and unit-testable
  (`categorization-domain.md`). Re-categorization is just the existing `useMemo` recomputing when the
  map state changes; no imperative row-rewriting pass.
- **Whole-file write, last-write-wins.** The map is a tiny JSON blob in the user's own app folder;
  saving merges the one new entry into the last-loaded map and PUTs the whole file. No delta/patch
  protocol, no locking (single-user tool — see *Considerations*).
- **No new dependency.** The dialog uses Fluent v9 `Dialog` + `Combobox`; the store uses the existing
  `@microsoft/microsoft-graph-client`. Both already pinned.
- **No new env var.** Graph scopes live in code (`msalConfig`/`graphClient`), not `VITE_*`; the store
  path is a constant. `.env.sample` is unchanged.

## Implementation approach
Thread a `ProjectGuidMap` through the existing data path and add the resolve UI. Follow the
established service-layer + presentational-component + colocated-hook patterns.

**1. Engine — resolve mapped GUIDs (pure).** In `models/categorization.ts` add the map type and a new
derived flag; in `categorizationService.ts` accept the map and apply it:
- `categorizeEmail(message, projectMap?)` / `categorizeEmails(messages, projectMap?)` gain an optional
  `projectMap` (default `{}`), so all existing callers/tests keep working.
- When `resolveOrgAndProject` yields a project that matches `GUID_RE`, look it up in the map
  (case-insensitive — keys are stored lowercased). A hit sets `project` to the friendly name and
  clears the GUID reason for `needsReview`; a miss leaves the GUID verbatim and keeps the flag
  (unchanged behavior).
- Add `projectIsUnresolvedGuid: boolean` to `CategorizedEmail` — **true** iff the project is a GUID
  with no mapping. This is the single signal the UI uses to decide whether to offer the action, so
  the UI never re-runs `GUID_RE` itself (components consume tags verbatim — `categorization-domain.md`).

**2. Storage service — `src/services/projectMap/projectMapService.ts` (new).** A thin Graph wrapper,
mirroring `mailService`'s shape (takes a `Client`, does I/O, returns plain data):
- `fetchProjectMap(client): Promise<ProjectGuidMap>` — `GET` the app-folder file
  `/me/drive/special/approot:/project-guid-map.json:/content`. A **404** (file not created yet) →
  `{}`. Any parse failure → `{}` (never blocks load — "if no mapping file found, nothing changes").
- `saveProjectMapping(client, current, guid, name): Promise<ProjectGuidMap>` — merge
  `{ ...current, [guid.toLowerCase()]: name.trim() }`, `PUT` the whole object as JSON to the same
  `:/content` path (creating the app folder on first write), and return the merged map.
- Robust read: the Graph JS client may hand back the file body as a parsed object *or* a string —
  normalize both (`typeof x === 'string' ? JSON.parse(x) : x`) and coerce to a
  `Record<string,string>`, dropping non-string values defensively.

**3. Graph scope.** The store needs write access to the user's OneDrive. Add the scope in the two
places tokens are requested — `src/auth/msalConfig.ts` `loginRequest.scopes` (so it is consented
**once at sign-in**, since the map is read on load) and `src/services/graph/graphClient.ts`
`GRAPH_SCOPES` (so the acquired token carries it). **Use `Files.ReadWrite`, not the story's
`Files.ReadWrite.AppFolder`** — the latter is unsupported for the org (Entra) accounts this app signs
in with (see *Assumptions*, doc-cited). `Files.ReadWrite` still reaches the `approot` app folder.

**4. Data hook — `src/hooks/useCategorizedMail.ts`.** Own the map alongside the messages:
- Add `projectMap` state (default `{}`). In the existing load effect, after creating the client,
  fetch the map and the mail (both under the same `cancelled` guard); a map-fetch failure resolves to
  `{}` and does **not** set the error status (only mail failure does, as today).
- `categorized = useMemo(() => categorizeEmails(messages, projectMap), [messages, projectMap])` — so
  saving a mapping (which updates `projectMap`) re-resolves the whole set for free.
- Expose `resolveProjectGuid(guid, name): Promise<void>`: build a client for the current `account`,
  call `saveProjectMapping` merging into the **latest** map (hold the current map in a ref to avoid a
  stale closure), and `setProjectMap` to the returned map on success. It **throws on failure** so the
  dialog can show an error and keep itself open. It does **not** own a spinner flag — the dialog owns
  that around the awaited promise (AC 7).

**5. Known-project-names helper — `src/components/ResolveProjectDialog/knownProjects.ts` (new, pure).**
`deriveKnownProjectNames(emails, customer): string[]` — from the **full** categorized set, the unique
`project` values for that customer that are real names (exclude `UNCATEGORIZED` and any
`projectIsUnresolvedGuid` row), sorted case-insensitively. Pure/React-free → its own colocated file,
not the hook (`frontend-architecture.md`).

**6. Dialog — `src/components/ResolveProjectDialog/` (new).**
- `ResolveProjectDialog.tsx` — a modal Fluent v9 `Dialog`/`DialogSurface` titled "Resolve Project
  GUID", showing the target **GUID** (read-only) and a **project picker**: a Fluent `Combobox` with
  `freeform` enabled, its `Option`s the `knownProjectNames` — the user can select a discovered name
  **or type a new one**. `DialogActions`: a **Cancel** button (dismisses) and a **Save** button
  (disabled until the value is non-empty; renders a `Spinner` while saving).
- `useResolveProjectDialog.ts` — owns the picker `value`, the `saving` flag, and an `error`; `save()`
  sets `saving`, `await onResolve(guid, value)`, on success calls `onCancel`/close, on failure clears
  `saving` and sets `error`. All logic here, none in JSX (`frontend-architecture.md`).

**7. List wiring — `src/components/EmailList/`.**
- `EmailList.tsx` — add a sixth **"Actions"** column (header + cell). The cell renders the "Resolve
  project GUID" `Button` **only** when `email.projectIsUnresolvedGuid`; otherwise it is empty.
  Clicking calls a hook action to open the dialog for that row's `{ guid: email.project, customer }`.
  Render one `ResolveProjectDialog` when a target is set, passing `deriveKnownProjectNames(allEmails,
  customer)` and `resolveProjectGuid`. Adjust the `makeStyles` column widths / `minWidth` to fit the
  new column (the table is `tableLayout: 'fixed'`).
- `useEmailList.ts` — add view state `resolveTarget: { guid, customer } | null` with
  `openResolve(guid, customer)` / `closeResolve()` (colocated with the existing selection state).
- `EmailListProps` gains `allEmails: CategorizedEmail[]` (the full set, for the org-scoped picker) and
  `resolveProjectGuid: (guid: string, name: string) => Promise<void>`.

**8. Pass-through — `useOrganizer.ts` / `Organizer.tsx`.** `useOrganizer` already returns
`categorized` (full) and now also returns `resolveProjectGuid` (from `useCategorizedMail`).
`Organizer` passes `allEmails={categorized}` and `resolveProjectGuid` into `EmailList`. `CustomerTabs`
and `SidebarFilters` are untouched.

## Data contracts

**A. OneDrive app-folder file (Graph ↔ app).** File `project-guid-map.json` at
`/me/drive/special/approot:/project-guid-map.json:/content`. Body is a flat JSON object; keys are
**lowercased** project GUIDs, values are the user-entered friendly names:
```jsonc
{ "2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4": "AI Sales Agents" }
```

**B. Types (`src/models/categorization.ts`).**
```ts
/** Persistent GUID→friendly-name map. Keys are lowercased ADO project GUIDs. */
export type ProjectGuidMap = Record<string, string>;

export interface CategorizedEmail {
  message: Message;
  customer: string;
  project: string;            // friendly name if mapped/inline, else the raw GUID, else UNCATEGORIZED
  type: MessageType;
  needsReview: boolean;
  projectIsUnresolvedGuid: boolean;   // NEW — true iff `project` is a GUID with no mapping
}
```

**C. Engine (`categorizationService.ts`).**
```ts
export function categorizeEmail(message: Message, projectMap?: ProjectGuidMap): CategorizedEmail;
export function categorizeEmails(messages: Message[], projectMap?: ProjectGuidMap): CategorizedEmail[];
// projectMap defaults to {} — resolution is identity when empty (existing callers unaffected).
```

**D. Storage service (`src/services/projectMap/projectMapService.ts`).**
```ts
export function fetchProjectMap(client: Client): Promise<ProjectGuidMap>; // 404 / parse error -> {}
export function saveProjectMapping(
  client: Client, current: ProjectGuidMap, guid: string, name: string,
): Promise<ProjectGuidMap>; // returns the merged map (guid lowercased, name trimmed)
```

**E. Hook (`useCategorizedMail.ts`) — additive.**
```ts
export interface UseCategorizedMailResult {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  categorized: CategorizedEmail[];
  resolveProjectGuid: (guid: string, name: string) => Promise<void>; // NEW; throws on failure
}
```

**F. Component props.**
```ts
export interface EmailListProps {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  emails: CategorizedEmail[];       // filtered set to render (unchanged)
  allEmails: CategorizedEmail[];    // NEW — full set, for the org-scoped picker
  resolveProjectGuid: (guid: string, name: string) => Promise<void>; // NEW
}

export interface ResolveProjectDialogProps {
  guid: string;
  customer: string;
  knownProjectNames: string[];
  onResolve: (guid: string, name: string) => Promise<void>;
  onCancel: () => void;
}
```
No existing field is renamed; casing is unchanged across every boundary (GUID keys are the only
transform — lowercased on write and on lookup).

## Task breakdown
1. **Engine + model.** Add `ProjectGuidMap` and `projectIsUnresolvedGuid` to
   `src/models/categorization.ts`; thread the optional `projectMap` through `categorizeEmail`/
   `categorizeEmails` in `src/services/categorization/categorizationService.ts`, resolving a mapped
   GUID to its name (case-insensitive) and clearing the GUID `needsReview` reason. Add unit tests to
   `categorizationService.test.ts` reusing the existing GUID fixtures (`AZELIS_GUID`). *Rules:
   `categorization-domain.md` (pure/deterministic engine, single source of tags, GUID-fallback
   invariant), `testing.md` (fixture-driven unit tests).*
2. **Storage service.** Add `src/services/projectMap/projectMapService.ts`
   (`fetchProjectMap`, `saveProjectMapping`) against the `approot` app-folder JSON file, with 404 /
   parse failure → `{}`. Unit-test with a fake `Client` (stub `.api().get()/.put()`). *Rules:
   `authentication.md` (Graph only via MSAL token; least privilege), `frontend-architecture.md`
   (front-end-only, bounded in-memory), `testing.md`.*
3. **Graph scope.** Add `Files.ReadWrite` to `loginRequest.scopes` (`src/auth/msalConfig.ts`) and to
   the client scopes (`src/services/graph/graphClient.ts`); update the doc comments to record the
   staged reason (persist the GUID map). Confirm the AppFolder-vs-Files.ReadWrite decision below.
   *Rules: `authentication.md` (least privilege evaluated per stage; never hardcode IDs; token via
   MSAL — Scope staging section).*
4. **Data hook.** Extend `src/hooks/useCategorizedMail.ts` to fetch the map on load (non-fatal on
   failure), pass it into `categorizeEmails` (memo dependency), and expose `resolveProjectGuid`.
   *Rules: `frontend-architecture.md` (data fetched once on load; bounded in-memory; shared data hook
   hoisted in `src/hooks/`), `categorization-domain.md` (filter/resolve in memory; tags from the
   service).*
5. **Known-names helper.** Add pure `src/components/ResolveProjectDialog/knownProjects.ts`
   (`deriveKnownProjectNames`) + unit test. *Rules: `frontend-architecture.md` (pure React-free helper
   in its own colocated file, not a `use*` file), `testing.md`.*
6. **Dialog.** Add `src/components/ResolveProjectDialog/ResolveProjectDialog.tsx` +
   `useResolveProjectDialog.ts` — Fluent `Dialog` + freeform `Combobox` picker, Cancel/Save, Save
   spinner while awaiting. Component test through the `FluentProvider`/`webLightTheme` wrapper; hook
   test for `save`/`saving`/`error`. *Rules: `frontend-architecture.md` (own folder; presentational +
   colocated hook; Fluent components/tokens; logic in the hook), `testing.md` (render through the
   provider wrapper; test hook logic directly).*
7. **List wiring.** Add the "Actions" column + conditional action button to
   `src/components/EmailList/EmailList.tsx`, the `resolveTarget` state to
   `src/components/EmailList/useEmailList.ts`, and the dialog render; extend `EmailListProps`. Update
   `EmailList.test.tsx`/`useEmailList.test.ts` (action shows only for unresolved-GUID rows; opens the
   dialog; cancel closes). *Rules: `frontend-architecture.md` (layout invariants; logic/rendering
   split), `testing.md`.*
8. **Pass-through.** Return `resolveProjectGuid` from `useOrganizer` and pass `allEmails` +
   `resolveProjectGuid` from `Organizer` into `EmailList`. *Rules: `frontend-architecture.md`
   (container owns selection/data wiring; UI layout invariants).*
9. **Verify done.** `npm run build`, `npm run lint`, `npm run format:check`, `npm run test` all
   clean, then the manual live check below. *Rules: `frontend-architecture.md` ("what done looks
   like"), `testing.md`.*

## Assumptions & open questions
- **Scope: use `Files.ReadWrite`, not the story's `Files.ReadWrite.AppFolder`.** Microsoft docs state
  `Files.ReadWrite.AppFolder` is **valid only for personal Microsoft accounts**; for work/school
  (OneDrive for Business) accounts it is *"not currently supported"* and `Files.ReadWrite` is the
  scope to use (permissions reference + OneDrive endpoint-differences). This app signs in with
  **organizational Entra ID accounts** (`authentication.md`), so I plan for `Files.ReadWrite` (which
  still reaches `/me/drive/special/approot`). Alternative: keep `Files.ReadWrite.AppFolder` if the app
  will only ever be used with personal accounts. **Which account type must this support?**
- **Storage location = the `approot` app folder, file `project-guid-map.json`.** Keeps the app's data
  in its own dedicated `Apps/<app>` folder rather than the OneDrive root. Alternative: a fixed path in
  the OneDrive root (e.g. `/me/drive/root:/devops-organizer/…`). Is the app folder the intended home?
- **Mapping key = bare GUID (globally unique), map is a flat `{ guid: name }`.** The picker is still
  org-scoped in the UI. Alternative: a compound `"<org>/<guid>"` key if you want the *same* GUID to
  map differently per organization. **OK to key by GUID alone?**
- **New model field `projectIsUnresolvedGuid` drives the action's visibility**, so the UI never
  re-derives GUID detection (honours "components consume tags verbatim"). Alternative: expose it via a
  helper on the service instead of a stored field, or let the UI test `GUID_RE` (rejected — that
  duplicates business logic). OK to extend `CategorizedEmail`?
- **Map-fetch failure is non-fatal.** If the map file is missing/unreadable the app loads mail with an
  empty map (GUIDs stay unresolved) and shows **no** error; only *mail* fetch failure surfaces the
  error state. Matches "if no mapping file found, nothing changes." Alternative: surface a dismissable
  warning that mappings couldn't load. Acceptable to fail silently?
- **The Save spinner and error live in the dialog** (around the awaited `resolveProjectGuid`), and the
  dialog closes only on success; on failure it stays open showing an error. The AC specifies the
  spinner but is silent on the failure path — is "stay open + show error" the wanted behavior?

## Considerations
- **Security — scope breadth.** `Files.ReadWrite` grants read/write to the user's whole OneDrive,
  broader than the (unsupported-here) AppFolder scope; it is the least-privilege option that actually
  works for org accounts, and access is still delegated (only the signed-in user's own drive). No
  tokens are stored outside MSAL's cache (`authentication.md`). Called out so the broadening is a
  conscious, documented staging decision, not scope creep.
- **OneDrive must be provisioned.** The signed-in org account must have a OneDrive for Business drive
  for `/me/drive/**` to resolve; if it isn't provisioned, the map read 404s/403s and (per the
  non-fatal decision) the app simply runs with no mappings. A risk to be aware of on fresh tenants.
- **Concurrency (last-write-wins).** Saving merges into the last-loaded map and rewrites the whole
  file. Two browser tabs saving different GUIDs could clobber each other's newest entry. For a
  single-user tool with rare edits this is acceptable; merging into the in-memory latest map (not a
  stale snapshot) minimizes it.
- **jsdom can't verify visuals/interaction.** Per `testing.md`, the dialog opening, the picker's
  freeform typing, the spinner, and the recategorized list are interactive; jsdom component tests
  assert DOM/state (dialog present, button gated, `onResolve` called) but the real
  save→spinner→persist→reload round-trip needs a browser + real Graph (see live verification).
- **`Combobox` freeform value capture.** Fluent v9 `Combobox` with `freeform` surfaces the typed value
  via `onInput` (and selections via `onOptionSelect`); the hook must read the free text, not only the
  selected `Option`, so a brand-new name saves correctly.

## Testing recommendations
The project has an established practice (Vitest, `npm run test`; `testing.md`), so this story ships
tests. **Altitude:** pure unit tests for the engine, the storage service (mocked client), and
`deriveKnownProjectNames`; hook tests (`renderHook`) for `useResolveProjectDialog`; a component test
for the dialog and for `EmailList`'s Actions column through the `FluentProvider`/`webLightTheme`
wrapper.

- **Must-cover (beyond what the ACs already pin):**
  - Engine: a fixture whose project is `AZELIS_GUID` **with** a matching map entry → `project` is the
    friendly name, `projectIsUnresolvedGuid === false`, and the GUID no longer forces
    `needsReview: true`; **without** a map entry → project stays the GUID and
    `projectIsUnresolvedGuid === true`.
  - Engine: map lookup is **case-insensitive** (upper-case GUID in the URL, lower-case key resolves);
    a map entry for an unrelated GUID leaves other rows untouched; an entry does **not** resurrect a
    no-URL / `UNCATEGORIZED` row (only GUID projects are mapped); empty/omitted map → identity.
  - Storage: `fetchProjectMap` on a 404 → `{}` (not a throw); on a well-formed file → the parsed map;
    on malformed JSON → `{}`. `saveProjectMapping` PUTs the **merged** object (existing entries kept)
    with the new key **lowercased** and name **trimmed**, and returns it.
  - `deriveKnownProjectNames`: excludes `UNCATEGORIZED` and unresolved-GUID projects, is unique and
    sorted case-insensitively, and is scoped to the given customer.
  - `useResolveProjectDialog`: `save` sets `saving` true while awaiting and calls
    `onResolve(guid, typedName)`; on resolve it closes; on reject `saving` returns false and `error`
    is set (dialog stays open). Save is disabled for an empty/whitespace value.
  - `EmailList`: an unresolved-GUID row shows the **"Resolve project GUID"** action; a resolved /
    non-GUID row shows none; clicking opens the dialog with that GUID; Cancel closes it. The five
    original columns plus **Actions** all render.
- **Live verification (needs manual browser check before merge — no real-Graph E2E harness):** sign
  in, open the dialog on a GUID row, save a name → the **spinner** shows, the dialog closes, and
  **every** row with that GUID now shows the name (AC 1, 6, 7); then **reload the browser** and
  confirm the mapping is still applied (AC 8, the OneDrive round-trip).

## Definition of done
- [ ] Mapped GUIDs render as their **friendly name** across the list; unmapped GUIDs are unchanged and
      still flagged (AC 1; `categorization-domain.md` fallback invariant).
- [ ] The overview has an **"Actions"** column; a row whose project is an **unresolved GUID** shows a
      **"Resolve project GUID"** action, and other rows do not (AC 2).
- [ ] The action opens the **"Resolve Project GUID"** dialog showing that row's GUID (AC 3); the
      **Cancel** button dismisses it (AC 4).
- [ ] The dialog's **project picker** lists the discovered project names for the e-mail's organization
      **and** accepts a typed custom name (AC 5).
- [ ] **Save** writes the mapping and, on success, closes the dialog and re-categorizes so **all**
      e-mails with that GUID show the name (AC 6); a **spinner** shows while saving (AC 7).
- [ ] The mapping is **persisted to the user's OneDrive** and **re-loaded on app start**, so it
      survives closing/reopening the browser (AC 8) — verified live (manual).
- [ ] Categorization stays **pure**: the map is passed into `categorizeEmails`; no I/O in the engine;
      the UI consumes `projectIsUnresolvedGuid`/tags verbatim and never re-derives them
      (`categorization-domain.md`).
- [ ] Graph is called only with an MSAL-acquired token; the added write scope is the least-privilege
      option that works for org accounts and is documented in `msalConfig`/`graphClient`
      (`authentication.md`).
- [ ] New/updated unit + component tests (engine mapping, storage service, `deriveKnownProjectNames`,
      dialog hook + render, `EmailList` action column) pass; full `npm run test` is green (`testing.md`).
- [ ] Type-checks and builds cleanly (`npm run build`); no ESLint errors; Prettier-clean
      (`npm run lint`, `npm run format:check`) (`frontend-architecture.md` "what done looks like").
- [ ] No new dependency; no new `VITE_*` env var; `.env.sample` unchanged.

## Files/areas affected
- `src/models/categorization.ts` — **edit** (`ProjectGuidMap`, `projectIsUnresolvedGuid`).
- `src/services/categorization/categorizationService.ts` — **edit** (thread + apply `projectMap`).
- `src/services/categorization/categorizationService.test.ts` — **edit** (mapping tests).
- `src/services/projectMap/projectMapService.ts` — **new** (fetch/save the OneDrive map).
- `src/services/projectMap/projectMapService.test.ts` — **new**.
- `src/auth/msalConfig.ts` — **edit** (`Files.ReadWrite` in `loginRequest`).
- `src/services/graph/graphClient.ts` — **edit** (`Files.ReadWrite` in client scopes).
- `src/hooks/useCategorizedMail.ts` — **edit** (fetch map, thread it, `resolveProjectGuid`).
- `src/components/ResolveProjectDialog/ResolveProjectDialog.tsx` — **new**.
- `src/components/ResolveProjectDialog/useResolveProjectDialog.ts` — **new**.
- `src/components/ResolveProjectDialog/knownProjects.ts` — **new** (pure helper).
- `src/components/ResolveProjectDialog/*.test.ts(x)` — **new** (helper + hook + dialog).
- `src/components/EmailList/EmailList.tsx` — **edit** (Actions column + dialog render).
- `src/components/EmailList/useEmailList.ts` — **edit** (`resolveTarget` state).
- `src/components/EmailList/EmailList.test.tsx`, `useEmailList.test.ts` — **edit**.
- `src/components/Organizer/Organizer.tsx`, `src/components/Organizer/useOrganizer.ts` — **edit**
  (pass `allEmails` + `resolveProjectGuid` through).
