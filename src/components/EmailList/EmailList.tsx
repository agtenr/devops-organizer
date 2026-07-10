import {
  Badge,
  Button,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InlineDrawer,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  TableSelectionCell,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Delete20Regular, TagSearch20Regular } from '@fluentui/react-icons';
import type { Message } from '@microsoft/microsoft-graph-types';
import type { CategorizedEmail } from '../../models/categorization';
import { typeLabel } from '../SidebarFilters/facetFilters';
import { ResolveProjectDialog } from '../ResolveProjectDialog/ResolveProjectDialog';
import { deriveKnownProjectNames } from '../ResolveProjectDialog/knownProjects';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog/ConfirmDeleteDialog';
import { formatReceivedDate, resolveBody } from './emailFormatters';
import { useEmailList } from './useEmailList';

const useStyles = makeStyles({
  // List fills the view; the body drawer docks to the right of it (inline = non-blocking). Fills the
  // full height it is given so the drawer spans it and `main` is the only scroller (story 46).
  root: {
    display: 'flex',
    minWidth: 0,
    height: '100%',
    minHeight: 0,
  },
  // The single scrolling region: with a long list only this overflows (the frame around it is fixed).
  main: {
    flexGrow: 1,
    minWidth: 0,
    minHeight: 0,
    overflowX: 'auto',
    overflowY: 'auto',
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
  },
  // Bulk-action bar above the list; the Delete button enables once 2+ rows are selected.
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBlockEnd: tokens.spacingVerticalS,
    minHeight: '32px',
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
  // Fixed layout so columns take their assigned widths (Subject widest) rather than an even split.
  // Percentage widths scale as the drawer opens/closes; the min-width makes the list scroll (main's
  // overflowX) instead of collapsing Subject to nothing when the drawer narrows the view.
  table: {
    width: '100%',
    minWidth: '880px',
    tableLayout: 'fixed',
  },
  colSelect: { width: '44px' },
  colDate: { width: '14%' },
  colOrg: { width: '14%' },
  colProject: { width: '13%' },
  colType: { width: '16%' },
  colActions: { width: '96px' },
  // Row action icons sit on one line; the cell never opens the body drawer (handlers stopPropagation).
  actionsCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
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
  /** The already-filtered categorized set to render (org ∩ project ∩ types), from `useOrganizer`. */
  emails: CategorizedEmail[];
  /** The full categorized set — source for the dialog's org-scoped known-project-name suggestions. */
  allEmails: CategorizedEmail[];
  /** Persists a GUID→name resolution and re-categorizes the set (from `useCategorizedMail`). */
  resolveProjectGuid: (guid: string, name: string) => Promise<void>;
  /** Deletes the given messages via Graph and refreshes the list (from `useCategorizedMail`). */
  deleteEmails: (ids: string[]) => Promise<void>;
}

/**
 * The center list view of the filtered e-mails: one row per e-mail (date, subject, organization,
 * project, type), with a `needsReview` marker on flagged rows. Clicking a row opens a non-blocking
 * inline `Drawer` showing that e-mail's formatted body; the list stays interactive, so clicking
 * another row swaps the shown body. Presentational — all selection logic and the row/body formatters
 * live in `useEmailList` (`.claude/rules/frontend-architecture.md`). Tags are consumed verbatim from
 * the engine; nothing is re-categorized (`.claude/rules/categorization-domain.md`).
 */
export function EmailList({ emails, allEmails, resolveProjectGuid, deleteEmails }: EmailListProps) {
  const styles = useStyles();
  const {
    selectedEmail,
    isPanelOpen,
    openEmail,
    closePanel,
    resolveTarget,
    openResolve,
    closeResolve,
    selectedIds,
    selectedCount,
    toggleSelected,
    toggleSelectAll,
    clearSelection,
    deleteTarget,
    openDeleteRow,
    openDeleteBulk,
    closeDelete,
  } = useEmailList(emails);

  // The ids of the currently-rendered rows — the scope of the header select-all checkbox.
  const visibleIds = emails
    .map((email) => email.message.id)
    .filter((id): id is string => Boolean(id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const headerChecked: boolean | 'mixed' = allVisibleSelected
    ? true
    : selectedCount > 0
      ? 'mixed'
      : false;

  return (
    <div className={styles.root}>
      {/* data-testid marks the single scroll region so the E2E layout test can assert only it scrolls. */}
      <div className={styles.main} data-testid="email-scroll-region">
        {emails.length === 0 ? (
          <Text as="p" className={styles.empty}>
            No e-mails to show.
          </Text>
        ) : (
          <>
            <div className={styles.toolbar}>
              <Button
                appearance="primary"
                icon={<Delete20Regular />}
                // Bulk delete acts on 2+ selected rows; a single row uses its own row icon (story 43).
                disabled={selectedCount < 2}
                onClick={openDeleteBulk}
              >
                Delete{selectedCount >= 2 ? ` (${selectedCount})` : ''}
              </Button>
            </div>
            <Table aria-label="E-mails" size="small" className={styles.table}>
              <TableHeader>
                <TableRow>
                  <TableSelectionCell
                    type="checkbox"
                    checked={headerChecked}
                    aria-label="Select all e-mails"
                    className={styles.colSelect}
                    onClick={() => toggleSelectAll(visibleIds)}
                  />
                  <TableHeaderCell className={styles.colDate}>Date</TableHeaderCell>
                  <TableHeaderCell>Subject</TableHeaderCell>
                  <TableHeaderCell className={styles.colOrg}>Organization</TableHeaderCell>
                  <TableHeaderCell className={styles.colProject}>Project</TableHeaderCell>
                  <TableHeaderCell className={styles.colType}>Type</TableHeaderCell>
                  <TableHeaderCell className={styles.colActions}>Actions</TableHeaderCell>
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
                      <TableSelectionCell
                        type="checkbox"
                        checked={id ? selectedIds.has(id) : false}
                        aria-label={`Select ${subject}`}
                        className={styles.colSelect}
                        // Keep row activation (which opens the body panel) from firing too.
                        onClick={(event) => {
                          event.stopPropagation();
                          if (id) {
                            toggleSelected(id);
                          }
                        }}
                        onKeyDown={(event) => event.stopPropagation()}
                      />
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
                      <TableCell className={styles.cell}>
                        <span className={styles.actionsCell}>
                          <Button
                            size="small"
                            appearance="subtle"
                            icon={<Delete20Regular />}
                            aria-label={`Delete ${subject}`}
                            // Keep row activation (which opens the body panel) from firing too.
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteRow(email);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                          />
                          {email.projectIsUnresolvedGuid && (
                            <Button
                              size="small"
                              appearance="subtle"
                              icon={<TagSearch20Regular />}
                              aria-label="Resolve project GUID"
                              onClick={(event) => {
                                event.stopPropagation();
                                openResolve(email.project, email.customer);
                              }}
                              onKeyDown={(event) => event.stopPropagation()}
                            />
                          )}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        )}
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

      {resolveTarget && (
        <ResolveProjectDialog
          guid={resolveTarget.guid}
          customer={resolveTarget.customer}
          knownProjectNames={deriveKnownProjectNames(allEmails, resolveTarget.customer)}
          onResolve={resolveProjectGuid}
          onCancel={closeResolve}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteDialog
          count={deleteTarget.ids.length}
          subject={deleteTarget.subject}
          // Delete via the shared data hook, then clear the (now-stale) selection. A failure rejects,
          // so the dialog stays open showing the error and the selection is preserved for a retry.
          onConfirm={async () => {
            await deleteEmails(deleteTarget.ids);
            clearSelection();
          }}
          onCancel={closeDelete}
        />
      )}
    </div>
  );
}
