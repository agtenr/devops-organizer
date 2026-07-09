import { useMemo, useState } from 'react';
import type { CategorizedEmail } from '../../models/categorization';
import { useCategorizedMail } from '../../hooks/useCategorizedMail';
import { ALL_CUSTOMERS } from '../CustomerTabs/useCustomerTabs';

/**
 * Organizer container logic: consumes the shared categorized-mail hook and layers the organization
 * tab selection on top, deriving the filtered set the view renders. The data path itself lives in
 * `useCategorizedMail` (`src/hooks/`), so only the selection concern is owned here.
 */
export function useOrganizer() {
  const { status, error, folderName, categorized } = useCategorizedMail();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(ALL_CUSTOMERS);

  const filtered = useMemo<CategorizedEmail[]>(
    () =>
      selectedCustomer === ALL_CUSTOMERS
        ? categorized
        : categorized.filter((email) => email.customer === selectedCustomer),
    [categorized, selectedCustomer],
  );

  return {
    status,
    error,
    folderName,
    categorized,
    filtered,
    selectedCustomer,
    setSelectedCustomer,
  };
}
