import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App', () => {
  it('renders the hello-world heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: /hello, devops organizer/i })).toBeInTheDocument();
  });
});
