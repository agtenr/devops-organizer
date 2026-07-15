import {
  Accordion,
  AccordionHeader,
  AccordionItem,
  AccordionPanel,
  CounterBadge,
  ToggleButton,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { FilterOption } from './facetFilters';

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalL,
    borderRight: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  // The stack of option rows inside a collapsible section's panel.
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  option: {
    // Full-width row: value ellipsizes on the left, counter pinned right; never wraps to a 2nd line.
    width: '100%',
    justifyContent: 'space-between',
  },
  optionValue: {
    flexGrow: 1,
    minWidth: 0,
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    // 12px so filter values read as distinct from the larger (14px) semibold group titles (story 46).
    fontSize: tokens.fontSizeBase200,
  },
  optionCount: {
    flexShrink: 0,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
  },
});

/**
 * A labelled facet group (Projects / Types) rendered as a collapsible accordion section: its title
 * lives in an `AccordionHeader` (chevron to the left) and its options — a vertical stack of toggle
 * buttons — in the `AccordionPanel`, which Fluent unmounts when the section is collapsed (story 57).
 */
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
    <AccordionItem value={heading}>
      <AccordionHeader>{heading}</AccordionHeader>
      <AccordionPanel>
        <div className={styles.options} role="group" aria-label={ariaLabel}>
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
                <span className={styles.optionValue}>{option.label}</span>
                <CounterBadge
                  className={styles.optionCount}
                  count={option.count}
                  appearance="filled"
                  color="informative"
                  size="small"
                  showZero
                />
              </ToggleButton>
            ))
          )}
        </div>
      </AccordionPanel>
    </AccordionItem>
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
 * each option showing an item counter (`.claude/rules/frontend-architecture.md`). Each group is a
 * **collapsible** section (Fluent `Accordion`): a chevron sits to the left of the title, both are
 * expanded by default, and clicking a header collapses that section — hiding its options — with the
 * two sections toggling independently (story 57). Controlled and purely presentational — all option
 * derivation and selection state live in `Organizer`/`useOrganizer`; this component only renders the
 * options it is handed and reports clicks upward. The `Accordion` is **uncontrolled** (it owns its
 * own open/closed state via `defaultOpenItems`), so there is no collapse state to manage here — it
 * resets to expanded on reload (no persistence). `ToggleButton` (`aria-pressed`) gives the selection
 * indication and makes click-to-deselect natural for both facets.
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
      <Accordion multiple collapsible defaultOpenItems={['Projects', 'Types']}>
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
      </Accordion>
    </aside>
  );
}
