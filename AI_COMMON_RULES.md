# Todolog AI Common Rules

Last Updated: 2026-10-02
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
- Obtain initial user authorization for a bounded work unit. Once authorized, continue repo-local inspection, implementation, verification, and documentation inside that scope without repeated approval requests. Ask again for new scope/product policy or deployment, DB write/migration, secrets/signing/provider, or destructive boundaries; existing explicit restrictions remain in force.

### Operational Authority and Tool Roles

- Authority order: explicit user decisions/approved frozen specs -> actual Git/source and commit-specific test evidence -> `docs/handoff/CURRENT.md` operational snapshot -> `PROJECT_CONTEXT.md` architecture/contracts -> `docs/handoff/DECISIONS.md` and relevant specs -> dated validation/incidents/handoffs -> actual CoS runtime for ephemeral external state -> Slack coordination/navigation. Approved policy remains authoritative regardless of its storage document; actual runtime observations determine external state, which must never be inferred from Slack.
- GitHub's designated repo/branch is the durable checkpoint. Actual branch, `git rev-parse HEAD`, and worktree override embedded implementation SHAs; do not assume `main` is current.
- Web GPT/Prime handles design, policy, review, model/review coordination and recording user approvals. CoS handles local runtime/UI, connected apps and external boundaries. Codex CLI handles repo-local search, implementation, tests/builds, diff and docs when efficient, within the authorized work unit.
- Use one mutation owner per work unit. Before CoS/Codex handoff, inspect running commands/builds/services/UI control and worktree changes; transfer ownership only at a safe boundary. Do not mutate the same worktree/device concurrently.

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
- Before session/operator migration, stop at a safe boundary and update `CURRENT.md` plus relevant handoff/validation with actual Git state, owner, completed evidence, blockers and next scope. When authorized, commit and push a GitHub checkpoint before starting the new chat. If commit/push is prohibited, report local uncheckpointed changes instead of claiming remote preservation.
- On takeover, use Slack START HERE if available, then repo entry/common rules -> `CURRENT.md` -> relevant decisions/handoffs/incidents/specs -> actual HEAD/worktree -> runtime/auth/device/provider state. Preserve completed evidence; repeat only checks needed for changed source/environment.
- Slack uses START/CHECKPOINT/BLOCKER/DECISION/RESOLVED/NEXT/OWNERSHIP with repo links. Preserve decisions/evidence in Git; Slack is never implementation, approval, secrets, or private-runtime authority. Ambiguous real provider/Google/DB results require runtime inspection before retry; app sync retry follows `PROJECT_CONTEXT.md` and the sync spec.

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
- `docs/handoff/CURRENT.md`: current operational snapshot, ownership, takeover entry and next boundary
- `PROJECT_CONTEXT.md`: architecture/contracts and implementation context; verify against actual Git/source/tests
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
6. Operational state/owner/next boundary or session/environment handoff change -> update `docs/handoff/CURRENT.md` and link dated evidence

## 8. Validation and Reporting

- Validate smallest affected surface first, then integration path.
- Run available tests/checks for changed areas.
- If tests are not run, state this explicitly.
- For contract changes, include payload-level verification in report.

## 9. Dependency and Native Lockfile Rules

- Do not run broad dependency upgrades (`npm update`, unscoped `npm install <package>@latest`, or equivalent) without explicit user approval.
- When `client/package.json` or `client/package-lock.json` changes native dependencies, validate with `npx expo install --check`.
- For iOS native dependency changes, keep `client/ios/Podfile.lock` synchronized with the current `node_modules` state before claiming the iOS build is healthy.
- If CocoaPods reports a podspec/lock mismatch, treat it as dependency drift first; do not reset Xcode or Simulator runtimes unless CoreSimulator itself is failing.
- Report dependency version changes explicitly, including Expo, React Native, and any native pod lockfile regeneration.

## 10. External AI Spec Review Protocol

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
