import { PublicClientApplication } from '@azure/msal-browser';
import type { Configuration, RedirectRequest } from '@azure/msal-browser';

// All configuration comes from VITE_* env vars (see `.env.sample`) — never hardcode the
// client/tenant IDs in source (see `.claude/rules/authentication.md`).
const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID;
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID;

const configuration: Configuration = {
  auth: {
    clientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    // The SPA is served at the app origin; the app registration must allow this redirect URI.
    redirectUri: '/',
  },
  cache: {
    // localStorage (not sessionStorage) so the session is remembered across browser sessions
    // and the user is not re-prompted on every visit. Tokens live only in MSAL's cache.
    cacheLocation: 'localStorage',
  },
};

// Single MSAL instance shared across the app; `initialize()` is awaited in `main.tsx` before use.
export const msalInstance = new PublicClientApplication(configuration);

// Sign-in requests, alongside the implicit OIDC scopes MSAL always includes:
// - `Mail.ReadWrite` — read mail (story 36) plus delete mail (story 43). Read stays the default
//   posture; the write capability is added only because deleting e-mails requires a mail write
//   scope, and it stays scoped to mail (never broader). See `.claude/rules/authentication.md`.
// - `Files.ReadWrite` — to persist the project GUID→name map in the user's OneDrive app folder
//   (story 42). `Files.ReadWrite.AppFolder` (narrower) is unsupported for the organizational
//   accounts this app signs in with, so the broader scope is the least-privilege option that works
//   here; the data still lives in the dedicated app folder. See `.claude/rules/authentication.md`.
// Consenting to both once at sign-in lets the app acquire tokens silently thereafter.
export const loginRequest: RedirectRequest = {
  scopes: ['Mail.ReadWrite', 'Files.ReadWrite'],
};
