import { Badge, Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import type { CategorizedEmail } from '../../models/categorization';
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
  // Categorized view on the left, raw payload on the right.
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: tokens.spacingHorizontalL,
    alignItems: 'start',
  },
  column: {
    minWidth: 0,
  },
  heading: {
    display: 'block',
    marginBlockEnd: tokens.spacingVerticalS,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  subject: {
    fontWeight: tokens.fontWeightSemibold,
  },
  tags: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
  },
  pre: {
    // Wrap and scroll rather than overflow the viewport with long raw payloads.
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    fontFamily: tokens.fontFamilyMonospace,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    marginBlockStart: 0,
  },
});

function CategorizedCard({ email }: { email: CategorizedEmail }) {
  const styles = useStyles();
  return (
    <div className={styles.card}>
      <Text className={styles.subject}>{email.message.subject ?? '(no subject)'}</Text>
      <div className={styles.tags}>
        <Badge appearance="tint" color="brand">
          {email.customer}
        </Badge>
        <Badge appearance="tint" color="informative">
          {email.project}
        </Badge>
        <Badge appearance="tint" color="subtle">
          {email.type.category} · {email.type.subType}
        </Badge>
        {email.needsReview && (
          <Badge appearance="filled" color="warning">
            needs review
          </Badge>
        )}
      </div>
    </div>
  );
}

/**
 * TEMPORARY debug component: shows the categorized `(Customer, Project, Type)` triples next to the
 * raw Microsoft Graph response for the configured mail folder, so the categorization can be eyeballed
 * against the raw shape. It exists only to inspect the engine's output and must be removed once the
 * real list/categorization UI lands — deleting this folder and its one line in `App.tsx` is the whole
 * removal.
 */
export function MailDebug() {
  const styles = useStyles();
  const { status, messages, categorized, error, folderName } = useMailDebug();

  return (
    <section className={styles.root}>
      {status === 'loading' && <Spinner label={`Loading mail from "${folderName}"…`} />}
      {status === 'error' && (
        <Text as="p" className={styles.error}>
          Failed to load mail: {error}
        </Text>
      )}
      {status === 'success' && (
        <div className={styles.columns}>
          <div className={styles.column}>
            <Text as="h2" size={400} className={styles.heading}>
              Categorized ({categorized.length})
            </Text>
            <div className={styles.list}>
              {categorized.map((email, index) => (
                <CategorizedCard key={email.message.id ?? index} email={email} />
              ))}
            </div>
          </div>
          <div className={styles.column}>
            <Text as="h2" size={400} className={styles.heading}>
              Raw Graph response
            </Text>
            <pre className={styles.pre}>{JSON.stringify(messages, null, 2)}</pre>
          </div>
        </div>
      )}
    </section>
  );
}
