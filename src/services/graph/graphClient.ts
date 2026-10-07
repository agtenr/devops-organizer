import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { BrowserAuthError, InteractionRequiredAuthError } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';
import { msalInstance } from '../../auth/msalConfig';

// Graph scopes the app acquires tokens for: read/write mail (read story 36, delete story 43) and
// read/write files to persist the project GUID map in the user's OneDrive app folder (story 42). All
// are consented once at sign-in (see msalConfig `loginRequest`), so acquireTokenSilent normally returns
// a cached/renewed token with no user interaction. See `.claude/rules/authentication.md` for the
// scope-staging rationale (read stays the default posture; write is scoped to mail for delete).
const GRAPH_SCOPES = ['Mail.ReadWrite', 'Files.ReadWrite'];

// MSAL error codes raised when the silent iframe renewal hangs or is blocked (story 128): the iframe
// loads the app's own redirect URI, MSAL refuses the reload (`block_iframe_reload`) and the call ends in
// `timed_out`. Neither is an `InteractionRequiredAuthError`, but both mean silent renewal cannot work.
const SILENT_FAILURE_CODES = ['timed_out', 'block_iframe_reload'];

/** True when a failed silent token request should fall back to an interactive redirect sign-in. */
export function needsInteractiveSignIn(error: unknown): boolean {
  return (
    error instanceof InteractionRequiredAuthError ||
    (error instanceof BrowserAuthError && SILENT_FAILURE_CODES.includes(error.errorCode))
  );
}

/**
 * Acquires a Graph access token for the account. The token comes silently from MSAL's cache; if it
 * cannot be renewed silently (`InteractionRequiredAuthError`, or the silent iframe timing out / being
 * blocked — see `needsInteractiveSignIn`) we fall back to an interactive redirect — consistent with
 * the app's redirect-only auth stance (see `.claude/rules/authentication.md`). Tokens live only in
 * MSAL's cache; this never stores them elsewhere.
 */
export async function acquireGraphToken(account: AccountInfo): Promise<string> {
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
    return result.accessToken;
  } catch (error) {
    if (needsInteractiveSignIn(error)) {
      // Full-page redirect to re-consent/renew; the current page navigates away.
      await msalInstance.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
    }
    throw error;
  }
}

/** Builds a Microsoft Graph client authenticated as the signed-in user (see `acquireGraphToken`). */
export function createGraphClient(account: AccountInfo): Client {
  const authProvider: AuthenticationProvider = {
    getAccessToken: () => acquireGraphToken(account),
  };

  return Client.initWithMiddleware({ authProvider });
}
