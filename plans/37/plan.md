# Plan — Story 37: E-mail categorization engine

## Context
The app triages a daily flood of Azure DevOps notification e-mails
(`.claude/rules/categorization-domain.md`). Story 36 (*done*) added the read path: on load it
fetches every raw Graph `Message` from the `DevOps` folder and dumps the raw JSON via the temporary
`MailDebug` component. Nothing yet derives meaning from those messages.

**This story adds the categorization engine:** a single, pure service that maps each raw Graph
`Message` to a `(Customer, Project, Type)` triple, following the rules the story pins down —
organization & project from the Azure DevOps URL in the body, type from the action sentence, with
explicit fallbacks and a "needs review" flag when a signal is missing. Per the story's own "Rules"
list, the engine is exercised by wiring it to the messages the mail service already returns and by
**extending the debug component to print the categorized result next to the raw Graph content**, so
the mapping can be eyeballed against real mail. Every rule is unit-tested against captured sample
e-mails.

This is the domain core called out in `.claude/rules/categorization-domain.md` ("all of this logic
is centralized in a single service — the one place business logic lives"). Building the real list
UI (tabs, sidebar, list view) that *consumes* the triple is the successor stories (#38, #39), not
this one.

## Keep it simple
The story's acceptance criteria are detailed, but several items are explicitly edge cases or future
concerns. Scope guardrails — concrete non-goals:
- **No real list / tabs / sidebar UI.** The only UI touched is the existing **temporary**
  `MailDebug` component, extended to also show the categorized triple beside the raw JSON. The
  customer tabs, project/type sidebar, and list view are stories #38/#39 — do **not** build them here.
- **No GUID → project-name translation.** The AC allows showing the **GUID as-is** when a name
  isn't present ("the guid can be shown instead"); there is no lookup source in a front-end-only app,
  so no translation table is built. A GUID project segment is used verbatim.
- **No multi-language type detection.** Per AC §6, type wording is assumed **English**; org/project
  stay language-independent because they come from the URL. A non-English wording list is out of scope.
- **No attachment-forward or deep re-forward reconstruction.** AC §5 lists "forwarded as an
  attachment" and stacked re-forwards as edge cases needing separate handling — those fall back to
  *needs review* rather than bespoke parsing. Inline forwards **are** handled (see approach).
- **No custom-sender rule engine.** AC §1 says non-native senders "must be categorized by their own
  rules, not these" — since no such rules exist yet, a non-native e-mail falls back to
  `Other / Unknown` + *needs review*, not a new rule framework.
- **No new dependencies, no DOM library.** Parsing uses the standard library plus the browser-native
  `DOMParser` (already available under jsdom in tests); nothing is added to `package.json`.
- **No persistence / caching.** In-memory, over the already-fetched bounded set
  (`.claude/rules/frontend-architecture.md`).
- **`MailDebug` is not removed.** It stays the (still temporary) display surface for this story; its
  removal happens when the real list UI lands.

## Implementation approach
Add a **pure categorization service** under `src/services/categorization/` and a small **domain
model** under `src/models/` (the first story to need either — both directories are created here per
`.claude/rules/frontend-architecture.md`). Then wire the service into the existing `useMailDebug`
hook and extend `MailDebug.tsx` to render the categorized triple beside the raw JSON.

**The service is pure and deterministic** (no I/O, no network, no MSAL) so it is trivially
unit-testable, exactly as `.claude/rules/categorization-domain.md` requires. It consumes the raw
`Message` objects the mail service already returns — it never fetches.

**Entry points:**
- `categorizeEmail(message: Message): CategorizedEmail` — categorizes one message.
- `categorizeEmails(messages: Message[]): CategorizedEmail[]` — maps the whole in-memory set.

**Internal helpers (each independently testable):**
- `isNativeNotification(message)` — true when the ADO address `azuredevops@microsoft.com` is the
  top-level `sender`/`from`, **or** appears in a `From:` line inside the body (inline forward).
- `extractBodyText(body)` — normalise `ItemBody` to plain text: if `contentType === 'html'`, strip
  markup via `DOMParser`; else use `content` as-is. Used for type/action-sentence matching.
- `resolveOrgAndProject(body)` — scan the raw body for Azure DevOps URLs, **unwrapping Microsoft
  SafeLinks first** (`safelinks.protection.outlook.com/?url=<encoded>` → decode the `url` param),
  match `dev.azure.com/{org}/{project}` or the legacy `{org}.visualstudio.com/{project}`, **skip
  path segments starting with `_`** (`_settings`, `_git`, `_apis`, …), and return the first real
  `(org, project)` (project used verbatim, name or GUID, URL-decoded). Returns `undefined` when no
  usable URL is found.
- `determineType(text, subject)` — evaluate the ordered rule list (below) against the action text
  (body), falling back to the subject; **case-insensitive**; stop at first match.

**Fallback discipline (`.claude/rules/categorization-domain.md` invariant — every e-mail gets all
three tags, nothing crashes or is silently dropped):** when a signal is missing, assign the explicit
sentinel `'Uncategorized'` for customer/project and `Other / Unknown` for type, and set
`needsReview: true`. `needsReview` is also set for a non-native sender, an unresolved/absent ADO URL,
and a no-match type.

**Type-detection rule order** (AC §4 — evaluate top-down, stop at first match, case-insensitive;
action sentence at the top of the body is authoritative, subject is a fallback hint):

| Order | Category | Signal (contains, case-insensitive) | Sub-type |
|---|---|---|---|
| 1 | Other | body/subject: requesting access to an org / "access request" | Access request |
| 1 | Other | org-settings notification with no work artifact | Admin |
| 2 | Build | "build succeeded" | Succeeded |
| 2 | Build | "build failed" / "failed" | Failed |
| 2 | Build | "partially succeeded" | Partially succeeded |
| 3 | Release | "approval is required for stage" | Approval pending |
| 3 | Release | "deployment succeeded" | Deployment succeeded |
| 3 | Release | "deployment failed" | Deployment failed |
| 4 | Pull request | "completed the pull request" | Completed |
| 4 | Pull request | "abandoned the pull request" | Abandoned |
| 4 | Pull request | "added as a reviewer" | Review requested |
| 4 | Pull request | "created the pull request" | Created |
| 4 | Pull request | "pushed" / "updated the pull request" | Updated |
| 4 | Pull request | "commented" / "mentioned you" (PR context) | Commented |
| 5 | Work item | "was assigned to" | Assigned |
| 5 | Work item | "mentioned you" | Mentioned |
| 5 | Work item | "commented on" | Commented |
| 5 | Work item | a state transition is shown | State changed |
| 5 | Work item | "created" | Created |
| 6 | Other | no rule matched | Unknown (+ needs review) |

**Inline-forward handling (AC §5):** native detection also inspects the body's `From:` line, and the
action-sentence search runs over the forwarded original content (the org/project URL is found by
scanning anywhere in the body, so forwarding does not affect it). The `FW:`/`FWD:` subject prefix is
harmless because matching is "contains", never start-of-line.

**Wiring:**
- `useMailDebug` already fetches `Message[]`; add `categorized = categorizeEmails(messages)` (pure,
  synchronous) and expose it alongside `messages`.
- `MailDebug.tsx` renders the categorized list **beside** the raw `<pre>` (two columns via a Griffel
  style), each row showing customer / project / type (+ a "needs review" marker). Still temporary.

**No dependency changes.** The service is plain TypeScript; `Message`/`ItemBody`/`Recipient` types
come from the already-present `@microsoft/microsoft-graph-types`.

## Data contracts
This change moves data across a module↔module boundary: mail service → categorization service →
debug UI. Pin the shapes.

- **Graph `Message` → `categorizeEmail` (input).** Consumed fields, all optional/nullable in
  `@microsoft/microsoft-graph-types` — the service must treat every one as possibly missing:
  - `subject?: string | null`
  - `body?: { contentType?: 'text' | 'html' | null; content?: string | null } | null` (`ItemBody`)
  - `sender?: { emailAddress?: { address?: string | null } } | null` (`Recipient`)
  - `from?: { emailAddress?: { address?: string | null } } | null` (`Recipient`)
- **`CategorizedEmail` (output)** — `src/models/categorization.ts`:
  ```ts
  export type MessageType =
    | { category: 'Work item'; subType: 'Created' | 'Assigned' | 'Mentioned' | 'Commented' | 'State changed' }
    | { category: 'Pull request'; subType: 'Created' | 'Updated' | 'Review requested' | 'Commented' | 'Completed' | 'Abandoned' }
    | { category: 'Build'; subType: 'Succeeded' | 'Failed' | 'Partially succeeded' }
    | { category: 'Release'; subType: 'Approval pending' | 'Deployment succeeded' | 'Deployment failed' }
    | { category: 'Other'; subType: 'Access request' | 'Admin' | 'Unknown' };

  export const UNCATEGORIZED = 'Uncategorized';

  export interface CategorizedEmail {
    message: Message;      // the raw source message, unchanged
    customer: string;      // ADO organization, or UNCATEGORIZED
    project: string;       // ADO project name or GUID (verbatim), or UNCATEGORIZED
    type: MessageType;     // taxonomy triple; fallback { category: 'Other', subType: 'Unknown' }
    needsReview: boolean;  // true when any signal was missing / non-native / no type match
  }
  ```
  The `Customer` axis = ADO organization, `Project` = ADO project, `Type` = message type
  (`.claude/rules/categorization-domain.md`). The raw `Message` is carried through so downstream
  list UI (stories #38/#39) can render subject/received date without re-fetching.

## Task breakdown
1. **Define the domain model.** Create `src/models/categorization.ts` with `MessageType`,
   `CategorizedEmail`, and the `UNCATEGORIZED` sentinel (shapes above). Rules:
   `.claude/rules/categorization-domain.md` (the `(Customer, Project, Type)` triple; explicit
   fallback value), `.claude/rules/frontend-architecture.md` (create `src/models/` on first need).
2. **Implement the categorization service.** Create `src/services/categorization/categorizationService.ts`
   exporting `categorizeEmail` + `categorizeEmails`, with the private helpers `isNativeNotification`,
   `extractBodyText`, `resolveOrgAndProject`, `determineType`. Pure/deterministic; no I/O. Honour the
   fallback discipline (all three tags always set; `needsReview` on any missing signal; never throw
   on missing fields). Rules: `.claude/rules/categorization-domain.md` (centralized pure service,
   every e-mail tagged, never crash/drop), `.claude/rules/frontend-architecture.md` (business logic
   in the service, not components).
3. **Capture sample-e-mail fixtures.** Add anonymised raw `Message` fixtures under
   `src/services/categorization/__fixtures__/` — at least one per row of the story's reference-examples
   table (§7) and one per type rule, plus a SafeLink-wrapped case, a GUID-project case, an inline-forward
   case, a non-native case, and a no-signal case. Rule: `.claude/rules/testing.md` (tests driven by
   real sample e-mails captured as fixtures).
4. **Unit-test every rule.** Create `src/services/categorization/categorizationService.test.ts`
   pinning each fixture to its expected `(customer, project, type, needsReview)`: org/project from
   `dev.azure.com` and `visualstudio.com`, SafeLink unwrap, `_`-segment skip, GUID verbatim, each
   type sub-type, inline forward, non-native → `Other/Unknown`+review, and no-URL → `Uncategorized`+review.
   Rule: `.claude/rules/testing.md` (categorization service MUST be unit-tested; each rule pinned;
   test pure logic directly).
5. **Wire the service into `useMailDebug`.** In `src/components/MailDebug/useMailDebug.ts`, compute
   `categorizeEmails(messages)` and expose it (`{ status, messages, categorized, error, folderName }`).
   Rule: `.claude/rules/frontend-architecture.md` (logic in the hook, not JSX; consume the service,
   never re-derive tags).
6. **Show categorized results beside raw JSON.** Extend `src/components/MailDebug/MailDebug.tsx` to
   render the categorized triple list next to the existing raw `<pre>` (Griffel two-column layout,
   Fluent UI components/tokens), keeping the temporary-component comment. Rule:
   `.claude/rules/frontend-architecture.md` (Fluent UI + Griffel; component renders, hook holds logic).
7. **Verify.** `npm run build`, `npm run lint`, `npm run test` green; then a **live** browser run
   (sign in → categorized triples render beside the raw JSON for the real `DevOps` folder, matching the
   reference-examples expectations). Validate the Definition of done. Rules: all skills' "done" bars.

## Assumptions & open questions
- **Domain model location & shape.** Types live in `src/models/categorization.ts` (first use of
  `src/models/`); `CategorizedEmail` **wraps** the raw `Message` (rather than flattening
  subject/date into it) and represents type as a structured `{ category, subType }` union rather than
  a flat `'Work item — Assigned'` string. Reviewer may prefer a flat string or a `models/email.ts`
  name.
- **Fallback sentinel = `'Uncategorized'` + a `needsReview` boolean.** The domain rule mandates an
  explicit fallback but not its spelling; I chose the single string `'Uncategorized'` for both
  customer and project plus a separate `needsReview` flag (so the UI can highlight review items).
  Reviewer may prefer a distinct per-axis sentinel or an enum.
- **Fixtures come from real `DevOps`-folder mail captured via the existing `MailDebug` dump,
  anonymised.** The repo has no raw sample e-mails yet; the coder captures representative raw
  `Message` JSON from the live dump (story 36's whole purpose) and anonymises it into fixtures. If a
  curated sample set exists elsewhere, point me at it — otherwise this is the source.
- **Body parsing: `DOMParser` for HTML → text + regex for URL extraction.** HTML bodies are converted
  to plain text with the browser-native `DOMParser` (available under jsdom in tests) for phrase
  matching, while ADO/SafeLink URLs are pulled with a regex over the raw body (hrefs aren't in the
  stripped text). Alternative: a pure tag-strip regex with no `DOMParser`. Accept `DOMParser`?
- **Type detection matches phrases anywhere in the (forward-aware) body text, in rule order —
  not a strict "first sentence only" isolation.** This is simpler and robust to formatting, at the
  cost of a small risk that a forwarder's typed note contains a trigger phrase. I bias the search to
  the content below any forwarded header block to mitigate it. Reviewer may want stricter action-line
  isolation.
- **Inline forwards handled; attachment-forwards and stacked re-forwards fall back to *needs
  review*.** AC §5 flags those as separate-handling edge cases; I scope them out (flagged, not
  parsed) rather than build attachment/MIME parsing now. OK to defer?
- **Non-native senders → `Other / Unknown` + *needs review* (no custom-sender rules built).** AC §1
  says non-native mail needs "its own rules"; none exist, so it is flagged rather than force-fit.
  Reviewer may want a distinct "non-native" marker instead of `Unknown`.

## Considerations
- **GUID vs. name projects.** A project segment may be a GUID; it is shown verbatim (no translation
  source exists in a front-end-only app). Downstream UI should tolerate a GUID as a project label.
- **`Build failed` ordering.** The `"failed"` substring is broad; because Build is evaluated (rule 2)
  after Access/Admin and before Release/PR/Work-item, and the fixtures pin real ADO build wording,
  a stray "failed" in a non-build e-mail is unlikely — but the fixtures should include a
  deployment-failed case to prove Release isn't shadowed. Monitor if a real sample misclassifies.
- **Graph field nullability.** Every consumed `Message` field is optional/nullable; the service must
  never assume presence (missing body/sender → fallbacks + review, never a throw).
- **HTML entities / encoded URLs.** SafeLink `url` params are percent-encoded and may be
  HTML-entity-escaped inside hrefs; decode both before parsing the path.

## Testing recommendations
- **At what altitude: unit (pure service), directly.** `.claude/rules/testing.md` mandates
  unit-testing the categorization service against real sample e-mails, and to prefer testing the pure
  logic directly over through the UI. Do exactly that: fixtures in `__fixtures__/`, one assertion set
  per rule.
- **Must-cover list** (each with expected outcome; beyond the plain reference-table rows):
  - SafeLink-wrapped ADO URL → unwrapped org/project resolved (not left `Uncategorized`).
  - URL whose first path segment is `_`-prefixed (e.g. `_git`, `_settings`) → that segment skipped, a
    real project resolved.
  - Project segment is a GUID → project set to the GUID verbatim, `needsReview` stays per other signals.
  - No ADO URL anywhere in the body → customer & project = `'Uncategorized'`, `needsReview: true`.
  - Inline-forwarded native notification (`From: Azure DevOps …` in body, `FW:` subject) → still
    recognised native, correct org/project/type.
  - Non-native sender → `Other / Unknown`, `needsReview: true`.
  - Missing `body` / missing `sender` → fallbacks applied, **no throw**.
  - `deployment failed` e-mail → `Release / Deployment failed`, not shadowed by the Build `"failed"`
    rule (ordering proof).
- **Live verification (manual): needs manual live verification before merge.** After the automated
  suite, a developer signs in and confirms the categorized triples render beside the raw JSON for the
  real `DevOps` folder and match the reference-examples table. No automated Playwright coverage is
  added (it would need a real credentialed Graph call — fragile/unsafe in the harness — consistent
  with stories 30/36).

## Definition of done
- [ ] A single pure categorization service maps each `Message` to a `(Customer, Project, Type)`
      triple; it does no I/O and never fetches (categorization-domain.md: centralized pure service).
- [ ] **Every** e-mail is assigned all three tags; a missing signal yields the explicit
      `'Uncategorized'` / `Other/Unknown` fallback with `needsReview: true` — never a crash or a
      silently-dropped e-mail (categorization-domain.md invariant).
- [ ] Organization & project are read from the Azure DevOps URL in the body, with SafeLinks
      unwrapped, `_`-prefixed path segments skipped, and the project used verbatim as name **or** GUID
      (AC §2).
- [ ] No organization/project is ever inferred when absent — an unresolved URL leaves both
      `'Uncategorized'` and flags the e-mail for review (AC §2.5).
- [ ] Type is derived from the action sentence with the documented ordered rules (stop at first
      match, case-insensitive), subject only as a fallback (AC §4).
- [ ] The full type taxonomy is representable and produced: Work item / Pull request / Build /
      Release / Other with their sub-types (AC §3).
- [ ] Native detection works for both direct sends and inline forwards (`azuredevops@microsoft.com`
      as sender or in a body `From:` line); non-native senders fall back to `Other/Unknown` + review
      (AC §1, §5).
- [ ] Every rule is covered by a unit test driven by captured sample-e-mail fixtures, and the full
      Vitest suite passes (testing.md; AC "make sure every rule is testable").
- [ ] The categorization logic lives in the service; components/hooks consume it and never re-derive
      tags (frontend-architecture.md).
- [ ] The debug component prints the categorized e-mails **next to** the raw Graph content (AC
      "change the debug component …").
- [ ] `npm run build`, `npm run lint`, and `npm run test` all pass (skills' "done" bars).
- [ ] Manual live verification done: categorized triples render beside the raw JSON for the real
      `DevOps` folder and match the reference-examples expectations.

## Files/areas affected
- **New:** `src/models/categorization.ts`, `src/services/categorization/categorizationService.ts`,
  `src/services/categorization/categorizationService.test.ts`,
  `src/services/categorization/__fixtures__/` (sample-e-mail fixtures).
- **Changed:** `src/components/MailDebug/useMailDebug.ts` (compute + expose `categorized`),
  `src/components/MailDebug/MailDebug.tsx` (render categorized triples beside raw JSON).
- **Untouched:** the mail fetch path (`services/mail`, `services/graph`), auth/MSAL config, `App.tsx`
  wiring (MailDebug stays mounted), the real list/tabs/sidebar UI (stories #38/#39), CI/CD (none).
</content>
</invoke>
