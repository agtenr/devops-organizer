import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import type { Message } from '@microsoft/microsoft-graph-types';
import { describe, expect, it, vi } from 'vitest';
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
    projectIsUnresolvedGuid: false,
    ...rest,
  };
}

function renderList(overrides: Partial<EmailListProps> = {}) {
  // In the real app the filtered `emails` are always a subset of the `allEmails` corpus, and the
  // previewed row must be in the corpus for the panel to stay open (story 55). Mirror that here by
  // defaulting `allEmails` to the same list as `emails` unless a test overrides it explicitly.
  const emails = overrides.emails ?? [email()];
  const props: EmailListProps = {
    emails,
    allEmails: emails,
    resolveProjectGuid: vi.fn(() => Promise.resolve()),
    deleteEmails: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
  return render(
    <FluentProvider theme={webLightTheme}>
      <EmailList {...props} />
    </FluentProvider>,
  );
}

describe('EmailList — states', () => {
  // Loading/error are no longer EmailList's concern (story 46) — Organizer owns them; see
  // Organizer.test.tsx. EmailList is success-only: it renders the list, or this empty state.
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

    for (const header of ['Date', 'Subject', 'Organization', 'Project', 'Type', 'Actions']) {
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

describe('EmailList — resolve project GUID action', () => {
  const GUID = '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4';

  it('offers the action only on unresolved-GUID rows', () => {
    renderList({
      emails: [
        email({
          message: { id: 'g', subject: 'Guid row' },
          project: GUID,
          projectIsUnresolvedGuid: true,
        }),
        email({ message: { id: 'n', subject: 'Named row' }, project: 'Alpha' }),
      ],
    });

    const guidRow = screen.getByRole('row', { name: /Guid row/ });
    expect(
      within(guidRow).getByRole('button', { name: 'Resolve project GUID' }),
    ).toBeInTheDocument();

    const namedRow = screen.getByRole('row', { name: /Named row/ });
    expect(
      within(namedRow).queryByRole('button', { name: 'Resolve project GUID' }),
    ).not.toBeInTheDocument();
  });

  it('opens the dialog for the row GUID without opening the body panel', () => {
    renderList({
      emails: [
        email({
          message: { id: 'g', subject: 'Guid row', body: { contentType: 'text', content: 'body' } },
          customer: 'Azelis',
          project: GUID,
          projectIsUnresolvedGuid: true,
        }),
      ],
    });

    fireEvent.click(screen.getByRole('button', { name: 'Resolve project GUID' }));

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Resolve Project GUID' }),
    ).toBeInTheDocument();
    // The GUID is shown in the dialog (it also appears in the row's Project cell, so scope the query).
    expect(within(dialog).getByText(GUID)).toBeInTheDocument();
    // The body panel (row activation) must not have opened.
    expect(screen.queryByText('body')).not.toBeInTheDocument();
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

describe('EmailList — delete actions', () => {
  const two = () => [
    email({
      message: { id: 'a', subject: 'First', body: { contentType: 'text', content: 'body a' } },
    }),
    email({ message: { id: 'b', subject: 'Second' } }),
  ];

  it('has a select-all checkbox plus one per row, and selecting does not open the body panel', () => {
    renderList({ emails: two() });

    // select-all + 2 rows
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);

    fireEvent.click(checkboxes[1]);
    // The row's body panel must not have opened from the checkbox click.
    expect(screen.queryByText('body a')).not.toBeInTheDocument();
  });

  it('enables the bulk Delete button only when 2+ rows are selected', () => {
    renderList({ emails: two() });
    const checkboxes = screen.getAllByRole('checkbox');

    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    fireEvent.click(checkboxes[1]);
    // Exactly one selected — a single row uses its own icon, so the bulk button stays disabled.
    expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled();

    fireEvent.click(checkboxes[2]);
    expect(screen.getByRole('button', { name: 'Delete (2)' })).toBeEnabled();
  });

  it('opens the single-delete confirm from the row icon without opening the body panel', () => {
    renderList({ emails: two() });

    fireEvent.click(screen.getByRole('button', { name: 'Delete First' }));

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Are you sure you want to delete "First"?'),
    ).toBeInTheDocument();
    expect(screen.queryByText('body a')).not.toBeInTheDocument();
  });

  it('deletes a single e-mail via deleteEmails on confirm', async () => {
    const deleteEmails = vi.fn(() => Promise.resolve());
    renderList({ emails: two(), deleteEmails });

    fireEvent.click(screen.getByRole('button', { name: 'Delete First' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

    await waitFor(() => expect(deleteEmails).toHaveBeenCalledWith(['a']));
  });

  it('bulk-deletes the selected e-mails via deleteEmails', async () => {
    const deleteEmails = vi.fn(() => Promise.resolve());
    renderList({ emails: two(), deleteEmails });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);

    fireEvent.click(screen.getByRole('button', { name: 'Delete (2)' }));
    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText('Are you sure you want to delete 2 items?'),
    ).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Yes' }));
    await waitFor(() => expect(deleteEmails).toHaveBeenCalledWith(['a', 'b']));
  });

  it('clears the selection after a successful bulk delete', async () => {
    const deleteEmails = vi.fn(() => Promise.resolve());
    renderList({ emails: two(), deleteEmails });

    const checkboxes = screen.getAllByRole('checkbox');
    fireEvent.click(checkboxes[1]);
    fireEvent.click(checkboxes[2]);
    fireEvent.click(screen.getByRole('button', { name: 'Delete (2)' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

    // On success the dialog closes and the selection resets, so the bulk button is disabled again.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled());
  });

  it('shows the error and keeps the row when a delete fails', async () => {
    const deleteEmails = vi.fn(() => Promise.reject(new Error('Graph 500')));
    renderList({ emails: two(), deleteEmails });

    fireEvent.click(screen.getByRole('button', { name: 'Delete First' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Yes' }));

    expect(await screen.findByText(/Could not delete: Graph 500/)).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /First/ })).toBeInTheDocument();
  });

  it('renders the resolve-project-GUID action as an icon button', () => {
    renderList({
      emails: [
        email({
          message: { id: 'g', subject: 'Guid row' },
          project: '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4',
          projectIsUnresolvedGuid: true,
        }),
      ],
    });

    const button = screen.getByRole('button', { name: 'Resolve project GUID' });
    // Icon button: labelled by aria-label, with no visible text label.
    expect(button).toHaveTextContent('');
  });
});
