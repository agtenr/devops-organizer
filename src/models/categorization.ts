import type { Message } from '@microsoft/microsoft-graph-types';

/**
 * The categorization domain model (see `.claude/rules/categorization-domain.md`).
 *
 * Every Azure DevOps notification e-mail is tagged with a `(Customer, Project, Type)` triple:
 * - **Customer** = the ADO organization the notification came from.
 * - **Project** = the ADO project within that organization (a name, or a GUID when the name is not
 *   present in the e-mail — never translated/inferred).
 * - **Type** = the ADO message type (category + sub-type).
 */

/** The ADO message-type taxonomy (category + sub-type). See the reference table in story 37 §3. */
export type MessageType =
  | {
      category: 'Work item';
      subType: 'Created' | 'Assigned' | 'Mentioned' | 'Commented' | 'State changed';
    }
  | {
      category: 'Pull request';
      subType: 'Created' | 'Updated' | 'Review requested' | 'Commented' | 'Completed' | 'Abandoned';
    }
  | { category: 'Build'; subType: 'Succeeded' | 'Failed' | 'Partially succeeded' }
  | {
      category: 'Release';
      subType: 'Approval pending' | 'Deployment succeeded' | 'Deployment failed';
    }
  | { category: 'Other'; subType: 'Access request' | 'Admin' | 'Unknown' };

/**
 * Explicit fallback value for a customer/project axis that cannot be resolved from the e-mail. The
 * categorization service assigns this rather than crashing or silently dropping the e-mail
 * (`.claude/rules/categorization-domain.md` invariant).
 */
export const UNCATEGORIZED = 'Uncategorized';

/** The type fallback used when no rule matches (paired with `needsReview: true`). */
export const UNKNOWN_TYPE: MessageType = { category: 'Other', subType: 'Unknown' };

/** A raw Graph message paired with its derived `(Customer, Project, Type)` triple. */
export interface CategorizedEmail {
  /** The raw source message, carried through unchanged for the UI (subject, received date, …). */
  message: Message;
  /** ADO organization, or {@link UNCATEGORIZED} when no ADO URL could be resolved. */
  customer: string;
  /** ADO project name or GUID (verbatim), or {@link UNCATEGORIZED} when unresolved. */
  project: string;
  /** The taxonomy triple; {@link UNKNOWN_TYPE} when no rule matched. */
  type: MessageType;
  /** True when a body signal was missing (no ADO URL) or no type rule matched. */
  needsReview: boolean;
}
