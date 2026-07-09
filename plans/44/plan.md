# Plan — Story 44: Update e-mail categorization

## Context

Four Azure DevOps notification e-mails in the demo corpus are mis-categorized by the rule-based
engine in `src/services/categorization/categorizationService.ts`. The story pins each one to a
sample `.msg` and the type it *should* get:

| # | Sample `.msg` id (`design/demo-messages/`) | Action sentence in body | Today | Expected |
|---|---|---|---|---|
| 1 | `PR - ACS Replacement … 8419 …` | "*(author)* **pushed new changes**" | Other · Unknown | **Pull request · Updated** |
| 2 | `FW_ PR - Change the requestor … AZGL.MeetingApp 278 …` | "*(author)* **published the pull request**" | Work item · Created | **Pull request · Published** |
| 3 | `PR - ACS Replacement … 8419 … (1)` | "*(author)* **created a new pull request**" | Work item · Created | **Pull request · Created** |
| 4 | `FW_ [Build canceled] DW.DataSync … 8776103c` | "Build #91801 **canceled**" / subject `[Build canceled]` | Other · Unknown | **Build · Cancelled** |

The four source e-mails live in `design/demo-messages/` (binary, untracked). Locate each by the
identifier above — the PR/build number (`8419`, `8419 … (1)`, `278`, `8776103c`) plus its subject
prefix; the author-name suffix present in the real filenames is omitted here for privacy.

Root causes, each verified against the extracted body text:

- **Case 1** — the body's visible text contains **no literal "pull request"** (the CTA reads
  "View changes", the action reads "pushed new changes"), so the PR gate
  `includesAny(text, 'pull request', 'added as a reviewer')` never opens and the `'pushed'` branch
  inside it is unreachable. Falls through to `Other · Unknown`.
- **Case 2** — `published the pull request` opens the PR gate but matches **none** of the PR
  sub-type branches (there is no `Published` sub-type at all), so execution falls past the gate to
  the Work-item block, where `text.includes('created')` (present elsewhere in the body) mis-fires
  as `Work item · Created`.
- **Case 3** — `created a new pull request` opens the PR gate but the Created branch only matches
  the exact phrase `created the pull request`, so it falls through to the Work-item `created`
  branch → `Work item · Created`.
- **Case 4** — there is no `Build · Cancelled` rule or sub-type; `canceled` matches nothing and it
  falls through to `Other · Unknown`.

Intended outcome: all four categorize correctly, **the existing 14-message corpus keeps passing**,
and each new behavior is pinned by a committed fixture + unit test.

## Keep it simple

- **No taxonomy redesign.** Two new leaf sub-types (`Build · Cancelled`, `Pull request ·
  Published`) added to the existing union — not a restructuring of the type model.
- **No new rule engine / config.** The fix is additional ordered branches and one extra gate
  trigger inside the existing `classify()` — same includes-based, top-down style already there.
- **No UI changes.** The list and sidebar render the type generically (`facetFilters.ts`:
  `` `${category} · ${subType}` ``); a new sub-type flows through with zero component edits. This
  plan touches only the service, the model, the fixtures, and the service's tests.
- **No `.msg` parser in the app.** Fixtures are hand-derived committed JSON (as the existing 14
  are); the binary `.msg` files stay untracked and out of the suite (`testing.md`).

## Implementation approach

All logic changes stay inside the pure categorization service and its model
(`.claude/rules/categorization-domain.md`: business logic is centralized here and is
deterministic/pure). Four edits:

1. **Extend the taxonomy** in `src/models/categorization.ts` — add `'Cancelled'` to the `Build`
   sub-type union and `'Published'` to the `Pull request` sub-type union.

2. **Add a Build-cancelled rule** in `classify()` (`categorizationService.ts`), among the Build
   branches (section 2, after `build succeeded`). Anchor it so a stray "cancel" cannot mis-fire:

   ```ts
   if (/build (?:#\d+ )?cancell?ed/.test(text)) {
     return { category: 'Build', subType: 'Cancelled' };
   }
   ```

   `cancell?ed` matches both US `canceled` and UK `cancelled`; the anchor requires `build`
   immediately (optionally `#<number> `) before it. This matches the body `build #91801 canceled`
   and the subject `[build canceled]` (`determineType` falls back to the subject when the body
   region yields nothing).

3. **Fix the Pull-request branches** in `classify()` (section 4):
   - **Open the gate for case 1**: add `'pushed new changes'` to the gate trigger →
     `includesAny(text, 'pull request', 'added as a reviewer', 'pushed new changes')`. The existing
     Updated branch already matches on `'pushed'`, so no new Updated branch is needed.
   - **Published (new)**: add, inside the gate,
     `if (text.includes('published the pull request')) return { category: 'Pull request', subType: 'Published' };`
     Place it **before** the Created branch (they are independent, but keep publish ahead of the
     generic checks).
   - **Created (case 3)**: broaden the Created branch to
     `includesAny(text, 'created the pull request', 'created a new pull request')`.

4. **Fixtures + tests** — add four anonymised JSON fixtures and pin each with a unit test, and
   confirm the existing corpus stays green.

The ordered-rule structure is preserved; every new branch returns before the Work-item block, so
cases 2 and 3 stop mis-classifying as `Work item · Created`.

## Task breakdown

1. **Extend the type taxonomy.** In `src/models/categorization.ts`, add `'Cancelled'` to the
   `Build` sub-type union and `'Published'` to the `Pull request` sub-type union. Keep the doc
   comment's reference to the story-37 taxonomy accurate.
   *Rules: `.claude/rules/categorization-domain.md`, `.claude/rules/frontend-architecture.md`.*

2. **Update `classify()`** in `src/services/categorization/categorizationService.ts` per the four
   sub-points in *Implementation approach* (Build-cancelled branch; PR gate trigger +
   `pushed new changes`; PR `Published` branch; PR `Created` broadened). Do not reorder the
   existing categories. Update the function's doc comment only if a comment there becomes stale.
   *Rules: `.claude/rules/categorization-domain.md` (pure/deterministic, ordered body-signal
   rules, sender never gates), `.claude/rules/frontend-architecture.md` (logic in the service).*

3. **Add four anonymised fixtures** under
   `src/services/categorization/__fixtures__/` (suggested names below), each reduced to the Graph
   `Message` fields the service consumes (`subject`, `body.contentType: "html"`, `body.content`)
   plus `sender`/`from` for realism, mirroring the existing fixtures' shape. **Anonymise**: replace
   every real personal display name and recipient e-mail address in the source e-mails (the PR
   author in the action sentence, and any `To:`/`Sent:` recipients in the forwarded wrapper) with
   the neutral placeholders already used (`Demo User`, `demo.user@example.com`, …). **Keep
   verbatim** the ADO signals the rules key on: the
   `dev.azure.com` / SafeLinks URLs carrying org + project, the action sentence, and the subject's
   type token. Suggested filenames:
   - `pr-updated-pushed-8419.json` (case 1)
   - `pr-published-278.json` (case 2)
   - `pr-created-8419.json` (case 3)
   - `build-cancelled-91801.json` (case 4)
   *Rules: `.claude/rules/testing.md` (fixture format, anonymisation, committed JSON not `.msg`).*

4. **Add unit tests** in `src/services/categorization/categorizationService.test.ts`. Add one case
   per new fixture asserting the full `(customer, project, type)` triple and `needsReview` (values
   in *Testing recommendations*). Prefer extending the existing `DEMO_CASES`-style `it.each` table
   so the new rows read like the current 14. Run the full suite to confirm no regression.
   *Rules: `.claude/rules/testing.md` (categorization MUST be unit-tested, fixture-driven; test the
   pure service directly).*

## Assumptions & open questions

- **A1 — Sub-type spelling is `Cancelled` (double-L), not `Canceled`.** The AC writes "Build -
  Cancelled"; the source e-mail (US spelling) writes "canceled". I match the AC for the stored
  sub-type value and match *both* spellings in the detection regex. Reviewer may prefer the
  sub-type value track the ADO wording (`Canceled`) instead.
- **A2 — `published` is a distinct new sub-type `Pull request · Published`, not folded into
  `Created`.** The AC lists "Pull request published" and "Pull request created" as two separate
  criteria backed by two different e-mails, so I treat them as distinct types. Reviewer may prefer
  collapsing publish into Created (ADO "publish" ≈ "create" for a PR).
- **A3 — Case 1 is detected by adding `pushed new changes` as a PR-gate trigger** (its visible body
  has no literal "pull request"), reusing the existing `'pushed'` Updated branch. Alternative: a
  standalone Updated branch keyed on `pushed new changes` independent of the PR gate. I chose the
  gate trigger as the smaller change.
- **A4 — Fixture project values follow the "prefer name over GUID" rule already in the service.**
  Case 4's body carries both a project GUID and the name `DLWR.DataSync internship`; per
  `resolveOrgAndProject` the name wins, so the fixture's expected `project` is the name and
  `needsReview` is `false`. Confirming this is the intended expectation for that row.

## Considerations

- **Forwarded (`FW_`) messages (cases 2 and 4) need no special handling.** `actionRegion()` already
  strips a leading `From:/Sent:/To:/Subject:` wrapper, and the action sentence sits *after* that
  header; the fix was verified to produce the right type whether or not the wrapper is stripped
  (nothing before the header is a misleading trigger).
- **Regression surface is low.** No existing corpus e-mail contains `created a new pull request`,
  `published the pull request`, `pushed new changes`, or a `build … cancelled/canceled` phrase, so
  the new branches cannot re-classify any of the current 14. The full suite run in Task 4 is the
  guardrail.
- **`pushed`-based Updated detection stays inside the PR gate**, so a non-PR e-mail that merely
  mentions "pushed" is not swept into Pull request unless it also trips the (now three-way) gate.

## Testing recommendations

- **Whether to test:** yes — the project has an established unit-test practice (Vitest, the `test`
  skill) and `testing.md` mandates the categorization service be unit-tested with fixture-driven
  cases. Test the **pure service directly** (unit altitude); no component or E2E test is warranted
  (this is non-visual logic — `testing.md`'s browser-verification rule does not apply).
- **Altitude:** unit, against `categorizeEmail` with the committed fixtures.
- **Must-cover (each with expected outcome):**
  - `pr-updated-pushed-8419` → `colruytgroupcom` / `SC ComCol` / **Pull request · Updated**; `needsReview: false`.
  - `pr-published-278` → `AZGL-DLWR` / `Meeting App` / **Pull request · Published**; `needsReview: false`.
  - `pr-created-8419` → `colruytgroupcom` / `SC ComCol` / **Pull request · Created**; `needsReview: false`.
  - `build-cancelled-91801` → `DLWR-DLWR` / `DLWR.DataSync internship` / **Build · Cancelled**; `needsReview: false`.
  - Regression: the existing 14-case corpus + all other suites still pass (`npm run test`).
- **Live verification:** not needed (no running-app or visual acceptance).

## Definition of done

- [ ] `Build` sub-type union includes `'Cancelled'` and `Pull request` includes `'Published'` in `src/models/categorization.ts`; type-checks cleanly.
- [ ] Case 1 `pr-updated-pushed-8419` categorizes as `colruytgroupcom` / `SC ComCol` / `Pull request · Updated`, `needsReview: false`.
- [ ] Case 2 `pr-published-278` categorizes as `AZGL-DLWR` / `Meeting App` / `Pull request · Published`, `needsReview: false`.
- [ ] Case 3 `pr-created-8419` categorizes as `colruytgroupcom` / `SC ComCol` / `Pull request · Created`, `needsReview: false`.
- [ ] Case 4 `build-cancelled-91801` categorizes as `DLWR-DLWR` / `DLWR.DataSync internship` / `Build · Cancelled`, `needsReview: false`.
- [ ] Four anonymised JSON fixtures added under `__fixtures__/` (no real names/e-mails; ADO URL, action sentence, and subject type token kept verbatim).
- [ ] Each new case is pinned by a unit test asserting the full triple + `needsReview`.
- [ ] The categorization service remains pure/deterministic (no I/O added).
- [ ] The full Vitest suite passes, including the existing 14-message corpus (`npm run test`).
- [ ] ESLint clean and Prettier-formatted (`npm run lint`).

## Files/areas affected

- `src/models/categorization.ts` — two sub-type additions.
- `src/services/categorization/categorizationService.ts` — `classify()` branches + gate trigger.
- `src/services/categorization/categorizationService.test.ts` — four new cases.
- `src/services/categorization/__fixtures__/pr-updated-pushed-8419.json` — **new**.
- `src/services/categorization/__fixtures__/pr-published-278.json` — **new**.
- `src/services/categorization/__fixtures__/pr-created-8419.json` — **new**.
- `src/services/categorization/__fixtures__/build-cancelled-91801.json` — **new**.
