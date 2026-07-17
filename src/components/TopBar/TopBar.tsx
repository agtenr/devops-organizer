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
    // Restore the heading-sized type the plain <h1> Text had (Button defaults to body-sized text),
    // so the clickable title reads as the app title, not a toolbar button.
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
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
 *
 * The title is a clickable control (a transparent Fluent Button) that refreshes the page, clearing
 * all filters (story 60). It keeps the `<h1>` heading landmark via `role="heading"`/`aria-level`.
 */
export function TopBar() {
  const styles = useStyles();
  const { displayName, logout, refresh } = useTopBar();

  return (
    <header className={styles.root}>
      <Button
        appearance="transparent"
        role="heading"
        aria-level={1}
        className={styles.title}
        onClick={refresh}
      >
        ADO E-mail Organizer
      </Button>
      <div className={styles.userGroup}>
        <Text weight="semibold">{displayName}</Text>
        <Button appearance="secondary" onClick={logout}>
          Log out
        </Button>
      </div>
    </header>
  );
}
