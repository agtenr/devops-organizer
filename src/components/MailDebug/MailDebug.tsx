import { Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useMailDebug } from './useMailDebug';

const useStyles = makeStyles({
  root: {
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
  },
  error: {
    color: tokens.colorPaletteRedForeground1,
    fontFamily: tokens.fontFamilyMonospace,
  },
  pre: {
    // Wrap and scroll rather than overflow the viewport with long raw payloads.
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
  },
});

/**
 * TEMPORARY debug component: dumps the raw Microsoft Graph response for the configured mail folder
 * into a `<pre>` so the raw shape can be inspected. It exists only to eyeball the fetch output for
 * story 36 and must be removed once the real list/categorization UI lands — deleting this folder
 * and its one line in `App.tsx` is the whole removal.
 */
export function MailDebug() {
  const styles = useStyles();
  const { status, messages, error, folderName } = useMailDebug();

  return (
    <section className={styles.root}>
      {status === 'loading' && <Spinner label={`Loading mail from "${folderName}"…`} />}
      {status === 'error' && (
        <Text as="p" className={styles.error}>
          Failed to load mail: {error}
        </Text>
      )}
      {status === 'success' && <pre className={styles.pre}>{JSON.stringify(messages, null, 2)}</pre>}
    </section>
  );
}
