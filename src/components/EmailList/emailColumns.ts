import type { TableColumnId, TableColumnSizingOptions } from '@fluentui/react-components';

/**
 * Pure, React-free column config for the `EmailList` `DataGrid` (mirrors the `emailFormatters.ts` /
 * `facetFilters.ts` split — config/derivation that is trivially inspectable without mounting a
 * component). The JSX `renderHeaderCell`/`renderCell` column definitions live in `EmailList.tsx`
 * because they render and close over the view handlers (`.claude/rules/frontend-architecture.md`);
 * only the ids and the sizing options — which have no React dependency — live here.
 */

/** Single source of the `DataGrid` column ids, so the view and the sizing map never drift. */
export const COLUMN_ID = {
  select: 'select',
  date: 'date',
  subject: 'subject',
  organization: 'organization',
  project: 'project',
  type: 'type',
  actions: 'actions',
} as const satisfies Record<string, TableColumnId>;

/**
 * Per-column default widths for `DataGrid`'s `resizableColumns` feature. `resizableColumns` is
 * global (every column gets a drag handle — the O6-A ruling in `plans/54/plan.md`), so `select` and
 * `actions` are pinned to tight fixed defaults rather than being made non-resizable. **Date** is
 * sized to comfortably fit its fixed-length text (e.g. `24 Apr 2020, 06:50`) — AC3 — and
 * **Subject** is the widest so it keeps its dominant share of the row.
 */
export const columnSizingOptions: TableColumnSizingOptions = {
  [COLUMN_ID.select]: { idealWidth: 44, minWidth: 44 },
  [COLUMN_ID.date]: { idealWidth: 140, minWidth: 120 },
  [COLUMN_ID.subject]: { idealWidth: 360, minWidth: 160 },
  [COLUMN_ID.organization]: { idealWidth: 140, minWidth: 100 },
  [COLUMN_ID.project]: { idealWidth: 140, minWidth: 100 },
  [COLUMN_ID.type]: { idealWidth: 160, minWidth: 120 },
  [COLUMN_ID.actions]: { idealWidth: 96, minWidth: 96 },
};
