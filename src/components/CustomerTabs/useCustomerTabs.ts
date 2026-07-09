import { useMemo } from 'react';
import { UNCATEGORIZED, type CategorizedEmail } from '../../models/categorization';

/**
 * Customer (= ADO organization) tab logic (see `.claude/rules/categorization-domain.md` and the
 * "Customer tabs across the top" invariant in `.claude/rules/frontend-architecture.md`).
 *
 * The tab strip is derived purely from the already-categorized set — it never re-derives tags, it
 * only groups by the `customer` value the engine assigned.
 */

/**
 * Sentinel identifying the "All" tab. A string unlikely to collide with a real ADO organization
 * name, so the selection can round-trip as a plain `customer` string everywhere else.
 */
export const ALL_CUSTOMERS = '__all__';

/** A single tab descriptor: the value to select on, its display label, and its e-mail counter. */
export interface CustomerTab {
  /** {@link ALL_CUSTOMERS} for the All tab; otherwise the exact `customer` string. */
  value: string;
  /** `'All'` for the All tab; otherwise the organization name (the `customer` value). */
  label: string;
  /** All → total e-mails; otherwise the number of e-mails whose `customer === value`. */
  count: number;
}

/**
 * Derives the ordered tab list from the full categorized set. Ordering (fixed by plan review):
 * **"All" first** (count = total), then one tab per distinct organization sorted alphabetically
 * (case-insensitive), and the {@link UNCATEGORIZED} fallback **pinned last** if present. Pure and
 * deterministic, so it is unit-testable without React.
 */
export function deriveCustomerTabs(emails: CategorizedEmail[]): CustomerTab[] {
  const counts = new Map<string, number>();
  for (const email of emails) {
    counts.set(email.customer, (counts.get(email.customer) ?? 0) + 1);
  }

  const organizations = [...counts.keys()]
    .filter((customer) => customer !== UNCATEGORIZED)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((customer): CustomerTab => ({
      value: customer,
      label: customer,
      count: counts.get(customer)!,
    }));

  const tabs: CustomerTab[] = [
    { value: ALL_CUSTOMERS, label: 'All', count: emails.length },
    ...organizations,
  ];

  // Pin the fallback bucket last, after every named organization regardless of letter.
  const uncategorizedCount = counts.get(UNCATEGORIZED);
  if (uncategorizedCount !== undefined) {
    tabs.push({ value: UNCATEGORIZED, label: UNCATEGORIZED, count: uncategorizedCount });
  }

  return tabs;
}

/** Memoises {@link deriveCustomerTabs} off the categorized set for the `CustomerTabs` component. */
export function useCustomerTabs(emails: CategorizedEmail[]): CustomerTab[] {
  return useMemo(() => deriveCustomerTabs(emails), [emails]);
}
