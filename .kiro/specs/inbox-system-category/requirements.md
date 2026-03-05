# Requirements Document: Inbox(System Category, `systemKey='inbox'`)

## Introduction

본 문서는 “Inbox”를 **시스템 카테고리(system category)**로 정의하고, `Category.systemKey === 'inbox'` 방식으로 식별/잠금/시드/동기화되는 요구사항을 규정한다.

관련 문서:

1. `.kiro/specs/inbox-system-category/systemKey-inbox-pre-spec.md` (적용 전 사실/제약 검증 메모)
2. `AI_COMMON_RULES.md` (Offline-first, SQLite SOT, UUID v4 등 공통 가드레일)
3. `PROJECT_CONTEXT.md` (현재 구현/동작 SOT)

## Decisions (고정 결정)

1. Inbox는 **카테고리로 취급**한다. (별도 엔티티/별도 테이블로 분리하지 않는다)
2. Inbox 식별은 **`Category.systemKey === 'inbox'`** 로 한다.
3. Todo는 계속 **`categoryId`(string) 필수**를 유지한다. (Inbox도 일반 카테고리처럼 categoryId를 가진다)
4. Seed 전략:
   - 온라인 계정(회원가입/로그인/소셜): **서버가 Inbox를 생성/보정**
   - 게스트(향후 local-only): **클라(SQLite)가 Inbox를 생성** (서버 미의존)
5. Inbox 잠금 정책:
   - 이름/색상/아이콘 변경 불가  
     - 참고: 현재 서버 Category 모델/API에는 `icon` 필드가 없어서 온라인 동기화로 icon을 보장하지 않는다. (본 스펙에서는 UI 잠금을 우선하고, 서버 enforcement는 icon 계약 도입 시점에 추가)
   - 삭제 불가
   - 순서(order) 변경 불가 (항상 고정 위치)
6. 카테고리 삭제 시 Todo 처리 정책: **현행 tombstone cascade 유지** (휴지통은 추후)
7. 레거시 데이터 보정/백필은 본 스펙 범위 밖(테스트 버전 전제: 데이터 초기화 가능)

## Glossary

- **System Category**: 유저 생성이 아니라 시스템이 보장하는 카테고리 (예: Inbox)
- **`systemKey`**: 시스템 카테고리 식별용 nullable string 필드. (Inbox는 `'inbox'`)
- **Active Category**: `deletedAt/deleted_at IS NULL` 인 카테고리
- **Locked Row**: UI에서 편집/삭제/정렬 액션이 제거된 항목
- **Seed/Ensure**: “없으면 생성하고, 있으면 정책을 만족하도록 보정”하는 멱등 동작
- **Tombstone Cascade**: 카테고리 삭제 시 해당 카테고리에 속한 Todo/Completion을 soft-delete로 함께 삭제 처리

## Requirements

### Requirement 1: `Category.systemKey` 계약

**User Story:** 개발자로서, Inbox를 “이름”이 아니라 **안정적인 키**로 식별하고 싶다.

#### Acceptance Criteria

1. THE system SHALL add `systemKey: string | null` to Category contract (server ↔ client).
2. THE system SHALL treat Inbox as `systemKey === 'inbox'`.
3. THE system SHALL treat non-system categories as `systemKey === null` (or missing → null로 간주).
4. THE system SHALL prevent user-driven mutation of `systemKey`.

### Requirement 2: Inbox 유일성(정합성)

**User Story:** 사용자로서, 내 계정에 Inbox가 중복 생성되거나 사라지지 않길 원한다.

#### Acceptance Criteria

1. THE system SHALL guarantee “활성 Inbox”는 유저당 정확히 1개여야 한다.
2. THE system SHALL enforce this invariant at the server layer (DB/index + controller 방어).
3. THE client SQLite SHALL store `systemKey` and SHALL not allow multiple active categories with the same non-null `systemKey`.

### Requirement 3: 온라인 계정 Seed/Ensure

**User Story:** 사용자로서, 회원가입/로그인 후 항상 Inbox가 존재하길 원한다.

#### Acceptance Criteria

1. WHEN a user registers/logs in via online flows, THEN the server SHALL ensure Inbox exists (idempotent).
2. WHEN Inbox exists but violates lock/order policy, THEN the server SHALL correct it (idempotent).
3. THE client SHALL obtain the seeded Inbox via sync category full pull and persist into SQLite.

### Requirement 4: 게스트(local-only) Seed (향후)

**User Story:** 사용자로서, 서버 없이도(게스트 local-only) Inbox가 항상 존재하길 원한다.

#### Acceptance Criteria

1. WHEN the app runs in guest local-only mode, THEN the client SHALL seed Inbox directly into SQLite.
2. Guest local-only mode SHALL NOT require server category creation APIs.

> 메모: 본 스펙은 “방향/정책”만 정의한다. guest local-only 전환 구현은 별도 스펙(guest-login-rework)에서 다룬다.

### Requirement 5: Inbox 잠금 정책(서버/클라 일치)

**User Story:** 사용자로서, Inbox는 실수로 삭제/변경되지 않는 “기본 수집함”으로 동작하길 원한다.

#### Acceptance Criteria

1. THE server SHALL reject delete requests targeting Inbox.
2. THE server SHALL reject update requests that attempt to change Inbox `name/color/icon/order` (가능한 범위 내).  
   (참고: `icon`은 현재 서버 저장 필드가 아니므로, 구현 단계에서는 `req.body.icon`이 들어오면 거부하는 방식으로 잠금 정책을 유지한다.)
3. THE client UI SHALL render Inbox as locked row (edit/delete/reorder actions removed).
4. THE client UI SHALL keep Inbox in a fixed position (top).

### Requirement 6: 카테고리 순서/정렬 규칙

**User Story:** 사용자로서, Inbox가 항상 가장 위에 있어 빠르게 접근하고 싶다.

#### Acceptance Criteria

1. THE system SHALL keep Inbox order fixed (highest priority in sorting).
2. THE client SHALL sort categories so that Inbox is first, then by `order`/`order_index`, then by `createdAt`.
3. Server-side order updates SHALL NOT move Inbox.

### Requirement 7: Todo의 `categoryId` 필수 유지

**User Story:** 개발자로서, 기존 Todo/Completion/집계 로직을 깨지 않고 Inbox를 도입하고 싶다.

#### Acceptance Criteria

1. THE system SHALL keep `Todo.categoryId` required (server + client domain).
2. Inbox Todo SHALL be represented as `todo.categoryId === inboxCategoryId`.
3. WHEN creating a new Todo and no last-used category is available, THEN default selection SHALL resolve to Inbox (by ordering or explicit rule).

### Requirement 8: 카테고리 삭제 정책(현행 유지)

**User Story:** 개발자로서, 기존 카테고리 삭제 정책을 바꾸지 않고 Inbox만 보호하고 싶다.

#### Acceptance Criteria

1. For non-Inbox categories, deleteCategory SHALL continue tombstone cascade to Todos/Completions.
2. The “마지막 카테고리 삭제 불가” 정책 SHALL remain true.
3. Inbox SHALL never be deletable (even if it is the last active category).

### Requirement 9: SQLite 마이그레이션 및 동기화

**User Story:** 개발자로서, `systemKey`를 안전하게 저장/동기화하고 싶다.

#### Acceptance Criteria

1. THE client SQLite schema SHALL add `categories.system_key TEXT` with migration (no destructive reset required).
2. Category upsert/deserialization SHALL preserve `systemKey` end-to-end.
3. Category full snapshot pull SHALL correctly populate/refresh `systemKey` for Inbox.

### Requirement 10: 검증(Validation) & 관측성

**User Story:** 개발자로서, 구현 후 “Inbox가 1개/잠금/정렬/동기화”가 제대로 되는지 빠르게 검증하고 싶다.

#### Acceptance Criteria

1. THE system SHALL define manual validation scenarios (signup/login, create todo, reorder, delete attempts).
2. THE system SHALL log/inspect enough evidence to diagnose failures (server logs + client logs).

## Scope

### In Scope

1. Category에 `systemKey` 추가 및 Inbox(systemKey='inbox') 도입
2. 온라인 계정 seed/ensure 정책 및 방어 로직
3. SQLite 마이그레이션 + sync category full pull 연동
4. CategoryManagementScreen에서 Inbox 잠금/고정 위치

### Out of Scope

1. guest local-only 전환 구현(별도 스펙)
2. 휴지통(Trash) 기능 및 복구 UX
3. Inbox 전용 화면(독립 메뉴) 구현
4. 태그(Tag) / 즐겨찾기(Favorites) 시스템 스키마
