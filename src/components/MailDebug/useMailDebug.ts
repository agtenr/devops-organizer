import { useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import type { Message } from '@microsoft/microsoft-graph-types';
import { createGraphClient } from '../../services/graph/graphClient';
import { fetchMailFromFolder } from '../../services/mail/mailService';
import { categorizeEmails } from '../../services/categorization/categorizationService';

type Status = 'loading' | 'success' | 'error';

// Folder name via env (see `.claude/rules/authentication.md`); default to the DevOps folder.
const mailFolder = import.meta.env.VITE_MAIL_FOLDER || 'DevOps';

/**
 * TEMPORARY debug hook (see `MailDebug`). Fetches all mail from the configured folder once on
 * mount using the signed-in account, and exposes the raw result plus a status/error for rendering.
 */
export function useMailDebug() {
  const { accounts } = useMsal();
  const account = accounts[0];
  const [status, setStatus] = useState<Status>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!account) {
      return;
    }
    let cancelled = false;

    const client = createGraphClient(account);
    fetchMailFromFolder(client, mailFolder)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setMessages(result);
        setStatus('success');
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, [account]);

  // Derive the (Customer, Project, Type) triples from the fetched set. Pure + synchronous, so it is
  // memoised off `messages` rather than held in its own state (the service is the single source of
  // categorization — the component never re-derives tags).
  const categorized = useMemo(() => categorizeEmails(messages), [messages]);

  return { status, messages, categorized, error, folderName: mailFolder };
}
