import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import {
  FluentProvider,
  Text,
  makeStaticStyles,
  makeStyles,
  tokens,
  webLightTheme,
} from '@fluentui/react-components';
import type { CategorizedEmail } from './models/categorization';
import { Organizer } from './components/Organizer/Organizer';
import type { OrganizerData } from './components/Organizer/useOrganizer';
import { ALL_CUSTOMERS } from './components/CustomerTabs/useCustomerTabs';
import { deriveProjectOptions, deriveTypeOptions } from './components/SidebarFilters/facetFilters';

/**
 * Dev/test-only entry that drives the **real** app layout (`Organizer` + its children) with mock data,
 * so Playwright can verify the layout defects fixed by story 46 (only the list scrolls, full-height
 * preview, single-line filters, loading gate) without the MSAL auth gate. It uses the `useData`
 * injection seam on `Organizer`; `?state=loading` renders the loading branch. A static header
 * stand-in mirrors the fixed top bar (the real `TopBar` needs MSAL). See `e2e/harness.spec.ts`.
 */

// The two sample e-mails the existing EmailList E2E assertions key on (needs-review badge, html vs
// text body, long subject), plus one with a deliberately long project name for the filter-wrap test,
// plus filler rows so the list overflows and the "only the list scrolls" test has something to scroll.
const LONG_PROJECT =
  'Alpha-very-long-project-name-that-would-wrap-onto-two-lines-if-not-ellipsized';

const filler: CategorizedEmail[] = Array.from({ length: 30 }, (_, i) => ({
  message: {
    id: `f${i}`,
    subject: `Filler notification ${i + 1}`,
    receivedDateTime: '2026-07-01T00:00:00Z',
    body: { contentType: 'text', content: 'filler body' },
  },
  customer: 'Contoso',
  project: 'Alpha',
  type: { category: 'Work item', subType: 'Assigned' },
  needsReview: false,
  projectIsUnresolvedGuid: false,
}));

const emails: CategorizedEmail[] = [
  {
    message: {
      id: '1',
      subject: 'Build failed on main for a rather long subject line that keeps going and going',
      receivedDateTime: '2026-07-09T08:30:00Z',
      body: { contentType: 'html', content: '<h1>Build failed</h1><p>See the logs.</p>' },
    },
    customer: 'Contoso',
    project: '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4',
    type: { category: 'Build', subType: 'Failed' },
    needsReview: true,
    projectIsUnresolvedGuid: true,
  },
  {
    message: {
      id: '2',
      subject: 'PR review requested',
      receivedDateTime: '2026-07-08T14:05:00Z',
      body: { contentType: 'text', content: 'Please review my PR.' },
    },
    customer: 'Adatum',
    project: 'Beta',
    type: { category: 'Pull request', subType: 'Review requested' },
    needsReview: false,
    projectIsUnresolvedGuid: false,
  },
  {
    message: {
      id: '3',
      subject: 'Long project row',
      receivedDateTime: '2026-07-02T00:00:00Z',
      body: { contentType: 'text', content: 'long project body' },
    },
    customer: 'Contoso',
    project: LONG_PROJECT,
    type: { category: 'Work item', subType: 'Assigned' },
    needsReview: false,
    projectIsUnresolvedGuid: false,
  },
  ...filler,
];

// A no-op stand-in for the real useOrganizer: static data, selection callbacks that do nothing, and a
// status read from the URL so the loading branch is drivable. Pure, so StrictMode's double render is safe.
const status: OrganizerData['status'] =
  new URLSearchParams(window.location.search).get('state') === 'loading' ? 'loading' : 'success';

const mockData: OrganizerData = {
  status,
  error: '',
  folderName: 'DevOps',
  categorized: emails,
  filtered: emails,
  resolveProjectGuid: () => Promise.resolve(),
  deleteEmails: () => Promise.resolve(),
  selectedCustomer: ALL_CUSTOMERS,
  selectCustomer: () => {},
  projectOptions: deriveProjectOptions(emails),
  selectedProject: null,
  onSelectProject: () => {},
  typeOptions: deriveTypeOptions(emails),
  selectedTypeKeys: new Set<string>(),
  onToggleType: () => {},
};

const useMockOrganizer = (): OrganizerData => mockData;

// Mirror the app's global full-height reset (App.tsx) so the harness layout matches the real app.
const useGlobalStyles = makeStaticStyles({
  'html, body, #root': { height: '100%', margin: 0 },
  body: { overflow: 'hidden' },
});

const useStyles = makeStyles({
  shell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexShrink: 0,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
});

// This is a test-only entry (not imported anywhere), so fast-refresh's "only export components" rule
// does not apply — the component is defined and mounted in the same file, like main.tsx.
// eslint-disable-next-line react-refresh/only-export-components
function Harness() {
  useGlobalStyles();
  const styles = useStyles();
  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <Text as="h1" size={500} weight="semibold">
          Azure DevOps E-mail Organizer
        </Text>
      </header>
      <Organizer useData={useMockOrganizer} />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme} style={{ height: '100%' }}>
      <Harness />
    </FluentProvider>
  </StrictMode>,
);
