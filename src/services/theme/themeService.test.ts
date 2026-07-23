import { describe, expect, it, vi } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { fetchThemePreference, saveThemePreference } from './themeService';

/**
 * Minimal fake of the Graph request builder chain used by the service:
 * `client.api(path).get()` and `client.api(path).header(...).put(body)`.
 */
function fakeClient(opts: { get?: () => unknown; put?: (body: string) => void }): {
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
      opts.put?.(body as string);
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

describe('fetchThemePreference', () => {
  it('resolves to light when the file does not exist (404 — first-time user)', async () => {
    const { client } = fakeClient({ get: notFound });
    await expect(fetchThemePreference(client)).resolves.toBe('light');
  });

  it('resolves to dark when the file contains {"theme":"dark"}', async () => {
    const { client } = fakeClient({ get: () => ({ theme: 'dark' }) });
    await expect(fetchThemePreference(client)).resolves.toBe('dark');
  });

  it('resolves to light when the file contains {"theme":"light"}', async () => {
    const { client } = fakeClient({ get: () => ({ theme: 'light' }) });
    await expect(fetchThemePreference(client)).resolves.toBe('light');
  });

  it('resolves to light for malformed content (graceful degradation)', async () => {
    const { client } = fakeClient({ get: () => 'not json {' });
    await expect(fetchThemePreference(client)).resolves.toBe('light');
  });

  it('resolves to light for an unrecognized theme value', async () => {
    const { client } = fakeClient({ get: () => ({ theme: 'high-contrast' }) });
    await expect(fetchThemePreference(client)).resolves.toBe('light');
  });

  it('parses a theme delivered as a JSON string', async () => {
    const { client } = fakeClient({ get: () => '{"theme":"dark"}' });
    await expect(fetchThemePreference(client)).resolves.toBe('dark');
  });

  it('propagates a non-404 error', async () => {
    const { client } = fakeClient({
      get: () => {
        throw Object.assign(new Error('forbidden'), { statusCode: 403 });
      },
    });
    await expect(fetchThemePreference(client)).rejects.toThrow('forbidden');
  });
});

describe('saveThemePreference', () => {
  it('PUTs the correct JSON payload and path for dark mode', async () => {
    const put = vi.fn();
    const { client, lastPutBody } = fakeClient({ put });

    await saveThemePreference(client, 'dark');

    expect(put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(lastPutBody() as string)).toEqual({ theme: 'dark' });
  });

  it('PUTs the correct JSON payload for light mode', async () => {
    const put = vi.fn();
    const { client, lastPutBody } = fakeClient({ put });

    await saveThemePreference(client, 'light');

    expect(put).toHaveBeenCalledTimes(1);
    expect(JSON.parse(lastPutBody() as string)).toEqual({ theme: 'light' });
  });
});
