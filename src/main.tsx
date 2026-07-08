import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { MsalProvider } from '@azure/msal-react';
import { App } from './App/App';
import { msalInstance } from './auth/msalConfig';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const root = createRoot(rootElement);

// msal-browser v5 requires initialize() to resolve before the instance is used; MsalProvider
// then handles the redirect promise internally, so we never call handleRedirectPromise ourselves.
void msalInstance.initialize().then(() => {
  root.render(
    <StrictMode>
      <MsalProvider instance={msalInstance}>
        <FluentProvider theme={webLightTheme}>
          <App />
        </FluentProvider>
      </MsalProvider>
    </StrictMode>,
  );
});
