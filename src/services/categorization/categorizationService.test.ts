import { describe, expect, it } from 'vitest';
import type { Message } from '@microsoft/microsoft-graph-types';
import {
  categorizeEmail,
  categorizeEmails,
  extractBodyText,
  resolveOrgAndProject,
} from './categorizationService';
import { UNCATEGORIZED } from '../../models/categorization';

// Load the committed JSON fixtures via Vite's eager glob import, so the suite stays hermetic and
// needs no Node `fs`/type dependency in the browser-targeted app project.
const fixtures = import.meta.glob<Message>('./__fixtures__/*.json', {
  eager: true,
  import: 'default',
});
const loadFixture = (name: string): Message => fixtures[`./__fixtures__/${name}.json`];

const AZELIS_GUID = '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4';
const COLRUYT_GUID = '6fde5845-6026-4248-95f1-d719c38f15c6';

/**
 * The demo corpus (story 37 §7). `customer` and `type` match the reference table for all 14;
 * `project` is the friendly name where the e-mail's URL exposes it (Build/PR) and the project GUID
 * for the work-item and release notifications, whose URLs carry only the GUID (names are never
 * inferred/translated — see the fixtures README).
 */
const DEMO_CASES = [
  {
    file: 'access-request',
    customer: 'DLWR-DLWR',
    project: 'DLWR.ISO27001',
    category: 'Other',
    subType: 'Access request',
  },
  {
    file: 'work-item-assigned-bug68305',
    customer: 'Azelis',
    project: AZELIS_GUID,
    category: 'Work item',
    subType: 'Assigned',
  },
  {
    file: 'work-item-mentioned-bug68506',
    customer: 'Azelis',
    project: AZELIS_GUID,
    category: 'Work item',
    subType: 'Mentioned',
  },
  {
    file: 'work-item-assigned-changerequest68488',
    customer: 'Azelis',
    project: AZELIS_GUID,
    category: 'Work item',
    subType: 'Assigned',
  },
  {
    file: 'build-failed-v0-1',
    customer: 'Azelis',
    project: 'AI Sales Agents',
    category: 'Build',
    subType: 'Failed',
  },
  {
    file: 'build-failed-v0-8',
    customer: 'Azelis',
    project: 'AI Sales Agents',
    category: 'Build',
    subType: 'Failed',
  },
  {
    file: 'build-succeeded-api',
    customer: 'Azelis',
    project: 'AI Sales Agents',
    category: 'Build',
    subType: 'Succeeded',
  },
  {
    file: 'build-succeeded-ui',
    customer: 'Azelis',
    project: 'AI Sales Agents',
    category: 'Build',
    subType: 'Succeeded',
  },
  {
    file: 'pr-review-requested-8255',
    customer: 'colruytgroupcom',
    project: 'SC ComCol',
    category: 'Pull request',
    subType: 'Review requested',
  },
  {
    file: 'pr-completed-3707',
    customer: 'Azelis',
    project: 'AI Sales Agents',
    category: 'Pull request',
    subType: 'Completed',
  },
  {
    file: 'pr-completed-8364',
    customer: 'colruytgroupcom',
    project: 'SC ComCol',
    category: 'Pull request',
    subType: 'Completed',
  },
  {
    file: 'release-approval-api',
    customer: 'Azelis',
    project: AZELIS_GUID,
    category: 'Release',
    subType: 'Approval pending',
  },
  {
    file: 'release-approval-ui',
    customer: 'Azelis',
    project: AZELIS_GUID,
    category: 'Release',
    subType: 'Approval pending',
  },
  {
    file: 'release-approval-webjobs',
    customer: 'colruytgroupcom',
    project: COLRUYT_GUID,
    category: 'Release',
    subType: 'Approval pending',
  },
] as const;

describe('categorizeEmail — demo corpus (story 37 §7 reference examples)', () => {
  it.each(DEMO_CASES)('$file → $customer / $project / $category · $subType', (c) => {
    const result = categorizeEmail(loadFixture(c.file));
    expect(result.customer).toBe(c.customer);
    expect(result.project).toBe(c.project);
    expect(result.type).toEqual({ category: c.category, subType: c.subType });
    expect(result.needsReview).toBe(false);
  });

  it('covers every type category across the corpus', () => {
    const categories = new Set(DEMO_CASES.map((c) => c.category));
    expect(categories).toEqual(new Set(['Other', 'Work item', 'Build', 'Pull request', 'Release']));
  });
});

/** Builds a minimal Graph message for the synthetic edge cases. */
const message = (body: string, subject = '', contentType: 'html' | 'text' = 'text'): Message => ({
  subject,
  body: { contentType, content: body },
});

describe('resolveOrgAndProject', () => {
  it('unwraps a Microsoft SafeLink before reading the org/project', () => {
    const safelink =
      'https://eur02.safelinks.protection.outlook.com/?url=https%3A%2F%2Fdev.azure.com%2FContoso%2FWebApp%2F_workitems%2Fedit%2F5&data=abc';
    expect(resolveOrgAndProject(`<a href="${safelink}">x</a>`)).toEqual({
      customer: 'Contoso',
      project: 'WebApp',
    });
  });

  it('skips `_`-prefixed path segments and uses a link that exposes a real project', () => {
    const body =
      'settings https://dev.azure.com/Contoso/_settings/notifications real ' +
      'https://dev.azure.com/Contoso/WebApp/_git/repo';
    expect(resolveOrgAndProject(body)).toEqual({ customer: 'Contoso', project: 'WebApp' });
  });

  it('returns the GUID verbatim when the URL carries only a project id', () => {
    const body =
      'https://dev.azure.com/Contoso/2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4/_workitems/edit/9';
    expect(resolveOrgAndProject(body)).toEqual({
      customer: 'Contoso',
      project: '2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4',
    });
  });

  it('prefers a project name over a bare GUID when both are present', () => {
    const body =
      'https://dev.azure.com/Contoso/2595f41b-a4ea-4a8e-a89c-1cc0bd9384b4/_workitems/edit/9 ' +
      'https://dev.azure.com/Contoso/WebApp/_build/results?buildId=1';
    expect(resolveOrgAndProject(body)?.project).toBe('WebApp');
  });

  it('resolves the legacy {org}.visualstudio.com form', () => {
    expect(resolveOrgAndProject('https://contoso.visualstudio.com/WebApp/_git/repo')).toEqual({
      customer: 'contoso',
      project: 'WebApp',
    });
  });

  it('returns undefined when no usable Azure DevOps URL is present', () => {
    expect(resolveOrgAndProject('just some text, no link')).toBeUndefined();
    expect(
      resolveOrgAndProject('https://dev.azure.com/Contoso/_settings/notifications'),
    ).toBeUndefined();
  });
});

describe('extractBodyText', () => {
  it('strips HTML markup to text', () => {
    expect(
      extractBodyText({ contentType: 'html', content: '<p>Build <b>failed</b></p>' }),
    ).toContain('Build failed');
  });

  it('passes plain-text bodies through unchanged', () => {
    expect(extractBodyText({ contentType: 'text', content: 'was assigned to you' })).toBe(
      'was assigned to you',
    );
  });

  it('returns an empty string for a missing body', () => {
    expect(extractBodyText(null)).toBe('');
    expect(extractBodyText(undefined)).toBe('');
  });
});

describe('categorizeEmail — fallback & sender-independence', () => {
  it('flags an e-mail with no ADO URL for review with the Uncategorized fallback', () => {
    const result = categorizeEmail(
      message('A newsletter with no Azure DevOps link.', 'Weekly digest'),
    );
    expect(result.customer).toBe(UNCATEGORIZED);
    expect(result.project).toBe(UNCATEGORIZED);
    expect(result.type).toEqual({ category: 'Other', subType: 'Unknown' });
    expect(result.needsReview).toBe(true);
  });

  it('never throws and applies the fallback when the body is missing entirely', () => {
    const result = categorizeEmail({ subject: 'No body here' });
    expect(result.customer).toBe(UNCATEGORIZED);
    expect(result.type).toEqual({ category: 'Other', subType: 'Unknown' });
    expect(result.needsReview).toBe(true);
  });

  it('categorizes a copied/forwarded message regardless of sender, ignoring the forwarder note', () => {
    // The forwarder's own note above the original content contains a misleading "build failed"
    // trigger; the real signal (a work-item assignment) sits below the forwarded header block.
    const forwarded = message(
      [
        'FYI — the build failed on my laptop too, please take a look below.',
        '-----Original Message-----',
        'From: Azure DevOps <azuredevops@microsoft.com>',
        'Sent: Monday, 6 July 2026',
        'Subject: Bug 42',
        '',
        'Demo Reviewer was assigned to Bug 42',
        'https://dev.azure.com/Contoso/WebApp/_workitems/edit/42',
      ].join('\n'),
      'FW: Bug 42',
    );
    // A non-Azure-DevOps sender must not change the outcome.
    forwarded.sender = { emailAddress: { name: 'A Colleague', address: 'colleague@example.com' } };

    const result = categorizeEmail(forwarded);
    expect(result.customer).toBe('Contoso');
    expect(result.project).toBe('WebApp');
    expect(result.type).toEqual({ category: 'Work item', subType: 'Assigned' });
    expect(result.needsReview).toBe(false);
  });
});

describe('determineType — Other sub-types', () => {
  it('classifies an organization-administration notification as Other · Admin', () => {
    const result = categorizeEmail(
      message(
        'You were added as an administrator. https://dev.azure.com/Contoso/WebApp/_settings/organization',
        'Organization settings changed',
      ),
    );
    expect(result.type).toEqual({ category: 'Other', subType: 'Admin' });
  });
});

describe('determineType ordering', () => {
  it('classifies a deployment-failed e-mail as Release, not shadowed by the Build rule', () => {
    const result = categorizeEmail(
      message(
        'The deployment failed for stage Production. https://dev.azure.com/Contoso/WebApp/_release',
        'Deployment failed',
      ),
    );
    expect(result.type).toEqual({ category: 'Release', subType: 'Deployment failed' });
  });

  it('classifies a deployment-succeeded e-mail as Release', () => {
    const result = categorizeEmail(
      message('Deployment succeeded for stage Test. https://dev.azure.com/Contoso/WebApp/_release'),
    );
    expect(result.type).toEqual({ category: 'Release', subType: 'Deployment succeeded' });
  });
});

describe('categorizeEmails', () => {
  it('maps the whole in-memory set', () => {
    const results = categorizeEmails([
      loadFixture('build-failed-v0-1'),
      loadFixture('pr-completed-3707'),
    ]);
    expect(results.map((r) => r.type.category)).toEqual(['Build', 'Pull request']);
  });
});
