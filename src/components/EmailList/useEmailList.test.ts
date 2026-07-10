import { act, renderHook } from '@testing-library/react';
import type { Message } from '@microsoft/microsoft-graph-types';
import { describe, expect, it } from 'vitest';
import type { CategorizedEmail, MessageType } from '../../models/categorization';
import { useEmailList } from './useEmailList';

const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };

function email(id: string, message: Partial<Message> = {}): CategorizedEmail {
  return {
    message: { id, ...message },
    customer: 'Contoso',
    project: 'Alpha',
    type: WI_ASSIGNED,
    needsReview: false,
    projectIsUnresolvedGuid: false,
  };
}

describe('useEmailList', () => {
  it('opens the panel on the selected e-mail', () => {
    const emails = [email('a'), email('b')];
    const { result } = renderHook(() => useEmailList(emails));

    expect(result.current.isPanelOpen).toBe(false);
    expect(result.current.selectedEmail).toBeNull();

    act(() => result.current.openEmail('a'));
    expect(result.current.isPanelOpen).toBe(true);
    expect(result.current.selectedEmail?.message.id).toBe('a');
  });

  it('swaps the selected e-mail while the panel stays open (non-blocking)', () => {
    const emails = [email('a'), email('b')];
    const { result } = renderHook(() => useEmailList(emails));

    act(() => result.current.openEmail('a'));
    act(() => result.current.openEmail('b'));

    expect(result.current.isPanelOpen).toBe(true);
    expect(result.current.selectedEmail?.message.id).toBe('b');
  });

  it('closePanel closes the panel but keeps the last selection', () => {
    const emails = [email('a')];
    const { result } = renderHook(() => useEmailList(emails));

    act(() => result.current.openEmail('a'));
    act(() => result.current.closePanel());

    expect(result.current.isPanelOpen).toBe(false);
    expect(result.current.selectedEmail?.message.id).toBe('a');
  });

  it('opens and closes the resolve-project-GUID target', () => {
    const { result } = renderHook(() => useEmailList([email('a')]));

    expect(result.current.resolveTarget).toBeNull();

    act(() => result.current.openResolve('the-guid', 'Azelis'));
    expect(result.current.resolveTarget).toEqual({ guid: 'the-guid', customer: 'Azelis' });

    act(() => result.current.closeResolve());
    expect(result.current.resolveTarget).toBeNull();
  });

  it('keeps showing the selected e-mail after it leaves the filtered set (ratified)', () => {
    const { result, rerender } = renderHook(({ emails }) => useEmailList(emails), {
      initialProps: { emails: [email('a'), email('b')] },
    });

    act(() => result.current.openEmail('a'));

    // A filter change removes 'a' from the set; the panel keeps showing its captured body.
    rerender({ emails: [email('b')] });

    expect(result.current.isPanelOpen).toBe(true);
    expect(result.current.selectedEmail?.message.id).toBe('a');
  });
});

describe('useEmailList — selection', () => {
  it('toggles a single row and reports the count', () => {
    const { result } = renderHook(() => useEmailList([email('a'), email('b')]));

    expect(result.current.selectedCount).toBe(0);

    act(() => result.current.toggleSelected('a'));
    expect(result.current.selectedIds.has('a')).toBe(true);
    expect(result.current.selectedCount).toBe(1);

    act(() => result.current.toggleSelected('a'));
    expect(result.current.selectedCount).toBe(0);
  });

  it('select-all selects every visible id, then clears when toggled again', () => {
    const { result } = renderHook(() => useEmailList([email('a'), email('b')]));

    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.selectedCount).toBe(2);

    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.selectedCount).toBe(0);
  });

  it('clearSelection empties the selection', () => {
    const { result } = renderHook(() => useEmailList([email('a')]));

    act(() => result.current.toggleSelected('a'));
    act(() => result.current.clearSelection());
    expect(result.current.selectedCount).toBe(0);
  });

  it('prunes selection to the visible rows when the filtered set changes', () => {
    const { result, rerender } = renderHook(({ emails }) => useEmailList(emails), {
      initialProps: { emails: [email('a'), email('b')] },
    });

    act(() => result.current.toggleSelectAll(['a', 'b']));
    expect(result.current.selectedCount).toBe(2);

    // A filter change hides 'a'; it must drop out of the selection so it can't be bulk-deleted.
    rerender({ emails: [email('b')] });
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.selectedIds.has('a')).toBe(false);
  });
});

describe('useEmailList — delete target', () => {
  it('opens a row delete target carrying the id and subject, and closes it', () => {
    const { result } = renderHook(() => useEmailList([email('a', { subject: 'Alpha' })]));

    expect(result.current.deleteTarget).toBeNull();

    act(() => result.current.openDeleteRow(email('a', { subject: 'Alpha' })));
    expect(result.current.deleteTarget).toEqual({ ids: ['a'], subject: 'Alpha' });

    act(() => result.current.closeDelete());
    expect(result.current.deleteTarget).toBeNull();
  });

  it('opens a bulk delete target from the current selection', () => {
    const { result } = renderHook(() => useEmailList([email('a'), email('b')]));

    act(() => result.current.toggleSelected('a'));
    act(() => result.current.toggleSelected('b'));
    act(() => result.current.openDeleteBulk());

    expect([...(result.current.deleteTarget?.ids ?? [])].sort()).toEqual(['a', 'b']);
    expect(result.current.deleteTarget?.subject).toBeUndefined();
  });
});
