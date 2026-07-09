import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED, UNKNOWN_TYPE, type CategorizedEmail } from '../../models/categorization';
import { ALL_CUSTOMERS, deriveCustomerTabs } from './useCustomerTabs';

// Only the `customer` axis drives the tab derivation, so the other fields are fillers here.
function email(customer: string): CategorizedEmail {
  return { message: {}, customer, project: 'p', type: UNKNOWN_TYPE, needsReview: false };
}

describe('deriveCustomerTabs', () => {
  it('returns only the "All" tab (count 0) for an empty set', () => {
    const tabs = deriveCustomerTabs([]);
    expect(tabs).toEqual([{ value: ALL_CUSTOMERS, label: 'All', count: 0 }]);
  });

  it('orders tabs All → organizations alphabetically → Uncategorized last, with correct counts', () => {
    const emails = [
      email('Contoso'),
      email('Adatum'),
      email('Contoso'),
      email(UNCATEGORIZED),
      email('Zzz'),
    ];

    const tabs = deriveCustomerTabs(emails);

    // Uncategorized is pinned last even though 'Zzz' sorts after 'Uncategorized' alphabetically.
    expect(tabs).toEqual([
      { value: ALL_CUSTOMERS, label: 'All', count: 5 },
      { value: 'Adatum', label: 'Adatum', count: 1 },
      { value: 'Contoso', label: 'Contoso', count: 2 },
      { value: 'Zzz', label: 'Zzz', count: 1 },
      { value: UNCATEGORIZED, label: UNCATEGORIZED, count: 1 },
    ]);
  });

  it('omits the Uncategorized tab when no e-mail is uncategorized', () => {
    const tabs = deriveCustomerTabs([email('Contoso'), email('Adatum')]);
    expect(tabs.map((t) => t.value)).toEqual([ALL_CUSTOMERS, 'Adatum', 'Contoso']);
  });
});
