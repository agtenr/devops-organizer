import { makeStyles, tokens } from '@fluentui/react-components';
import { CustomerTabs } from '../CustomerTabs/CustomerTabs';
import { SidebarFilters } from '../SidebarFilters/SidebarFilters';
import { MailDebug } from '../MailDebug/MailDebug';
import { useOrganizer } from './useOrganizer';

const useStyles = makeStyles({
  // Sidebar (fixed-ish width) on the left, the view filling the rest.
  body: {
    display: 'flex',
    alignItems: 'stretch',
    gap: tokens.spacingHorizontalL,
  },
  sidebar: {
    flexShrink: 0,
    width: '240px',
  },
  view: {
    flexGrow: 1,
    minWidth: 0,
  },
});

/**
 * Permanent container between the top bar and the e-mail view. It owns the three-filter selection
 * (organization tab + project/type facets, via `useOrganizer`), feeds the tab strip and the sidebar
 * the full/faceted sets so their counters reflect availability, and feeds the view the composed
 * filtered set. Today the view is the temporary `MailDebug` visualizer; a later story swaps that for
 * the real list view while keeping this container and the sidebar.
 */
export function Organizer() {
  const styles = useStyles();
  const {
    status,
    error,
    folderName,
    categorized,
    filtered,
    selectedCustomer,
    selectCustomer,
    projectOptions,
    selectedProject,
    onSelectProject,
    typeOptions,
    selectedTypeKeys,
    onToggleType,
  } = useOrganizer();

  return (
    <>
      <CustomerTabs
        emails={categorized}
        selectedCustomer={selectedCustomer}
        onSelect={selectCustomer}
      />
      <div className={styles.body}>
        <div className={styles.sidebar}>
          <SidebarFilters
            projectOptions={projectOptions}
            selectedProject={selectedProject}
            onSelectProject={onSelectProject}
            typeOptions={typeOptions}
            selectedTypeKeys={selectedTypeKeys}
            onToggleType={onToggleType}
          />
        </div>
        <div className={styles.view}>
          <MailDebug status={status} error={error} folderName={folderName} emails={filtered} />
        </div>
      </div>
    </>
  );
}
