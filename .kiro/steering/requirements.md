# Todolog AI Steering Requirements

Last Updated: 2026-02-13
Scope: Rules for AI agents working in this repository.

## 1. Purpose

This document defines how an AI agent must operate in the Todolog repository.
It is focused on execution behavior, safety, and delivery quality.

This file is not a feature spec. Feature details belong under `.kiro/specs/<feature>/`.

## 2. Instruction Priority

When instructions conflict, use this order:

1. System / platform-level instructions
2. `AGENTS.md`
3. This file (`.kiro/steering/requirements.md`)
4. Feature specs under `.kiro/specs/<feature>/`
5. User request in the current conversation

If the user gives explicit direction for the current task, follow it unless it violates a higher-priority rule.

## 3. Working Style

- Prioritize correctness, safety, and clarity over speed.
- Start with a short plan before making changes.
- Keep communication concise and factual.
- Use English for project documentation unless the user asks otherwise.

## 4. Code Modification Protocol

- Ask for explicit user confirmation before modifying code or docs.
- For substantial changes, explain the plan first, then execute after approval.
- For high-risk refactors, propose working on a separate branch.
- Never run destructive git commands (`git reset --hard`, `git clean -fd`) without explicit approval.
- Never revert unrelated user changes.

## 5. Mandatory Development Method

Use Spec-Driven Development for all new features and major changes.

### 5.1 Spec Location (Source of Truth)

All feature specs must live in:

`.kiro/specs/<feature>/`

Each feature folder must contain:

- `requirements.md`
- `design.md`
- `tasks.md`

### 5.2 Required Flow

1. Requirements phase
- user stories
- acceptance criteria
- glossary
- explicit user approval

2. Design phase
- architecture and interfaces
- API contracts
- data models
- error handling
- correctness properties
- testing strategy
- explicit user approval

3. Tasks phase
- dependency-ordered tasks
- requirement traceability
- checkpoint tasks
- explicit user approval

4. Implementation phase
- execute tasks in order
- update task checkboxes
- verify at checkpoints

### 5.3 When Spec-Driven Is Mandatory

- New features
- Data model changes
- API additions or contract changes
- Architecture-level refactors
- Complex business logic

### 5.4 When Spec-Driven Can Be Skipped

- Small bug fix (1-2 files)
- Style-only UI tweak
- Logging-only change
- Documentation-only update

## 6. Non-Negotiable Architecture Constraints

### 6.1 Offline-First

- Core flows must work without network.
- Client writes locally first; server sync is asynchronous.
- UI must not block on server availability.

### 6.2 Local Source of Truth

- SQLite is the primary source for todos, completions, categories, and pending changes.
- Settings persist via `authStore` + AsyncStorage.

### 6.3 Identity

- IDs are generated client-side as UUID v4.
- Server models use String `_id`.

### 6.4 Sync Ordering

Always preserve dependency order:

Category -> Todo -> Completion

### 6.5 Date/Time Contract (Phase 2.5)

Todo schedule fields must follow floating string format:

- Date: `YYYY-MM-DD` or `null`
- Time: `HH:mm` or `null`

Legacy schedule fields are disallowed in API payloads:

- `date`
- `startDateTime`
- `endDateTime`
- `timeZone`

Timezone source of truth is `user.settings.timeZone`.
Do not store todo-level timezone.

## 7. Validation and Testing Rules

- Validate the smallest affected surface first, then integration path.
- Run available checks/tests for changed areas.
- If tests are not run, state that clearly in the report.
- For data contract changes, include at least one payload-level verification.

## 8. Documentation Maintenance Rules

When architecture, contracts, or workflows change, update:

1. Relevant feature spec files (`.kiro/specs/...`)
2. `PROJECT_CONTEXT.md` (implementation truth)
3. `README.md` (public onboarding)
4. `ROADMAP.md` (status and next steps)

Keep document roles separated:

- `requirements.md`: AI behavior and guardrails
- `PROJECT_CONTEXT.md`: how the system currently works
- `README.md`: what the project is and how to run it
- `ROADMAP.md`: what was done and what is next

## 9. Session Bootstrap Checklist for AI

Before major work, read in order:

1. `.kiro/steering/requirements.md`
2. `PROJECT_CONTEXT.md`
3. `README.md`
4. `ROADMAP.md`
5. Target feature specs under `.kiro/specs/<feature>/`

Then:

1. Restate task scope.
2. Provide a short execution plan.
3. Ask for confirmation if edits are required.
4. Execute with checkpoints and report results.
