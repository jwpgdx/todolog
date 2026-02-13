# Codex Entry Rules

Last Updated: 2026-02-13
Scope: Codex IDE startup instructions only.

## 1. Purpose

This file is the Codex entry document.
It must stay thin and contain only Codex-specific startup behavior.

Shared rules are defined in:

- `AI_COMMON_RULES.md`

## 2. Codex Startup Order

When working with Codex, read in this order:

1. `AGENTS.md` (this file)
2. `AI_COMMON_RULES.md`
3. `PROJECT_CONTEXT.md`
4. `README.md`
5. `ROADMAP.md`
6. Relevant `.kiro/specs/<feature>/...`

## 3. Codex-Specific Rules

- Default conversation language: Korean (unless user requests English).
- Before substantial edits: restate scope, provide short plan, and get explicit user approval.
- For rule conflicts after startup, follow `AI_COMMON_RULES.md` for shared behavior.

## 4. Maintenance Rule

If a rule applies to both Codex and Kiro, do not duplicate it here.
Update `AI_COMMON_RULES.md` instead.
