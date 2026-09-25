import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useSavedViewsPanel } from './useSavedViewsPanel';

describe('useSavedViewsPanel', () => {
  it('starts with no dialog open', () => {
    const { result } = renderHook(() => useSavedViewsPanel());
    expect(result.current.dialogTarget).toBeNull();
  });

  it('opens the create dialog', () => {
    const { result } = renderHook(() => useSavedViewsPanel());

    act(() => result.current.openCreateDialog());
    expect(result.current.dialogTarget).toEqual({ kind: 'create' });
  });

  it('opens the rename dialog prefilled with the current name', () => {
    const { result } = renderHook(() => useSavedViewsPanel());

    act(() => result.current.openRenameDialog('view-1', 'Old name'));
    expect(result.current.dialogTarget).toEqual({
      kind: 'rename',
      id: 'view-1',
      initialName: 'Old name',
    });
  });

  it('closeDialog clears whichever dialog is open', () => {
    const { result } = renderHook(() => useSavedViewsPanel());

    act(() => result.current.openCreateDialog());
    act(() => result.current.closeDialog());

    expect(result.current.dialogTarget).toBeNull();
  });
});
