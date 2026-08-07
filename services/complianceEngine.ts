import { SessionNote, DocumentationQARule, DocumentationQAIssue, NoteStatus } from '../types';

/**
 * Documentation QA engine, adapted from aba_tool_genie/services/complianceEngine.ts.
 *
 * IMPORTANT: this is a documentation-quality / QA check, not a guarantee of payer or
 * billing compliance. The original engine filtered rules by insurance payor and included
 * an AUTH_MATCH rule tied to CPT codes/authorized units -- both were billing concerns and
 * have been removed entirely. What's left are the checks that are useful regardless of
 * who pays for the service: is the note actually complete, and has a BCBA signed off
 * before it's marked done.
 */
export const runDocumentationQA = (
  note: Partial<SessionNote>,
  rules: DocumentationQARule[],
  finalStatus: NoteStatus,
): DocumentationQAIssue[] => {
  const issues: DocumentationQAIssue[] = [];

  for (const rule of rules) {
    let violated = false;

    switch (rule.requirementType) {
      case 'PRESENCE': {
        if (!rule.fieldName) break;
        const value = (note as Record<string, unknown>)[rule.fieldName as string];
        if (value === undefined || value === null || value === '') {
          violated = true;
        }
        if (Array.isArray(value) && value.length === 0) {
          violated = true;
        }
        break;
      }

      case 'REVIEWER_SIGNOFF':
        // A note being marked Completed should have a reviewer on record.
        if (finalStatus === 'Completed' && !note.reviewerId) {
          violated = true;
        }
        break;

      case 'NARRATIVE_PRESENT':
        // A completed note should have a written narrative, not just raw/quantitative data.
        if (finalStatus === 'Completed' && !note.narrative) {
          violated = true;
        }
        break;

      default:
        break;
    }

    if (violated) {
      issues.push({ ruleId: rule.id, message: rule.message, severity: rule.severity });
    }
  }

  return issues;
};
