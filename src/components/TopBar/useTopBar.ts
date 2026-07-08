import { useMsal } from '@azure/msal-react';

/**
 * Top-bar logic: exposes the signed-in user's display name and a sign-out action.
 * The display name comes from the MSAL account's ID-token `name` claim, falling back to the
 * username when `name` is absent. Sign-out uses the redirect flow (never a popup).
 */
export function useTopBar() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const displayName = account?.name ?? account?.username ?? '';

  const logout = () => {
    void instance.logoutRedirect();
  };

  return { displayName, logout };
}
