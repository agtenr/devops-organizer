import { Tag, TagGroup, makeStyles, tokens } from '@fluentui/react-components';
import type { SelectedFilterChip } from './filterChips';

const useStyles = makeStyles({
  // Chips wrap onto a second line rather than overflowing the toolbar when many filters are active.
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
});

export interface SelectedFiltersProps {
  /** The active filter chips to display (already ordered/derived by `buildSelectedFilters`). */
  filters: SelectedFilterChip[];
  /** Called with the chip whose dismiss (X) was clicked, so the owner can clear that one filter. */
  onRemove: (chip: SelectedFilterChip) => void;
}

/**
 * The overview of active sidebar filters, rendered next to the subject search box: one dismissible
 * Fluent v9 `Tag` per selected Project/Type facet (`.claude/rules/frontend-architecture.md` — prefer
 * the first-class `TagGroup`/`Tag` over a hand-rolled chip). Purely presentational: it renders the
 * chips it is handed and reports a dismiss upward; all selection state and the removal dispatch live
 * in `useOrganizer`. Renders nothing when no filter is selected, so the toolbar is unchanged.
 *
 * A dismissible `Tag`'s root **is** the dismiss button (its accessible name is the chip label), so
 * `onDismiss` fires with the tag's `value` (the chip `key`); we map that back to the chip.
 */
export function SelectedFilters({ filters, onRemove }: SelectedFiltersProps) {
  const styles = useStyles();

  if (filters.length === 0) {
    return null;
  }

  return (
    <TagGroup
      className={styles.root}
      aria-label="Active filters"
      onDismiss={(_event, { value }) => {
        const chip = filters.find((filter) => filter.key === value);
        if (chip) {
          onRemove(chip);
        }
      }}
    >
      {filters.map((chip) => (
        <Tag key={chip.key} value={chip.key} dismissible>
          {chip.label}
        </Tag>
      ))}
    </TagGroup>
  );
}
