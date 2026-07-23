import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FluentProvider, webDarkTheme, webLightTheme } from '@fluentui/react-components';
import { useMsal } from '@azure/msal-react';
import { createGraphClient } from '../../services/graph/graphClient';
import {
  fetchThemePreference,
  saveThemePreference,
  type ThemeMode,
} from '../../services/theme/themeService';
import { ThemeContext } from './useTheme';

const DEFAULT_THEME: ThemeMode = 'light';

/**
 * Owns the theme state for the entire app. Fetches the saved preference from OneDrive approot
 * on mount (after auth), defaults to `'light'` until the fetch resolves, and persists each toggle.
 * Wraps descendants in `FluentProvider` with the resolved theme token so the visual switch is
 * seamless — no custom dark-mode CSS is needed (story 87).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { accounts } = useMsal();
  const [themeMode, setThemeMode] = useState<ThemeMode>(DEFAULT_THEME);

  // Fetch saved preference once on mount. The account is available because ThemeProvider sits
  // inside the MsalAuthenticationTemplate gate in App.tsx.
  useEffect(() => {
    const account = accounts[0];
    if (!account) return;

    const client = createGraphClient(account);
    // Fire-and-forget style: update state when it resolves. Errors propagate to console so they
    // are visible in dev but don't crash the app — the default ('light') remains.
    fetchThemePreference(client)
      .then((saved) => setThemeMode(saved))
      .catch((err) => console.error('Failed to fetch theme preference:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetch only on mount; accounts stable after auth.
  }, [accounts]);

  const toggleTheme = useCallback(() => {
    const account = accounts[0];
    if (!account) return Promise.resolve();

    const next: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    const client = createGraphClient(account);

    return saveThemePreference(client, next)
      .then(() => setThemeMode(next))
      .catch((err) => {
        console.error('Failed to save theme preference:', err);
      });
  }, [accounts, themeMode]);

  // Resolve the Fluent UI theme token from the mode string — during render so it updates
  // FluentProvider atomically with the state change.
  const themeToken = useMemo(
    () => (themeMode === 'dark' ? webDarkTheme : webLightTheme),
    [themeMode],
  );

  const contextValue = useMemo(
    () => ({ theme: themeToken, themeMode, toggleTheme }),
    [themeToken, themeMode, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      <FluentProvider theme={themeToken} style={{ height: '100%' }}>
        {children}
      </FluentProvider>
    </ThemeContext.Provider>
  );
}
