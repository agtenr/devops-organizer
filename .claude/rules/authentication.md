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
- Request **least privilege** — read-only mail access (**`Mail.Read`**). Do not add write
  or broader scopes without an explicit reason.
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
