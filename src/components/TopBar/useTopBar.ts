import { useMsal } from '@azure/msal-react';
import { useTheme } from '../ThemeProvider/useTheme';

/**
 * Top-bar logic: exposes the signed-in user's display name, a sign-out action, a page-refresh
 * action, and the theme toggle (story 87). The display name comes from the MSAL account's ID-token
 * `name` claim, falling back to the username when `name` is absent. Sign-out uses the redirect
 * flow (never a popup).
 *
 * `refresh` does a full browser reload (`window.location.reload()`): re-mounting the whole app resets
 * the in-memory filter/selection state in `useOrganizer` to its defaults, so "refresh the page with
 * all filters cleared" needs no explicit state-reset plumbing (story 60).
 */
export function useTopBar() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const displayName = account?.name ?? account?.username ?? '';
  const { themeMode, toggleTheme } = useTheme();

  const logout = () => {
    void instance.logoutRedirect();
  };

  const refresh = () => {
    window.location.reload();
  };

  return { displayName, logout, refresh, themeMode, toggleTheme };
}
