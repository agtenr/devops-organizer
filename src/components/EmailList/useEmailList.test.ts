import { act, renderHook } from '@testing-library/react';
import type { Message } from '@microsoft/microsoft-graph-types';
import { describe, expect, it } from 'vitest';
import type { CategorizedEmail, MessageType } from '../../models/categorization';
import { formatReceivedDate, resolveBody, useEmailList } from './useEmailList';

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

describe('formatReceivedDate', () => {
  it('returns "" for missing or unparseable input, never throwing', () => {
    expect(formatReceivedDate(undefined)).toBe('');
    expect(formatReceivedDate(null)).toBe('');
    expect(formatReceivedDate('')).toBe('');
    expect(formatReceivedDate('not-a-date')).toBe('');
  });

  it('returns a non-empty formatted string for a valid ISO date', () => {
    expect(formatReceivedDate('2026-07-09T08:30:00Z')).not.toBe('');
  });
});

describe('resolveBody', () => {
  it('returns an html body verbatim when contentType is html', () => {
    const message: Message = { body: { contentType: 'html', content: '<p>hi</p>' } };
    expect(resolveBody(message)).toEqual({ kind: 'html', content: '<p>hi</p>' });
  });

  it('returns a text body verbatim when contentType is text', () => {
    const message: Message = { body: { contentType: 'text', content: 'plain body' } };
    expect(resolveBody(message)).toEqual({ kind: 'text', content: 'plain body' });
  });

  it('falls back to an empty text body when the body is missing or empty', () => {
    expect(resolveBody({})).toEqual({ kind: 'text', content: '' });
    expect(resolveBody({ body: { contentType: 'html', content: '' } })).toEqual({
      kind: 'text',
      content: '',
    });
  });
});

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
