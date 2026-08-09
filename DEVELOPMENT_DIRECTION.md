# BCBA Workspace — Development Direction

This document is the permanent engineering direction for `bcba-workspace-ai-studio`. Read it before starting any development work on this codebase, human or AI-agent.

## 1. Source of Truth

- The existing local clone of `bcba-workspace-ai-studio` is the primary local development working copy.
- GitHub `CreditProAM/bcba-workspace-ai-studio` `main` is the shared remote source of truth.
- The older local `bcba-workspace` project is historical/reference only and must not receive new development work unless explicitly requested.
- Do not create fresh review clones unless isolation is genuinely necessary. Work in the existing clone.

## 2. Required Workflow Before Every Task

Always, in order:

1. `git status`
2. `git pull origin main`
3. Confirm the current working tree state and commit SHA before touching anything.
4. Inspect the relevant existing code before editing.
5. Implement locally.
6. Run verification locally (see Section 10).
7. Commit locally.
8. Push to GitHub `main`.

Never assume an AI Studio workspace, a Cursor session, or any other environment is newer than GitHub. GitHub `main` is authoritative.

## 3. Agent Roles

- **Claude**: primary implementation/refactor/repo-integrity agent.
- **Cursor/Codex**: bounded implementation, debugging, and testing when requested.
- **Google AI Studio/Gemini**: prototyping, isolated experiments, and UI exploration only, unless explicitly authorized to modify the primary flow.
- **GitHub `main`**: the integration and history point all agents converge on.

Do not let multiple agents independently implement the same slice. If two agents could plausibly pick up the same task, confirm ownership before starting.

## 4. Current Product Thesis

BCBA Workspace is a BCBA operations + clinical workspace for managing a caseload — it is **not** a billing platform.

Core clinical loop:

```
Client → Service Plan → Program → Baseline → Measurement → Session Data → Session Note → Progress → BCBA Review → Needs Attention
```

## 5. Current Built Capabilities

Verified as of commit `c0dfd8ce0f833c803ec0db7c74dbc0696b905f7c`:

- Today / Calendar
- Caseload
- Completed client onboarding fields (age, guardian/caregiver, authorized hours, via `ClientModal`)
- Supervision + 5% calculation
- Unified Needs My Attention (shared `deriveClinicalAttention` engine)
- Session Notes + Documentation QA
- RBT → BCBA review flow
- Service Plans
- Clinical Programs/categories
- Program Library
- Measurement configuration: frequency, duration, percentage, intensity, task analysis
- Program-driven Data Collection
- Grounded AI narrative generation
- Progress Charts
- Shared `utils/clinicalProgress.ts` utility
- Shared `utils/clinicalAttention.ts` utility
- Unified Client Clinical Workspace
- FBA
- Parent Training
- Cross-Caseload Pending Review Queue
- Baseline Capture + chart reference (Program Editor "Baseline" tab, `ClinicalProgress` reference line)
- Toolkit
- Sidekick
- JSON export/import backup

## 6. Known Remaining Product Priorities

In order:

1. Objective Mastery Criteria
2. Deepen clinical program/progress workflows based on actual use
3. Documents/templates only when justified
4. Assessments only when a specific instrument/use case is validated
5. Production infrastructure only when preparing for real pilot/deployment

Priorities may change after real BCBA usage. Treat this list as a starting order, not a fixed contract.

## 7. Explicitly Not Building Yet

- Billing
- Claims
- Payroll
- EVV
- Clearinghouses
- Insurance/payer workflows
- Full HR
- Complex credential management
- Production authentication/backend/database, unless pilot readiness requires it
- Automatic clinical decisions
- Automatic mastery
- AI clinical risk scoring
- Unnecessary new top-level modules

## 8. Architectural Rules

- Reuse the central `appState`.
- Do not introduce independent localStorage systems for features that belong in `appState`.
- Preserve `useHistory`, autosave, and backup/recovery.
- Derived information such as progress and attention must remain derived, not persisted independently.
- Use stable IDs, especially `programId`, not display names, for clinical relationships.
- Avoid duplicate calculation logic; use shared utilities (`utils/clinicalProgress.ts`, `utils/clinicalAttention.ts`).
- Preserve legacy data paths until an explicit migration plan exists.
- Do not silently delete or replace old data/workflows.
- Do not rewrite working modules just to modernize them.

## 9. Clinical Safety / Product Boundaries

- AI-generated narratives must remain grounded in entered session data.
- Do not fabricate clinical facts.
- Do not automatically diagnose, master objectives, recommend treatment changes, or assign clinical risk.
- Deterministic workflow alerts (e.g. Needs My Attention items) must be clearly distinguished from clinical judgment. They flag; they do not decide.

## 10. Verification Gate

Before every push:

```
npm install
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run build
```

Verify:

- `package-lock.json` is present
- no `bun.lock`
- no secrets/API keys committed
- no unexpected unrelated files changed

## 11. Change Discipline

Every task should be one bounded slice.

Before coding, state:

- what is being changed
- what is explicitly not being changed
- which existing systems are being reused

After coding, report:

- files changed
- behavior added/fixed
- compatibility decisions
- verification results
- commit SHA
- next recommended slice

Do not automatically start the next slice.

## 12. Current Next Recommended Slice

**Objective Mastery Criteria V1**

This should only be started after this direction file (and the agent grounding files that accompany it) are committed and pushed as their own bounded slice — not bundled into the same commit as a feature change.
