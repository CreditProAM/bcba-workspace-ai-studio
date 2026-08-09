# BCBA Workspace — Codex Instructions

Before making code changes, read:

`DEVELOPMENT_DIRECTION.md`

Treat it as the canonical product and engineering direction.

## Repository

Work only in the current `bcba-workspace-ai-studio` repository unless explicitly instructed otherwise.

GitHub `main` is the shared remote source of truth.

The older `bcba-workspace` repository is historical/reference only.

## Before Every Task

1. Run `git status`.
2. Run `git pull origin main`.
3. Confirm the current commit and working tree.
4. Inspect the existing implementation before editing.
5. Implement only the requested bounded slice.

## Engineering Rules

- Reuse existing architecture before creating new systems.
- Use existing `appState` for persisted application data.
- Do not create independent localStorage systems unnecessarily.
- Keep derived clinical progress and attention derived rather than independently persisted.
- Reuse shared utilities rather than duplicating calculations.
- Use stable IDs for clinical relationships.
- Preserve legacy data paths unless an explicit migration is requested.
- Do not rewrite working modules merely for modernization.
- Do not independently change the product roadmap.
- Do not automatically begin the next feature.

## Clinical Boundaries

- Never fabricate clinical facts.
- AI narratives must remain grounded in entered data.
- Do not automatically determine mastery.
- Do not diagnose.
- Do not automatically recommend treatment changes.
- Do not convert deterministic workflow alerts into clinical judgments.

## Verification Before Completion

Run:

`npm install`

`npx tsc --noEmit --noUnusedLocals --noUnusedParameters`

`npm run build`

Confirm:

- `package-lock.json` exists
- `bun.lock` does not exist
- no credentials/secrets were added
- no unrelated files were changed

Report:

- files changed
- behavior implemented/fixed
- compatibility decisions
- verification results
- commit SHA

Stop after the requested slice.
