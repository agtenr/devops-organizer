import { PageIterator } from '@microsoft/microsoft-graph-client';
import type { Client, PageCollection } from '@microsoft/microsoft-graph-client';
import type { MailFolder, Message } from '@microsoft/microsoft-graph-types';

// `id` (the delete key — story 43 deletes by message id, so select it explicitly rather than relying
// on Graph's implicit inclusion), the fields the story requires (sender, subject, body), plus `from`
// (ADO notifications set the practical author there, which can differ from `sender`) and
// `receivedDateTime` for a stable order in the dump.
const MESSAGE_FIELDS = 'id,subject,sender,from,body,receivedDateTime';

// Graph page size. The working set is bounded (~100 messages); paging drains every page so "all
// e-mails from the folder" is honoured regardless (see `.claude/rules/categorization-domain.md`).
const PAGE_SIZE = 50;

/**
 * Fetches every message in the named Outlook folder via Microsoft Graph.
 *
 * The folder is custom (not a well-known folder), so it is resolved by display name to its id
 * first, then its messages are paged to exhaustion. Returns the raw Graph `Message` objects — no
 * mapping or categorization happens here. Throws a clear error (never silently drops) when the
 * folder does not exist.
 */
export async function fetchMailFromFolder(client: Client, folderName: string): Promise<Message[]> {
  const folders: { value: MailFolder[] } = await client
    .api('/me/mailFolders')
    .filter(`displayName eq '${folderName}'`)
    .select('id,displayName')
    .get();

  const folderId = folders.value[0]?.id;
  if (!folderId) {
    throw new Error(`Mail folder "${folderName}" was not found.`);
  }

  const firstPage: PageCollection = await client
    .api(`/me/mailFolders/${folderId}/messages`)
    .select(MESSAGE_FIELDS)
    .top(PAGE_SIZE)
    .get();

  const messages: Message[] = [];
  const iterator = new PageIterator(client, firstPage, (message) => {
    messages.push(message as Message);
    return true;
  });
  await iterator.iterate();

  return messages;
}

/**
 * Deletes a single message by its id via Microsoft Graph (story 43). Graph's `DELETE
 * /me/messages/{id}` moves the message to the mailbox's Deleted Items (recoverable) — not a permanent
 * delete. Requires the `Mail.ReadWrite` scope (see `.claude/rules/authentication.md`). One message per
 * call keeps this trivial; the caller (`useCategorizedMail.deleteEmails`) orchestrates batches and
 * prunes the in-memory set. Rejects if Graph rejects, so the caller can surface the failure.
 */
export async function deleteMailMessage(client: Client, id: string): Promise<void> {
  await client.api(`/me/messages/${id}`).delete();
}
