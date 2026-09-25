import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SavedView } from '../models/savedViews';

// Stable signed-in account (defined inside the factory so its identity never changes across renders,
// otherwise the load effect would re-run every render) — mirrors `useCategorizedMail.test.ts`.
vi.mock('@azure/msal-react', () => {
  const account = { homeAccountId: 'home', username: 'user@example.com' };
  return { useMsal: () => ({ accounts: [account] }) };
});
vi.mock('../services/graph/graphClient', () => ({
  createGraphClient: () => ({}),
}));

const EXISTING: SavedView = {
  id: 'existing-id',
  name: 'Contoso failed builds',
  customer: 'Contoso',
  project: 'Alpha',
  typeKeys: ['Build::Failed'],
  searchQuery: '',
  isDefault: true,
};

vi.mock('../services/savedViews/savedViewsService', () => ({
  fetchSavedViews: vi.fn(() => Promise.resolve([EXISTING])),
  saveSavedViews: vi.fn(() => Promise.resolve(undefined)),
}));

import { saveSavedViews } from '../services/savedViews/savedViewsService';
import { useSavedViews } from './useSavedViews';

describe('useSavedViews', () => {
  it('loads the persisted views and reports loaded once settled', async () => {
    const { result } = renderHook(() => useSavedViews());

    expect(result.current.loaded).toBe(false);
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.savedViews).toEqual([EXISTING]);
  });

  it('saveView appends a new view with a generated id and PUTs the whole array', async () => {
    const { result } = renderHook(() => useSavedViews());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.saveView('New view', {
        customer: 'Adatum',
        project: null,
        typeKeys: [],
        searchQuery: 'foo',
      });
    });

    expect(result.current.savedViews).toHaveLength(2);
    const added = result.current.savedViews.find((view) => view.name === 'New view')!;
    expect(added.id).not.toBe(EXISTING.id);
    expect(added.isDefault).toBe(false);
    expect(added.customer).toBe('Adatum');
    expect(vi.mocked(saveSavedViews)).toHaveBeenCalledWith(
      expect.anything(),
      result.current.savedViews,
    );
  });

  it('renameView changes only the name', async () => {
    const { result } = renderHook(() => useSavedViews());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.renameView('existing-id', 'Renamed');
    });

    expect(result.current.savedViews).toEqual([{ ...EXISTING, name: 'Renamed' }]);
  });

  it('deleteView removes only the targeted id', async () => {
    const { result } = renderHook(() => useSavedViews());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.saveView('Second', {
        customer: 'Adatum',
        project: null,
        typeKeys: [],
        searchQuery: '',
      });
    });
    expect(result.current.savedViews).toHaveLength(2);

    await act(async () => {
      await result.current.deleteView('existing-id');
    });

    expect(result.current.savedViews).toHaveLength(1);
    expect(result.current.savedViews[0].name).toBe('Second');
  });

  it('setDefaultView marks exactly one view default, clearing every other', async () => {
    const { result } = renderHook(() => useSavedViews());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await result.current.saveView('Second', {
        customer: 'Adatum',
        project: null,
        typeKeys: [],
        searchQuery: '',
      });
    });
    const second = result.current.savedViews.find((view) => view.name === 'Second')!;

    await act(async () => {
      await result.current.setDefaultView(second.id);
    });

    expect(result.current.savedViews.find((view) => view.id === 'existing-id')?.isDefault).toBe(
      false,
    );
    expect(result.current.savedViews.find((view) => view.id === second.id)?.isDefault).toBe(true);
  });
});
