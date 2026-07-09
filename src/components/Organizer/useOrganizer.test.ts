import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategorizedEmail, MessageType } from '../../models/categorization';
import { typeKey } from '../SidebarFilters/useSidebarFilters';
import { useOrganizer } from './useOrganizer';

const BUILD_FAILED: MessageType = { category: 'Build', subType: 'Failed' };
const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };
const PR_CREATED: MessageType = { category: 'Pull request', subType: 'Created' };

function email(customer: string, project: string, type: MessageType): CategorizedEmail {
  return { message: {}, customer, project, type, needsReview: false };
}

// Within Contoso: Alpha has {Build·Failed, WI·Assigned}; Beta has {Build·Failed}. Adatum is separate.
const CATEGORIZED = [
  email('Contoso', 'Alpha', BUILD_FAILED),
  email('Contoso', 'Alpha', WI_ASSIGNED),
  email('Contoso', 'Beta', BUILD_FAILED),
  email('Adatum', 'Gamma', PR_CREATED),
];

// useOrganizer's data path is mocked so the test drives only the selection/facet logic it owns.
const useCategorizedMail = vi.fn();
vi.mock('../../hooks/useCategorizedMail', () => ({
  useCategorizedMail: () => useCategorizedMail(),
}));

beforeEach(() => {
  useCategorizedMail.mockReturnValue({
    status: 'success',
    error: '',
    folderName: 'DevOps',
    categorized: CATEGORIZED,
  });
});

const KEY_BUILD = typeKey(BUILD_FAILED);
const KEY_WI = typeKey(WI_ASSIGNED);

describe('useOrganizer — project facet (single-value)', () => {
  it('selects, replaces, and deselects on re-click', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));

    act(() => result.current.onSelectProject('Alpha'));
    expect(result.current.selectedProject).toBe('Alpha');
    expect(result.current.filtered).toHaveLength(2);

    // Selecting a different project replaces the selection (single value).
    act(() => result.current.onSelectProject('Beta'));
    expect(result.current.selectedProject).toBe('Beta');
    expect(result.current.filtered).toHaveLength(1);

    // Clicking the selected project deselects it.
    act(() => result.current.onSelectProject('Beta'));
    expect(result.current.selectedProject).toBeNull();
    expect(result.current.filtered).toHaveLength(3);
  });
});

describe('useOrganizer — type facet (multi-value)', () => {
  it('adds and removes types independently', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));

    act(() => result.current.onToggleType(KEY_BUILD));
    expect([...result.current.selectedTypeKeys]).toEqual([KEY_BUILD]);
    expect(result.current.filtered).toHaveLength(2); // both Build·Failed e-mails in Contoso

    act(() => result.current.onToggleType(KEY_WI));
    expect(result.current.selectedTypeKeys.size).toBe(2);
    expect(result.current.filtered).toHaveLength(3);

    // Toggling an already-selected type removes just it.
    act(() => result.current.onToggleType(KEY_BUILD));
    expect([...result.current.selectedTypeKeys]).toEqual([KEY_WI]);
    expect(result.current.filtered).toHaveLength(1);
  });
});

describe('useOrganizer — facet interdependence', () => {
  it('narrows type options/counts when a project is selected', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));

    // No project: both types available, Build·Failed twice.
    expect(result.current.typeOptions).toEqual([
      { value: KEY_BUILD, label: 'Build · Failed', count: 2 },
      { value: KEY_WI, label: 'Work item · Assigned', count: 1 },
    ]);

    act(() => result.current.onSelectProject('Alpha'));
    // Alpha has one of each type.
    expect(result.current.typeOptions).toEqual([
      { value: KEY_BUILD, label: 'Build · Failed', count: 1 },
      { value: KEY_WI, label: 'Work item · Assigned', count: 1 },
    ]);
  });

  it('narrows project options/counts when a type is selected', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));

    // No type: Alpha(2), Beta(1).
    expect(result.current.projectOptions).toEqual([
      { value: 'Alpha', label: 'Alpha', count: 2 },
      { value: 'Beta', label: 'Beta', count: 1 },
    ]);

    act(() => result.current.onToggleType(KEY_WI));
    // Only Alpha has a Work item·Assigned e-mail.
    expect(result.current.projectOptions).toEqual([{ value: 'Alpha', label: 'Alpha', count: 1 }]);
  });
});

describe('useOrganizer — clear on tab switch', () => {
  it('clears both facet selections when the organization changes', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));
    act(() => result.current.onSelectProject('Alpha'));
    act(() => result.current.onToggleType(KEY_BUILD));

    act(() => result.current.selectCustomer('Adatum'));

    expect(result.current.selectedProject).toBeNull();
    expect(result.current.selectedTypeKeys.size).toBe(0);
    expect(result.current.selectedCustomer).toBe('Adatum');
  });

  it('keeps facet selections when the same organization is re-selected', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));
    act(() => result.current.onSelectProject('Alpha'));

    act(() => result.current.selectCustomer('Contoso'));
    expect(result.current.selectedProject).toBe('Alpha');
  });
});
