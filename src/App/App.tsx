import { InteractionType } from '@azure/msal-browser';
import { MsalAuthenticationTemplate } from '@azure/msal-react';
import { loginRequest } from '../auth/msalConfig';
import { AuthError } from '../components/AuthError/AuthError';
import { AuthLoading } from '../components/AuthLoading/AuthLoading';
import { Organizer } from '../components/Organizer/Organizer';
import { TopBar } from '../components/TopBar/TopBar';

/**
 * Gates the app behind an Entra ID sign-in. Unauthenticated users are automatically redirected
 * to the Microsoft login page (redirect flow, never a popup); while that is in progress the
 * loading UI shows, and a failure renders the error page. Authenticated users see the app.
 */
export function App() {
  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
      errorComponent={AuthError}
      loadingComponent={AuthLoading}
    >
      <TopBar />
      <Organizer />
    </MsalAuthenticationTemplate>
  );
}
