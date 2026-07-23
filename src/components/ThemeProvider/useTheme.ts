import { createContext, useContext } from 'react';
import type { ThemeMode } from '../../services/theme/themeService';

/**
 * Shape exposed by the `ThemeProvider` through React context so any descendant can read the
 * current theme mode and toggle it. The `theme` token is the resolved Fluent UI theme object
 * (`webLightTheme` or `webDarkTheme`), ready for `FluentProvider`.
 */
export interface ThemeContextValue {
  /** The resolved Fluent UI theme token for the current mode. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Fluent UI theme is a large object; any avoids importing it into the context shape.
  theme: any;
  /** The current mode string. */
  themeMode: ThemeMode;
  /** Switch to the other theme and persist the change. */
  toggleTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Consumer hook for theme state. Must be called inside a `ThemeProvider`; throws if used outside.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { ThemeContext };
