import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AccountInfo } from '@azure/msal-browser';
import { BrowserAuthError, InteractionRequiredAuthError } from '@azure/msal-browser';

const acquireTokenSilent = vi.fn();
const acquireTokenRedirect = vi.fn();
vi.mock('../../auth/msalConfig', () => ({
  msalInstance: {
    acquireTokenSilent: (...args: unknown[]) => acquireTokenSilent(...args),
    acquireTokenRedirect: (...args: unknown[]) => acquireTokenRedirect(...args),
  },
}));

import { acquireGraphToken } from './graphClient';

const account = { homeAccountId: 'home', username: 'user@example.com' } as AccountInfo;
const scopes = ['Mail.ReadWrite', 'Files.ReadWrite'];

describe('acquireGraphToken', () => {
  beforeEach(() => {
    acquireTokenSilent.mockReset();
    acquireTokenRedirect.mockReset();
    acquireTokenRedirect.mockResolvedValue(undefined);
  });

  it('returns the access token without redirecting on success', async () => {
    acquireTokenSilent.mockResolvedValue({ accessToken: 'tok' });
    await expect(acquireGraphToken(account)).resolves.toBe('tok');
    expect(acquireTokenRedirect).not.toHaveBeenCalled();
  });

  it.each(['timed_out', 'block_iframe_reload'])(
    'redirects to sign in when silent renewal fails with %s',
    async (code) => {
      const error = new BrowserAuthError(code, 'test');
      acquireTokenSilent.mockRejectedValue(error);
      await expect(acquireGraphToken(account)).rejects.toBe(error);
      expect(acquireTokenRedirect).toHaveBeenCalledTimes(1);
      expect(acquireTokenRedirect).toHaveBeenCalledWith({ scopes, account });
    },
  );

  it('still redirects on InteractionRequiredAuthError', async () => {
    acquireTokenSilent.mockRejectedValue(
      new InteractionRequiredAuthError('interaction_required', 'test'),
    );
    await expect(acquireGraphToken(account)).rejects.toBeInstanceOf(InteractionRequiredAuthError);
    expect(acquireTokenRedirect).toHaveBeenCalledTimes(1);
  });

  it.each([new Error('network down'), new BrowserAuthError('empty_window_error', 'test')])(
    'rethrows other errors without redirecting',
    async (error) => {
      acquireTokenSilent.mockRejectedValue(error);
      await expect(acquireGraphToken(account)).rejects.toBe(error);
      expect(acquireTokenRedirect).not.toHaveBeenCalled();
    },
  );
});
