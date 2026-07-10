import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useConfirmDeleteDialog } from './useConfirmDeleteDialog';

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
});

export interface ConfirmDeleteDialogProps {
  /** Number of items to delete (1 for a single row delete). */
  count: number;
  /** The single e-mail's subject; shown only when `count === 1`. */
  subject?: string;
  /** Performs the delete (and any caller cleanup); rejects on failure. */
  onConfirm: () => Promise<void>;
  /** Dismisses the dialog without deleting. */
  onCancel: () => void;
}

/**
 * Modal confirm dialog guarding a delete (story 43), shared by the per-row delete and the bulk delete.
 * The primary "Yes" runs the delete showing a spinner and, on success, closes; a failure keeps the
 * dialog open with the error. Secondary "No" (or Escape / dismiss) closes without deleting. All logic is
 * in `useConfirmDeleteDialog` (`.claude/rules/frontend-architecture.md`); it mirrors `ResolveProjectDialog`.
 */
export function ConfirmDeleteDialog({
  count,
  subject,
  onConfirm,
  onCancel,
}: ConfirmDeleteDialogProps) {
  const styles = useStyles();
  const { deleting, error, confirm } = useConfirmDeleteDialog({ onConfirm, onCancel });

  const message =
    count === 1
      ? `Are you sure you want to delete "${subject ?? '(no subject)'}"?`
      : `Are you sure you want to delete ${count} items?`;

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_event, data) => {
        if (!data.open && !deleting) {
          onCancel();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>Delete {count === 1 ? 'e-mail' : 'e-mails'}</DialogTitle>
          <DialogContent className={styles.content}>
            <Text>{message}</Text>
            {error && (
              <Text as="p" className={styles.error}>
                Could not delete: {error}
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel} disabled={deleting}>
              No
            </Button>
            <Button
              appearance="primary"
              onClick={confirm}
              disabled={deleting}
              icon={deleting ? <Spinner size="tiny" /> : undefined}
            >
              Yes
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
