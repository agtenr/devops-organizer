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

function renderTopBar() {
  render(
    <FluentProvider theme={webLightTheme}>
      <TopBar />
    </FluentProvider>,
  );
}

const TITLE = 'ADO E-mail Organizer';

describe('TopBar', () => {
  const originalLocation = window.location;

  afterEach(() => {
    // Restore the real location object stubbed out by the reload test.
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
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
});
