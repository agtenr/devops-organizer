import type { ItemBody, Message } from '@microsoft/microsoft-graph-types';
import {
  UNCATEGORIZED,
  UNKNOWN_TYPE,
  type CategorizedEmail,
  type MessageType,
} from '../../models/categorization';

/**
 * Categorization engine (see `.claude/rules/categorization-domain.md`).
 *
 * A **pure, deterministic** service — no I/O, no network, no MSAL — that maps a raw Microsoft Graph
 * `Message` to a `(Customer, Project, Type)` triple. Organization & project come from the Azure
 * DevOps URL in the body; type from the action sentence (subject as a fallback hint). Every e-mail
 * is tagged with all three axes; when a signal is missing the explicit `Uncategorized` / `Other →
 * Unknown` fallback is used and `needsReview` is set — the engine never throws and never drops an
 * e-mail. Categorization does **not** gate on the sender (the app runs against a demo mailbox that
 * copies production mail, so the sender is often not `azuredevops@microsoft.com`) — folder
 * membership is the scope and only body signals drive the triple.
 */

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A canonical ADO project link is `{org}/{project}/_<area>` (e.g. `/_workitems`, `/_build`,
// `/_release`). Requiring the trailing `/_…` segment skips non-project links such as the legacy
// `dev.azure.com/{org}/web/build.aspx` and settings/notification links.
const DEV_AZURE_RE = /https?:\/\/dev\.azure\.com\/([^/\s"'<>]+)\/([^/\s"'<>?#]+)\/_[^\s"'<>]+/gi;
const VISUALSTUDIO_RE =
  /https?:\/\/([^./\s"'<>]+)\.visualstudio\.com\/([^/\s"'<>?#]+)\/_[^\s"'<>]+/gi;

/** Any http(s) URL, as it appears in the raw body (may be SafeLinks-wrapped or HTML-entity-escaped). */
const URL_RE = /https?:\/\/[^\s"'<>]+/gi;

/**
 * Normalises an `ItemBody` to plain text for phrase matching. HTML bodies are converted with the
 * browser-native `DOMParser` (available under jsdom in tests); a plain regex tag-strip is the
 * fallback if `DOMParser` is unavailable.
 */
export function extractBodyText(body: ItemBody | null | undefined): string {
  const content = body?.content ?? '';
  if (!content) {
    return '';
  }
  if (body?.contentType !== 'html') {
    return content;
  }
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(content, 'text/html');
    return doc.body?.textContent ?? '';
  }
  return content.replace(/<[^>]+>/g, ' ');
}

/** Decodes the real target out of a Microsoft SafeLinks wrapper; returns the URL unchanged otherwise. */
function unwrapSafeLink(rawUrl: string): string {
  // Hrefs in HTML bodies escape `&` as `&amp;`; undo that before parsing the query string.
  const url = rawUrl.replace(/&amp;/gi, '&');
  if (!/safelinks\.protection\.outlook\.com/i.test(url)) {
    return url;
  }
  try {
    const target = new URL(url).searchParams.get('url');
    return target ? decodeURIComponent(target) : url;
  } catch {
    return url;
  }
}

function safeDecode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Resolves the ADO organization & project from the first usable Azure DevOps URL in the body.
 *
 * SafeLinks are unwrapped first; `dev.azure.com/{org}/{project}/_…` and the legacy
 * `{org}.visualstudio.com/{project}/_…` forms are both matched; `_`-prefixed segments are never
 * treated as a project. When several links resolve, a project **name** is preferred over a bare
 * **GUID** (the name is used directly per the domain rules; the GUID is used only when no name is
 * present — it is never translated). Returns `undefined` when no usable URL is found.
 */
export function resolveOrgAndProject(
  bodyContent: string | null | undefined,
): { customer: string; project: string } | undefined {
  const content = bodyContent ?? '';
  if (!content) {
    return undefined;
  }

  const matches: { customer: string; project: string }[] = [];
  for (const rawUrl of content.match(URL_RE) ?? []) {
    const url = unwrapSafeLink(rawUrl);
    for (const re of [DEV_AZURE_RE, VISUALSTUDIO_RE]) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(url)) !== null) {
        const project = safeDecode(m[2]);
        if (project.startsWith('_')) {
          continue;
        }
        matches.push({ customer: safeDecode(m[1]), project });
      }
    }
  }

  if (matches.length === 0) {
    return undefined;
  }
  return matches.find((m) => !GUID_RE.test(m.project)) ?? matches[0];
}

/**
 * Strips a leading forwarded/copied wrapper (`----- Original Message -----`, or a
 * `From:`/`Sent:`/`To:`/`Subject:` header block) so a forwarder's own typed note above the original
 * content cannot trigger a false type match. Returns the text unchanged when no wrapper is found.
 */
function actionRegion(text: string): string {
  const original = text.search(/-{3,}\s*original message\s*-{3,}/i);
  if (original !== -1) {
    return text.slice(original);
  }
  const header = text.match(/\bfrom:.*(?:\r?\n.*){0,5}?\r?\n\s*subject:.*\r?\n/i);
  if (header?.index !== undefined) {
    return text.slice(header.index + header[0].length);
  }
  return text;
}

const includesAny = (haystack: string, ...needles: string[]): boolean =>
  needles.some((n) => haystack.includes(n));

/**
 * Applies the ordered type rules (story 37 §4) to a single lowercased haystack. Evaluated top-down,
 * stopping at the first match. Returns `null` when no rule matches.
 */
function classify(text: string): MessageType | null {
  // 1. Access / admin (checked first).
  if (
    includesAny(text, 'access request', 'requested access', 'requester email', 'requested resource')
  ) {
    return { category: 'Other', subType: 'Access request' };
  }
  // Other organization-administration notifications with no work artifact.
  if (
    includesAny(
      text,
      'as an administrator',
      'administrator of',
      'organization settings',
      'organization owner',
    )
  ) {
    return { category: 'Other', subType: 'Admin' };
  }

  // 2. Build. Anchored on the contiguous action phrase so an incidental "build" (e.g. in a branch
  // or repo name) plus a stray "failed"/"succeeded" elsewhere in the body cannot mis-fire.
  if (text.includes('build partially succeeded')) {
    return { category: 'Build', subType: 'Partially succeeded' };
  }
  if (text.includes('build failed')) {
    return { category: 'Build', subType: 'Failed' };
  }
  if (text.includes('build succeeded')) {
    return { category: 'Build', subType: 'Succeeded' };
  }

  // 3. Release / deployment.
  if (includesAny(text, 'approval is required for stage', 'approval pending')) {
    return { category: 'Release', subType: 'Approval pending' };
  }
  if (text.includes('deployment succeeded')) {
    return { category: 'Release', subType: 'Deployment succeeded' };
  }
  if (text.includes('deployment failed')) {
    return { category: 'Release', subType: 'Deployment failed' };
  }

  // 4. Pull request (only when the e-mail is about a pull request).
  if (includesAny(text, 'pull request', 'added as a reviewer')) {
    if (text.includes('completed the pull request')) {
      return { category: 'Pull request', subType: 'Completed' };
    }
    if (text.includes('abandoned the pull request')) {
      return { category: 'Pull request', subType: 'Abandoned' };
    }
    if (text.includes('added as a reviewer')) {
      return { category: 'Pull request', subType: 'Review requested' };
    }
    if (text.includes('created the pull request')) {
      return { category: 'Pull request', subType: 'Created' };
    }
    if (includesAny(text, 'updated the pull request', 'pushed')) {
      return { category: 'Pull request', subType: 'Updated' };
    }
    if (includesAny(text, 'commented', 'mentioned you')) {
      return { category: 'Pull request', subType: 'Commented' };
    }
  }

  // 5. Work item.
  if (text.includes('was assigned to')) {
    return { category: 'Work item', subType: 'Assigned' };
  }
  if (text.includes('mentioned you')) {
    return { category: 'Work item', subType: 'Mentioned' };
  }
  if (text.includes('commented on')) {
    return { category: 'Work item', subType: 'Commented' };
  }
  if (
    includesAny(text, 'changed the state', 'state changed', 'state was changed', 'changed state')
  ) {
    return { category: 'Work item', subType: 'State changed' };
  }
  if (text.includes('created')) {
    return { category: 'Work item', subType: 'Created' };
  }

  // 6. No match.
  return null;
}

/**
 * Derives the message type. The action sentence in the body is authoritative; the subject is a
 * fallback hint. Matching is case-insensitive. Returns `null` when neither yields a match.
 */
export function determineType(bodyText: string, subject: string): MessageType | null {
  return classify(actionRegion(bodyText).toLowerCase()) ?? classify(subject.toLowerCase());
}

/** Categorizes a single raw Graph message into its `(Customer, Project, Type)` triple. */
export function categorizeEmail(message: Message): CategorizedEmail {
  const orgProject = resolveOrgAndProject(message.body?.content);
  const type = determineType(extractBodyText(message.body), message.subject ?? '');

  return {
    message,
    customer: orgProject?.customer ?? UNCATEGORIZED,
    project: orgProject?.project ?? UNCATEGORIZED,
    type: type ?? UNKNOWN_TYPE,
    needsReview: orgProject === undefined || type === null,
  };
}

/** Categorizes the whole in-memory set of fetched messages. */
export function categorizeEmails(messages: Message[]): CategorizedEmail[] {
  return messages.map(categorizeEmail);
}
