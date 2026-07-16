import {
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { CustomerTabs } from '../CustomerTabs/CustomerTabs';
import { SidebarFilters } from '../SidebarFilters/SidebarFilters';
import { EmailList } from '../EmailList/EmailList';
import { useOrganizer, type OrganizerData } from './useOrganizer';

const useStyles = makeStyles({
  // Fills the app shell below the top bar; a column so the tab strip sits above the scrolling body.
  root: {
    flexGrow: 1,
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
  },
  // Sidebar (fixed width) on the left, the view filling the rest. Fills the remaining height so the
  // list view (EmailList) owns the only scroll region.
  body: {
    flexGrow: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'stretch',
    gap: tokens.spacingHorizontalL,
  },
  sidebar: {
    flexShrink: 0,
    width: '240px',
    // A long facet list scrolls within the sidebar rather than growing the frame (settled OQ4).
    overflowY: 'auto',
  },
  view: {
    flexGrow: 1,
    minWidth: 0,
    display: 'flex',
  },
  // Loading/error fill the region and center their content (during load: only header + spinner).
  status: {
    flexGrow: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    fontFamily: tokens.fontFamilyMonospace,
  },
});

export interface OrganizerProps {
  /** Data source; defaults to the real `useOrganizer`. Overridden only by the test/e2e harness. */
  useData?: () => OrganizerData;
}

/**
 * Permanent container between the top bar and the e-mail view. It owns the three-filter selection
 * (organization tab + project/type facets, via `useOrganizer`), feeds the tab strip and the sidebar
 * the full/faceted sets so their counters reflect availability, and feeds the composed filtered set
 * to the center list view (`EmailList`).
 *
 * It also owns the load lifecycle UI (story 46): while mail is loading it renders **only** a spinner,
 * and on failure **only** the error — the tabs, filters, and list mount solely on success, so the
 * confusing `All (0)`/`None` flash is gone. In the same vein it owns the **empty-corpus** state
 * (story 48): when the folder holds no e-mails it renders **only** a warning message, so no empty
 * tabs/filters are shown. The `useData` seam lets a harness drive this real layout with mock data
 * (`.claude/rules/testing.md`); production passes nothing.
 */
export function Organizer({ useData = useOrganizer }: OrganizerProps = {}) {
  const styles = useStyles();
  const {
    status,
    error,
    folderName,
    categorized,
    filtered,
    resolveProjectGuid,
    deleteEmails,
    selectedCustomer,
    selectCustomer,
    projectOptions,
    selectedProject,
    onSelectProject,
    typeOptions,
    selectedTypeKeys,
    onToggleType,
    selectedFilters,
    removeFilter,
  } = useData();

  if (status === 'loading') {
    return (
      <div className={styles.root}>
        <div className={styles.status}>
          <Spinner label={`Loading mail from "${folderName}"…`} />
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className={styles.root}>
        <div className={styles.status}>
          <Text as="p" className={styles.error}>
            Failed to load mail: {error}
          </Text>
        </div>
      </div>
    );
  }

  if (categorized.length === 0) {
    return (
      <div className={styles.root}>
        <div className={styles.status}>
          <MessageBar intent="warning">
            <MessageBarBody>
              No e-mails found in "{folderName}". There is nothing to display.
            </MessageBarBody>
          </MessageBar>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root}>
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
          <EmailList
            emails={filtered}
            allEmails={categorized}
            resolveProjectGuid={resolveProjectGuid}
            deleteEmails={deleteEmails}
            selectedFilters={selectedFilters}
            onRemoveFilter={removeFilter}
          />
        </div>
      </div>
    </div>
  );
}
