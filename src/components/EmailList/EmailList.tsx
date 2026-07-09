import {
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InlineDrawer,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { Message } from '@microsoft/microsoft-graph-types';
import type { CategorizedEmail } from '../../models/categorization';
import { typeLabel } from '../SidebarFilters/facetFilters';
import { formatReceivedDate, resolveBody, useEmailList } from './useEmailList';

const useStyles = makeStyles({
  // List fills the view; the body drawer docks to the right of it (inline = non-blocking).
  root: {
    display: 'flex',
    minWidth: 0,
    minHeight: '70vh',
  },
  main: {
    flexGrow: 1,
    minWidth: 0,
    overflowX: 'auto',
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    fontFamily: tokens.fontFamilyMonospace,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
  // Fixed layout so columns take their assigned widths (Subject widest) rather than an even split.
  // Percentage widths scale as the drawer opens/closes; the min-width makes the list scroll (main's
  // overflowX) instead of collapsing Subject to nothing when the drawer narrows the view.
  table: {
    width: '100%',
    minWidth: '760px',
    tableLayout: 'fixed',
  },
  colDate: { width: '15%' },
  colOrg: { width: '15%' },
  colProject: { width: '14%' },
  colType: { width: '18%' },
  // Non-subject cells stay single-line and ellipsize rather than wrapping to a taller row.
  cell: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  row: {
    cursor: 'pointer',
  },
  subjectCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  subjectText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  // Keep the marker on one line and never let it shrink/wrap next to a long subject.
  reviewBadge: {
    flexShrink: 0,
  },
  // Without this the flex-grow list shrinks the inline drawer to ~0 width (invisible when open).
  drawer: {
    flexShrink: 0,
  },
  drawerBody: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  // Sandboxed frame isolates the e-mail's scripts/CSS from the app (see the plan's security note).
  bodyFrame: {
    flexGrow: 1,
    width: '100%',
    minHeight: 0,
    border: 'none',
  },
  bodyText: {
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: tokens.fontFamilyMonospace,
    marginBlockStart: 0,
  },
});

/** Renders the selected e-mail's body: `html` in a sandboxed iframe, otherwise as preformatted text. */
function EmailBody({ message }: { message: Message }) {
  const styles = useStyles();
  const body = resolveBody(message);

  if (body.kind === 'html') {
    // sandbox="" applies every restriction: no scripts run, no same-origin access (XSS-safe).
    return (
      <iframe title="E-mail body" srcDoc={body.content} sandbox="" className={styles.bodyFrame} />
    );
  }
  return <pre className={styles.bodyText}>{body.content}</pre>;
}

export interface EmailListProps {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  /** The already-filtered categorized set to render (org ∩ project ∩ types), from `useOrganizer`. */
  emails: CategorizedEmail[];
}

/**
 * The center list view of the filtered e-mails: one row per e-mail (date, subject, organization,
 * project, type), with a `needsReview` marker on flagged rows. Clicking a row opens a non-blocking
 * inline `Drawer` showing that e-mail's formatted body; the list stays interactive, so clicking
 * another row swaps the shown body. Presentational — all selection logic and the row/body formatters
 * live in `useEmailList` (`.claude/rules/frontend-architecture.md`). Tags are consumed verbatim from
 * the engine; nothing is re-categorized (`.claude/rules/categorization-domain.md`).
 */
export function EmailList({ status, error, folderName, emails }: EmailListProps) {
  const styles = useStyles();
  const { selectedEmail, isPanelOpen, openEmail, closePanel } = useEmailList(emails);

  return (
    <div className={styles.root}>
      <div className={styles.main}>
        {status === 'loading' && <Spinner label={`Loading mail from "${folderName}"…`} />}
        {status === 'error' && (
          <Text as="p" className={styles.error}>
            Failed to load mail: {error}
          </Text>
        )}
        {status === 'success' &&
          (emails.length === 0 ? (
            <Text as="p" className={styles.empty}>
              No e-mails match the current filters.
            </Text>
          ) : (
            <Table aria-label="E-mails" size="small" className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableHeaderCell className={styles.colDate}>Date</TableHeaderCell>
                  <TableHeaderCell>Subject</TableHeaderCell>
                  <TableHeaderCell className={styles.colOrg}>Organization</TableHeaderCell>
                  <TableHeaderCell className={styles.colProject}>Project</TableHeaderCell>
                  <TableHeaderCell className={styles.colType}>Type</TableHeaderCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {emails.map((email, index) => {
                  const id = email.message.id;
                  const subject = email.message.subject ?? '(no subject)';
                  const open = () => {
                    if (id) {
                      openEmail(id);
                    }
                  };
                  return (
                    <TableRow
                      key={id ?? index}
                      className={styles.row}
                      tabIndex={0}
                      aria-label={subject}
                      onClick={open}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          open();
                        }
                      }}
                    >
                      <TableCell className={styles.cell}>
                        {formatReceivedDate(email.message.receivedDateTime)}
                      </TableCell>
                      <TableCell>
                        <span className={styles.subjectCell}>
                          <span className={styles.subjectText}>{subject}</span>
                          {email.needsReview && (
                            <Badge
                              className={styles.reviewBadge}
                              appearance="filled"
                              color="warning"
                              size="small"
                            >
                              needs review
                            </Badge>
                          )}
                        </span>
                      </TableCell>
                      <TableCell className={styles.cell}>{email.customer}</TableCell>
                      <TableCell className={styles.cell}>{email.project}</TableCell>
                      <TableCell className={styles.cell}>{typeLabel(email.type)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ))}
      </div>

      <InlineDrawer
        open={isPanelOpen}
        position="end"
        separator
        size="medium"
        className={styles.drawer}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button appearance="subtle" onClick={closePanel}>
                Close
              </Button>
            }
          >
            {selectedEmail?.message.subject ?? '(no subject)'}
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody className={styles.drawerBody}>
          {selectedEmail && <EmailBody message={selectedEmail.message} />}
        </DrawerBody>
      </InlineDrawer>
    </div>
  );
}
