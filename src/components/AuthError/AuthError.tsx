import { Text, Title2, makeStyles, tokens } from '@fluentui/react-components';
import type { MsalAuthenticationResult } from '@azure/msal-react';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    maxWidth: '640px',
    marginInline: 'auto',
    paddingBlock: tokens.spacingVerticalXXL,
    paddingInline: tokens.spacingHorizontalL,
  },
  detail: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
});

/**
 * Explanatory error page shown by MsalAuthenticationTemplate when sign-in fails. Surfaces the
 * error code and message so the user (or an admin) can see what went wrong — e.g. a redirect-URI
 * mismatch on the app registration (see `.claude/rules/authentication.md`).
 */
export function AuthError({ error }: MsalAuthenticationResult) {
  const styles = useStyles();

  return (
    <div className={styles.root}>
      <Title2 as="h1">Sign-in failed</Title2>
      <Text>Something went wrong while signing you in. Please try again.</Text>
      {error && (
        <Text as="p" className={styles.detail}>
          {error.errorCode ? `${error.errorCode}: ` : ''}
          {error.message}
        </Text>
      )}
    </div>
  );
}
