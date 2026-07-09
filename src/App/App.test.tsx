import { render } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  // Smoke test: the app is auth-gated (story 30) so, unauthenticated and without an MSAL provider,
  // it renders no user-visible content here — this only asserts it mounts inside the provider
  // without throwing. (The scaffold's original "hello-world heading" assertion became obsolete when
  // the hello-world UI was replaced by the auth gate; proper App+MSAL rendering coverage is a
  // separate auth-story concern.)
  it('mounts within the Fluent provider without crashing', () => {
    const { container } = render(
      <FluentProvider theme={webLightTheme}>
        <App />
      </FluentProvider>,
    );
    expect(container.querySelector('.fui-FluentProvider')).toBeInTheDocument();
  });
});
