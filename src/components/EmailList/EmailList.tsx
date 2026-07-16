import { useMemo } from 'react';
import type { KeyboardEvent } from 'react';
import {
  Badge,
  Button,
  Checkbox,
  DataGrid,
  DataGridBody,
  DataGridCell,
  DataGridHeader,
  DataGridHeaderCell,
  DataGridRow,
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  InlineDrawer,
  SearchBox,
  Text,
  Tooltip,
  createTableColumn,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { TableColumnDefinition, TableColumnId } from '@fluentui/react-components';
import { Delete20Regular, TagSearch20Regular } from '@fluentui/react-icons';
import type { Message } from '@microsoft/microsoft-graph-types';
import type { CSSProperties } from 'react';
import type { CategorizedEmail } from '../../models/categorization';
import { typeLabel } from '../SidebarFilters/facetFilters';
import { SelectedFilters } from '../SelectedFilters/SelectedFilters';
import type { SelectedFilterChip } from '../SelectedFilters/filterChips';
import { ResolveProjectDialog } from '../ResolveProjectDialog/ResolveProjectDialog';
import { deriveKnownProjectNames } from '../ResolveProjectDialog/knownProjects';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog/ConfirmDeleteDialog';
import { COLUMN_ID, columnSizingOptions } from './emailColumns';
import { formatReceivedDate, resolveBody } from './emailFormatters';
import { useEmailList } from './useEmailList';
import { useResizablePanel } from './useResizablePanel';

// The single-line data columns whose cells ellipsize rather than wrap; the selection/subject/actions
// cells own their own layout, so they are excluded.
const ELLIPSIS_COLUMNS = new Set<TableColumnId>([
  COLUMN_ID.date,
  COLUMN_ID.organization,
  COLUMN_ID.project,
  COLUMN_ID.type,
]);

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
  // Bar above the list: the subject search box (plus the active-filter chips) on the left, the bulk
  // Delete button on the right, sharing one row. The Delete button enables once 2+ rows are selected.
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBlockEnd: tokens.spacingVerticalS,
    minHeight: '32px',
  },
  // The left cluster: the search box with the selected-filter chips next to it (AC1). Wraps onto a
  // second line when many filters are active rather than pushing the Delete button off the row.
  toolbarLeft: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    minWidth: 0,
  },
  // Keep the search box a sensible fixed-ish width rather than stretching across the whole toolbar.
  searchBox: {
    width: '280px',
    maxWidth: '50%',
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
  // DataGrid owns the column widths via `columnSizingOptions` (the `resizableColumns` feature sets
  // explicit per-column widths); their sum gives the grid a natural min width, so `main`'s overflowX
  // scrolls it rather than collapsing Subject when the drawer narrows the view. `fit-content` keeps
  // the grid from stretching columns past those widths to fill a wide viewport.
  grid: {
    width: 'fit-content',
    minWidth: '100%',
  },
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
  // Thin draggable bar between the list and the drawer; drag it to resize the preview (story 55).
  // `touchAction: none` keeps a touch-drag from scrolling the list instead of resizing.
  resizeHandle: {
    flexShrink: 0,
    width: '6px',
    cursor: 'col-resize',
    backgroundColor: tokens.colorNeutralBackground5,
    touchAction: 'none',
    ':hover': {
      backgroundColor: tokens.colorNeutralStroke1,
    },
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
  /** The active sidebar filters as dismissible chips (from `useOrganizer`), shown by the search box. */
  selectedFilters: SelectedFilterChip[];
  /** Removes a single active filter when its chip's X is clicked (dispatches to `useOrganizer`). */
  onRemoveFilter: (chip: SelectedFilterChip) => void;
}

/**
 * The center list view of the filtered e-mails: one row per e-mail (date, subject, organization,
 * project, type), with a `needsReview` marker on flagged rows. Clicking a row opens a non-blocking
 * inline `Drawer` showing that e-mail's formatted body; the list stays interactive, so clicking
 * another row swaps the shown body. Presentational — all selection logic and the row/body formatters
 * live in `useEmailList` (`.claude/rules/frontend-architecture.md`). Tags are consumed verbatim from
 * the engine; nothing is re-categorized (`.claude/rules/categorization-domain.md`).
 */
export function EmailList({
  emails,
  allEmails,
  resolveProjectGuid,
  deleteEmails,
  selectedFilters,
  onRemoveFilter,
}: EmailListProps) {
  const styles = useStyles();
  const {
    visibleEmails,
    searchQuery,
    setSearchQuery,
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
  } = useEmailList(emails, allEmails);
  const { width: panelWidth, handleProps } = useResizablePanel();

  // The ids of the currently-rendered (filtered + searched) rows — the scope of the header
  // select-all checkbox.
  const visibleIds = useMemo(
    () => visibleEmails.map((email) => email.message.id).filter((id): id is string => Boolean(id)),
    [visibleEmails],
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const headerChecked: boolean | 'mixed' = allVisibleSelected
    ? true
    : selectedCount > 0
      ? 'mixed'
      : false;

  // The DataGrid column definitions. Rebuilt only when the selection or handlers change (not on every
  // render), so the cell closures see fresh selection state while the columns' identity stays stable
  // during a resize drag — `DataGrid` keys its width state by columnId, so widths survive the rebuild.
  const columns = useMemo<TableColumnDefinition<CategorizedEmail>[]>(
    () => [
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.select,
        renderHeaderCell: () => (
          <Checkbox
            aria-label="Select all e-mails"
            checked={headerChecked}
            onClick={(event) => event.stopPropagation()}
            onChange={() => toggleSelectAll(visibleIds)}
          />
        ),
        renderCell: (email) => {
          const id = email.message.id;
          const subject = email.message.subject ?? '(no subject)';
          return (
            <Checkbox
              aria-label={`Select ${subject}`}
              checked={id ? selectedIds.has(id) : false}
              // Keep row activation (which opens the body panel) from firing too.
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
              onChange={() => {
                if (id) {
                  toggleSelected(id);
                }
              }}
            />
          );
        },
      }),
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.date,
        renderHeaderCell: () => 'Date',
        renderCell: (email) => formatReceivedDate(email.message.receivedDateTime),
      }),
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.subject,
        renderHeaderCell: () => 'Subject',
        renderCell: (email) => {
          const subject = email.message.subject ?? '(no subject)';
          return (
            <span className={styles.subjectCell}>
              {/* Hover tooltip reveals the full subject when the cell text is ellipsized (AC2). */}
              <Tooltip content={subject} relationship="label" withArrow>
                <span className={styles.subjectText}>{subject}</span>
              </Tooltip>
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
          );
        },
      }),
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.organization,
        renderHeaderCell: () => 'Organization',
        renderCell: (email) => email.customer,
      }),
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.project,
        renderHeaderCell: () => 'Project',
        renderCell: (email) => email.project,
      }),
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.type,
        renderHeaderCell: () => 'Type',
        renderCell: (email) => typeLabel(email.type),
      }),
      createTableColumn<CategorizedEmail>({
        columnId: COLUMN_ID.actions,
        renderHeaderCell: () => 'Actions',
        renderCell: (email) => {
          const subject = email.message.subject ?? '(no subject)';
          return (
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
          );
        },
      }),
    ],
    [
      headerChecked,
      selectedIds,
      visibleIds,
      toggleSelectAll,
      toggleSelected,
      openDeleteRow,
      openResolve,
      styles,
    ],
  );

  return (
    <div className={styles.root}>
      {/* data-testid marks the single scroll region so the E2E layout test can assert only it scrolls. */}
      <div className={styles.main} data-testid="email-scroll-region">
        {emails.length === 0 ? (
          // Nothing in this tab/facet combo — nothing to search, so no toolbar/search box (D3).
          <Text as="p" className={styles.empty}>
            No e-mails to show.
          </Text>
        ) : (
          <>
            <div className={styles.toolbar}>
              <div className={styles.toolbarLeft}>
                <SearchBox
                  className={styles.searchBox}
                  placeholder="Search by subject"
                  aria-label="Search e-mails by subject"
                  // Controlled: typing and the built-in clear (dismiss) button both flow through here.
                  // No debounce — the corpus is bounded and filtering is synchronous (story 56).
                  value={searchQuery}
                  onChange={(_event, data) => setSearchQuery(data.value)}
                />
                {/* The active-filter overview sits next to the search box (AC1); empty → renders nothing. */}
                <SelectedFilters filters={selectedFilters} onRemove={onRemoveFilter} />
              </div>
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
            {visibleEmails.length === 0 ? (
              // The combo has e-mails but none match the search — keep the toolbar (so the box can be
              // cleared) and show a distinct empty message instead of the grid.
              <Text as="p" className={styles.empty}>
                No e-mails match your search.
              </Text>
            ) : (
              <DataGrid
                aria-label="E-mails"
                size="small"
                className={styles.grid}
                items={visibleEmails}
                columns={columns}
                getRowId={(email) => email.message.id ?? ''}
                resizableColumns
                // autoFitColumns re-fits every column to the container on each render, which shrinks
                // them below their ideal widths and immediately undoes a manual drag; disabling it lets
                // resizes stick and keeps Date at its compact default (the grid overflows → main scrolls).
                resizableColumnsOptions={{ autoFitColumns: false }}
                columnSizingOptions={columnSizingOptions}
              >
                <DataGridHeader>
                  <DataGridRow>
                    {({ renderHeaderCell }) => (
                      <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                    )}
                  </DataGridRow>
                </DataGridHeader>
                <DataGridBody<CategorizedEmail>>
                  {({ item, rowId }) => {
                    const id = item.message.id;
                    const subject = item.message.subject ?? '(no subject)';
                    const open = () => {
                      if (id) {
                        openEmail(id);
                      }
                    };
                    return (
                      <DataGridRow<CategorizedEmail>
                        key={rowId}
                        className={styles.row}
                        tabIndex={0}
                        aria-label={subject}
                        onClick={open}
                        onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            open();
                          }
                        }}
                      >
                        {({ columnId, renderCell }) => (
                          <DataGridCell
                            // Cells holding interactive controls trap Tab inside until Escape (`group`);
                            // plain data cells stay a single Tab stop (`cell`).
                            focusMode={
                              columnId === COLUMN_ID.select || columnId === COLUMN_ID.actions
                                ? 'group'
                                : 'cell'
                            }
                            className={ELLIPSIS_COLUMNS.has(columnId) ? styles.cell : undefined}
                          >
                            {renderCell(item)}
                          </DataGridCell>
                        )}
                      </DataGridRow>
                    );
                  }}
                </DataGridBody>
              </DataGrid>
            )}
          </>
        )}
      </div>

      {/* Drag handle to resize the preview; only present while the panel is open (story 55). */}
      {isPanelOpen && (
        <div
          className={styles.resizeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize e-mail preview"
          {...handleProps}
        />
      )}

      <InlineDrawer
        open={isPanelOpen}
        position="end"
        separator
        className={styles.drawer}
        // Controlled width (px) drives the drawer size — overrides the preset `size` var (story 55).
        style={{ '--fui-Drawer--size': `${panelWidth}px` } as CSSProperties}
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
