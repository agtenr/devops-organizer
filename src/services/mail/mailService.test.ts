import { describe, expect, it } from 'vitest';
import type { Client } from '@microsoft/microsoft-graph-client';
import { deleteMailMessage } from './mailService';

/** Minimal fake of the Graph request builder chain used by delete: `client.api(path).delete()`. */
function fakeClient(deleteImpl: () => Promise<unknown> = () => Promise.resolve(undefined)): {
  client: Client;
  lastPath: () => string;
  deleteCount: () => number;
} {
  let path = '';
  let deletes = 0;
  const builder = {
    delete: () => {
      deletes += 1;
      return deleteImpl();
    },
  };
  const client = {
    api: (p: string) => {
      path = p;
      return builder;
    },
  } as unknown as Client;
  return { client, lastPath: () => path, deleteCount: () => deletes };
}

describe('deleteMailMessage', () => {
  it('issues a single DELETE against /me/messages/{id} for the given id', async () => {
    const { client, lastPath, deleteCount } = fakeClient();
    await deleteMailMessage(client, 'AAMkAG-123');
    expect(lastPath()).toBe('/me/messages/AAMkAG-123');
    expect(deleteCount()).toBe(1);
  });

  it('propagates a Graph failure to the caller', async () => {
    const { client } = fakeClient(() => Promise.reject(new Error('forbidden')));
    await expect(deleteMailMessage(client, 'x')).rejects.toThrow('forbidden');
  });
});
