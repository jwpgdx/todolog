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
- **Database:** SQLite (expo-sqlite) - Local storage for todos, completions, categories
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

## Recently Completed (2026-02-03)
- **UUID Migration (Phase 6)**: tempId → UUID v4 완전 전환
  - 클라이언트: expo-crypto 기반 UUID 생성
  - 서버: 모든 Model String _id로 전환
  - Offline-First: Category hooks 오프라인 지원 추가
  - tempId 매핑 로직 완전 제거
  - pending_changes 스키마: todo_id → entity_id

- **SQLite Migration (Phase 5)**: AsyncStorage → SQLite 전환 완료
  - 성능: 앱 시작 15배, Completion 토글 160배, 메모리 10배 감소
  - 모든 CRUD hooks SQLite 기반으로 전환
  - WASM 콜드 스타트 해결 (워밍업 로직)
  
- **UltimateCalendar**: Infinite scroll + dynamic events implementation
- **Performance**: <10ms event calculation, 90%+ cache hit rate
- **Cache Optimization**: range: 12 (±12주), maxCacheSize: 60주

## Key Architecture Patterns
1. **ID Generation**: UUID v4 (클라이언트에서 생성)
   - 클라이언트: `expo-crypto.randomUUID()`
   - 서버: `crypto.randomUUID()` (fallback)
   - Completion ID: `todoId_date` 형식
2. **Data Storage**: SQLite as Source of Truth
   - Todos, Completions, Categories, Pending Changes all in SQLite
   - Settings remain in AsyncStorage (intentional)
3. **Pending Change Types**: 
   - Category: `createCategory`, `updateCategory`, `deleteCategory`
   - Todo: `createTodo`, `updateTodo`, `deleteTodo` (legacy: `create`, `update`, `delete`)
   - Completion: `createCompletion`, `deleteCompletion`
4. **Sync Order**: Category → Todo → Completion (의존성 순서)
5. **Cache Strategy**: Single-source cache (`['todos', 'all']`) with on-demand filtering

## Key Files (UUID Migration)
- `client/src/utils/idGenerator.js` - UUID 생성 유틸리티
- `client/src/db/pendingService.js` - entity_id 기반, 새 타입들
- `client/src/hooks/queries/useCreate*.js` - UUID 생성, 오프라인 지원
- `server/src/models/*.js` - 모두 String _id로 전환
- `server/src/controllers/*.js` - 클라이언트 _id 수용

## Important Documentation
- **README.md**: Architecture overview, UUID strategy, performance
- **UUID_MIGRATION_PLAN.md**: 마이그레이션 계획서 (완료됨)
- **client/docs/ROADMAP.md**: Next tasks and priorities

## Next Session Start Guide
When starting a new session:
1. **ROADMAP.md** for next tasks (UUID 테스트 필요)
2. **UUID 테스트**: 회원가입 → Todo 생성 → 오프라인 동기화
3. **서버 실행 후 테스트**: MongoDB 초기화 → 서버 시작 → 앱 테스트

## Debug & Testing
- **Database Reset**: 클라이언트 SQLite + MongoDB 컬렉션 drop
- **Manual Tests**: `client/src/test/TestDashboard.js`
- **Next Task**: UUID 기반 CRUD 전체 테스트