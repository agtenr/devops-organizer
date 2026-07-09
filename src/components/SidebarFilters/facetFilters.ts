import {
  UNCATEGORIZED,
  type CategorizedEmail,
  type MessageType,
} from '../../models/categorization';

/**
 * Sidebar facet-filter logic (see the "Left sidebar filters by project and/or type; each entry
 * shows an item counter" invariant in `.claude/rules/frontend-architecture.md`, and the facet model
 * in `plans/39/plan.md`).
 *
 * All derivation/filtering here is **pure and React-free** so it is unit-testable without mounting a
 * component. Options are derived purely from the already-categorized set — the tags the engine
 * assigned are consumed verbatim, never re-derived (`.claude/rules/categorization-domain.md`).
 */

/**
 * Stable string identity for a {@link MessageType}. The multi-select type facet stores its selection
 * as a `Set` of these keys, so it needs a value-based key (an object can't be a `Set` member nor
 * compared by reference). Every producer/consumer of a selected type routes through this one helper.
 */
export function typeKey(type: MessageType): string {
  return `${type.category}::${type.subType}`;
}

/** Human-readable label for a {@link MessageType} — matches the badge format used in `MailDebug`. */
export function typeLabel(type: MessageType): string {
  return `${type.category} · ${type.subType}`;
}

/** A single selectable facet row: the value to toggle on, its display label, and its e-mail count. */
export interface FilterOption {
  /** A `project` string (verbatim) for the project facet, or a {@link typeKey} for the type facet. */
  value: string;
  /** The `project` string, or {@link typeLabel} for the type facet. */
  label: string;
  /** Number of e-mails in the (already cross-faceted) input set matching this option. */
  count: number;
}

/**
 * Derives the project facet options from an already-faceted set (org ∩ selected types). One option
 * per distinct `project`, ordered alphabetically (case-insensitive) with the {@link UNCATEGORIZED}
 * fallback pinned **last** regardless of letter. No "All" row — an empty selection means no filter.
 */
export function deriveProjectOptions(emails: CategorizedEmail[]): FilterOption[] {
  const counts = new Map<string, number>();
  for (const email of emails) {
    counts.set(email.project, (counts.get(email.project) ?? 0) + 1);
  }

  const named = [...counts.keys()]
    .filter((project) => project !== UNCATEGORIZED)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map((project): FilterOption => ({
      value: project,
      label: project,
      count: counts.get(project)!,
    }));

  // Pin the fallback bucket last, after every named project regardless of letter.
  const uncategorizedCount = counts.get(UNCATEGORIZED);
  if (uncategorizedCount !== undefined) {
    named.push({ value: UNCATEGORIZED, label: UNCATEGORIZED, count: uncategorizedCount });
  }

  return named;
}

/**
 * Derives the type facet options from an already-faceted set (org ∩ selected project). One option
 * per distinct `(category, subType)`, keyed by {@link typeKey}, ordered alphabetically by
 * {@link typeLabel} (`localeCompare`). No "All" row — an empty selection means no filter.
 */
export function deriveTypeOptions(emails: CategorizedEmail[]): FilterOption[] {
  const options = new Map<string, FilterOption>();
  for (const email of emails) {
    const value = typeKey(email.type);
    const existing = options.get(value);
    if (existing) {
      existing.count += 1;
    } else {
      options.set(value, { value, label: typeLabel(email.type), count: 1 });
    }
  }

  return [...options.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
}

/** Keeps only e-mails matching `project`; a `null` selection is identity (no filter). */
export function filterByProject(
  emails: CategorizedEmail[],
  project: string | null,
): CategorizedEmail[] {
  return project === null ? emails : emails.filter((email) => email.project === project);
}

/** Keeps only e-mails whose type is in `selectedTypeKeys`; an empty set is identity (no filter). */
export function filterByTypes(
  emails: CategorizedEmail[],
  selectedTypeKeys: ReadonlySet<string>,
): CategorizedEmail[] {
  return selectedTypeKeys.size === 0
    ? emails
    : emails.filter((email) => selectedTypeKeys.has(typeKey(email.type)));
}
