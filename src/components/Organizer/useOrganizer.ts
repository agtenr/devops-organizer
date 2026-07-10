import { useCallback, useMemo, useState } from 'react';
import type { CategorizedEmail } from '../../models/categorization';
import { useCategorizedMail } from '../../hooks/useCategorizedMail';
import { ALL_CUSTOMERS } from '../CustomerTabs/useCustomerTabs';
import {
  deriveProjectOptions,
  deriveTypeOptions,
  filterByProject,
  filterByTypes,
  type FilterOption,
} from '../SidebarFilters/facetFilters';

/**
 * Organizer container logic: consumes the shared categorized-mail hook and layers the three filters
 * on top — the organization tab (customer), the single-value project facet, and the multi-value
 * type facet — deriving the filtered set the view renders and the sidebar's facet options. The data
 * path itself lives in `useCategorizedMail` (`src/hooks/`), so only the selection concern is owned
 * here; the facet option/filtering logic is the pure helpers in `SidebarFilters/facetFilters`.
 *
 * Facet model (see `plans/39/plan.md`): each facet's options reflect the *other* active facet but
 * not itself, so selecting one narrows the other's options/counts while staying mutually consistent.
 */
export function useOrganizer() {
  const { status, error, folderName, categorized, resolveProjectGuid, deleteEmails } =
    useCategorizedMail();
  const [selectedCustomer, setSelectedCustomer] = useState<string>(ALL_CUSTOMERS);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedTypeKeys, setSelectedTypeKeys] = useState<ReadonlySet<string>>(new Set());

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
  };
}
