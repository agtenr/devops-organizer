import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the hello-world heading', () => {
    render(
      <FluentProvider theme={webLightTheme}>
        <App />
      </FluentProvider>,
    );
    expect(screen.getByRole('heading', { name: /hello, devops organizer/i })).toBeInTheDocument();
  });
});
