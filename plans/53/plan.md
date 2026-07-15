# Plan — Story 53: Extra type categorization

## Context

Two Azure DevOps notification e-mails in the demo corpus fall through the rule-based engine in
`src/services/categorization/categorizationService.ts` to the `Other · Unknown` fallback because no
rule (and no taxonomy sub-type) exists for them. The story pins each to a sample `.msg` and the
type it *should* get:

| # | Sample `.msg` id (`design/demo-messages/`) | Action signal | Today | Expected |
|---|---|---|---|---|
| 1 | `PR - fix: Replace ACS SP connectivity … TCR.EquipmentCenter.Git 3094` | *(reviewer)* "**approved the changes**" | Other · Unknown | **Pull request · Approved** |
| 2 | `[Deployment cancelled] EQL Web + webjobs DEV … Release-2026.0.714.2 … 132` | body "Deployment … **cancelled**" / subject `[Deployment cancelled]` | Other · Unknown | **Release · Deployment cancelled** |

Locate each source e-mail by the identifier above — the PR number (`3094`) / release id (`132`,
release name `Release-2026.0.714.2`) plus its subject prefix; the author-name suffix in the real
filenames is omitted here for privacy. Both files are binary and untracked (`.gitignore`d).

Root causes, verified against the extracted body/subject text:

- **Case 1** — the PR gate `includesAny(text, 'pull request', …)` **does** open (the body contains
  "View pull request"), but the e-mail's action phrase is "*(reviewer)* **approved the changes**",
  which matches **none** of the PR sub-type branches (there is no `Approved` sub-type at all), so it
  falls past the gate to the Work-item block and then off the end → `Other · Unknown`.
- **Case 2** — there is no `Release · Deployment cancelled` rule or sub-type. The subject reads
  `[Deployment cancelled]` (contiguous) and the body reads "Deployment … cancelled" (the two words
  separated by the stage name); neither `deployment succeeded`/`deployment failed` nor the
  `build … cancelled` rule matches, so it falls through → `Other · Unknown`.

Intended outcome: both e-mails categorize correctly, **the existing corpus keeps passing**, and each
new behavior is pinned by a locally-generated fixture + unit test. The demo `.msg` files and the
derived fixture JSON both stay `.gitignore`d (they contain personal data) — per the story and
`.claude/rules/testing.md`.

## Keep it simple

- **No taxonomy redesign.** Two new leaf sub-types added to the existing union
  (`Pull request · Approved`, `Release · Deployment cancelled`) — not a restructuring of the model.
- **No new rule engine / config.** The fix is two additional ordered branches in the existing
  `classify()`, in the same includes/regex, top-down style already there (mirrors story 44).
- **No UI changes.** The list and sidebar render the type generically
  (`facetFilters.ts`: `` `${category} · ${subType}` ``), so a new sub-type flows through with zero
  component edits. This plan touches only the service, the model, the tests, and (local, uncommitted)
  fixtures.
- **No `.msg` parser committed to the app.** Fixtures are derived locally and stay `.gitignore`d, as
  the existing 18 are; the binary `.msg` files stay untracked and out of the suite (`testing.md`).
- **Non-goal — the deployment category placement.** A cancelled *deployment* is filed under the
  existing **`Release`** category (alongside `Deployment succeeded` / `Deployment failed`); this plan
  does **not** introduce a new top-level `Deployment` category. (Naming is an open question below.)

## AC coverage

| AC | Status | Where |
|---|---|---|
| Approved PR e-mails categorized under "Pull Request - Approved" | covered | Tasks 1–4; type `Pull request · Approved` |
| Cancelled deployment e-mails categorized under "Deployment - Cancelled" | covered | Tasks 1–4; type `Release · Deployment cancelled` |

Both ACs are fully covered — each e-mail categorizes to a dedicated new sub-type. The
naming/detection decisions (Q1–Q5) were **ratified by the reviewer** on PR #35 (all confirmed as the
recommended option — see *Assumptions & open questions*); no AC is narrowed.

## Implementation approach

All logic changes stay inside the pure categorization service and its model
(`.claude/rules/categorization-domain.md`: business logic is centralized here, deterministic/pure,
gated on folder membership and body signals only — never the sender). Both target e-mails resolve a
friendly project **name** (`TCR.EquipmentCenter`) from their ADO URL via the existing
`resolveOrgAndProject`, so `needsReview` is `false` for both and there is **no** GUID-mapping
interaction. Four edits:

1. **Extend the taxonomy** in `src/models/categorization.ts` — add `'Approved'` to the `Pull request`
   sub-type union and `'Deployment cancelled'` to the `Release` sub-type union.

2. **Add a PR-approved branch** inside the existing PR gate in `classify()`
   (`categorizationService.ts`, section 4). The gate already opens for this e-mail (body contains
   "pull request"). Add, among the PR sub-type branches (after the `Abandoned` branch, grouping the
   terminal states):

   ```ts
   if (includesAny(text, 'approved the changes', 'approved the pull request')) {
     return { category: 'Pull request', subType: 'Approved' };
   }
   ```

   The literal ADO wording in this e-mail is "approved the changes"; `approved the pull request` is
   included as a defensive variant. Keying on the full phrase (not a bare `approved`) avoids matching
   a reviewer merely *listed* as "Approved" in a `Completed`/other PR e-mail — and the earlier
   `Completed`/`Abandoned` branches already return first for those, so ordering also protects.

3. **Add a Release deployment-cancelled branch** in `classify()` (section 3, after `deployment
   failed`):

   ```ts
   if (/deployment\b[\s\S]{0,40}cancell?ed/.test(text)) {
     return { category: 'Release', subType: 'Deployment cancelled' };
   }
   ```

   This matches both the subject `[deployment cancelled]` (words contiguous) and the body's separated
   form "deployment to deploy eql web cancelled" (within the 40-char window); `cancell?ed` matches
   both US `canceled` and UK `cancelled`. The bounded window prevents a runaway match across
   unrelated text. Section 2 (Build) runs first, but this e-mail carries no `build … cancelled`
   phrase, so the Build·Cancelled rule does not shadow it. (Detection form → Q4.)

4. **Fixtures + tests** — add two anonymised JSON fixtures (generated locally, `.gitignore`d) and pin
   each with a unit test, then confirm the existing corpus stays green.

Both new branches return **before** the Work-item block and the end-of-function fall-through, so
neither e-mail lands on `Other · Unknown` any longer.

## Task breakdown

1. **Extend the type taxonomy.** In `src/models/categorization.ts`, add `'Approved'` to the
   `Pull request` sub-type union and `'Deployment cancelled'` to the `Release` sub-type union. Keep
   the doc comment's reference to the taxonomy accurate.
   *Rules: `.claude/rules/categorization-domain.md`, `.claude/rules/frontend-architecture.md`.*

2. **Update `classify()`** in `src/services/categorization/categorizationService.ts` per steps 2–3 of
   *Implementation approach* (PR `Approved` branch inside the PR gate; Release `Deployment cancelled`
   branch after `deployment failed`). Do not reorder the existing categories/branches. Update a doc
   comment only if it becomes stale.
   *Rules: `.claude/rules/categorization-domain.md` (pure/deterministic, ordered body-signal rules,
   sender never gates), `.claude/rules/frontend-architecture.md` (logic in the service).*

3. **Add two anonymised fixtures** under `src/services/categorization/__fixtures__/` (suggested names
   below), each reduced to the Graph `Message` fields the service consumes — `subject`,
   `body.contentType: "html"`, `body.content`, plus `sender`/`from` for realism — mirroring the
   existing fixtures' exact shape. Generate them **locally** from the two `.msg` files (e.g. with the
   same ad-hoc `.msg`→JSON converter used for the existing corpus — it is **not** part of the app or
   suite); the resulting JSON is **`.gitignore`d and does not ship in the PR**. **Anonymise**: replace
   every real personal display name / e-mail address (the PR reviewer in "approved the changes", the
   "Cancelled by …" name, and any recipient identity embedded in SafeLinks `data=` params) with the
   neutral placeholders already used (`Demo User`, `demo.user@example.com`, …). **Keep verbatim** the
   ADO signals the rules key on: the `dev.azure.com` / SafeLinks URLs carrying org + project, the
   action sentence, and the subject's type token. Suggested filenames:
   - `pr-approved-3094.json` (case 1)
   - `release-cancelled-eqlweb.json` (case 2)
   *Rules: `.claude/rules/testing.md` (fixture format, anonymisation, fixtures gitignored & locally
   regenerated — never committed).*

4. **Add unit tests** in `src/services/categorization/categorizationService.test.ts`. Add one case per
   new fixture asserting the full `(customer, project, type)` triple and `needsReview` (values in
   *Testing recommendations*). Prefer a small `it.each` table in the style of the existing
   `STORY44_CASES` block so the new rows read like the current ones. Run the full suite to confirm no
   regression. **These test-file edits and the source/model edits are git-tracked and ship in the PR;
   the fixtures do not** (they are regenerated locally).
   *Rules: `.claude/rules/testing.md` (categorization MUST be unit-tested, fixture-driven; test the
   pure service directly).*

## Assumptions & open questions

All five were opened as either/or threads on PR #35 and **resolved by the reviewer** — each confirmed
as the recommended option (A). Recorded here as settled decisions:

- **Q1 — RESOLVED (A): cancelled deployments file under the existing `Release` category** (no new
  top-level `Deployment` category), consistent with the sibling `Deployment succeeded` /
  `Deployment failed` outcomes.
- **Q2 — RESOLVED (A): the Release cancelled sub-type is named `Deployment cancelled`** (displays as
  `Release · Deployment cancelled`), mirroring the sibling names.
- **Q3 — RESOLVED (A): PR approval is a distinct new sub-type `Pull request · Approved`**, detected
  inside the existing PR gate via the action phrase `approved the changes` / `approved the pull
  request` (not a bare `approved`).
- **Q4 — RESOLVED (A): deployment-cancelled detection uses the bounded regex
  `/deployment\b[\s\S]{0,40}cancell?ed/`**, matching both the contiguous subject `[deployment
  cancelled]` and the body's separated "deployment … cancelled" phrasing.
- **Q5 — RESOLVED (A): the stored sub-type spelling is UK `Cancelled` (double-L)**, matching the AC
  and the existing `Build · Cancelled` value; the detection regex (`cancell?ed`) matches both
  spellings regardless.

## Considerations

- **Both e-mails resolve a friendly project name** (`TCR.EquipmentCenter`) from their ADO URL, so
  `needsReview` is `false` for both and there is no project-GUID-mapping interaction (unlike story 44
  case 4). The case-2 build **permalink** URLs use a `_permalink` path segment, which
  `resolveOrgAndProject` already skips (leading `_`); the `_release` URL supplies the org/project.
- **Regression surface is low.** No existing corpus e-mail carries "approved the changes"/"approved
  the pull request" as its action, nor a "deployment … cancelled" phrase, and both new branches
  return before the shared fall-throughs — so they cannot re-classify any existing message. The full
  suite run (Task 4) is the guardrail.
- **Fixtures are gitignored and regenerated locally** (per `testing.md`), so they are absent from the
  PR by design. Note the fixtures `README.md` and a comment in the test file describe the JSON as
  "committed" — that wording is stale versus the actual `.gitignore`; this plan does not change it
  (out of scope), but the coder should not be misled into `git add`-ing the fixtures.

## Testing recommendations

- **Whether to test:** yes — the project has an established unit-test practice (Vitest, the `test`
  skill) and `testing.md` mandates the categorization service be unit-tested with fixture-driven
  cases. Test the **pure service directly** (unit altitude); no component or E2E test is warranted
  (non-visual logic — `testing.md`'s browser-verification rule does not apply).
- **Altitude:** unit, against `categorizeEmail` with the locally-generated fixtures.
- **Must-cover (each with expected outcome):**
  - `pr-approved-3094` → `tcr-group` / `TCR.EquipmentCenter` / **Pull request · Approved**;
    `needsReview: false`.
  - `release-cancelled-eqlweb` → `tcr-group` / `TCR.EquipmentCenter` /
    **Release · Deployment cancelled**; `needsReview: false`.
  - Regression: the existing corpus + all other suites still pass (`npm run test`).
- **Live verification:** not needed (no running-app or visual acceptance).

## Definition of done

- [ ] `Pull request` sub-type union includes `'Approved'` and `Release` includes `'Deployment
      cancelled'` in `src/models/categorization.ts`; type-checks cleanly.
- [ ] Case 1 `pr-approved-3094` categorizes as `tcr-group` / `TCR.EquipmentCenter` /
      `Pull request · Approved`, `needsReview: false`.
- [ ] Case 2 `release-cancelled-eqlweb` categorizes as `tcr-group` / `TCR.EquipmentCenter` /
      `Release · Deployment cancelled`, `needsReview: false`.
- [ ] Two anonymised JSON fixtures generated locally under `__fixtures__/` (no real names/e-mails;
      ADO URL, action sentence, and subject type token kept verbatim) — and they remain `.gitignore`d
      (not added to the PR).
- [ ] Each new case is pinned by a unit test asserting the full triple + `needsReview`.
- [ ] The categorization service remains pure/deterministic (no I/O added); no existing category or
      branch reordered.
- [ ] The full Vitest suite passes, including the existing corpus (`npm run test`).
- [ ] All new/changed **git-tracked** files (model, service, test) are included in the change;
      `git status` shows nothing untracked that the change needs, except the intentionally-ignored
      fixtures (`testing.md` / story 43 lesson).
- [ ] ESLint clean and Prettier-formatted (`npm run lint`).

## Files/areas affected

- `src/models/categorization.ts` — two sub-type additions.
- `src/services/categorization/categorizationService.ts` — two new `classify()` branches.
- `src/services/categorization/categorizationService.test.ts` — two new cases.
- `src/services/categorization/__fixtures__/pr-approved-3094.json` — **new, local & gitignored** (not in PR).
- `src/services/categorization/__fixtures__/release-cancelled-eqlweb.json` — **new, local & gitignored** (not in PR).
