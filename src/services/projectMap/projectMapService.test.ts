import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { fetchProjectMap, saveProjectMapping } from './projectMapService';

/**
 * Minimal fake of the Graph request builder chain used by the service:
 * `client.api(path).get()` and `client.api(path).header(...).put(body)`.
 */
function fakeClient(opts: {
  get?: () => unknown;
  put?: (body: unknown) => void;
}): { client: Client; lastPath: () => string; lastPutBody: () => unknown } {
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

describe('fetchProjectMap', () => {
  it('returns an empty map when the file does not exist (404)', async () => {
    const { client } = fakeClient({ get: notFound });
    await expect(fetchProjectMap(client)).resolves.toEqual({});
  });

  it('parses a well-formed map and lowercases its keys', async () => {
    const { client } = fakeClient({
      get: () => ({ '2595F41B-A4EA-4A8E-A89C-1CC0BD9384B4': 'AI Sales Agents' }),
    });
    await expect(fetchProjectMap(client)).resolves.toEqual({
      '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4': 'AI Sales Agents',
    });
  });

  it('parses a map delivered as a JSON string', async () => {
    const { client } = fakeClient({ get: () => '{"guid-1":"Alpha"}' });
    await expect(fetchProjectMap(client)).resolves.toEqual({ 'guid-1': 'Alpha' });
  });

  it('returns an empty map for malformed JSON', async () => {
    const { client } = fakeClient({ get: () => 'not json {' });
    await expect(fetchProjectMap(client)).resolves.toEqual({});
  });

  it('drops non-string values defensively', async () => {
    const { client } = fakeClient({ get: () => ({ 'guid-1': 'Alpha', 'guid-2': 42 }) });
    await expect(fetchProjectMap(client)).resolves.toEqual({ 'guid-1': 'Alpha' });
  });

  it('propagates a non-404 error', async () => {
    const { client } = fakeClient({
      get: () => {
        throw Object.assign(new Error('forbidden'), { statusCode: 403 });
      },
    });
    await expect(fetchProjectMap(client)).rejects.toThrow('forbidden');
  });
});

describe('saveProjectMapping', () => {
  it('merges the new entry (key lowercased, name trimmed) and PUTs the whole map', async () => {
    const put = vi.fn();
    const { client, lastPutBody } = fakeClient({ put });

    const result = await saveProjectMapping(
      client,
      { 'existing-guid': 'Existing' },
      'ABCD-1234',
      '  AI Sales Agents  ',
    );

    const expected = { 'existing-guid': 'Existing', 'abcd-1234': 'AI Sales Agents' };
    expect(result).toEqual(expected);
    expect(put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(lastPutBody() as string)).toEqual(expected);
  });
});
