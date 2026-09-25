import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CategorizedEmail } from '../../models/categorization';
import type { SavedView } from '../../models/savedViews';
import { useCategorizedMail } from '../../hooks/useCategorizedMail';
import { useSavedViews, type SavedViewFilters } from '../../hooks/useSavedViews';
import { ALL_CUSTOMERS } from '../CustomerTabs/useCustomerTabs';
import {
  deriveProjectOptions,
  deriveTypeOptions,
  filterByProject,
  filterByTypes,
  type FilterOption,
} from '../SidebarFilters/facetFilters';
import { buildSelectedFilters, type SelectedFilterChip } from '../SelectedFilters/filterChips';

/**
 * Organizer container logic: consumes the shared categorized-mail hook and layers the three filters
 * on top — the organization tab (customer), the single-value project facet, and the multi-value
 * type facet, plus the subject-search query — deriving the filtered set the view renders and the
 * sidebar's facet options. The data path itself lives in `useCategorizedMail` (`src/hooks/`), so only
 * the selection concern is owned here; the facet option/filtering logic is the pure helpers in
 * `SidebarFilters/facetFilters`.
 *
 * `useOrganizer` is the single owner of the **whole filter combination** (story 126): the search
 * query, previously colocated in `useEmailList`, was hoisted up here so a saved view can capture and
 * reapply the tab + facets + search text together (`.claude/rules/frontend-architecture.md` — a
 * cross-cutting concern has one owner). Saved-view persistence itself lives in `useSavedViews`
 * (`src/hooks/`); this hook only wires the current selection to it and applies a chosen view back.
 *
 * Facet model (see `plans/39/plan.md`): each facet's options reflect the *other* active facet but
 * not itself, so selecting one narrows the other's options/counts while staying mutually consistent.
 */
/**
 * The full data/selection shape the Organizer consumes. Derived from the hook so the type stays in
 * lock-step with it; used to type the `useData` injection seam on `Organizer` (test/e2e harness).
 */
export type OrganizerData = ReturnType<typeof useOrganizer>;

export function useOrganizer() {
  const { status, error, folderName, categorized, resolveProjectGuid, deleteEmails } =
    useCategorizedMail();
  const {
    savedViews,
    loaded: savedViewsLoaded,
    saveView,
    renameView,
    deleteView,
    setDefaultView,
  } = useSavedViews();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(ALL_CUSTOMERS);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTypeKeys, setSelectedTypeKeys] = useState<ReadonlySet<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  // Organization tab is the top-level filter; switching it clears both facet selections (AC).
  const selectCustomer = useCallback(
    (value: string) => {
      if (value === selectedCustomer) {
        return;
      }
      setSelectedCustomer(value);
      setSelectedProject(null);
      setSelectedTypeKeys(new Set());
    },
    [selectedCustomer],
  );

  // Single-value: clicking the selected project deselects it; clicking another replaces it.
  const onSelectProject = useCallback((value: string) => {
    setSelectedProject((current) => (current === value ? null : value));
  }, []);

  // Multi-value: toggle the key in/out of the set.
  const onToggleType = useCallback((key: string) => {
    setSelectedTypeKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  // Base set for the sidebar and the view: the categorized set narrowed to the selected org.
  const orgBase = useMemo<CategorizedEmail[]>(
    () =>
      selectedCustomer === ALL_CUSTOMERS
        ? categorized
        : categorized.filter((email) => email.customer === selectedCustomer),
    [categorized, selectedCustomer],
  );

  // Project options reflect org ∩ selected types; type options reflect org ∩ selected project.
  const projectOptions = useMemo<FilterOption[]>(
    () => deriveProjectOptions(filterByTypes(orgBase, selectedTypeKeys)),
    [orgBase, selectedTypeKeys],
  );
  const typeOptions = useMemo<FilterOption[]>(
    () => deriveTypeOptions(filterByProject(orgBase, selectedProject)),
    [orgBase, selectedProject],
  );

  // The displayed set: organization ∩ project ∩ types.
  const filtered = useMemo<CategorizedEmail[]>(
    () => filterByTypes(filterByProject(orgBase, selectedProject), selectedTypeKeys),
    [orgBase, selectedProject, selectedTypeKeys],
  );

  // The active sidebar selection as dismissible chips for the SelectedFilters overview (derived
  // during render — no setState-in-effect). The org tab is intentionally not chipped (OQ1, story 58).
  const selectedFilters = useMemo<SelectedFilterChip[]>(
    () => buildSelectedFilters(selectedProject, selectedTypeKeys),
    [selectedProject, selectedTypeKeys],
  );

  // Remove a single active filter from its chip's X: clear the project, or toggle that type off.
  const removeFilter = useCallback(
    (chip: SelectedFilterChip) => {
      if (chip.facet === 'project') {
        setSelectedProject(null);
      } else {
        onToggleType(chip.value);
      }
    },
    [onToggleType],
  );

  // Sets the whole filter combination straight from a saved view — bypassing `selectCustomer`'s
  // side effect of clearing the facets on a tab change, since a saved view sets a tab *and* facets
  // together (story 126). A saved `project`/`typeKeys` value that no longer matches any current row
  // just narrows `filtered` to empty — `filterByProject`/`filterByTypes` are plain equality filters,
  // so this can never throw (AC 5).
  const applyFilters = useCallback((view: SavedView) => {
    setSelectedCustomer(view.customer);
    setSelectedProject(view.project);
    setSelectedTypeKeys(new Set(view.typeKeys));
    setSearchQuery(view.searchQuery);
  }, []);

  const applyView = useCallback(
    (id: string) => {
      const view = savedViews.find((candidate) => candidate.id === id);
      if (view) {
        applyFilters(view);
      }
    },
    [savedViews, applyFilters],
  );

  const saveCurrentView = useCallback(
    (name: string) => {
      const filters: SavedViewFilters = {
        customer: selectedCustomer,
        project: selectedProject,
        typeKeys: [...selectedTypeKeys],
        searchQuery,
      };
      return saveView(name, filters);
    },
    [saveView, selectedCustomer, selectedProject, selectedTypeKeys, searchQuery],
  );

  // One-time default-view apply: fires once mail has loaded *and* the saved views have finished
  // their own (independent) load, guarded by a ref so it only ever runs once per app session — a
  // one-off reaction to async data becoming ready, not a per-render state sync (AC 6). The actual
  // apply is deferred to a microtask callback, mirroring how `useCategorizedMail`'s own load effect
  // sets state from a `.then()` callback rather than synchronously in the effect body — the pattern
  // `react-hooks/set-state-in-effect` expects (`.claude/rules/frontend-architecture.md`).
  const hasAppliedDefaultRef = useRef(false);
  useEffect(() => {
    if (hasAppliedDefaultRef.current || status !== 'success' || !savedViewsLoaded) {
      return;
    }
    hasAppliedDefaultRef.current = true;
    const defaultView = savedViews.find((view) => view.isDefault);
    if (!defaultView) {
      return;
    }
    // Guard against the deferred apply landing after this hook's owner has unmounted (review finding).
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        applyFilters(defaultView);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [status, savedViewsLoaded, savedViews, applyFilters]);

  return {
    status,
    error,
    folderName,
    categorized,
    filtered,
    resolveProjectGuid,
    deleteEmails,
    selectedCustomer,
    selectCustomer,
    projectOptions,
    selectedProject,
    onSelectProject,
    typeOptions,
    selectedTypeKeys,
    onToggleType,
    selectedFilters,
    removeFilter,
    searchQuery,
    setSearchQuery,
    savedViews,
    applyView,
    saveCurrentView,
    renameView,
    deleteView,
    setDefaultView,
  };
}
