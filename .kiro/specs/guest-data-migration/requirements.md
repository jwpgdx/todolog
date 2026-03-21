# Requirements Document: Guest Data Migration (All Guest Todos -> Target Inbox)

## Introduction

게스트 데이터 마이그레이션은 local-only guest 사용자가
기존 계정으로 로그인하거나 새 계정을 만든 뒤,
guest SQLite의 데이터를 대상 계정으로 **이관(move)** 하는 기능이다.

이번 결정의 핵심은 다음과 같다.

1. guest 카테고리 구조는 보존하지 않는다.
2. 가져오기 성공 시 모든 guest todo는 대상 계정의 `Inbox(systemKey='inbox')` 로 들어간다.
3. guest completion은 imported todo ids를 그대로 따라간다.

관련 문서:

1. `.kiro/specs/guest-login-rework/requirements.md`
2. `.kiro/specs/inbox-system-category/requirements.md`
3. `AI_COMMON_RULES.md`
4. `PROJECT_CONTEXT.md`

## Glossary

- **Guest_User**: 서버 비연동 local-only 익명 사용자 (`accountType='anonymous'`)
- **Regular_User**: 이메일/비밀번호 또는 소셜 로그인으로 가입한 정회원
- **Migration**: guest SQLite 데이터를 regular-user 계정으로 옮기는 프로세스
- **Target_Inbox**: 대상 regular-user 계정의 활성 Inbox category (`systemKey='inbox'`)
- **Move Semantics**: 구현은 copy 후 clear여도, 제품 계약상 guest 쪽에 데이터가 남지 않는 이동 의미

## Requirements

### Requirement 1: Migration Entry Handoff

**User Story:** 게스트 사용자로서, 로그인/회원가입 시 가져오기를 선택하면 내 로컬 데이터가 계정으로 넘어가길 원한다.

#### Acceptance Criteria

1. WHEN the user selects `가져오기` from the guest auth choice flow THEN the client SHALL initiate guest-data migration.
2. THE migration path SHALL be callable after existing-account login intent and after successful new-account registration.
3. THE handoff UI SHALL disclose that imported guest todos go to the target account Inbox and guest category structure is not preserved.

### Requirement 2: Source Data Selection

**User Story:** 개발자로서, 무엇을 서버로 보내는지 명확히 하고 싶다.

#### Acceptance Criteria

1. THE client SHALL collect active guest todos for migration using a dedicated migration export DTO, not raw local entity objects.
2. The guest todo migration DTO SHALL include `_id`, `title`, `startDate`, `endDate`, `startTime`, `endTime`, `isAllDay`, `recurrence`, `recurrenceEndDate`, `memo`, `createdAt`, and `updatedAt`.
3. The guest todo migration DTO SHALL NOT include legacy `date` or joined category objects.
4. THE client SHALL collect active guest completions for migration.
5. The guest completion migration DTO SHALL include `_id`, `key`, `todoId`, `date`, and `completedAt`.
6. Guest categories MAY be inspected locally for detection/count/cleanup, but SHALL NOT be sent as migration materialization payload and SHALL NOT be recreated as target-account categories during migration.
7. Deleted/tombstoned guest rows SHALL NOT be included as migratable active data.
8. A seeded guest Inbox by itself SHALL NOT count as migratable guest data that triggers the import choice flow.

### Requirement 3: Target Inbox Resolution

**User Story:** 사용자로서, 가져온 일정이 계정의 기본 Inbox에 들어가길 원한다.

#### Acceptance Criteria

1. WHEN migration starts THEN the server SHALL resolve the target Regular_User's active Inbox by `systemKey='inbox'`.
2. THE server SHALL NOT create a temporary migrated category.
3. THE server SHALL NOT recreate guest categories on the target account.
4. In this phase, target Regular_User active Inbox existence is treated as a normal-auth invariant and not as a separate repair branch inside migration.

### Requirement 4: Todo / Completion Import Contract

**User Story:** 시스템 관리자로서, guest 데이터가 단순하고 예측 가능하게 계정으로 들어가길 원한다.

#### Acceptance Criteria

1. THE server SHALL insert all migrated guest todos under the target Regular_User's ownership.
2. THE server SHALL set `categoryId` of every imported guest todo to the resolved target Inbox category id, regardless of the guest todo’s original category.
3. THE server SHALL insert all migrated guest completions under the target Regular_User's ownership.
4. Imported completions SHALL continue to reference the imported todo ids.
5. In this phase, imported todo/completion `_id` values SHALL preserve the client-provided ids used by current local contracts.
6. The server SHALL validate guest todo payloads against the canonical migration DTO field set and SHALL reject legacy `date`-based payloads.

### Requirement 5: Transaction and Move Semantics

**User Story:** 사용자로서, 가져오기 중 오류가 나면 guest 데이터가 사라지지 않길 원한다.

#### Acceptance Criteria

1. WHEN migration starts THEN the server SHALL process the import transactionally.
2. IF any migration step fails THEN the server SHALL rollback all imported server-side data.
3. THE client SHALL clear guest SQLite only after confirmed server success.
4. IF migration fails THEN guest local session and SQLite data SHALL remain intact.

### Requirement 6: Post-Success Client State

**User Story:** 사용자로서, 가져오기 성공 후 바로 계정 데이터로 이어서 사용하고 싶다.

#### Acceptance Criteria

1. WHEN migration succeeds THEN the client SHALL clear guest local SQLite data including guest categories.
2. WHEN guest local SQLite is cleared THEN the client SHALL persist the authenticated Regular_User session.
3. WHEN the authenticated session is persisted THEN the client SHALL trigger a full sync from the server.
4. WHEN full sync completes THEN the client SHALL invalidate relevant caches and navigate to the normal signed-in home flow.
5. In the signup `가져오기` path, the authenticated Regular_User session SHALL NOT become the active client session until migration success is confirmed.

### Requirement 7: Discard and Failure Boundary

**User Story:** 사용자로서, 가져오지 않거나 실패했을 때 동작이 예측 가능하길 원한다.

#### Acceptance Criteria

1. WHEN the user selects `버리기` THEN the client SHALL clear guest local SQLite data before proceeding with normal auth.
2. WHEN the user selects `취소` THEN the auth attempt SHALL abort and guest local state SHALL remain unchanged.
3. IF migration fails due to network or server error THEN the system SHALL present a retryable error and keep guest local data intact.
4. IF signup succeeds but migration fails THEN the guest session SHALL remain the active client session and retry SHALL occur through a later auth flow.

### Requirement 8: Data Integrity Validation

**User Story:** 시스템 관리자로서, 마이그레이션 후 데이터가 의도한 구조로 들어갔는지 검증하고 싶다.

#### Acceptance Criteria

1. WHEN migration completes THEN the server SHALL verify all imported todos have the target Regular_User ownership.
2. WHEN migration completes THEN the server SHALL verify all imported todos have `categoryId = targetInboxCategoryId`.
3. WHEN migration completes THEN the server SHALL verify imported guest categories were not recreated as target-account categories.
4. WHEN migration completes THEN the server SHALL verify imported completions point to imported todo ids.

## Scope

### In Scope

1. Existing-login guest migration
2. Signup-after-register guest migration
3. All guest todos -> target Inbox mapping
4. Guest category non-preservation
5. Move semantics and local clear boundary

### Out of Scope

1. Legacy server guest account cleanup
2. Preserving guest category structure on the target account
3. One-step register-and-migrate API redesign
4. Social-login specific UX variants
