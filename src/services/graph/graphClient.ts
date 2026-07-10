import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';
import { msalInstance } from '../../auth/msalConfig';

// Graph scopes the app acquires tokens for: read/write mail (read story 36, delete story 43) and
// read/write files to persist the project GUID map in the user's OneDrive app folder (story 42). All
// are consented once at sign-in (see msalConfig `loginRequest`), so acquireTokenSilent normally returns
// a cached/renewed token with no user interaction. See `.claude/rules/authentication.md` for the
// scope-staging rationale (read stays the default posture; write is scoped to mail for delete).
const GRAPH_SCOPES = ['Mail.ReadWrite', 'Files.ReadWrite'];

/**
 * Builds a Microsoft Graph client authenticated as the signed-in user. Tokens are acquired
 * silently from MSAL's cache; only if the cached token cannot be renewed silently
 * (`InteractionRequiredAuthError`) do we fall back to an interactive redirect — consistent with the
 * app's redirect-only auth stance (see `.claude/rules/authentication.md`). Tokens live only in
 * MSAL's cache; this never stores them elsewhere.
 */
export function createGraphClient(account: AccountInfo): Client {
  const authProvider: AuthenticationProvider = {
    getAccessToken: async () => {
      try {
        const result = await msalInstance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account });
        return result.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          // Full-page redirect to re-consent/renew; the current page navigates away.
          await msalInstance.acquireTokenRedirect({ scopes: GRAPH_SCOPES, account });
        }
        throw error;
      }
    },
  };

  return Client.initWithMiddleware({ authProvider });
}
