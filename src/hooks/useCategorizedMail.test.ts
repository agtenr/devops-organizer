import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Stable signed-in account (defined inside the factory so its identity never changes across renders,
// otherwise the load effect would re-run every render).
vi.mock('@azure/msal-react', () => {
  const account = { homeAccountId: 'home', username: 'user@example.com' };
  return { useMsal: () => ({ accounts: [account] }) };
});
vi.mock('../services/graph/graphClient', () => ({
  createGraphClient: () => ({}),
}));
vi.mock('../services/mail/mailService', () => ({
  fetchMailFromFolder: vi.fn(() =>
    Promise.resolve([
      { id: 'a', subject: 'A' },
      { id: 'b', subject: 'B' },
      { id: 'c', subject: 'C' },
    ]),
  ),
  deleteMailMessage: vi.fn(() => Promise.resolve()),
}));
vi.mock('../services/projectMap/projectMapService', () => ({
  fetchProjectMap: vi.fn(() => Promise.resolve({})),
  saveProjectMapping: vi.fn(),
}));

import { deleteMailMessage } from '../services/mail/mailService';
import { useCategorizedMail } from './useCategorizedMail';

/** Ids of the categorized set, in order (the raw messages are carried through unchanged). */
function ids(categorized: { message: { id?: string | null } }[]): (string | null | undefined)[] {
  return categorized.map((email) => email.message.id);
}

describe('useCategorizedMail — deleteEmails', () => {
  beforeEach(() => {
    vi.mocked(deleteMailMessage).mockReset();
  });

  it('removes every id from the set on a fully successful delete', async () => {
    vi.mocked(deleteMailMessage).mockResolvedValue(undefined);
    const { result } = renderHook(() => useCategorizedMail());
    await waitFor(() => expect(result.current.status).toBe('success'));
    expect(ids(result.current.categorized)).toEqual(['a', 'b', 'c']);

    await act(async () => {
      await result.current.deleteEmails(['a', 'c']);
    });

    expect(ids(result.current.categorized)).toEqual(['b']);
  });

  it('prunes the succeeded ids and rejects naming the failures on a partial delete', async () => {
    // 'a' deletes; 'b' fails.
    vi.mocked(deleteMailMessage).mockImplementation((_client, id) =>
      id === 'b' ? Promise.reject(new Error('graph said no')) : Promise.resolve(),
    );
    const { result } = renderHook(() => useCategorizedMail());
    await waitFor(() => expect(result.current.status).toBe('success'));

    let caught: unknown;
    await act(async () => {
      caught = await result.current.deleteEmails(['a', 'b']).catch((err: unknown) => err);
    });

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toContain('1 of 2 messages could not be deleted');
    // The succeeded id ('a') is pruned; the failed one ('b') stays alongside the untouched 'c'.
    expect(ids(result.current.categorized)).toEqual(['b', 'c']);
  });
});
