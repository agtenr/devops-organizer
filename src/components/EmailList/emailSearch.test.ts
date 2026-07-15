import type { Message } from '@microsoft/microsoft-graph-types';
import { describe, expect, it } from 'vitest';
import type { CategorizedEmail, MessageType } from '../../models/categorization';
import { filterBySubject } from './emailSearch';

const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };

function email(subject: string | null, id = subject ?? 'none'): CategorizedEmail {
  const message: Message = { id, subject, body: { contentType: 'text', content: '' } };
  return {
    message,
    customer: 'Contoso',
    project: 'Alpha',
    type: WI_ASSIGNED,
    needsReview: false,
    projectIsUnresolvedGuid: false,
  };
}

describe('filterBySubject', () => {
  const emails = [
    email('Build failed on main'),
    email('PR review requested'),
    email('Work item assigned to you'),
  ];

  it('returns the input array unchanged (same reference) for an empty query', () => {
    expect(filterBySubject(emails, '')).toBe(emails);
  });

  it('returns the input array unchanged (same reference) for a whitespace-only query', () => {
    expect(filterBySubject(emails, '   ')).toBe(emails);
  });

  it('matches case-insensitively', () => {
    const result = filterBySubject(emails, 'build');
    expect(result.map((e) => e.message.subject)).toEqual(['Build failed on main']);
  });

  it('matches a substring, not just a prefix', () => {
    const result = filterBySubject(emails, 'failed');
    expect(result.map((e) => e.message.subject)).toEqual(['Build failed on main']);
  });

  it('returns an empty array (not an error) when nothing matches', () => {
    expect(filterBySubject(emails, 'zzz-nope')).toEqual([]);
  });

  it('excludes an e-mail with a missing subject from a non-empty query without throwing', () => {
    const withNull = [...emails, email(null, 'null-subject')];
    const result = filterBySubject(withNull, 'requested');
    expect(result.map((e) => e.message.subject)).toEqual(['PR review requested']);
  });

  it('includes an e-mail with a missing subject when the query is blank (return-all)', () => {
    const withNull = [email(null, 'null-subject')];
    expect(filterBySubject(withNull, '')).toBe(withNull);
  });

  it('trims surrounding whitespace off a non-blank query before matching', () => {
    const result = filterBySubject(emails, '  review  ');
    expect(result.map((e) => e.message.subject)).toEqual(['PR review requested']);
  });
});
