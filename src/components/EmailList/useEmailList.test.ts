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
