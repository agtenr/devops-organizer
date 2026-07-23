import { InteractionType } from '@azure/msal-browser';
import { MsalAuthenticationTemplate } from '@azure/msal-react';
import { makeStaticStyles, makeStyles } from '@fluentui/react-components';
import { loginRequest } from '../auth/msalConfig';
import { AuthError } from '../components/AuthError/AuthError';
import { AuthLoading } from '../components/AuthLoading/AuthLoading';
import { Organizer } from '../components/Organizer/Organizer';
import { ThemeProvider } from '../components/ThemeProvider/ThemeProvider';
import { TopBar } from '../components/TopBar/TopBar';

// Full-height chain so the app fills the viewport and only the inner e-mail list scrolls (story 46).
// The html/body/#root ancestors have no height by default, so a griffel static (global) reset gives
// them 100% and drops the body margin/scrollbar; the FluentProvider height is set in ThemeProvider
// and the shell below fills the rest (story 87 moved FluentProvider into ThemeProvider).
// (griffel over hand-rolled CSS — `.claude/rules/frontend-architecture.md`.)
const useGlobalStyles = makeStaticStyles({
  'html, body, #root': { height: '100%', margin: 0 },
  body: { overflow: 'hidden' },
});

const useStyles = makeStyles({
  // Fixed app frame: the top bar stays put and the Organizer region fills the rest (its inner list is
  // the only scroller). overflow:hidden so nothing here scrolls the page itself.
  shell: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
});

/**
 * Gates the app behind an Entra ID sign-in. Unauthenticated users are automatically redirected
 * to the Microsoft login page (redirect flow, never a popup); while that is in progress the
 * loading UI shows, and a failure renders the error page. Authenticated users see the app inside a
 * fixed, full-height shell whose only scrolling region is the e-mail list (story 46).
 *
 * `ThemeProvider` wraps the shell inside the auth gate so the Graph client is available for the
 * theme preference fetch (story 87). It owns the `FluentProvider` with the dynamic theme token.
 */
export function App() {
  useGlobalStyles();
  const styles = useStyles();

  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
      errorComponent={AuthError}
      loadingComponent={AuthLoading}
    >
      <ThemeProvider>
        <div className={styles.shell}>
          <TopBar />
          <Organizer />
        </div>
      </ThemeProvider>
    </MsalAuthenticationTemplate>
  );
}
