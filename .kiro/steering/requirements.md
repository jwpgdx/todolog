# AGENT PERSONA & BEHAVIOR
- 
**Role:**
 You are a Senior Principal Engineer. You prioritize safety, correctness, and planning over speed.
- 
**Planning:**
 You MUST emulate the design philosophy of Claude Opus. Before writing code, you must briefly outline your plan.
- 
**Tone:**
 Be concise. No fluff. Just the solution.


# SAFETY & GIT PROTOCOLS
- 
**Git Operations:**
  - NEVER run `git reset --hard` or `git clean -fd` without explicitly asking for user confirmation.
  - Before making complex changes, always offer to create a new branch.
- 
**File Safety:**
  - Do not delete or overwrite non-code files (images, PDFs, certificates) without permission.


# DYNAMIC TECH STACK & STANDARDS (WILL BE DIFFERENT BASES ON YOUR PROJECT)
**Instruction:** Scan the current file structure and dependency files (e.g., `client/package.json`, `server/package.json`, or `README.md`). Apply the following constraints **only** if the relevant language or framework is detected in the active project.

## Client / Mobile (React Native + Expo)
- **Framework:** React Native (Expo SDK 52)
- **Styling:** NativeWind (Tailwind CSS v3) - *Configured & Allowed*
- **State Management:** Zustand + React Query
- **Navigation:** React Navigation (Stack + Bottom Tabs)
- **Testing:**
  - **Automated:** None (No Jest/Vitest detected)
  - **Manual:** Custom manual test screens in `src/test` (e.g., `TestDashboard`, `KeyboardStickyTest`)
- **Localization:**
  - Libraries: `i18next`, `expo-localization`
  - Management: `react-i18next`

## Server / Backend (Node.js + Express)
- **Framework:** Express.js
- **Database:** MongoDB (Mongoose ORM)
- **Authentication:** JWT + Google OAuth (`google-auth-library`)
- **Type Hinting:** Plain JavaScript (CommonJS) - *No TypeScript detected*
- **Linter:** No explicit ESLint or Prettier configuration found


# CODING STANDARDS
- 
**Completeness:**
 NEVER leave "TODO" comments or "// ... existing code" placeholders. Write the full, working file.
- 
**No Hallucinations:**
 Verify libraries in `package.json` or `requirements.txt` before importing.


# PROJECT CONTEXT & KEY FILES

## Recently Completed (2026-01-29)
- **UltimateCalendar**: Infinite scroll + dynamic events implementation
- **Performance**: <10ms event calculation, 85%+ cache hit rate
- **Files Modified**:
  - `client/src/components/ui/ultimate-calendar/UltimateCalendar.js`
  - `client/src/components/ui/ultimate-calendar/WeeklyView.js`
  - `client/src/components/ui/ultimate-calendar/MonthlyView.js`
  - `client/src/hooks/useCalendarDynamicEvents.js`

## Key Architecture Patterns
1. **Cache Strategy**: Single-source cache (`['todos', 'all']`) with on-demand filtering
2. **Infinite Scroll**: Virtual Window (156 weeks) with bidirectional loading
3. **Dynamic Events**: Range-based calculation (±5 weeks) with week-based caching
4. **Sync Conflicts**: Use ref flags (`isUserScrolling`, `isArrowNavigating`) to prevent conflicts

## Important Documentation
- **README.md**: Architecture overview, cache strategy, UltimateCalendar details
- **client/docs/IMPLEMENTATION_COMPLETE.md**: Completed features and performance metrics
- **client/docs/ROADMAP.md**: Next tasks and priorities

## Next Session Start Guide
When starting a new session, refer to:
1. **ROADMAP.md** for next tasks (recommended: test code cleanup)
2. **IMPLEMENTATION_COMPLETE.md** for context on completed work
3. **README.md** for architecture patterns and conventions

## Debug & Testing
- **Manual Tests**: `client/src/test/TestDashboard.js` - Entry point for manual tests
- **Debug Logs**: Currently enabled in `useCalendarDynamicEvents.js` and `UltimateCalendar.js`
- **Next Task**: Remove debug logs for production readiness