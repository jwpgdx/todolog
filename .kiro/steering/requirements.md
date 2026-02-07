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
- 
**Language:**
 ALWAYS respond in Korean (한글) unless the user explicitly requests English. Code comments, variable names, and technical documentation should remain in English, but all explanations, summaries, and conversations must be in Korean.
- 
**Code Modification Protocol:**
 ALWAYS ask for user confirmation before modifying code. Even if the user asks a question that implies a fix is needed, explain the issue and proposed solution first, then wait for explicit approval before making changes.


# DEVELOPMENT METHODOLOGY 🔴 CRITICAL

## Spec-Driven Development (MANDATORY)

**모든 새로운 기능 개발 및 주요 수정 작업은 반드시 Spec-Driven Development 방법론을 따라야 합니다.**

### Workflow

1. **Requirements Phase** (`.kiro/specs/{feature-name}/requirements.md`)
   - User Stories 작성
   - Acceptance Criteria 정의
   - Glossary 작성
   - 사용자 검토 및 승인 필수

2. **Design Phase** (`.kiro/specs/{feature-name}/design.md`)
   - Architecture Overview (Mermaid 다이어그램)
   - Components & Interfaces 설계
   - API Design (Request/Response 명세)
   - Data Models (SQLite, MongoDB 스키마)
   - Error Handling 전략
   - **Correctness Properties** (Property-Based Testing용)
   - Testing Strategy (Unit + Property Tests)
   - 사용자 검토 및 승인 필수

3. **Tasks Phase** (`.kiro/specs/{feature-name}/tasks.md`)
   - 구현 태스크 분해 (의존성 순서 고려)
   - 각 태스크에 Requirements 매핑
   - Property-Based Tests 포함
   - Checkpoint 태스크로 점진적 검증
   - 사용자 검토 및 승인 필수

4. **Implementation Phase**
   - Tasks.md의 태스크를 순서대로 실행
   - "Run All Tasks" 버튼으로 자동 실행 가능
   - 각 태스크 완료 후 체크박스 업데이트
   - Checkpoint에서 중간 검증

### When to Use Spec-Driven Development

**MUST USE (필수)**:
- 새로운 기능 개발
- 주요 아키텍처 변경
- 데이터 모델 변경
- API 엔드포인트 추가/수정
- 복잡한 비즈니스 로직 구현

**CAN SKIP (선택)**:
- 단순 버그 수정 (1-2 파일)
- UI 스타일 조정
- 로그 추가
- 문서 업데이트

### Benefits

✅ **명확한 요구사항**: 구현 전 요구사항 합의
✅ **체계적인 설계**: 아키텍처 사전 검증
✅ **점진적 구현**: 태스크 단위로 안전하게 진행
✅ **각 단계 검토**: 사용자 승인 후 다음 단계
✅ **정확성 보장**: Property-Based Testing
✅ **추적 가능성**: Requirements ↔ Design ↔ Tasks 매핑

### Example

```bash
# 1. Spec 생성 요청
"게스트 데이터 마이그레이션 기능을 만들고 싶어"

# 2. Agent가 자동으로 생성
.kiro/specs/guest-data-migration/
  ├── requirements.md  (9개 요구사항)
  ├── design.md        (아키텍처, API, 12개 Properties)
  └── tasks.md         (14개 구현 태스크)

# 3. 각 단계마다 사용자 승인
Requirements 검토 → Design 검토 → Tasks 검토

# 4. 구현 시작
"Run All Tasks" 버튼 클릭 또는 개별 태스크 실행
```

### Command

새로운 기능 개발 시:
```
"[기능명] 스펙을 만들어줘"
또는
"[기능명] 기능을 Spec-Driven으로 개발하고 싶어"
```


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

### 1. **Offline-First Architecture** 🔴 CRITICAL
   - **All features MUST work offline first**
   - Client generates data locally (SQLite) → Sync to server when online
   - Server is optional: App fully functional without network
   - Sync is background process, never blocks UI
   - Guest mode: No server account required

### 2. **ID Generation**: UUID v4 (클라이언트에서 생성)
   - 클라이언트: `expo-crypto.randomUUID()`
   - 서버: `crypto.randomUUID()` (fallback)
   - Completion ID: `todoId_date` 형식
   - Guest ID: `guest_${UUID}` 형식

### 3. **Data Storage**: SQLite as Source of Truth
   - Todos, Completions, Categories, Pending Changes all in SQLite
   - Settings remain in AsyncStorage (intentional)
   - Local data persists even without server account

### 4. **Pending Change Types**: 
   - Category: `createCategory`, `updateCategory`, `deleteCategory`
   - Todo: `createTodo`, `updateTodo`, `deleteTodo` (legacy: `create`, `update`, `delete`)
   - Completion: `createCompletion`, `deleteCompletion`

### 5. **Sync Order**: Category → Todo → Completion (의존성 순서)
   - Only syncs when user has server account (not guest)
   - Pending changes queued in SQLite until online

### 6. **Cache Strategy**: Single-source cache (`['todos', 'all']`) with on-demand filtering

### 7. **Cache Invalidation**: Optimistic Updates only - no redundant invalidation on success

## Key Files Reference
- **ID Generation**: `client/src/utils/idGenerator.js` - UUID 생성 유틸리티
- **Database Layer**: `client/src/db/*.js` - SQLite services (todo, completion, category, pending)
- **Query Hooks**: `client/src/hooks/queries/*.js` - React Query hooks with offline support
- **Server Models**: `server/src/models/*.js` - MongoDB models (String _id)
- **Server Controllers**: `server/src/controllers/*.js` - REST API endpoints
- **Documentation**: See "Key Files Reference" section below for full list

## Important Documentation
- **README.md**: Architecture overview, performance (this file)
- **UUID_MIGRATION_PLAN.md**: UUID 마이그레이션 계획서 (완료)
- **CACHE_INVALIDATION_ANALYSIS.md**: 캐시 무효화 최적화 분석
- **client/docs/ROADMAP.md**: Next tasks and priorities
- **client/docs/OPTIMISTIC_UPDATE_COMPLETED.md**: Optimistic Update 구현
- **.kiro/steering/requirements.md**: Development guidelines and tech stack

## Next Session Start Guide
When starting a new session:
1. Check **client/docs/ROADMAP.md** for next tasks
2. Review recent updates in this README (Recent Updates & Optimizations section)
3. For testing: MongoDB 초기화 → 서버 시작 → 앱 테스트

## Debug & Testing
- **Database Reset**: 클라이언트 SQLite (앱 데이터 삭제) + MongoDB 컬렉션 drop
- **Manual Tests**: `client/src/test/TestDashboard.js`