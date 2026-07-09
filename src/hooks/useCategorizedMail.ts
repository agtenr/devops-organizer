import { useEffect, useMemo, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import type { Message } from '@microsoft/microsoft-graph-types';
import { createGraphClient } from '../services/graph/graphClient';
import { fetchMailFromFolder } from '../services/mail/mailService';
import { categorizeEmails } from '../services/categorization/categorizationService';
import type { CategorizedEmail } from '../models/categorization';

type Status = 'loading' | 'success' | 'error';

// Folder name via env (see `.claude/rules/authentication.md`); default to the DevOps folder.
const mailFolder = import.meta.env.VITE_MAIL_FOLDER || 'DevOps';

/** The shared mail data: load status, the categorized set, and context for rendering. */
export interface UseCategorizedMailResult {
  status: Status;
  error: string;
  folderName: string;
  /** The full categorized set. `categorized.length` equals the fetched-message count (never dropped). */
  categorized: CategorizedEmail[];
}

/**
 * Shared data hook: fetches all mail from the configured folder once on mount using the signed-in
 * account and categorizes it via the pure engine, exposing the tagged set plus a status/error. It
 * owns no selection or view concern — consumers (the `Organizer` container today, the real list
 * view in #39) layer filtering/selection on top. Categorization is memoised off the fetched
 * messages; the service is the single source of tags (`.claude/rules/categorization-domain.md`).
 */
export function useCategorizedMail(): UseCategorizedMailResult {
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

  const categorized = useMemo(() => categorizeEmails(messages), [messages]);

  return { status, error, folderName: mailFolder, categorized };
}
