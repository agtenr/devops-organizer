<!-- AIND KICKSTART DRAFT — intended design captured in conversation, NOT yet validated against
     code. Review and correct before relying on it; re-run /aind:onboard once code exists to
     reconcile. Suggestions, not ground truth. -->

# Categorization & domain rules

## The core concept
The app exists to make a daily flood of **Azure DevOps notification emails** triageable.
Every email is **tagged** with three attributes; once tagged, filtering the in-memory list
by tab (customer) and sidebar (project / type) is trivial.

## Key entities and relationships
- **Email** — one Outlook message from the `DevOps` folder.
- **Customer** = the **ADO organization** the notification came from.
- **Project** = the **ADO project** within that organization.
- **Type** = the **ADO message type** (e.g. "Comment mentioned", "Build failed", "PR
  review requested", …).

Each Email maps to exactly one `(Customer, Project, Type)` triple.

- **The demo corpus is the authoritative source of the message-type taxonomy.** The
  **`design/demo-messages/`** corpus — not story 37 §3's reference table — is the ground truth for
  which message types exist. The reference table is a **starting point** and is **not exhaustive**:
  real types present in the corpus can be absent from it (e.g. **"Pull request published"** and
  **"Build cancelled"**, surfaced in story 44). The Build/PR sub-type unions (and any type
  enumeration) must cover **every** message type actually present in the corpus — reconcile against
  the corpus, not the table.

## How categorization works
- Categorization **gates on folder membership only** — every message in the `DevOps` folder is
  treated as an ADO notification. **Sender is never a gate**, because of the delivery topology
  below: the sender is frequently *not* `azuredevops@microsoft.com`, so gating on sender identity
  is actively wrong.
- Tagging is **rule-based**, deriving the triple **purely from body signals** — the **ADO URL**
  (organization / project) plus the **action sentence** (message type) — and any ADO notification
  metadata present in the body. Subject may corroborate, but the sender is not a signal.
- All of this logic is **centralized in a single service** — the one place business logic
  lives. Components and hooks consume the tagged results; they never re-derive tags.

### Delivery topology (why sender is unreliable)
- The app runs **locally against a DEMO mailbox**; the production mailbox cannot be connected
  locally for security reasons. The demo mailbox is populated by an **automatic copy** of the
  e-mails from the production mailbox, so the copied messages frequently arrive with a **sender
  that is not** `azuredevops@microsoft.com`. Folder membership is the only reliable gate.
  (Source: PR#13 reviewer decision.)

## Invariants every feature must respect
- **Every email gets all three tags.** When a signal is missing, assign an explicit
  **"uncategorized"/fallback** value — never crash and never silently drop the email.
- **Untranslatable project GUID → emit the GUID *and* flag `needsReview`.** Real ADO work-item
  and release notifications carry only the **project GUID** in their URLs (confirmed: 6 of the 14
  sample messages), and a front-end-only app has **no GUID→name lookup source**. When a project
  resolves only to a GUID, emit the project **as the GUID** and set **`needsReview = true`** —
  do **not** invent a friendly project name. This keeps such rows visibly flagged (visibility over
  silent acceptance) so a future GUID→name mapping feature can address them; it is the concrete
  form of the "explicit fallback, never silently drop" invariant above. (Source: PR#14 human
  tiebreak.)
- The categorization service is **pure** (deterministic, no I/O) so it is trivially
  unit-testable.
- Filtering happens **in memory** over the already-tagged set — no re-fetch, no backend.

## Where this shows up in the code
- TODO (undecided): the concrete service location and the concrete rule set. Both are
  driven by the **sample email corpus** (`design/demo-messages/`), using unit tests to
  lock each rule in. See `testing.md` for the canonical corpus location, fixture format,
  and anonymisation convention.
