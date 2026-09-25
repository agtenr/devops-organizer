import {
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Input,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useSaveViewDialog } from './useSaveViewDialog';

const useStyles = makeStyles({
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
});

export interface SaveViewDialogProps {
  /** Dialog title — "Save current view" for create, "Rename view" for rename. */
  title: string;
  /** The name field's starting value ('' for create, the current name for rename). */
  initialName: string;
  /** Persists the name; rejects on failure. */
  onSave: (name: string) => Promise<void>;
  /** Dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Modal dialog collecting a saved-view name (story 126) — reused for both **create** ("Save current
 * view") and **rename**, distinguished only by `title`/`initialName`/`onSave`. Save persists the name
 * (showing a spinner) and, on success, closes; Cancel (or Escape/dismiss) closes without saving. All
 * logic is in `useSaveViewDialog` (`.claude/rules/frontend-architecture.md`); mirrors
 * `ResolveProjectDialog`'s Cancel/Save + spinner-while-saving shape.
 */
export function SaveViewDialog({ title, initialName, onSave, onCancel }: SaveViewDialogProps) {
  const styles = useStyles();
  const { value, setValue, saving, error, canSave, save } = useSaveViewDialog({
    initialName,
    onSave,
    onCancel,
  });

  return (
    <Dialog
      open
      modalType="modal"
      onOpenChange={(_event, data) => {
        if (!data.open && !saving) {
          onCancel();
        }
      }}
    >
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <Field label="View name">
              <Input
                value={value}
                onChange={(_event, data) => setValue(data.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && canSave) {
                    void save();
                  }
                }}
                autoFocus
              />
            </Field>
            {error && (
              <Text as="p" className={styles.error}>
                Could not save the view: {error}
              </Text>
            )}
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel} disabled={saving}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              onClick={save}
              disabled={!canSave}
              icon={saving ? <Spinner size="tiny" /> : undefined}
            >
              Save
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
}
