import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useResolveProjectDialog } from './useResolveProjectDialog';

describe('useResolveProjectDialog', () => {
  it('disables save for an empty or whitespace-only value', () => {
    const { result } = renderHook(() =>
      useResolveProjectDialog({ guid: 'g', onResolve: vi.fn(), onCancel: vi.fn() }),
    );

    expect(result.current.canSave).toBe(false);
    act(() => result.current.setValue('   '));
    expect(result.current.canSave).toBe(false);
    act(() => result.current.setValue('Alpha'));
    expect(result.current.canSave).toBe(true);
  });

  it('shows the spinner while saving, persists the trimmed value, and closes on success', async () => {
    let release!: () => void;
    const onResolve = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useResolveProjectDialog({ guid: 'guid-1', onResolve, onCancel }),
    );

    act(() => result.current.setValue('  AI Sales Agents  '));

    let savePromise!: Promise<void>;
    act(() => {
      savePromise = result.current.save();
    });
    expect(result.current.saving).toBe(true);

    await act(async () => {
      release();
      await savePromise;
    });

    expect(onResolve).toHaveBeenCalledWith('guid-1', 'AI Sales Agents');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('stays open with an error when the save fails', async () => {
    const onResolve = vi.fn(() => Promise.reject(new Error('network down')));
    const onCancel = vi.fn();
    const { result } = renderHook(() =>
      useResolveProjectDialog({ guid: 'g', onResolve, onCancel }),
    );

    act(() => result.current.setValue('Alpha'));
    await act(async () => {
      await result.current.save();
    });

    expect(result.current.error).toContain('network down');
    expect(result.current.saving).toBe(false);
    expect(onCancel).not.toHaveBeenCalled();
  });
});
