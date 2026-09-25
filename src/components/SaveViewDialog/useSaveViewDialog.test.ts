import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useSaveViewDialog } from './useSaveViewDialog';

describe('useSaveViewDialog', () => {
  it('starts from initialName and disables Save for a blank value', () => {
    const { result } = renderHook(() =>
      useSaveViewDialog({ initialName: 'Existing', onSave: vi.fn(), onCancel: vi.fn() }),
    );

    expect(result.current.value).toBe('Existing');
    expect(result.current.canSave).toBe(true);

    act(() => result.current.setValue('   '));
    expect(result.current.canSave).toBe(false);
  });

  it('save() calls onSave with the trimmed value and then onCancel on success', async () => {
    const onSave = vi.fn(() => Promise.resolve());
    const onCancel = vi.fn();
    const { result } = renderHook(() => useSaveViewDialog({ initialName: '', onSave, onCancel }));

    act(() => result.current.setValue('  My view  '));
    await act(async () => {
      await result.current.save();
    });

    expect(onSave).toHaveBeenCalledWith('My view');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBe('');
  });

  it('on failure keeps the dialog open and shows the error', async () => {
    const onSave = vi.fn(() => Promise.reject(new Error('Graph 500')));
    const onCancel = vi.fn();
    const { result } = renderHook(() => useSaveViewDialog({ initialName: '', onSave, onCancel }));

    act(() => result.current.setValue('My view'));
    await act(async () => {
      await result.current.save();
    });

    expect(onCancel).not.toHaveBeenCalled();
    expect(result.current.saving).toBe(false);
    expect(result.current.error).toBe('Graph 500');
  });

  it('is a no-op when the value is blank', async () => {
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useSaveViewDialog({ initialName: '', onSave, onCancel: vi.fn() }),
    );

    await act(async () => {
      await result.current.save();
    });

    expect(onSave).not.toHaveBeenCalled();
  });
});
