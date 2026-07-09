import { describe, expect, it } from 'vitest';
import {
  UNCATEGORIZED,
  UNKNOWN_TYPE,
  type CategorizedEmail,
  type MessageType,
} from '../../models/categorization';
import {
  deriveProjectOptions,
  deriveTypeOptions,
  filterByProject,
  filterByTypes,
  typeKey,
  typeLabel,
} from './facetFilters';

const BUILD_FAILED: MessageType = { category: 'Build', subType: 'Failed' };
const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };
const PR_CREATED: MessageType = { category: 'Pull request', subType: 'Created' };

function email(overrides: Partial<CategorizedEmail> = {}): CategorizedEmail {
  return {
    message: {},
    customer: 'c',
    project: 'p',
    type: UNKNOWN_TYPE,
    needsReview: false,
    ...overrides,
  };
}

describe('typeKey / typeLabel', () => {
  it('derives a stable key and a readable label from a MessageType', () => {
    expect(typeKey(BUILD_FAILED)).toBe('Build::Failed');
    expect(typeLabel(BUILD_FAILED)).toBe('Build · Failed');
  });
});

describe('deriveProjectOptions', () => {
  it('returns an empty list for an empty set (no phantom "All" row)', () => {
    expect(deriveProjectOptions([])).toEqual([]);
  });

  it('orders projects alphabetically (case-insensitive) with Uncategorized pinned last, with counts', () => {
    const emails = [
      email({ project: 'Contoso' }),
      email({ project: 'adatum' }),
      email({ project: 'Contoso' }),
      email({ project: UNCATEGORIZED }),
      email({ project: 'Zzz' }),
    ];

    // Uncategorized is pinned last even though 'Zzz' sorts after it alphabetically.
    expect(deriveProjectOptions(emails)).toEqual([
      { value: 'adatum', label: 'adatum', count: 1 },
      { value: 'Contoso', label: 'Contoso', count: 2 },
      { value: 'Zzz', label: 'Zzz', count: 1 },
      { value: UNCATEGORIZED, label: UNCATEGORIZED, count: 1 },
    ]);
  });
});

describe('deriveTypeOptions', () => {
  it('returns an empty list for an empty set', () => {
    expect(deriveTypeOptions([])).toEqual([]);
  });

  it('yields one option per distinct (category, subType) with counts, ordered by label', () => {
    const emails = [
      email({ type: WI_ASSIGNED }),
      email({ type: BUILD_FAILED }),
      email({ type: WI_ASSIGNED }),
      email({ type: PR_CREATED }),
    ];

    // Ordered by label: 'Build · …' < 'Pull request · …' < 'Work item · …'.
    expect(deriveTypeOptions(emails)).toEqual([
      { value: 'Build::Failed', label: 'Build · Failed', count: 1 },
      { value: 'Pull request::Created', label: 'Pull request · Created', count: 1 },
      { value: 'Work item::Assigned', label: 'Work item · Assigned', count: 2 },
    ]);
  });
});

describe('filterByProject', () => {
  const emails = [email({ project: 'Alpha' }), email({ project: 'Beta' })];

  it('is identity when no project is selected', () => {
    expect(filterByProject(emails, null)).toBe(emails);
  });

  it('keeps only e-mails matching the selected project', () => {
    expect(filterByProject(emails, 'Alpha')).toEqual([email({ project: 'Alpha' })]);
  });
});

describe('filterByTypes', () => {
  const emails = [email({ type: BUILD_FAILED }), email({ type: WI_ASSIGNED })];

  it('is identity when the selection is empty', () => {
    expect(filterByTypes(emails, new Set())).toBe(emails);
  });

  it('keeps only e-mails whose type key is selected', () => {
    expect(filterByTypes(emails, new Set([typeKey(BUILD_FAILED)]))).toEqual([
      email({ type: BUILD_FAILED }),
    ]);
  });
});
