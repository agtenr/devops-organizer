import { describe, expect, it } from 'vitest';
import {
  UNCATEGORIZED,
  type CategorizedEmail,
  type MessageType,
} from '../../models/categorization';
import { deriveKnownProjectNames } from './knownProjects';

const TYPE: MessageType = { category: 'Work item', subType: 'Assigned' };

function email(
  customer: string,
  project: string,
  projectIsUnresolvedGuid = false,
): CategorizedEmail {
  return {
    message: { id: `${customer}-${project}` },
    customer,
    project,
    type: TYPE,
    needsReview: projectIsUnresolvedGuid,
    projectIsUnresolvedGuid,
  };
}

describe('deriveKnownProjectNames', () => {
  it('returns the unique friendly project names for the given organization, sorted', () => {
    const emails = [
      email('Azelis', 'beta'),
      email('Azelis', 'Alpha'),
      email('Azelis', 'Alpha'),
      email('Contoso', 'Gamma'),
    ];
    expect(deriveKnownProjectNames(emails, 'Azelis')).toEqual(['Alpha', 'beta']);
  });

  it('excludes the Uncategorized fallback and unresolved-GUID projects', () => {
    const emails = [
      email('Azelis', 'Alpha'),
      email('Azelis', UNCATEGORIZED),
      email('Azelis', '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4', true),
    ];
    expect(deriveKnownProjectNames(emails, 'Azelis')).toEqual(['Alpha']);
  });

  it('returns an empty list when the organization has no discovered names', () => {
    expect(deriveKnownProjectNames([email('Contoso', 'Gamma')], 'Azelis')).toEqual([]);
  });
});
