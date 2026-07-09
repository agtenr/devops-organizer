import { UNCATEGORIZED, type CategorizedEmail } from '../../models/categorization';

/**
 * Pure, React-free helper for the Resolve Project GUID dialog (see `.claude/rules/frontend-architecture.md`
 * — pure derivation lives in its own colocated file, not the hook). It reads the tags the engine
 * assigned verbatim; nothing is re-categorized (`.claude/rules/categorization-domain.md`).
 */

/**
 * The distinct **friendly** project names already discovered for one organization — the picker
 * suggestions in the dialog. Excludes the {@link UNCATEGORIZED} fallback and any project that is still
 * an unresolved GUID (those are not names to suggest). Sorted alphabetically (case-insensitive).
 */
export function deriveKnownProjectNames(emails: CategorizedEmail[], customer: string): string[] {
  const names = new Set<string>();
  for (const email of emails) {
    if (email.customer !== customer) {
      continue;
    }
    if (email.project === UNCATEGORIZED || email.projectIsUnresolvedGuid) {
      continue;
    }
    names.add(email.project);
  }
  return [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}
