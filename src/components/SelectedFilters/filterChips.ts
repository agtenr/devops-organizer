import { typeLabelFromKey } from '../SidebarFilters/facetFilters';

/**
 * Pure, React-free derivation for the {@link SelectedFilters} overview (see
 * `.claude/rules/frontend-architecture.md` — a component's pure derivation helper lives in its own
 * colocated, non-`use*` file). Turns the `useOrganizer` selection state into the ordered list of
 * dismissible chips shown next to the search box. It never re-derives categorization tags — the
 * project string and type keys are consumed verbatim (`.claude/rules/categorization-domain.md`).
 */

/** The single project chip's stable key (only one project can be selected, so it is unique). */
const PROJECT_CHIP_KEY = 'project';

/** One dismissible filter chip: what to display, which facet it is, and the value to remove. */
export interface SelectedFilterChip {
  /** Stable React key AND the dismiss `value` carried by the Fluent `Tag` (unique per chip). */
  key: string;
  /** Which sidebar facet this chip represents (drives removal dispatch in `useOrganizer`). */
  facet: 'project' | 'type';
  /** The facet value to remove: the project string, or the `typeKey` for a type. */
  value: string;
  /** Display text, e.g. `Project: Alpha` or `Type: Build · Failed`. */
  label: string;
}

/**
 * Builds the ordered chip list from the active sidebar selection: the project chip (if any) **first**,
 * then one chip per selected type ordered **alphabetically (case-insensitive) by label** — the
 * "fixed entry first, then alphabetical" facet-ordering invariant
 * (`.claude/rules/frontend-architecture.md`). An empty selection yields `[]` (the component renders
 * nothing). Type labels are reconstructed from the key via {@link typeLabelFromKey}, so a type that
 * has been narrowed out of the current `typeOptions` still gets a correct label.
 */
export function buildSelectedFilters(
  selectedProject: string | null,
  selectedTypeKeys: ReadonlySet<string>,
): SelectedFilterChip[] {
  const projectChips: SelectedFilterChip[] =
    selectedProject === null
      ? []
      : [
          {
            key: PROJECT_CHIP_KEY,
            facet: 'project',
            value: selectedProject,
            label: `Project: ${selectedProject}`,
          },
        ];

  const typeChips = [...selectedTypeKeys]
    .map((key): SelectedFilterChip => ({
      key,
      facet: 'type',
      value: key,
      label: `Type: ${typeLabelFromKey(key)}`,
    }))
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }));

  return [...projectChips, ...typeChips];
}
