import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import type { Message } from '@microsoft/microsoft-graph-types';
import { createGraphClient } from '../services/graph/graphClient';
import { fetchMailFromFolder } from '../services/mail/mailService';
import { fetchProjectMap, saveProjectMapping } from '../services/projectMap/projectMapService';
import { categorizeEmails } from '../services/categorization/categorizationService';
import type { CategorizedEmail, ProjectGuidMap } from '../models/categorization';

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
  /**
   * Persists a GUID→friendly-name resolution to the user's OneDrive app folder and updates the
   * in-memory map, which re-categorizes the whole set so every e-mail with that GUID shows the name
   * (story 42). Rejects if the save fails, so the caller can surface an error.
   */
  resolveProjectGuid: (guid: string, name: string) => Promise<void>;
}

/**
 * Shared data hook: on mount it loads the persistent project GUID→name map and all mail from the
 * configured folder using the signed-in account, then categorizes the mail against that map via the
 * pure engine — exposing the tagged set, a status/error, and an action to add a new GUID resolution.
 * Categorization is memoised off the fetched messages and the map, so saving a mapping re-resolves the
 * set for free. The map load is non-fatal (an absent/unreadable map just leaves GUIDs unresolved); only
 * a mail-load failure surfaces the error state. The service is the single source of tags
 * (`.claude/rules/categorization-domain.md`).
 */
export function useCategorizedMail(): UseCategorizedMailResult {
  const { accounts } = useMsal();
  const account = accounts[0];
  const [status, setStatus] = useState<Status>('loading');
  const [messages, setMessages] = useState<Message[]>([]);
  const [projectMap, setProjectMap] = useState<ProjectGuidMap>({});
  const [error, setError] = useState<string>('');

  // Latest map, read by resolveProjectGuid so a save merges into current state (not a stale closure).
  const projectMapRef = useRef<ProjectGuidMap>(projectMap);
  useEffect(() => {
    projectMapRef.current = projectMap;
  }, [projectMap]);

  useEffect(() => {
    if (!account) {
      return;
    }
    let cancelled = false;

    const client = createGraphClient(account);
    // Map load is non-fatal: an absent/unreadable map resolves to {} so mail still loads. Only a mail
    // failure rejects and surfaces the error state.
    Promise.all([
      fetchMailFromFolder(client, mailFolder),
      fetchProjectMap(client).catch(() => ({}) as ProjectGuidMap),
    ])
      .then(([mail, map]) => {
        if (cancelled) {
          return;
        }
        setMessages(mail);
        setProjectMap(map);
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

  const resolveProjectGuid = useCallback(
    async (guid: string, name: string) => {
      if (!account) {
        return;
      }
      const client = createGraphClient(account);
      const next = await saveProjectMapping(client, projectMapRef.current, guid, name);
      setProjectMap(next);
    },
    [account],
  );

  const categorized = useMemo(() => categorizeEmails(messages, projectMap), [messages, projectMap]);

  return { status, error, folderName: mailFolder, categorized, resolveProjectGuid };
}
