import { describe, expect, it } from 'vitest';
import type { MessageType } from '../../models/categorization';
import { typeKey } from '../SidebarFilters/facetFilters';
import { buildSelectedFilters } from './filterChips';

const BUILD_FAILED: MessageType = { category: 'Build', subType: 'Failed' };
const WI_ASSIGNED: MessageType = { category: 'Work item', subType: 'Assigned' };
const PR_CREATED: MessageType = { category: 'Pull request', subType: 'Created' };

const KEY_BUILD = typeKey(BUILD_FAILED);
const KEY_WI = typeKey(WI_ASSIGNED);
const KEY_PR = typeKey(PR_CREATED);

describe('buildSelectedFilters', () => {
  it('returns an empty list when nothing is selected', () => {
    expect(buildSelectedFilters(null, new Set())).toEqual([]);
  });

  it('emits a single "Project: <name>" chip when only a project is selected', () => {
    expect(buildSelectedFilters('Alpha', new Set())).toEqual([
      { key: 'project', facet: 'project', value: 'Alpha', label: 'Project: Alpha' },
    ]);
  });

  it('emits one "Type: <label>" chip per selected type, ordered by label', () => {
    // Insertion order (WI, Build, PR) differs from label order (Build < Pull request < Work item).
    const chips = buildSelectedFilters(null, new Set([KEY_WI, KEY_BUILD, KEY_PR]));
    expect(chips).toEqual([
      { key: KEY_BUILD, facet: 'type', value: KEY_BUILD, label: 'Type: Build · Failed' },
      { key: KEY_PR, facet: 'type', value: KEY_PR, label: 'Type: Pull request · Created' },
      { key: KEY_WI, facet: 'type', value: KEY_WI, label: 'Type: Work item · Assigned' },
    ]);
  });

  it('puts the project chip first, then the sorted type chips', () => {
    const chips = buildSelectedFilters('Beta', new Set([KEY_WI, KEY_BUILD]));
    expect(chips.map((chip) => chip.label)).toEqual([
      'Project: Beta',
      'Type: Build · Failed',
      'Type: Work item · Assigned',
    ]);
  });

  it('reconstructs a type label from its key (does not depend on a live options list)', () => {
    // A type key that would be absent from the current typeOptions still yields a correct label,
    // because the label is rebuilt from the key rather than looked up.
    const chips = buildSelectedFilters(null, new Set(['Release::Deployment approved']));
    expect(chips).toEqual([
      {
        key: 'Release::Deployment approved',
        facet: 'type',
        value: 'Release::Deployment approved',
        label: 'Type: Release · Deployment approved',
      },
    ]);
  });
});
