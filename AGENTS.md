# Codex Entry Rules

Last Updated: 2026-10-02
Scope: Codex IDE/CLI startup instructions only.

## 1. Purpose

This file is the Codex entry document.
It must stay thin and contain only Codex-specific startup behavior.

Shared rules are defined in:

- `AI_COMMON_RULES.md`

## 2. Codex Startup Order

When working with Codex, read in this order:

1. `AGENTS.md` (this file)
2. `AI_COMMON_RULES.md`
3. `docs/handoff/CURRENT.md`
4. `PROJECT_CONTEXT.md`
5. Relevant handoffs/decisions/incidents and `.kiro/specs/<feature>/...`
6. `README.md`, `ROADMAP.md` for onboarding and dated plans

During the Web GPT / CoS handoff, follow `CURRENT.md` to the relevant evidence. `WEB_GPT_HANDOFF.md` is historical context, not the live operational entry.

## 3. Codex-Specific Rules

- Default conversation language: Korean (unless user requests English).
- Codex CLI performs repo-local search, implementation, verification, diff and documentation within the bounded user-authorized scope; follow `AI_COMMON_RULES.md` for approval and mutation ownership.
- For rule conflicts after startup, follow `AI_COMMON_RULES.md` for shared behavior.

## 4. Maintenance Rule

If a rule applies to both Codex and Kiro, do not duplicate it here.
Update `AI_COMMON_RULES.md` instead.
