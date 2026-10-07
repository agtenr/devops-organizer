# Plan — AB#128: Authentication timeout

## Context

Sometimes the app never loads. The "Loading mail from …" spinner shows for a long time, then the page
shows `Failed to load mail: timed_out`. The console also shows `block_iframe_reload`.

**Found:** every Graph call gets its token in `src/services/graph/graphClient.ts`
(`createGraphClient` → `getAccessToken`). It calls `msalInstance.acquireTokenSilent`. When the cached
token cannot be renewed from the refresh token, MSAL opens a hidden iframe that loads the app's
`redirectUri` (`'/'`, set in `src/auth/msalConfig.ts`). That iframe loads the whole app, which MSAL
blocks (`block_iframe_reload`), and the call ends in `timed_out`.

**Found:** the code only falls back to a redirect sign-in for `InteractionRequiredAuthError`. A
timeout is a different error type, so it is rethrown and shown as the mail error.

**Assumed:** the trigger is an expired refresh token (for example the app left idle for a day) or
blocked third-party cookies. The story does not say. The fix below works for both.

*(dev-seeded: approach chosen live with the dev — fall back to redirect; no Entra app-registration
change.)*

## Keep it simple

- **Non-goal: no `redirect.html` / dedicated silent-iframe page.** That would need a new redirect URI
  registered on the Entra app, and can still time out when third-party cookies are blocked.
- **Non-goal: no change to scopes, `loginRequest`, cache location or `msalConfig.ts`.** The scope
  staging log in `.claude/rules/authentication.md` stays as is.
- **Non-goal: no retry loop, no custom timeout settings.** One failed silent attempt goes straight
  to the redirect.
- **Non-goal: no new UI.** The page reloads through Microsoft sign-in, which is the existing
  recovery path for `InteractionRequiredAuthError`.

## AC coverage

| AC | Status | Where |
|---|---|---|
| The authentication timeout bug is fixed | covered | Tasks 1–2. Read as: when silent renewal times out, the app recovers by redirecting to sign in instead of showing `timed_out`. |

## Implementation approach

In `getAccessToken` (`src/services/graph/graphClient.ts`), extend the existing `catch` so the redirect
fallback runs for three cases instead of one:

- `InteractionRequiredAuthError` (existing).
- `BrowserAuthError` with `errorCode` `timed_out`.
- `BrowserAuthError` with `errorCode` `block_iframe_reload`.

Put the check in a small pure function in the same file (`needsInteractiveSignIn(error: unknown):
boolean`). Compare `errorCode` as strings, because these are the codes MSAL prints in the story's
console output. Everything else is rethrown unchanged, so real failures (network, 403) still surface.

This keeps the single place that owns token acquisition. Hooks and components do not change.

## Task breakdown

1. **Fallback on timeout.** Edit `src/services/graph/graphClient.ts`:
   add `needsInteractiveSignIn` and use it in the `catch` of `getAccessToken`. Update the file's doc
   comment to say timeouts are handled too. Rules: `.claude/rules/authentication.md` (tokens only in
   MSAL's cache, redirect-only stance, no new scopes), `.claude/rules/frontend-architecture.md`.
2. **Unit tests.** Add `src/services/graph/graphClient.test.ts`. Mock `msalInstance`
   (`../../auth/msalConfig`) with `vi.fn()` for `acquireTokenSilent` and `acquireTokenRedirect`. Call
   the provider via `createGraphClient(account)` or export the check for direct testing. Rule:
   `.claude/rules/testing.md`.
3. **Update the auth rule.** In `.claude/rules/authentication.md`, change "falling back to
   `acquireTokenRedirect` only on `InteractionRequiredAuthError`" (Scope staging, story 36) to also
   name the timeout cases. No scope changes, so no new log entry.

## Assumptions & open questions

- **Error codes covered.** Only `timed_out` and `block_iframe_reload` trigger the redirect. Both were
  seen in the story's console output. Add `monitor_window_timeout`, or keep just these two? Reply A
  (keep two, recommended: smallest fix that matches the evidence) or B (add the third).
- **Brief error flash before the redirect.** `getAccessToken` rethrows after starting the redirect (as
  it does today for `InteractionRequiredAuthError`), so `useCategorizedMail` may flash the error for
  a moment while the page navigates. Accept this (A, recommended: same as existing behaviour) or
  B: return a never-resolving promise after starting the redirect?

## Considerations

- **Redirect loop risk:** low. After the redirect, sign-in puts fresh tokens in MSAL's cache, so the
  next silent call succeeds. The `MsalAuthenticationTemplate` already handles the returning redirect.
- **Security:** no new scopes, no new token storage. Tokens stay in MSAL's cache.
- **Cannot be reproduced on demand.** The timeout depends on token age and browser cookie settings.
  The unit test pins the logic; a manual check is listed under Definition of done.
- **Story hygiene:** the story's console paste contains an auth `code=` value. It is a one-time
  value, but the author may want to remove it.

## Testing recommendations

- **Altitude:** unit tests with Vitest (the project's runner), not E2E. The bug is in token
  handling, which the mock-data harness does not exercise (it bypasses MSAL).
- **Must-cover:**
  - `acquireTokenSilent` rejects with `BrowserAuthError` `timed_out` → `acquireTokenRedirect` called once with the same scopes and account.
  - Same for `block_iframe_reload`.
  - `InteractionRequiredAuthError` → redirect (existing behaviour kept).
  - Any other error (e.g. a generic `Error`, or a `BrowserAuthError` with another code) → no redirect; the error is rethrown.
  - Success → returns `accessToken`, no redirect.
- No screenshot: there is no UI change.

## Definition of done

- [ ] `getAccessToken` redirects to sign-in when silent renewal fails with `timed_out` or `block_iframe_reload` (AC).
- [ ] Other errors are still rethrown and no redirect happens for them.
- [ ] `graphClient.test.ts` covers the must-cover cases and `npm run test` passes.
- [ ] `npm run build`, `npm run lint` and `npm run format:check` pass.
- [ ] `.claude/rules/authentication.md` describes the timeout fallback; Scope staging log needs no new entry.
- [ ] `git status` shows the new test file tracked.
- [ ] Manual live check before merge: with an expired/cleared token cache, opening the app signs the user in and loads mail, with no `timed_out` page.

## Files/areas affected

- `src/services/graph/graphClient.ts` (change)
- `src/services/graph/graphClient.test.ts` (new)
- `.claude/rules/authentication.md` (one-sentence update)
