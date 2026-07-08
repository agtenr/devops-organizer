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

## How categorization works
- Tagging is **rule-based**, deriving the triple from the email's **subject, sender, and
  body** (and any ADO notification metadata present).
- All of this logic is **centralized in a single service** — the one place business logic
  lives. Components and hooks consume the tagged results; they never re-derive tags.

## Invariants every feature must respect
- **Every email gets all three tags.** When a signal is missing, assign an explicit
  **"uncategorized"/fallback** value — never crash and never silently drop the email.
- The categorization service is **pure** (deterministic, no I/O) so it is trivially
  unit-testable.
- Filtering happens **in memory** over the already-tagged set — no re-fetch, no backend.

## Where this shows up in the code
- TODO (undecided): the concrete service location and the concrete rule set. Both are
  driven by the **sample emails provided during implementation**, using unit tests to
  lock each rule in. See `testing.md`.
