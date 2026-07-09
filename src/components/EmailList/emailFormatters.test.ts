import type { Message } from '@microsoft/microsoft-graph-types';
import { describe, expect, it } from 'vitest';
import { formatReceivedDate, resolveBody } from './emailFormatters';

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
