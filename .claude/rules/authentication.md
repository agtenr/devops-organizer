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

## TODO (undecided)
- Confirm the exact Graph scope string and the folder-read endpoint (folder **by name**
  vs. resolving a folder **id** first) during implementation.
