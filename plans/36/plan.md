# Plan — Story 36: Fetch e-mails

## Context
The app is meant to triage a daily flood of Azure DevOps notification e-mails (see
`.claude/rules/categorization-domain.md`). Story 30 (*done*) gates the app behind an Entra ID
sign-in and shows the top bar. Nothing yet reads mail. **This story adds the read path only:**
on load, fetch **all** messages from the user's Outlook **`DevOps`** folder via Microsoft Graph,
in a dedicated service, and dump the **raw** Graph output to the screen in a `<pre>` for
inspection. It deliberately stops before any parsing, categorization, or list UI.

The stack for this is fixed by `.claude/rules/authentication.md`: read mail with the **Microsoft
Graph JS SDK** (`@microsoft/microsoft-graph-client`) using an MSAL-acquired token, requesting the
**least-privilege `Mail.Read`** scope, with the folder name coming from `VITE_MAIL_FOLDER`
(default `DevOps`). Research at plan time: the current client is
`@microsoft/microsoft-graph-client@3.0.7` with types `@microsoft/microsoft-graph-types@2.43.1`;
MSAL is already on v5 (`@azure/msal-browser@5.17.0`).

## Keep it simple
This is a fetch-and-dump spike, not the mail feature. Concrete non-goals:
- **No categorization / tagging.** The `(Customer, Project, Type)` triple, the categorization
  service, and its rules (`.claude/rules/categorization-domain.md`) are later stories. This story
  produces raw Graph JSON, nothing derived.
- **No real list UI, tabs, or sidebar.** The only new UI is a **temporary** debug component that
  prints raw JSON in a `<pre>`. It is explicitly slated for removal and must not become the mail
  list.
- **No domain model / mapping layer.** We return the raw Graph `Message` objects as-is; we do
  **not** introduce an `Email` model, DTO, or field mapping yet (that arrives with categorization).
- **No persistence, caching, or pagination UI.** In-memory only, fetched once on load, bounded
  (~100 messages) per `.claude/rules/frontend-architecture.md`.
- **No broadening of the login flow.** Login scopes stay OIDC-only; `Mail.Read` is requested
  **incrementally** at fetch time, not added to the sign-in request.
- **No retry/backoff, throttling handling, or delta sync.** A single fetch on load with a plain
  error surface is sufficient for a debug spike.

## Implementation approach
Add a **Graph client factory** and a **mail service**, then a **temporary debug component** that
calls the service on mount and renders the raw result. Wire the debug component into the
authenticated area of `App` (below `<TopBar />`).

Token acquisition reuses the existing singleton `msalInstance` (`src/auth/msalConfig.ts`). The
sanctioned browser integration is the Graph SDK's **`AuthCodeMSALBrowserAuthenticationProvider`**
(from `@microsoft/microsoft-graph-client/authProviders/authCodeMsalBrowser`), which wraps MSAL and
does `acquireTokenSilent` with an interactive fallback. Because `Mail.Read` was **not** consented
at sign-in (login uses OIDC-only scopes), the *first* fetch triggers an incremental-consent
interaction; we use the same **redirect** interaction type the app already uses everywhere, so no
popup is introduced.

`DevOps` is a **custom** (non-well-known) folder, so the `/me/mailFolders('DevOps')` well-known
shortcut does not apply. Resolve the folder id first via
`GET /me/mailFolders?$filter=displayName eq '<name>'`, then list its messages, selecting only the
fields the story needs and **paging until exhausted** so "all" is honoured.

Concrete files:
- **`src/services/graph/graphClient.ts`** *(new)* — `createGraphClient(account: AccountInfo): Client`.
  Builds an `AuthCodeMSALBrowserAuthenticationProvider` over the imported `msalInstance` with
  `{ account, scopes: ['Mail.Read'], interactionType: InteractionType.Redirect }`, and returns
  `Client.initWithMiddleware({ authProvider })`. This is the one place the mail scope is named.
- **`src/services/mail/mailService.ts`** *(new)* — `fetchMailFromFolder(client: Client, folderName: string): Promise<Message[]>`.
  (1) resolve folder id via `.api('/me/mailFolders').filter(\`displayName eq '${folderName}'\`).select('id,displayName').get()`;
  (2) if no folder matches, throw a clear `Error` naming the folder; (3)
  `.api(\`/me/mailFolders/${id}/messages\`).select('subject,sender,from,body,receivedDateTime').top(50).get()`
  and drain all pages with the SDK **`PageIterator`**, collecting the raw `Message` objects.
- **`src/components/MailDebug/MailDebug.tsx` + `useMailDebug.ts`** *(new, TEMPORARY)* — the hook
  owns the fetch: reads the signed-in account via `useMsal()`, builds the client, calls the
  service in a `useEffect` on mount, and exposes `{ status, messages, error }`. The `.tsx` renders
  a Fluent `Spinner` while loading, an error `Text` on failure, and the raw payload as
  `<pre>{JSON.stringify(messages, null, 2)}</pre>` on success. A comment marks the whole folder as
  temporary / to be removed.
- **`src/App/App.tsx`** *(changed)* — render `<MailDebug />` under `<TopBar />` inside the
  authenticated area.
- **`src/vite-env.d.ts`** *(changed)* — add `readonly VITE_MAIL_FOLDER: string` to `ImportMetaEnv`.
- **`.env.sample`** *(changed)* — document `VITE_MAIL_FOLDER=DevOps`.
- **`.claude/rules/authentication.md`** *(changed)* — resolve the "Mail reading (later story,
  TODO)" scope-staging note now that the decision is settled (`Mail.Read`; folder resolved by
  display name → id).

Dependencies to add (exact-pinned, `npm install --save-exact`):
`@microsoft/microsoft-graph-client@3.0.7` and, as a dev dependency for types,
`@microsoft/microsoft-graph-types@2.43.1`.

## Data contracts
- **Environment → mail service** (`import.meta.env`, string). Name must match `.env.sample`,
  `vite-env.d.ts`, `.claude/rules/authentication.md`, and the code exactly:
  - `VITE_MAIL_FOLDER: string` (default `'DevOps'` when unset) → `folderName` argument of
    `fetchMailFromFolder`.
- **MSAL token request** (consumed by the auth provider): `{ scopes: ['Mail.Read'], account: AccountInfo }`.
  The scope string is exactly `Mail.Read` (delegated).
- **Graph folder lookup → id**: response is `{ value: MailFolder[] }`; take `value[0].id`
  (`MailFolder.id?: string`). Empty `value` ⇒ folder-not-found error.
- **Graph message → debug UI**: raw `Message` from `@microsoft/microsoft-graph-types` — every
  requested field is **optional**: `subject?: string | null`, `sender?: Recipient | null`,
  `from?: Recipient | null`, `body?: ItemBody | null` (`ItemBody.contentType`, `ItemBody.content`),
  `receivedDateTime?: string | null`. The UI must not assume any field is present; it only
  `JSON.stringify`s the array, so no field access is required.

## Task breakdown
1. **Add Graph dependencies.** Add `@microsoft/microsoft-graph-client@3.0.7` (dependency) and
   `@microsoft/microsoft-graph-types@2.43.1` (devDependency), **exact-pinned**
   (`npm install --save-exact`; no `^`/`~`/`*`). Rule: `.claude/rules/frontend-architecture.md`
   (exact pins, npm).
2. **Add the `VITE_MAIL_FOLDER` env var.** Add `readonly VITE_MAIL_FOLDER: string` to
   `src/vite-env.d.ts` and document `VITE_MAIL_FOLDER=DevOps` in `.env.sample` (`.env` stays
   gitignored). Rule: `.claude/rules/authentication.md` (VITE_* config, no hardcoded folder name),
   `.claude/rules/frontend-architecture.md`.
3. **Create `src/services/graph/graphClient.ts`.** `createGraphClient(account)` wiring
   `AuthCodeMSALBrowserAuthenticationProvider` over `msalInstance` with `Mail.Read` + redirect
   interaction, returning `Client.initWithMiddleware`. Rules: `.claude/rules/authentication.md`
   (Graph via MSAL token, least-privilege `Mail.Read`, tokens only in MSAL cache, no hardcoded
   IDs), `.claude/rules/frontend-architecture.md` (service under `src/`, front-end only).
4. **Create `src/services/mail/mailService.ts`.** `fetchMailFromFolder(client, folderName)`:
   resolve folder id by `displayName` filter, error clearly if absent, then page **all** messages
   via `PageIterator` selecting `subject,sender,from,body,receivedDateTime`; return raw
   `Message[]`. Rules: `.claude/rules/categorization-domain.md` (fetch is folder-scoped, in-memory;
   never crash/drop silently — surface a clear error), `.claude/rules/frontend-architecture.md`
   (fetch once on load, bounded set, logic in a service not a component).
5. **Build the temporary `MailDebug` component + `useMailDebug` hook.** Hook reads the account
   from `useMsal()`, builds the client, fetches on mount, exposes `{ status, messages, error }`;
   `.tsx` renders spinner / error / `<pre>` raw JSON. Mark clearly as temporary. Rule:
   `.claude/rules/frontend-architecture.md` (component-per-folder, logic-in-hook, Fluent UI).
6. **Render `<MailDebug />` in `src/App/App.tsx`** below `<TopBar />` in the authenticated area.
   Rule: `.claude/rules/frontend-architecture.md` (Fluent UI, layout).
7. **Resolve the auth-rule scope-staging TODO.** Update `.claude/rules/authentication.md`'s "Mail
   reading (later story, TODO)" bullet to record the settled decision: delegated `Mail.Read`,
   acquired incrementally at fetch; custom folder resolved by `displayName` → id. Rule:
   `.claude/rules/authentication.md`.
8. **Add unit tests.** `src/services/mail/mailService.test.ts` with a **mocked** `Client`
   (stub `.api().filter().select().get()` and `.top().get()` + a paged `@odata.nextLink`
   response): asserts it targets the folder-lookup then the messages endpoint, requests the right
   `$select` fields, drains all pages, aggregates results, and throws on an unknown folder. Rule:
   `.claude/rules/testing.md` (Vitest; prefer testing service logic directly over through the UI).
9. **Verify.** `npm run build`, `npm run lint`, `npm run test` green; then a **live** browser run:
   sign in → consent `Mail.Read` → raw messages from the `DevOps` folder render in the `<pre>`.
   Validate the Definition of done. Rules: all skills' "done" bars +
   `.claude/rules/authentication.md` invariants.

## Assumptions & open questions
- **Folder resolved by `displayName` filter → id, not a well-known-name shortcut.** `DevOps` is a
  custom folder, so `/me/mailFolders('DevOps')` (well-known shortcut) does not resolve it; we do
  `$filter=displayName eq 'DevOps'` and use `value[0].id`. Alternative the reviewer may prefer:
  configure the folder **id** directly via env instead of resolving by name.
- **Auth provider = `AuthCodeMSALBrowserAuthenticationProvider` with `InteractionType.Redirect`.**
  Reuses the app's redirect-only stance; the first fetch triggers an incremental-consent
  **redirect** for `Mail.Read`. Alternative: a hand-rolled `acquireTokenSilent` callback, and/or
  **popup** interaction for consent so app state is preserved instead of a full-page redirect.
- **Scope = delegated `Mail.Read` (exact string).** Least privilege per the auth rule. Confirming
  the exact scope string is right (vs. e.g. `Mail.ReadBasic`, which omits the body — but the story
  requires the body).
- **Selected fields = `subject,sender,from,body,receivedDateTime`.** The story asks for sender,
  subject, body; `from` is included because ADO notifications set the practical author there and
  `sender` can differ, and `receivedDateTime` gives the dump a stable order. Alternative: restrict
  to exactly `subject,sender,body` as literally listed.
- **"All" via `PageIterator` (page size `$top=50`).** Honours "all e-mails fetched" even though the
  working set is bounded (~100). Alternative the reviewer may prefer: a single `$top=100` call for
  simplicity, accepting it silently truncates if the folder ever exceeds 100.
- **Service split into two modules** (`services/graph/graphClient.ts` for auth-wiring +
  `services/mail/mailService.ts` for the query) rather than one combined module. Alternative: a
  single `mailService.ts` that both builds the client and fetches.

## Considerations
- **Incremental consent is expected, not a bug.** Because login requested only OIDC scopes, the
  first mail fetch will prompt for `Mail.Read` consent (a redirect). Subsequent loads acquire the
  token silently from MSAL's cache.
- **App-registration `Mail.Read`.** The existing app registration must permit the delegated
  `Mail.Read` scope (user or admin consent). If it is blocked, the consent redirect returns an
  `AADSTS` error; the debug component surfaces the error text.
- **The debug component is throwaway.** It exists only to eyeball raw Graph output and must be
  removed when the real list/categorization lands; keep it isolated so removal is a folder delete
  plus one line in `App.tsx`.
- **Graph type nullability.** All `Message` fields are optional/nullable; since the UI only
  `JSON.stringify`s, there is no field-access risk this story, but downstream stories must not
  assume presence.

## Testing recommendations
- **Spec-level (behavioral) tests? Yes.** Unit-test `mailService` against a **mocked** Graph
  `Client`: it hits the folder-lookup then the folder's messages endpoint, requests the correct
  `$select`, pages through `@odata.nextLink` until exhausted, aggregates all messages, and throws a
  clear error when the folder is not found. This is the pure, mockable seam; the MSAL/Graph network
  path itself is not unit-testable.
- **Live / end-to-end test? Yes (manual).** A manual live browser run — sign in, consent
  `Mail.Read`, confirm the raw messages from the real `DevOps` folder render in the `<pre>` with
  sender/subject/body present. No automated Playwright coverage is added: it would require a real
  credentialed Graph call (fragile/unsafe in the harness), consistent with story 30's E2E stance.

## Definition of done
- [ ] E-mails are fetched from Microsoft Graph using `@microsoft/microsoft-graph-client` with an MSAL-acquired token (AC: fetched using the Graph API; authentication.md: Graph only via MSAL token).
- [ ] Fetching is scoped to the folder named by `VITE_MAIL_FOLDER` (default `DevOps`) (AC: fetched from a specific folder; authentication.md: folder name via env, not hardcoded).
- [ ] **All** messages in that folder are retrieved — paging is drained, not just the first page (AC: all e-mails from that folder are fetched; categorization-domain.md: never silently drop).
- [ ] The raw Graph response is rendered on screen in a `<pre>` by a clearly-temporary debug component (AC: raw graph response printed on the screen).
- [ ] Each fetched message includes sender, subject, and body (AC: sender, subject and body are returned).
- [ ] The Graph call lives in its own service under `src/services/`, not inline in a component (AC: implement the graph call in its own service; frontend-architecture.md: logic in service).
- [ ] Only the delegated `Mail.Read` scope is requested — no broader or write scope; login scopes are unchanged (authentication.md: least privilege).
- [ ] Client/tenant IDs and the folder name are read only from `VITE_*` env vars — none hardcoded (authentication.md invariant).
- [ ] Tokens are acquired through MSAL and held only in MSAL's cache — no other token storage (authentication.md invariant).
- [ ] New dependencies are exact-pinned — no `^`/`~`/`*` (frontend-architecture.md).
- [ ] `npm run build`, `npm run lint`, and `npm run test` all pass; `mailService` has unit tests over a mocked Graph client (testing.md).
- [ ] The live browser run shows real `DevOps`-folder messages' raw JSON in the `<pre>` (ratified live test).

## Files/areas affected
- **New:** `src/services/graph/graphClient.ts`, `src/services/mail/mailService.ts`,
  `src/services/mail/mailService.test.ts`, `src/components/MailDebug/MailDebug.tsx`,
  `src/components/MailDebug/useMailDebug.ts`.
- **Changed:** `package.json` (Graph deps, exact-pinned), `src/App/App.tsx` (render `<MailDebug />`),
  `src/vite-env.d.ts` (`VITE_MAIL_FOLDER`), `.env.sample` (`VITE_MAIL_FOLDER`),
  `.claude/rules/authentication.md` (resolve the mail-scope-staging TODO).
- **Untouched:** MSAL sign-in flow / `msalConfig.ts` (login scopes unchanged), TopBar/auth
  components, categorization (none exists yet), CI/CD (none).
