# Todolog AI Common Rules

Last Updated: 2026-02-22
Scope: Shared rules for all AI tools used in this repository.

## 1. Purpose

This file is the single source of truth for shared AI behavior.
Use this for policies that must be identical across Codex and Kiro.

Tool-specific entry behavior must stay in:

- `AGENTS.md` (Codex entry)
- `.kiro/steering/requirements.md` (Kiro entry)

## 2. Shared Principles

- Prioritize safety, correctness, and clarity over speed.
- Start with a short plan before substantial edits.
- Keep communication concise and concrete.
- Ask for explicit user confirmation before editing code/docs.

## 3. Mandatory Development Method

Use Spec-Driven Development for:

- new features
- architecture changes
- data model changes
- API contract changes
- complex business logic

Spec location (source of truth):

- `.kiro/specs/<feature>/requirements.md`
- `.kiro/specs/<feature>/design.md`
- `.kiro/specs/<feature>/tasks.md`

Execution flow:

1. Requirements (with user approval)
2. Design (with user approval)
3. Tasks (with user approval)
4. Implementation in task order with checkpoints

Can skip spec-driven for small fixes (1-2 files), style-only tweaks, log-only changes, and doc-only edits.

## 4. Safety and Git Rules

- Never run `git reset --hard` or `git clean -fd` without explicit approval.
- Never overwrite or delete non-code assets without permission.
- Never revert unrelated user changes.
- Prefer minimal, reviewable, non-destructive edits.

## 5. Architecture Guardrails (Must Preserve)

- Offline-first behavior is mandatory.
- SQLite is local source of truth for todos/completions/categories/pending changes.
- IDs are UUID v4, generated client-side.
- Sync order must remain: Category -> Todo -> Completion.

Phase 2.5 schedule contract:

- Date: `YYYY-MM-DD` or `null`
- Time: `HH:mm` or `null`

Disallowed legacy payload fields:

- `date`
- `startDateTime`
- `endDateTime`
- `timeZone`

Timezone source of truth:

- `user.settings.timeZone`

For implementation detail, reference `PROJECT_CONTEXT.md`.

## 6. Documentation Roles

- `AGENTS.md`: Codex entry-only instructions
- `.kiro/steering/requirements.md`: Kiro entry-only instructions
- `AI_COMMON_RULES.md`: shared AI rules (this file)
- `PROJECT_CONTEXT.md`: implementation source of truth
- `README.md`: public onboarding and run instructions
- `ROADMAP.md`: dated milestones and next plan

## 7. Documentation Update Policy

When architecture/contracts/workflow change, update affected docs in the same session.

Rule of thumb:

1. Shared rule change -> update `AI_COMMON_RULES.md`
2. Codex/Kiro startup-only change -> update entry file only
3. Implementation reality change -> update `PROJECT_CONTEXT.md`
4. Public setup/onboarding change -> update `README.md`
5. Milestone/plan change -> update `ROADMAP.md`

## 8. Validation and Reporting

- Validate smallest affected surface first, then integration path.
- Run available tests/checks for changed areas.
- If tests are not run, state this explicitly.
- For contract changes, include payload-level verification in report.

## 9. External AI Spec Review Protocol

When validating spec/architecture documents with external AI tools (e.g. Opus, Gemini):

1. Use evidence-based review prompts with strict output format.
2. Require file/section citations for every finding.
3. Require copy-pastable patch proposals (not abstract advice).
4. Start implementation only after review verdict is at least "Conditionally ready" and Critical/High items are addressed.

Prompt storage rule:

1. Keep reusable prompt templates in `DOCUMENT_UPDATE_GUIDE.md`.
2. Do not store long prompt templates in `AGENTS.md` or tool entry docs.

Review log rule:

1. Save review outputs under the related spec folder (e.g. `*_review*.md`).
2. Record model name/date/verdict and whether each finding was accepted or rejected.

Review triage rule:

1. Classify findings into `must-fix`, `optional`, or `reject`.
2. Every classification must include file/section evidence and a short reason.
3. Before implementation, resolve all `must-fix` items or explicitly defer them with risk notes.
