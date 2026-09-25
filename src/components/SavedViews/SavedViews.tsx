import { Button, Text, Tooltip, makeStyles, tokens } from '@fluentui/react-components';
import {
  Add20Regular,
  Delete20Regular,
  Edit20Regular,
  Star20Filled,
  Star20Regular,
} from '@fluentui/react-icons';
import type { SavedView } from '../../models/savedViews';
import { SaveViewDialog } from '../SaveViewDialog/SaveViewDialog';
import { useSavedViewsPanel } from './useSavedViewsPanel';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
  },
  name: {
    flexGrow: 1,
    minWidth: 0,
    justifyContent: 'flex-start',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
});

export interface SavedViewsProps {
  /** The signed-in user's saved views (from `useOrganizer`). */
  savedViews: SavedView[];
  /** Reapplies a saved view's whole filter combination. */
  onApply: (id: string) => void;
  /** Saves the currently active filters under the given name. Rejects on failure. */
  onSaveCurrent: (name: string) => Promise<void>;
  /** Renames a saved view. Rejects on failure. */
  onRename: (id: string, name: string) => Promise<void>;
  /** Deletes a saved view — no confirm dialog (decided in planning; see `plans/126/plan.md`). */
  onDelete: (id: string) => Promise<void>;
  /** Marks the given view as the (sole) default. Rejects on failure. */
  onSetDefault: (id: string) => Promise<void>;
}

/**
 * Left-sidebar "Saved views" section (story 126): a "Save current view" action, plus one row per
 * saved view — click the name to reapply it, the star to mark it default, the pencil to rename, the
 * trash to delete (no confirm — deleting a shortcut is low stakes, decided in planning with the dev).
 * Purely presentational; all persistence lives in `useSavedViews` (`src/hooks/`), wired in through
 * `useOrganizer`. Rendered as its own component next to `SidebarFilters` — not folded into it, since a
 * saved-view row's actions (apply/rename/delete/default) don't fit `SidebarFilters`'s count-only
 * `FilterOption` model (`.claude/rules/frontend-architecture.md`).
 */
export function SavedViews({
  savedViews,
  onApply,
  onSaveCurrent,
  onRename,
  onDelete,
  onSetDefault,
}: SavedViewsProps) {
  const styles = useStyles();
  const { dialogTarget, openCreateDialog, openRenameDialog, closeDialog } = useSavedViewsPanel();

  return (
    <div className={styles.root} aria-label="Saved views">
      <div className={styles.header}>
        <Text weight="semibold">Saved views</Text>
        <Button
          appearance="subtle"
          size="small"
          icon={<Add20Regular />}
          aria-label="Save current view"
          onClick={openCreateDialog}
        >
          Save current view
        </Button>
      </div>

      {savedViews.length === 0 ? (
        <Text size={200} className={styles.empty}>
          No saved views yet.
        </Text>
      ) : (
        <div className={styles.list} role="list" aria-label="Saved views list">
          {savedViews.map((view) => (
            <div key={view.id} className={styles.row} role="listitem" aria-label={view.name}>
              <Button appearance="subtle" className={styles.name} onClick={() => onApply(view.id)}>
                {view.name}
              </Button>
              <Tooltip content="Mark as default" relationship="label" withArrow>
                <Button
                  appearance="subtle"
                  size="small"
                  icon={view.isDefault ? <Star20Filled /> : <Star20Regular />}
                  aria-label={`Mark ${view.name} as default`}
                  onClick={() => onSetDefault(view.id)}
                />
              </Tooltip>
              <Button
                appearance="subtle"
                size="small"
                icon={<Edit20Regular />}
                aria-label={`Rename ${view.name}`}
                onClick={() => openRenameDialog(view.id, view.name)}
              />
              <Button
                appearance="subtle"
                size="small"
                icon={<Delete20Regular />}
                aria-label={`Delete ${view.name}`}
                onClick={() => onDelete(view.id)}
              />
            </div>
          ))}
        </div>
      )}

      {dialogTarget?.kind === 'create' && (
        <SaveViewDialog
          title="Save current view"
          initialName=""
          onSave={onSaveCurrent}
          onCancel={closeDialog}
        />
      )}
      {dialogTarget?.kind === 'rename' && (
        <SaveViewDialog
          title="Rename view"
          initialName={dialogTarget.initialName}
          onSave={(name) => onRename(dialogTarget.id, name)}
          onCancel={closeDialog}
        />
      )}
    </div>
  );
}
