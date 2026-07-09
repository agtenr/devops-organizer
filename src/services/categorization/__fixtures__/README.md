# Categorization test fixtures

These JSON files are **derived from the real demo corpus** — the 14 Outlook `.msg` files under
`/design/demo-messages/` (one per row of story 37 §7's reference-examples table). Each fixture is the
message reduced to the Graph `Message` fields the categorization service consumes (`subject`,
`body.contentType`, `body.content`) plus `sender`/`from` for realism (the service ignores them).

**Personal data is scrubbed** — real personal e-mail addresses and display names are replaced with
neutral placeholders (`demo.user@example.com`, `Demo User`, …). The **categorization signals are
kept verbatim**: the Azure DevOps URLs (SafeLinks-wrapped, carrying org/project/GUID) and the action
sentences. Regenerate with the one-time converter if the corpus changes (the converter is not part of
the app or its test suite).

Tests read these committed JSON files, never the binary `.msg` files (which are not git-tracked), so
the suite is hermetic and deterministic.

## Note on project GUIDs vs. the §7 reference table

Story §7's reference table lists friendly project **names** for every row, but Azure DevOps
work-item and release notifications only carry the project **GUID** in their URLs — the friendly
name is genuinely absent from those e-mails. Per the domain rules (a name is used directly; a GUID is
shown when no name is present; names are never inferred/translated) and the merged plan's "no
GUID → name translation" non-goal, the engine outputs the **GUID** for those messages. So `customer`
and `type` match the reference table for all 14, while `project` matches for the 8 messages whose URL
exposes the name (Build/PR) and is the GUID for the 6 that don't (work item + release). The expected
values asserted in the tests reflect what is actually derivable from each e-mail.
