import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CategorizedEmail, MessageType } from '../../models/categorization';
import { typeKey } from '../SidebarFilters/facetFilters';
import { useOrganizer } from './useOrganizer';

const BUILD_FAILED: MessageType = { category: 'Build', subType: 'Failed' };
const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };
const PR_CREATED: MessageType = { category: 'Pull request', subType: 'Created' };

function email(customer: string, project: string, type: MessageType): CategorizedEmail {
  return {
    message: {},
    customer,
    project,
    type,
    needsReview: false,
    projectIsUnresolvedGuid: false,
  };
}

// Within Contoso: Alpha has {Build·Failed, WI·Assigned}; Beta has {Build·Failed}. Adatum is separate.
const CATEGORIZED = [
  email('Contoso', 'Alpha', BUILD_FAILED),
  email('Contoso', 'Alpha', WI_ASSIGNED),
  email('Contoso', 'Beta', BUILD_FAILED),
  email('Adatum', 'Gamma', PR_CREATED),
];

// useOrganizer's data paths are mocked so the test drives only the selection/facet logic it owns.
const useCategorizedMail = vi.fn();
vi.mock('../../hooks/useCategorizedMail', () => ({
  useCategorizedMail: () => useCategorizedMail(),
}));

const useSavedViews = vi.fn();
vi.mock('../../hooks/useSavedViews', () => ({
  useSavedViews: () => useSavedViews(),
}));

beforeEach(() => {
  useCategorizedMail.mockReturnValue({
    status: 'success',
    error: '',
    folderName: 'DevOps',
    categorized: CATEGORIZED,
  });
  useSavedViews.mockReturnValue({
    savedViews: [],
    loaded: true,
    saveView: vi.fn(() => Promise.resolve()),
    renameView: vi.fn(() => Promise.resolve()),
    deleteView: vi.fn(() => Promise.resolve()),
    setDefaultView: vi.fn(() => Promise.resolve()),
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

describe('useOrganizer — selectedFilters / removeFilter', () => {
  it('derives a project-first, type-sorted chip list from the active selection', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));

    expect(result.current.selectedFilters).toEqual([]);

    act(() => result.current.onSelectProject('Alpha'));
    act(() => result.current.onToggleType(KEY_WI));
    act(() => result.current.onToggleType(KEY_BUILD));

    expect(result.current.selectedFilters.map((chip) => chip.label)).toEqual([
      'Project: Alpha',
      'Type: Build · Failed',
      'Type: Work item · Assigned',
    ]);
  });

  it('removeFilter on the project chip clears the project selection', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));
    act(() => result.current.onSelectProject('Alpha'));

    const projectChip = result.current.selectedFilters.find((chip) => chip.facet === 'project')!;
    act(() => result.current.removeFilter(projectChip));

    expect(result.current.selectedProject).toBeNull();
  });

  it('removeFilter on a type chip removes just that type and keeps the others', () => {
    const { result } = renderHook(() => useOrganizer());
    act(() => result.current.selectCustomer('Contoso'));
    act(() => result.current.onToggleType(KEY_BUILD));
    act(() => result.current.onToggleType(KEY_WI));

    const buildChip = result.current.selectedFilters.find((chip) => chip.value === KEY_BUILD)!;
    act(() => result.current.removeFilter(buildChip));

    expect([...result.current.selectedTypeKeys]).toEqual([KEY_WI]);
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

describe('useOrganizer — search query', () => {
  it('owns the search query so it starts empty and is settable', () => {
    const { result } = renderHook(() => useOrganizer());
    expect(result.current.searchQuery).toBe('');

    act(() => result.current.setSearchQuery('failed'));
    expect(result.current.searchQuery).toBe('failed');
  });
});

describe('useOrganizer — saved views', () => {
  const SAVED_VIEW = {
    id: 'view-1',
    name: 'Contoso Alpha builds',
    customer: 'Contoso',
    project: 'Alpha',
    typeKeys: [KEY_BUILD],
    searchQuery: 'urgent',
    isDefault: false,
  };

  it('saveCurrentView captures the whole active filter combination', () => {
    const saveView = vi.fn(() => Promise.resolve());
    useSavedViews.mockReturnValue({
      savedViews: [],
      loaded: true,
      saveView,
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result } = renderHook(() => useOrganizer());

    act(() => result.current.selectCustomer('Contoso'));
    act(() => result.current.onSelectProject('Alpha'));
    act(() => result.current.onToggleType(KEY_BUILD));
    act(() => result.current.setSearchQuery('urgent'));
    act(() => {
      void result.current.saveCurrentView('Contoso Alpha builds');
    });

    expect(saveView).toHaveBeenCalledWith('Contoso Alpha builds', {
      customer: 'Contoso',
      project: 'Alpha',
      typeKeys: [KEY_BUILD],
      searchQuery: 'urgent',
    });
  });

  it('applyView sets customer/project/typeKeys/searchQuery in one step, not through selectCustomer', () => {
    useSavedViews.mockReturnValue({
      savedViews: [SAVED_VIEW],
      loaded: true,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result } = renderHook(() => useOrganizer());

    act(() => result.current.applyView('view-1'));

    expect(result.current.selectedCustomer).toBe('Contoso');
    expect(result.current.selectedProject).toBe('Alpha');
    expect([...result.current.selectedTypeKeys]).toEqual([KEY_BUILD]);
    expect(result.current.searchQuery).toBe('urgent');
  });

  it('applyView with a project that matches no current row narrows to empty without throwing (AC 5)', () => {
    useSavedViews.mockReturnValue({
      savedViews: [{ ...SAVED_VIEW, project: 'Nonexistent-Project', typeKeys: [] }],
      loaded: true,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result } = renderHook(() => useOrganizer());

    expect(() => act(() => result.current.applyView('view-1'))).not.toThrow();
    expect(result.current.selectedProject).toBe('Nonexistent-Project');
    expect(result.current.filtered).toHaveLength(0);
  });

  it('does nothing when the view id is not found', () => {
    useSavedViews.mockReturnValue({
      savedViews: [],
      loaded: true,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result } = renderHook(() => useOrganizer());

    act(() => result.current.applyView('missing'));
    expect(result.current.selectedCustomer).toBe('__all__');
  });

  it('auto-applies the default view exactly once, after both mail and saved views have loaded', async () => {
    useSavedViews.mockReturnValue({
      savedViews: [{ ...SAVED_VIEW, isDefault: true }],
      loaded: true,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result } = renderHook(() => useOrganizer());

    await waitFor(() => expect(result.current.selectedCustomer).toBe('Contoso'));
    expect(result.current.selectedProject).toBe('Alpha');

    // Manually clearing the project afterward must not be re-clobbered by a second auto-apply.
    act(() => result.current.onSelectProject('Alpha'));
    expect(result.current.selectedProject).toBeNull();
  });

  it('does not auto-apply when no view is marked default', async () => {
    useSavedViews.mockReturnValue({
      savedViews: [SAVED_VIEW],
      loaded: true,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result } = renderHook(() => useOrganizer());

    // Let any (absent) deferred apply have a chance to run before asserting the negative.
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.selectedCustomer).toBe('__all__');
    expect(result.current.selectedProject).toBeNull();
  });

  it('does not auto-apply before the saved views have finished loading', async () => {
    useSavedViews.mockReturnValue({
      savedViews: [],
      loaded: false,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    const { result, rerender } = renderHook(() => useOrganizer());
    expect(result.current.selectedCustomer).toBe('__all__');

    useSavedViews.mockReturnValue({
      savedViews: [{ ...SAVED_VIEW, isDefault: true }],
      loaded: true,
      saveView: vi.fn(),
      renameView: vi.fn(),
      deleteView: vi.fn(),
      setDefaultView: vi.fn(),
    });
    rerender();

    await waitFor(() => expect(result.current.selectedCustomer).toBe('Contoso'));
  });

  it('passes savedViews, renameView, deleteView, and setDefaultView through unchanged', () => {
    const renameView = vi.fn();
    const deleteView = vi.fn();
    const setDefaultView = vi.fn();
    useSavedViews.mockReturnValue({
      savedViews: [SAVED_VIEW],
      loaded: true,
      saveView: vi.fn(),
      renameView,
      deleteView,
      setDefaultView,
    });
    const { result } = renderHook(() => useOrganizer());

    expect(result.current.savedViews).toEqual([SAVED_VIEW]);
    expect(result.current.renameView).toBe(renameView);
    expect(result.current.deleteView).toBe(deleteView);
    expect(result.current.setDefaultView).toBe(setDefaultView);
  });
});
