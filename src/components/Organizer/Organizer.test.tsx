import { render, screen } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import type { CategorizedEmail } from '../../models/categorization';
import { Organizer } from './Organizer';
import type { OrganizerData } from './useOrganizer';
import { ALL_CUSTOMERS } from '../CustomerTabs/useCustomerTabs';

// jsdom has no layout engine, so these tests assert the loading/error gate as DOM *presence* only
// (tabs/filters mounted or not) — the visual "only the list scrolls / full-height preview" checks
// live in the Playwright harness (`.claude/rules/testing.md`).

const sample: CategorizedEmail = {
  message: {
    id: '1',
    subject: 'A mail',
    receivedDateTime: '2026-07-09T08:30:00Z',
    body: { contentType: 'text', content: 'body' },
  },
  customer: 'Contoso',
  project: 'Alpha',
  type: { category: 'Work item', subType: 'Assigned' },
  needsReview: false,
  projectIsUnresolvedGuid: false,
};

// Build the full OrganizerData the seam requires; overrides tweak status/error for each case.
function data(overrides: Partial<OrganizerData> = {}): OrganizerData {
  const emails = overrides.categorized ?? [sample];
  return {
    status: 'success',
    error: '',
    folderName: 'DevOps',
    categorized: emails,
    filtered: emails,
    resolveProjectGuid: vi.fn(() => Promise.resolve()),
    deleteEmails: vi.fn(() => Promise.resolve()),
    selectedCustomer: ALL_CUSTOMERS,
    selectCustomer: vi.fn(),
    projectOptions: [],
    selectedProject: null,
    onSelectProject: vi.fn(),
    typeOptions: [],
    selectedTypeKeys: new Set<string>(),
    onToggleType: vi.fn(),
    selectedFilters: [],
    removeFilter: vi.fn(),
    ...overrides,
  };
}

function renderOrganizer(overrides: Partial<OrganizerData> = {}) {
  const d = data(overrides);
  return render(
    <FluentProvider theme={webLightTheme}>
      <Organizer useData={() => d} />
    </FluentProvider>,
  );
}

describe('Organizer — load lifecycle gate', () => {
  it('shows only a spinner while loading — no tabs, filters, or list', () => {
    renderOrganizer({ status: 'loading' });

    expect(screen.getByText(/Loading mail from "DevOps"/)).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Organizations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'E-mails' })).not.toBeInTheDocument();
  });

  it('shows only the error on failure — no tabs, filters, or list', () => {
    renderOrganizer({ status: 'error', error: 'boom' });

    expect(screen.getByText(/Failed to load mail: boom/)).toBeInTheDocument();
    expect(screen.queryByText(/Loading mail from/)).not.toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Organizations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'E-mails' })).not.toBeInTheDocument();
  });

  it('renders the tabs, filters, and list on success', () => {
    renderOrganizer({ status: 'success' });

    expect(screen.getByRole('tablist', { name: 'Organizations' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Filters' })).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: 'E-mails' })).toBeInTheDocument();
    expect(screen.queryByText(/Loading mail from/)).not.toBeInTheDocument();
  });

  it('shows only a warning message when the corpus is empty — no tabs, filters, or list', () => {
    renderOrganizer({ status: 'success', categorized: [] });

    expect(screen.getByText(/nothing to display/i)).toBeInTheDocument();
    expect(screen.queryByRole('tablist', { name: 'Organizations' })).not.toBeInTheDocument();
    expect(screen.queryByRole('complementary', { name: 'Filters' })).not.toBeInTheDocument();
    expect(screen.queryByRole('grid', { name: 'E-mails' })).not.toBeInTheDocument();
  });
});
