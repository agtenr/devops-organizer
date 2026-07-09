import {
  Button,
  Combobox,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogSurface,
  DialogTitle,
  Field,
  Option,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useResolveProjectDialog } from './useResolveProjectDialog';

const useStyles = makeStyles({
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  guid: {
    fontFamily: tokens.fontFamilyMonospace,
    wordBreak: 'break-all',
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
  },
});

export interface ResolveProjectDialogProps {
  /** The unresolved project GUID from the e-mail row. */
  guid: string;
  /** The e-mail's organization — scopes which discovered project names are suggested. */
  customer: string;
  /** Distinct friendly project names already discovered for `customer` (picker suggestions). */
  knownProjectNames: string[];
  /** Persists the mapping; rejects on failure. */
  onResolve: (guid: string, name: string) => Promise<void>;
  /** Dismisses the dialog. */
  onCancel: () => void;
}

/**
 * Modal dialog to map an unresolved project GUID to a friendly name (story 42). Shows the GUID and a
 * freeform project picker: choose a name already discovered for the e-mail's organization, or type a
 * new one. Save persists the mapping (showing a spinner) and, on success, closes; Cancel (or Escape /
 * dismiss) closes without saving. All logic is in `useResolveProjectDialog`
 * (`.claude/rules/frontend-architecture.md`).
 */
export function ResolveProjectDialog({
  guid,
  customer,
  knownProjectNames,
  onResolve,
  onCancel,
}: ResolveProjectDialogProps) {
  const styles = useStyles();
  const { value, setValue, saving, error, canSave, save } = useResolveProjectDialog({
    guid,
    onResolve,
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
          <DialogTitle>Resolve Project GUID</DialogTitle>
          <DialogContent className={styles.content}>
            <Text>
              Map the project GUID{' '}
              <Text as="span" className={styles.guid}>
                {guid}
              </Text>{' '}
              (organization <Text weight="semibold">{customer}</Text>) to a friendly name.
            </Text>
            <Field label="Project name">
              <Combobox
                freeform
                placeholder="Select or type a project name"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onOptionSelect={(_event, data) => setValue(data.optionText ?? '')}
              >
                {knownProjectNames.map((name) => (
                  <Option key={name}>{name}</Option>
                ))}
              </Combobox>
            </Field>
            {error && (
              <Text as="p" className={styles.error}>
                Could not save the mapping: {error}
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
