import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useTopBar } from './useTopBar';

const useStyles = makeStyles({
  root: {
    // Fixed top band: a non-shrinking flex child of the app shell (which owns the fixed full-height
    // frame), so the bar stays put while only the e-mail list scrolls (story 46; see
    // `.claude/rules/frontend-architecture.md`).
    flexShrink: 0,
    // Three-zone grid so the title is centered independent of the right group's width: an empty
    // 1fr spacer (column 1), the title (column 2, auto), and the user group (column 3, 1fr).
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    // Opaque background so scrolled content passes under the bar rather than showing through it.
    backgroundColor: tokens.colorNeutralBackground1,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  title: {
    gridColumnStart: 2,
    // Reset the default <h1> margin so the title sits vertically centered in the bar.
    margin: 0,
  },
  userGroup: {
    gridColumnStart: 3,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalM,
  },
});

/**
 * Top navigation bar. Fixed to the top of the page (does not scroll with content); shows the app
 * title centered, and the logged-in user's display name plus a log-out button on the right
 * (see `.claude/rules/frontend-architecture.md`).
 */
export function TopBar() {
  const styles = useStyles();
  const { displayName, logout } = useTopBar();

  return (
    <header className={styles.root}>
      <Text as="h1" size={500} weight="semibold" align="center" className={styles.title}>
        Azure DevOps E-mail Organizer
      </Text>
      <div className={styles.userGroup}>
        <Text weight="semibold">{displayName}</Text>
        <Button appearance="secondary" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
