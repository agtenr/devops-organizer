import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FluentProvider, createDarkTheme, createLightTheme } from '@fluentui/react-components';
import { useMsal } from '@azure/msal-react';
import { createGraphClient } from '../../services/graph/graphClient';
import { brandRamp } from '../../services/theme/brandPalette';
import {
  fetchThemePreference,
  getCachedThemeMode,
  saveThemePreference,
  setCachedThemeMode,
  type ThemeMode,
} from '../../services/theme/themeService';
import { ThemeContext } from './useTheme';

const DEFAULT_THEME: ThemeMode = 'light';

/**
 * Owns the theme state for the entire app. Renders the last-known theme from the `localStorage`
 * cache immediately (AB#125 — avoids a light-theme flash on load), then fetches the saved
 * preference from OneDrive approot on mount (after auth) and reconciles. Wraps descendants in
 * `FluentProvider` with the resolved theme token so the visual switch is seamless — no custom
 * dark-mode CSS is needed (story 87).
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { accounts } = useMsal();
  const [themeMode, setThemeMode] = useState<ThemeMode>(
    () => getCachedThemeMode() ?? DEFAULT_THEME,
  );

  // Fetch the saved preference once an account is available (AB#125 moved ThemeProvider above
  // MsalAuthenticationTemplate, so this effect re-runs and resolves once sign-in completes).
  useEffect(() => {
    const account = accounts[0];
    if (!account) return;

    const client = createGraphClient(account);
    // Fire-and-forget style: update state when it resolves. Errors propagate to console so they
    // are visible in dev but don't crash the app — the cached/default mode remains.
    fetchThemePreference(client)
      .then((saved) => {
        setThemeMode(saved);
        setCachedThemeMode(saved);
      })
      .catch((err) => console.error('Failed to fetch theme preference:', err));
  }, [accounts]);

  const toggleTheme = useCallback(() => {
    const account = accounts[0];
    if (!account) return Promise.resolve();

    const next: ThemeMode = themeMode === 'light' ? 'dark' : 'light';
    const client = createGraphClient(account);

    return saveThemePreference(client, next)
      .then(() => {
        setThemeMode(next);
        setCachedThemeMode(next);
      })
      .catch((err) => {
        console.error('Failed to save theme preference:', err);
      });
  }, [accounts, themeMode]);

  // Resolve the Fluent UI theme token from the mode string — during render so it updates
  // FluentProvider atomically with the state change. Both themes are built from the same brand
  // ramp (story 124) so the color scheme is identical in light and dark mode.
  const themeToken = useMemo(
    () => (themeMode === 'dark' ? createDarkTheme(brandRamp) : createLightTheme(brandRamp)),
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
