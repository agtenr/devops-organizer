import { Client } from '@microsoft/microsoft-graph-client';
import type { AuthenticationProvider } from '@microsoft/microsoft-graph-client';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import type { AccountInfo } from '@azure/msal-browser';
import { msalInstance } from '../../auth/msalConfig';

// Least-privilege read-only mail scope. Consented once at sign-in (see msalConfig `loginRequest`),
// so acquireTokenSilent normally returns a cached/renewed token with no user interaction.
const MAIL_SCOPES = ['Mail.Read'];

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
        const result = await msalInstance.acquireTokenSilent({ scopes: MAIL_SCOPES, account });
        return result.accessToken;
      } catch (error) {
        if (error instanceof InteractionRequiredAuthError) {
          // Full-page redirect to re-consent/renew; the current page navigates away.
          await msalInstance.acquireTokenRedirect({ scopes: MAIL_SCOPES, account });
        }
        throw error;
      }
    },
  };

  return Client.initWithMiddleware({ authProvider });
}
