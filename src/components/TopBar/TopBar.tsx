import { Button, Text, makeStyles, tokens } from '@fluentui/react-components';
import { useTopBar } from './useTopBar';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
});

/**
 * Top navigation bar. Per the layout invariant it shows ONLY the logged-in user's display name
 * and a log-out button — nothing else (see `.claude/rules/frontend-architecture.md`).
 */
export function TopBar() {
  const styles = useStyles();
  const { displayName, logout } = useTopBar();

  return (
    <header className={styles.root}>
      <Text weight="semibold">{displayName}</Text>
      <Button appearance="secondary" onClick={logout}>
        Log out
      </Button>
    </header>
  );
}
