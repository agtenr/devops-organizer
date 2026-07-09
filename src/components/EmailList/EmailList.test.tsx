import { fireEvent, render, screen, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { Message } from '@microsoft/microsoft-graph-types';
import { describe, expect, it } from 'vitest';
import type { CategorizedEmail, MessageType } from '../../models/categorization';
import { EmailList, type EmailListProps } from './EmailList';

const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };
const BUILD_FAILED: MessageType = { category: 'Build', subType: 'Failed' };

function email(
  overrides: Partial<CategorizedEmail> & { message?: Partial<Message> } = {},
): CategorizedEmail {
  const { message, ...rest } = overrides;
  return {
    message: {
      id: 'id-1',
      subject: 'Alpha subject',
      receivedDateTime: '2026-07-09T08:30:00Z',
      body: { contentType: 'text', content: 'plain body' },
      ...message,
    },
    customer: 'Contoso',
    project: 'Alpha',
    type: WI_ASSIGNED,
    needsReview: false,
    ...rest,
  };
}

function renderList(overrides: Partial<EmailListProps> = {}) {
  const props: EmailListProps = {
    status: 'success',
    error: '',
    folderName: 'DevOps',
    emails: [email()],
    ...overrides,
  };
  return render(
    <FluentProvider theme={webLightTheme}>
      <EmailList {...props} />
    </FluentProvider>,
  );
}

describe('EmailList — states', () => {
  it('shows a spinner while loading', () => {
    renderList({ status: 'loading', emails: [] });
    expect(screen.getByText(/Loading mail from "DevOps"/)).toBeInTheDocument();
  });

  it('shows the error message on error', () => {
    renderList({ status: 'error', error: 'boom', emails: [] });
    expect(screen.getByText(/Failed to load mail: boom/)).toBeInTheDocument();
  });

  it('shows an empty state when there are no e-mails', () => {
    renderList({ emails: [] });
    expect(screen.getByText(/No e-mails to show/)).toBeInTheDocument();
  });
});

describe('EmailList — rows', () => {
  it('renders the five column headers and one row per e-mail with its cells', () => {
    renderList({
      emails: [
        email({
          message: { id: 'a', subject: 'First subject' },
          customer: 'Contoso',
          project: 'Alpha',
          type: WI_ASSIGNED,
        }),
        email({
          message: { id: 'b', subject: 'Second subject' },
          customer: 'Adatum',
          project: 'Beta',
          type: BUILD_FAILED,
        }),
      ],
    });

    for (const header of ['Date', 'Subject', 'Organization', 'Project', 'Type']) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }

    // header row + 2 body rows
    expect(screen.getAllByRole('row')).toHaveLength(3);

    const first = screen.getByRole('row', { name: /First subject/ });
    expect(within(first).getByText('Contoso')).toBeInTheDocument();
    expect(within(first).getByText('Alpha')).toBeInTheDocument();
    expect(within(first).getByText('Work item · Assigned')).toBeInTheDocument();

    const second = screen.getByRole('row', { name: /Second subject/ });
    expect(within(second).getByText('Build · Failed')).toBeInTheDocument();
  });

  it('shows the needsReview marker only on flagged rows', () => {
    renderList({
      emails: [
        email({ message: { id: 'a', subject: 'Flagged' }, needsReview: true }),
        email({ message: { id: 'b', subject: 'Clean' }, needsReview: false }),
      ],
    });

    const flagged = screen.getByRole('row', { name: /Flagged/ });
    expect(within(flagged).getByText(/needs review/i)).toBeInTheDocument();

    const clean = screen.getByRole('row', { name: /Clean/ });
    expect(within(clean).queryByText(/needs review/i)).not.toBeInTheDocument();
  });
});

describe('EmailList — body panel', () => {
  it('opens the panel with the e-mail body when a row is clicked', () => {
    renderList({
      emails: [
        email({
          message: {
            id: 'a',
            subject: 'Open me',
            body: { contentType: 'text', content: 'the body text' },
          },
        }),
      ],
    });

    expect(screen.queryByText('the body text')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: /Open me/ }));
    expect(screen.getByText('the body text')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    // The selected e-mail's subject is shown in the drawer header (not just the row).
    expect(screen.getByRole('heading', { name: 'Open me' })).toBeInTheDocument();
  });

  it('closes the panel when the close control is clicked', () => {
    renderList({
      emails: [
        email({
          message: {
            id: 'a',
            subject: 'Open me',
            body: { contentType: 'text', content: 'the body text' },
          },
        }),
      ],
    });

    fireEvent.click(screen.getByRole('row', { name: /Open me/ }));
    const close = screen.getByRole('button', { name: 'Close' });
    fireEvent.click(close);

    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('swaps the shown body when a different row is clicked while open', () => {
    renderList({
      emails: [
        email({
          message: {
            id: 'a',
            subject: 'First',
            body: { contentType: 'text', content: 'body one' },
          },
        }),
        email({
          message: {
            id: 'b',
            subject: 'Second',
            body: { contentType: 'text', content: 'body two' },
          },
        }),
      ],
    });

    fireEvent.click(screen.getByRole('row', { name: /First/ }));
    expect(screen.getByText('body one')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('row', { name: /Second/ }));
    expect(screen.getByText('body two')).toBeInTheDocument();
    expect(screen.queryByText('body one')).not.toBeInTheDocument();
  });

  it('renders an html body inside a sandboxed iframe carrying its srcDoc', () => {
    renderList({
      emails: [
        email({
          message: {
            id: 'a',
            subject: 'Html mail',
            body: { contentType: 'html', content: '<p>hello</p>' },
          },
        }),
      ],
    });

    fireEvent.click(screen.getByRole('row', { name: /Html mail/ }));
    const frame = screen.getByTitle('E-mail body') as HTMLIFrameElement;
    expect(frame.tagName).toBe('IFRAME');
    expect(frame.getAttribute('srcdoc')).toBe('<p>hello</p>');
    expect(frame.getAttribute('sandbox')).toBe('');
  });
});
