import { Badge, Spinner, Text, makeStyles, tokens } from '@fluentui/react-components';
import type { CategorizedEmail } from '../../models/categorization';

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

export interface MailDebugProps {
  status: 'loading' | 'success' | 'error';
  error: string;
  folderName: string;
  /** The (already-filtered) categorized set to visualize; the raw `<pre>` is `emails.map(e => e.message)`. */
  emails: CategorizedEmail[];
}

/**
 * TEMPORARY debug component: shows the categorized `(Customer, Project, Type)` triples next to the
 * raw Microsoft Graph response, so the categorization can be eyeballed against the raw shape. It is
 * a pure presentational visualizer — it renders whatever (already-filtered) e-mails it is handed and
 * owns no data-fetching or selection state (those live in `useCategorizedMail` / the `Organizer`
 * container). It must be removed once the real list/categorization UI lands — deleting this folder
 * and swapping the visualizer inside `Organizer` is the whole removal.
 */
export function MailDebug({ status, error, folderName, emails }: MailDebugProps) {
  const styles = useStyles();

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
              Categorized ({emails.length})
            </Text>
            <div className={styles.list}>
              {emails.map((email, index) => (
                <CategorizedCard key={email.message.id ?? index} email={email} />
              ))}
            </div>
          </div>
          <div className={styles.column}>
            <Text as="h2" size={400} className={styles.heading}>
              Raw Graph response
            </Text>
            <pre className={styles.pre}>
              {JSON.stringify(
                emails.map((email) => email.message),
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      )}
    </section>
  );
}
