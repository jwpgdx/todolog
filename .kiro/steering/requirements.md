# Kiro Entry Requirements

Last Updated: 2026-10-02
Scope: Kiro startup instructions only.

## 1. Purpose

This file is the Kiro entry document.
It must stay thin and contain only Kiro-specific startup behavior.

Shared rules are defined in:

- `AI_COMMON_RULES.md`

## 2. Kiro Startup Order

When working with Kiro, read in this order:

1. `.kiro/steering/requirements.md` (this file)
2. `AI_COMMON_RULES.md`
3. `docs/handoff/CURRENT.md`
4. `PROJECT_CONTEXT.md`
5. Relevant handoffs/decisions/incidents and `.kiro/specs/<feature>/...`
6. `README.md`, `ROADMAP.md` for onboarding and dated plans

## 3. Kiro-Specific Rules

- Follow `AI_COMMON_RULES.md` for initial bounded authorization, continued work inside that scope, approval boundaries and mutation ownership.
- For shared policy conflicts, `AI_COMMON_RULES.md` is the source of truth.

## 4. Maintenance Rule

If a rule applies to both Codex and Kiro, do not duplicate it here.
Update `AI_COMMON_RULES.md` instead.
