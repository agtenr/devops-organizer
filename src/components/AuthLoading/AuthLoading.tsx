import { Spinner, makeStyles, tokens } from '@fluentui/react-components';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    justifyContent: 'center',
    paddingBlock: tokens.spacingVerticalXXL,
  },
});

/**
 * Shown by MsalAuthenticationTemplate while the redirect sign-in is in progress.
 */
export function AuthLoading() {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Spinner label="Signing in…" />
    </div>
  );
}
