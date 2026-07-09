import { CustomerTabs } from '../CustomerTabs/CustomerTabs';
import { MailDebug } from '../MailDebug/MailDebug';
import { useOrganizer } from './useOrganizer';

/**
 * Permanent container between the top bar and the e-mail view. It owns the organization-tab
 * selection (via `useOrganizer`), feeds the tab strip the full categorized set (so counters reflect
 * totals) and the view the filtered set. Today the view is the temporary `MailDebug` visualizer;
 * #39 swaps that for the real list view while keeping this container.
 */
export function Organizer() {
  const {
    status,
    error,
    folderName,
    categorized,
    filtered,
    selectedCustomer,
    setSelectedCustomer,
  } = useOrganizer();

  return (
    <>
      <CustomerTabs
        emails={categorized}
        selectedCustomer={selectedCustomer}
        onSelect={setSelectedCustomer}
      />
      <MailDebug status={status} error={error} folderName={folderName} emails={filtered} />
    </>
  );
}
