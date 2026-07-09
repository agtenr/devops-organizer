import {
  CounterBadge,
  Tab,
  TabList,
  makeStyles,
  tokens,
  type SelectTabData,
  type SelectTabEvent,
} from '@fluentui/react-components';
import type { CategorizedEmail } from '../../models/categorization';
import { useCustomerTabs } from './useCustomerTabs';

const useStyles = makeStyles({
  root: {
    paddingBlock: tokens.spacingVerticalS,
    paddingInline: tokens.spacingHorizontalL,
    borderBottom: `${tokens.strokeWidthThin} solid ${tokens.colorNeutralStroke2}`,
  },
  tabLabel: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
});

export interface CustomerTabsProps {
  /** The full (unfiltered) categorized set — the tab list and counters derive from this. */
  emails: CategorizedEmail[];
  /** The currently selected tab value (the `ALL_CUSTOMERS` sentinel or a `customer` string). */
  selectedCustomer: string;
  /** Called with the selected tab's `value` when the user picks a different tab. */
  onSelect: (value: string) => void;
}

/**
 * Customer (= ADO organization) tab strip. A controlled, presentational component: it renders one
 * tab per organization (plus "All", plus an "Uncategorized" fallback when present) with an item
 * counter, and reports selection changes upward. All derivation lives in `useCustomerTabs`; this
 * component never re-derives tags (see `.claude/rules/frontend-architecture.md`).
 */
export function CustomerTabs({ emails, selectedCustomer, onSelect }: CustomerTabsProps) {
  const styles = useStyles();
  const tabs = useCustomerTabs(emails);

  const handleTabSelect = (_event: SelectTabEvent, data: SelectTabData) => {
    onSelect(data.value as string);
  };

  return (
    <TabList
      className={styles.root}
      selectedValue={selectedCustomer}
      onTabSelect={handleTabSelect}
      aria-label="Organizations"
    >
      {tabs.map((tab) => (
        <Tab key={tab.value} value={tab.value}>
          <span className={styles.tabLabel}>
            {tab.label}
            <CounterBadge
              count={tab.count}
              appearance="filled"
              color="informative"
              size="small"
              showZero
            />
          </span>
        </Tab>
      ))}
    </TabList>
  );
}
