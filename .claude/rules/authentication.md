<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->

# Authentication rules

## How it works here
- Sign-in with an **organizational (Entra ID) account** against an **existing app
  registration**.
  - Client ID: `9d1fdce9-fb8c-432e-a293-8a879ce34c26`
  - Tenant ID: `17b35a1d-057c-4ac5-a15a-08758f7a7064`
- Auth library: **MSAL React** (`@azure/msal-react`) + **msal-browser**
  (`@azure/msal-browser`) for the SPA sign-in flow.
- Mail is read via the **Microsoft Graph JS SDK** (`@microsoft/microsoft-graph-client`)
  from the Outlook folder named **`DevOps`**.

## Where it lives (config / secrets)
- Configuration comes from **`VITE_*` env vars**, read via `import.meta.env`:
  - `VITE_ENTRA_CLIENT_ID`
  - `VITE_ENTRA_TENANT_ID`
  - `VITE_MAIL_FOLDER` (default `DevOps`)
- `.env` is **gitignored**; a committed **`.env.sample`** documents the variables.
- Note: for a browser SPA the client/tenant IDs are **not real secrets** — they ship in
  the bundle. The real protection is the app registration's **redirect-URI allow-list**
  and requested **scopes**.

## Invariants every change must uphold
- Never call Graph without a valid token acquired through MSAL.
- Request **least privilege, evaluated per stage** — request only the scopes the **current
  slice actually needs**, not a fixed always-on set. Sign-in **alone** needs **no Graph scope**
  (the display name comes from the ID-token claim); the read-only mail scope (**`Mail.Read`**) is
  added only when the app **actually reads mail**. **Read stays the default posture**: a mail
  **write** scope is added only when a feature genuinely requires it — **`Mail.ReadWrite`** for
  **deleting** mail (story 43) — and even then it stays **scoped to mail** (never broader). Do not
  add write or broader scopes without an explicit, per-slice reason. (See **Scope staging** below for
  how this played out across stories 30, 36 and 43.)
- Never hardcode the client ID / tenant ID / folder name in source — always via the
  `VITE_*` vars.

## Common mistakes to avoid
- Storing tokens anywhere other than MSAL's cache.
- Assuming an interactive login where a silent token acquisition suffices (and vice versa).

## Scope staging
- **Sign-in (story 30):** at the auth-setup stage sign-in requested only the implicit OIDC scopes
  (`openid`/`profile`) — enough to read the display name from the ID token — with no Graph client
  and no mail scope (least privilege for what sign-in alone needed).
- **Mail reading (story 36, done):** the app now reads mail, so the least-privilege read-only
  **`Mail.Read`** scope is folded into the **sign-in** request (`loginRequest.scopes`), letting the
  user consent once and the app acquire mail tokens **silently** thereafter via `acquireTokenSilent`
  (falling back to `acquireTokenRedirect` only on `InteractionRequiredAuthError`). `Mail.ReadBasic`
  is insufficient because it omits the message body. The target folder is **custom** (not a
  well-known folder), so it is resolved by **display name → id** (`$filter=displayName eq …`) rather
  than the well-known-name shortcut, with the folder name supplied via `VITE_MAIL_FOLDER`.
- **Project-GUID map persistence (story 42, done):** the app persists a GUID→friendly-name map in the
  signed-in user's OneDrive **app folder** (`/me/drive/special/approot`), so the read/write file scope
  **`Files.ReadWrite`** is added to the **sign-in** request (`loginRequest.scopes`) and the Graph client
  scopes — consented once at sign-in, acquired silently thereafter like `Mail.Read`. The narrower
  **`Files.ReadWrite.AppFolder`** is **not** used: it is valid only for personal Microsoft accounts and
  is unsupported for the **organizational (Entra ID) accounts** this app signs in with, so
  `Files.ReadWrite` is the least-privilege scope that actually works here (the data still lives in the
  dedicated app folder). This is the first write scope; it stays scoped to files (never broader).
- **Mail deletion (story 43, done):** the app now **deletes** mail (row-level and bulk), which needs a
  mail **write** scope, so **`Mail.Read`** is upgraded to **`Mail.ReadWrite`** in both the **sign-in**
  request (`loginRequest.scopes`) and the Graph client scopes — consented once at sign-in and acquired
  silently thereafter, exactly like the earlier scopes. **Read remains the default posture**: this is
  the first *mail* write scope and it is added **only** because delete requires it; it stays **scoped to
  mail** (no broader `Mail.*` or unrelated scopes). Deletion uses Graph's default `DELETE
  /me/messages/{id}`, which moves the message to **Deleted Items** (recoverable) — not a permanent
  delete.
