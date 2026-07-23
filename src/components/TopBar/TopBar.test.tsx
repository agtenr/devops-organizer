import { fireEvent, render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';

// Stable signed-in account + a no-op MSAL instance (TopBar only reads the display name and calls
// logoutRedirect; neither is exercised here). Same mocking shape as useCategorizedMail.test.ts.
vi.mock('@azure/msal-react', () => {
  const account = { name: 'Ada Lovelace', username: 'ada@example.com' };
  return {
    useMsal: () => ({ instance: { logoutRedirect: vi.fn() }, accounts: [account] }),
  };
});

// Mock the theme context so TopBar can consume `useTheme`.
// A mutable state variable lets per-test code override the theme mode (the mock factory hoists, but the
// getter runs at call time).
const mockToggleTheme = vi.fn().mockResolvedValue(undefined);
let mockThemeMode: 'light' | 'dark' = 'light';
vi.mock('../ThemeProvider/useTheme', () => ({
  useTheme: () => ({
    theme: webLightTheme,
    themeMode: (mockThemeMode as 'light' | 'dark') ?? 'light',
    toggleTheme: mockToggleTheme,
  }),
}));

function renderTopBar() {
  render(
    <FluentProvider theme={webLightTheme}>
      <TopBar />
    </FluentProvider>,
  );
}

const TITLE = 'E-mail Organizer';

describe('TopBar', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    // Reset mutable mock state so each test starts in light mode.
    mockThemeMode = 'light';
  });

  afterEach(() => {
    // Restore the real location object stubbed out by the reload test.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
    vi.clearAllMocks();
  });

  it('shows the app title as a level-1 heading (AC1)', () => {
    renderTopBar();
    expect(screen.getByRole('heading', { level: 1, name: TITLE })).toBeInTheDocument();
  });

  it('refreshes the page when the title is clicked (AC2)', () => {
    // jsdom's window.location.reload is a no-op that warns; replace location with a spy so the click
    // handler's reload is observable and does not attempt a real navigation.
    const reload = vi.fn();
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { reload },
    });

    renderTopBar();
    fireEvent.click(screen.getByRole('heading', { level: 1, name: TITLE }));

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('renders the theme toggle icon button (story 87)', () => {
    renderTopBar();
    // Default mock is light mode → toggle shows "Dark mode" title.
    const toggle = screen.getByRole('button', { name: 'Dark mode' });
    expect(toggle).toBeInTheDocument();
  });

  it('calls toggleTheme when the toggle icon is clicked (story 87)', () => {
    renderTopBar();
    const toggle = screen.getByRole('button', { name: 'Dark mode' });
    fireEvent.click(toggle);
    expect(mockToggleTheme).toHaveBeenCalledTimes(1);
  });

  it('switches icon from moon to sun when themeMode changes to dark (story 87)', () => {
    mockThemeMode = 'dark';
    renderTopBar();
    // Dark mode → toggle shows "Light mode" title (target = sun icon).
    const toggle = screen.getByRole('button', { name: 'Light mode' });
    expect(toggle).toBeInTheDocument();
  });
});
