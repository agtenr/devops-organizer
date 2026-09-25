import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from './ThemeProvider';
import { useTheme } from './useTheme';
import { fetchThemePreference, saveThemePreference } from '../../services/theme/themeService';

// Stable signed-in account so ThemeProvider's Graph fetch effect actually runs (mirrors the
// mocking shape used in TopBar.test.tsx / useCategorizedMail.test.ts).
vi.mock('@azure/msal-react', () => ({
  useMsal: () => ({ accounts: [{ name: 'Ada Lovelace', username: 'ada@example.com' }] }),
}));

vi.mock('../../services/graph/graphClient', () => ({
  createGraphClient: () => ({}),
}));

// The Graph fetch never resolves in these tests, so any assertion made right after render
// reflects only the synchronous initial state — the regression coverage for AB#125.
vi.mock('../../services/theme/themeService', async () => {
  const actual = await vi.importActual<typeof import('../../services/theme/themeService')>(
    '../../services/theme/themeService',
  );
  return {
    ...actual,
    fetchThemePreference: vi.fn(() => new Promise(() => {})),
    saveThemePreference: vi.fn(() => Promise.resolve()),
  };
});

function ThemeModeProbe() {
  const { themeMode, toggleTheme } = useTheme();
  return (
    <>
      <span data-testid="mode">{themeMode}</span>
      <button onClick={() => void toggleTheme()}>toggle</button>
    </>
  );
}

function renderWithProbe() {
  render(
    <ThemeProvider>
      <ThemeModeProbe />
    </ThemeProvider>,
  );
}

describe('ThemeProvider', () => {
  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('uses the cached theme mode on the very first render, before the Graph fetch resolves (AB#125)', () => {
    localStorage.setItem('themeMode', 'dark');
    renderWithProbe();
    expect(screen.getByTestId('mode')).toHaveTextContent('dark');
  });

  it('defaults to light when nothing is cached', () => {
    renderWithProbe();
    expect(screen.getByTestId('mode')).toHaveTextContent('light');
  });

  it('caches the new mode alongside the OneDrive save on toggle', async () => {
    renderWithProbe();
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));

    expect(saveThemePreference).toHaveBeenCalledWith(expect.anything(), 'dark');
    expect(await screen.findByText('dark')).toBeInTheDocument();
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });

  it('caches the mode fetched from OneDrive once it resolves', async () => {
    vi.mocked(fetchThemePreference).mockResolvedValueOnce('dark');
    renderWithProbe();

    expect(await screen.findByText('dark')).toBeInTheDocument();
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });
});
