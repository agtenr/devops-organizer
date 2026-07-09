import { fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, expect, it, vi } from 'vitest';
import { UNCATEGORIZED, UNKNOWN_TYPE, type CategorizedEmail } from '../../models/categorization';
import { CustomerTabs } from './CustomerTabs';
import { ALL_CUSTOMERS } from './useCustomerTabs';

function email(customer: string): CategorizedEmail {
  return {
    message: {},
    customer,
    project: 'p',
    type: UNKNOWN_TYPE,
    needsReview: false,
    projectIsUnresolvedGuid: false,
  };
}

// Fluent UI v9 components read theme/context from FluentProvider, so mount through the same wrapper
// the app uses (see `.claude/rules/testing.md`).
function renderTabs(props: Parameters<typeof CustomerTabs>[0]) {
  return render(
    <FluentProvider theme={webLightTheme}>
      <CustomerTabs {...props} />
    </FluentProvider>,
  );
}

const sampleEmails = [email('Contoso'), email('Adatum'), email('Contoso'), email(UNCATEGORIZED)];

describe('CustomerTabs', () => {
  it('renders a tab per organization with its counter, marking the selected tab active', () => {
    renderTabs({ emails: sampleEmails, selectedCustomer: ALL_CUSTOMERS, onSelect: vi.fn() });

    // One tab per derived entry: All + Adatum + Contoso + Uncategorized. (Exact ordering is pinned
    // by the deriveCustomerTabs unit test; here we assert the rendered set, selection, and counters.)
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    for (const name of ['Adatum', 'Contoso', 'Uncategorized']) {
      expect(screen.getByRole('tab', { name: new RegExp(name) })).toBeInTheDocument();
    }

    const allTab = screen.getByRole('tab', { name: /All/ });
    expect(allTab).toHaveAttribute('aria-selected', 'true');
    // The counter is visible inside the All tab (total across every organization).
    expect(within(allTab).getByText('4')).toBeInTheDocument();
  });

  it('calls onSelect with the tab value when a different tab is clicked', () => {
    const onSelect = vi.fn();
    renderTabs({ emails: sampleEmails, selectedCustomer: ALL_CUSTOMERS, onSelect });

    fireEvent.click(screen.getByRole('tab', { name: /Contoso/ }));

    expect(onSelect).toHaveBeenCalledWith('Contoso');
  });
});
