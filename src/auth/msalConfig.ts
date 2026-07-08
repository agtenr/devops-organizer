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

// Interactive sign-in requests only the implicit OIDC scopes (openid/profile), which is enough
// to read the display name from the ID token. Mail.Read is deferred to the mail-reading story.
export const loginRequest: RedirectRequest = {
  scopes: [],
};
