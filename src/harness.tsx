import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { CategorizedEmail } from './models/categorization';
import { EmailList } from './components/EmailList/EmailList';

const emails: CategorizedEmail[] = [
  {
    message: {
      id: '1',
      subject: 'Build failed on main for a rather long subject line that keeps going and going',
      receivedDateTime: '2026-07-09T08:30:00Z',
      body: { contentType: 'html', content: '<h1>Build failed</h1><p>See the logs.</p>' },
    },
    customer: 'Contoso',
    project: 'Alpha',
    type: { category: 'Build', subType: 'Failed' },
    needsReview: true,
  },
  {
    message: {
      id: '2',
      subject: 'PR review requested',
      receivedDateTime: '2026-07-08T14:05:00Z',
      body: { contentType: 'text', content: 'Please review my PR.' },
    },
    customer: 'Adatum',
    project: 'Beta',
    type: { category: 'Pull request', subType: 'Review requested' },
    needsReview: false,
  },
];

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme}>
      <EmailList status="success" error="" folderName="DevOps" emails={emails} />
    </FluentProvider>
  </StrictMode>,
);
