import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import type { SavedView } from '../../models/savedViews';
import { fetchSavedViews, saveSavedViews } from './savedViewsService';

/**
 * Minimal fake of the Graph request builder chain used by the service:
 * `client.api(path).get()` and `client.api(path).header(...).put(body)`. Mirrors
 * `projectMapService.test.ts`'s fake.
 */
function fakeClient(opts: { get?: () => unknown; put?: (body: unknown) => void }): {
  client: Client;
  lastPath: () => string;
  lastPutBody: () => unknown;
} {
  let path = '';
  let putBody: unknown;
  const builder = {
    header: () => builder,
    get: () => Promise.resolve(opts.get?.()),
    put: (body: unknown) => {
      putBody = body;
      opts.put?.(body);
      return Promise.resolve(undefined);
    },
  };
  const client = {
    api: (p: string) => {
      path = p;
      return builder;
    },
  } as unknown as Client;
  return { client, lastPath: () => path, lastPutBody: () => putBody };
}

const notFound = () => {
  throw Object.assign(new Error('itemNotFound'), { statusCode: 404 });
};

const SAMPLE_VIEW: SavedView = {
  id: 'b3f1c2a0-1111-2222-3333-444455556666',
  name: 'Contoso failed builds',
  customer: 'Contoso',
  project: 'Alpha',
  typeKeys: ['Build::Failed'],
  searchQuery: '',
  isDefault: true,
};

describe('fetchSavedViews', () => {
  it('returns an empty array when the file does not exist (404)', async () => {
    const { client } = fakeClient({ get: notFound });
    await expect(fetchSavedViews(client)).resolves.toEqual([]);
  });

  it('parses a well-formed array', async () => {
    const { client } = fakeClient({ get: () => [SAMPLE_VIEW] });
    await expect(fetchSavedViews(client)).resolves.toEqual([SAMPLE_VIEW]);
  });

  it('parses an array delivered as a JSON string', async () => {
    const { client } = fakeClient({ get: () => JSON.stringify([SAMPLE_VIEW]) });
    await expect(fetchSavedViews(client)).resolves.toEqual([SAMPLE_VIEW]);
  });

  it('returns an empty array for malformed JSON', async () => {
    const { client } = fakeClient({ get: () => 'not json [' });
    await expect(fetchSavedViews(client)).resolves.toEqual([]);
  });

  it('returns an empty array when the content is not an array', async () => {
    const { client } = fakeClient({ get: () => ({ not: 'an array' }) });
    await expect(fetchSavedViews(client)).resolves.toEqual([]);
  });

  it('drops entries missing required fields defensively', async () => {
    const { client } = fakeClient({ get: () => [SAMPLE_VIEW, { id: 'incomplete' }] });
    await expect(fetchSavedViews(client)).resolves.toEqual([SAMPLE_VIEW]);
  });

  it('propagates a non-404 error', async () => {
    const { client } = fakeClient({
      get: () => {
        throw Object.assign(new Error('forbidden'), { statusCode: 403 });
      },
    });
    await expect(fetchSavedViews(client)).rejects.toThrow('forbidden');
  });
});

describe('saveSavedViews', () => {
  it('PUTs the whole array as JSON', async () => {
    const put = vi.fn();
    const { client, lastPutBody } = fakeClient({ put });

    await saveSavedViews(client, [SAMPLE_VIEW]);

    expect(put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(lastPutBody() as string)).toEqual([SAMPLE_VIEW]);
  });
});
