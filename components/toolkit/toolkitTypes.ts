// Local types for the Toolkit module, ported from aba-clinical-decision-support-toolkit/types.ts.
// Kept separate from the app's core clinical types.ts (Client/SessionNote/etc.) since these
// describe the prompt library itself, not clinical/patient data. Note this file's ChatMessage
// is intentionally named ToolkitChatMessage -- the app already has an unrelated ChatMessage
// type in ../../types.ts for the Sidekick chat.

export type PromptCategory =
  | 'Crisis Help'
  | 'Documentation Templates'
  | 'Ethics Support'
  | 'Parent Scripts'
  | 'Data & Patterns'
  | 'Goal Writing'
  | 'Supervisor Talk Tracks';

export const PROMPT_CATEGORIES: PromptCategory[] = [
  'Crisis Help',
  'Documentation Templates',
  'Ethics Support',
  'Parent Scripts',
  'Data & Patterns',
  'Goal Writing',
  'Supervisor Talk Tracks',
];

export interface PromptTemplate {
  id: string;
  category: PromptCategory;
  title: string;
  description: string;
  prompt: string;
  staticFallback: string;
}

export interface ToolkitSessionContext {
  promptsUsed: string[];
  favorited: string[];
}

export interface StructuredPromptOutput {
  meta: {
    scenarioId: string;
    generatedAt: number;
    density: 'twenty';
  };
  summary: string;
  immediateSteps: string[];
  parentScript?: string;
  documentationTemplate?: string;
  risksWatchouts?: string[];
  relatedScenarios?: string[];
  resources?: string[];
}

export interface ToolkitChatMessage {
  role: 'user' | 'model';
  text: string;
}

export const TOOLKIT_DISCLAIMER = `This content is AI-generated as an educational resource and should not replace professional clinical judgment. Always verify information with your supervisor and adhere to BACB guidelines and your organization's policies.`;
