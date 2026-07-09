import { CounterBadge, ToggleButton, Text, makeStyles, tokens } from '@fluentui/react-components';
import type { FilterOption } from './facetFilters';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  groupHeading: {
    display: 'block',
    marginBlockEnd: tokens.spacingVerticalXXS,
  },
  option: {
    // Full-width rows with the label on the left and the counter pinned to the right.
    justifyContent: 'space-between',
  },
  optionLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
});

/** A labelled facet group (Projects / Types) rendered as a vertical stack of toggle buttons. */
interface FilterGroupProps {
  heading: string;
  options: FilterOption[];
  /** Whether an option's `value` is currently selected. */
  isSelected: (value: string) => boolean;
  /** Called with the clicked option's `value`. */
  onToggle: (value: string) => void;
  /** Accessible group label for the underlying option set. */
  ariaLabel: string;
}

function FilterGroup({ heading, options, isSelected, onToggle, ariaLabel }: FilterGroupProps) {
  const styles = useStyles();
  return (
    <div className={styles.group} role="group" aria-label={ariaLabel}>
      <Text as="h2" size={300} weight="semibold" className={styles.groupHeading}>
        {heading}
      </Text>
      {options.length === 0 ? (
        <Text size={200} className={styles.empty}>
          None
        </Text>
      ) : (
        options.map((option) => (
          <ToggleButton
            key={option.value}
            className={styles.option}
            appearance="subtle"
            checked={isSelected(option.value)}
            onClick={() => onToggle(option.value)}
          >
            <span className={styles.optionLabel}>
              {option.label}
              <CounterBadge
                count={option.count}
                appearance="filled"
                color="informative"
                size="small"
                showZero
              />
            </span>
          </ToggleButton>
        ))
      )}
    </div>
  );
}

export interface SidebarFiltersProps {
  /** Project facet options (already pre-filtered by org ∩ selected types). */
  projectOptions: FilterOption[];
  /** The selected project `value`, or `null` when none is selected (single-value facet). */
  selectedProject: string | null;
  /** Called with the clicked project option's `value`. */
  onSelectProject: (value: string) => void;
  /** Type facet options (already pre-filtered by org ∩ selected project). */
  typeOptions: FilterOption[];
  /** The set of selected type keys (multi-value facet). */
  selectedTypeKeys: ReadonlySet<string>;
  /** Called with the clicked type option's `value` (a `typeKey`). */
  onToggleType: (key: string) => void;
}

/**
 * Left-sidebar facet filters: a single-value **Projects** group and a multi-value **Types** group,
 * each option showing an item counter (`.claude/rules/frontend-architecture.md`). Controlled and
 * purely presentational — all option derivation and selection state live in `Organizer`/
 * `useOrganizer`; this component only renders the options it is handed and reports clicks upward.
 * `ToggleButton` (`aria-pressed`) gives the selection indication and makes click-to-deselect natural
 * for both facets.
 */
export function SidebarFilters({
  projectOptions,
  selectedProject,
  onSelectProject,
  typeOptions,
  selectedTypeKeys,
  onToggleType,
}: SidebarFiltersProps) {
  const styles = useStyles();

  return (
    <aside className={styles.root} aria-label="Filters">
      <FilterGroup
        heading="Projects"
        ariaLabel="Filter by project"
        options={projectOptions}
        isSelected={(value) => value === selectedProject}
        onToggle={onSelectProject}
      />
      <FilterGroup
        heading="Types"
        ariaLabel="Filter by type"
        options={typeOptions}
        isSelected={(value) => selectedTypeKeys.has(value)}
        onToggle={onToggleType}
      />
    </aside>
  );
}
