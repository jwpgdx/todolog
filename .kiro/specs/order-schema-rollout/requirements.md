# Requirements Document: Order Schema Rollout

## Introduction

현재 Todo/Category 순서 저장 구조는 구현 실체와 UX 방향이 어긋나 있다.

- 문서상으로는 `custom / category / favorite` 순서 lane 분리가 확정되었다.
- 실제 코드/DB/서버/sync 경로는 아직 이를 반영하지 못했다.
- 특히 `TODO SCREEN > 사용자 지정`은 더 이상 날짜별 임시 순서가 아니라,
  **todo 원본의 전역 `custom order`** 로 동작해야 한다.

본 스펙의 목표는 order 관련 데이터 구조를 실제 코드에 반영하여,
SQLite / 서버 / sync / reorder write 경로가 같은 계약을 따르도록 만드는 것이다.

관련 문서:

1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `/Users/admin/Documents/github/todo/메뉴 구조.md`
4. `/Users/admin/Documents/github/todo/ORDER_SCHEMA.md`
5. `/Users/admin/Documents/github/todo/IMPLEMENTATION_ORDER.md`

## Decisions (고정 결정)

1. SQLite는 로컬 Source of Truth 이다.
2. Category 순서와 Todo 순서는 서로 다른 lane 이다.
3. Todo 순서는 `custom / category / favorite` 3개 lane 으로 분리한다.
4. `TODO SCREEN > 시간순`은 DB order를 저장하지 않는다.
5. `TODO SCREEN > 사용자 지정`은 날짜별 custom table이 아니라 `todo.order.custom`을 사용한다.
6. 반복 일정 / 기간 일정은 날짜가 바뀌어 다시 보여도 같은 todo의 `custom order`를 그대로 따른다.
7. `TODO SCREEN` 정렬 모드 선택값(`시간순 / 사용자 지정 / 카테고리별 순서`)은 로컬에 저장한다.
8. custom order도 서버까지 sync 한다.
9. sync는 문서 전체 replace 가 아니라 patch / op 단위로 처리한다.
10. 현재는 개발 중이므로 기존 계정 / 기존 일정 데이터는 초기화 예정이며, legacy order 복원은 고려하지 않는다.

## Glossary

- **custom order**: `TODO SCREEN > 사용자 지정`에서 사용하는 전역 flat 순서
- **category order**: 카테고리 내부 일정 순서
- **favorite order**: 즐겨찾기 전용 순서
- **category header order**: 카테고리 자체 순서
- **patch/op sync**: 문서 전체를 덮어쓰지 않고 변경된 필드만 서버에 반영하는 sync 방식

## Requirements

### Requirement 1: Canonical Order Lanes

**User Story:** 개발자로서, 화면마다 의미가 다른 순서가 서로 섞이지 않길 원한다.

#### Acceptance Criteria

1. THE system SHALL store category header order separately from todo orders.
2. THE system SHALL store todo custom order separately from todo category order.
3. THE system SHALL store todo favorite order separately from both custom and category order.
4. THE system SHALL NOT use a shared `todo.order.manual` field.

### Requirement 2: SQLite Schema Rollout

**User Story:** 개발자로서, 로컬 Source of Truth 인 SQLite가 최종 order 계약을 직접 반영하길 원한다.

#### Acceptance Criteria

1. THE system SHALL persist category order in `categories.order_index`.
2. THE system SHALL persist todo custom order in `todos.custom_order`.
3. THE system SHALL persist todo category order in `todos.category_order`.
4. THE system SHALL persist todo favorite order in `todos.favorite_order`.
5. `todos.favorite_order` SHALL allow `NULL` when the todo is not favorited.

### Requirement 3: Server Contract Rollout

**User Story:** 개발자로서, 서버 모델과 클라이언트 로컬 계약이 같은 의미를 공유하길 원한다.

#### Acceptance Criteria

1. THE system SHALL persist category order on the server as `category.order`.
2. THE system SHALL persist todo custom/category/favorite order on the server as:
   - `todo.order.custom`
   - `todo.order.category`
   - `todo.order.favorite`
3. The server SHALL stop relying on shared/manual order semantics for todos.

### Requirement 4: Sync Contract Rollout

**User Story:** 개발자로서, order 변경이 offline-first 환경에서도 안정적으로 동기화되길 원한다.

#### Acceptance Criteria

1. THE system SHALL sync `custom_order`, `category_order`, and `favorite_order` as patch/op updates.
2. THE system SHALL NOT require document-level replace to persist order changes.
3. WHEN moving a todo to another category, THEN `categoryId` and `category_order` SHALL be synced as one logical operation.

### Requirement 5: Reorder Write Semantics

**User Story:** 사용자로서, 화면별 reorder가 각 화면 의미에 맞는 순서만 바꾸길 원한다.

#### Acceptance Criteria

1. WHEN reordering in `TODO SCREEN > 사용자 지정`, THEN only `custom_order` SHALL change.
2. WHEN reordering in `CATEGORY SCREEN`, `TODO SCREEN > 카테고리별 순서`, or `ALL TODOS SCREEN`, THEN only `category_order` SHALL change.
3. WHEN reordering in favorite contexts, THEN only `favorite_order` SHALL change.
4. WHEN moving a todo by menu or edit form category change, THEN the todo SHALL be appended to the target category bottom.

### Requirement 6: Favorite Toggle Semantics

**User Story:** 사용자로서, 즐겨찾기 추가/해제가 다른 순서를 깨뜨리지 않길 원한다.

#### Acceptance Criteria

1. WHEN adding favorite, THEN `favorite_order` SHALL be assigned as `favorite max + STEP`.
2. WHEN removing favorite, THEN `favorite_order` SHALL become `NULL`.
3. `custom_order` and `category_order` SHALL remain unchanged when favorite state changes.

### Requirement 7: TODO Screen Sort Mode Persistence

**User Story:** 사용자로서, `TODO SCREEN`에서 마지막으로 선택한 정렬 모드가 다음 진입 시 유지되길 원한다.

#### Acceptance Criteria

1. THE system SHALL persist the last selected sort mode locally.
2. THE system SHALL restore the stored sort mode on next `TODO SCREEN` entry.
3. The persisted sort mode SHALL support:
   - `시간순`
   - `사용자 지정`
   - `카테고리별 순서`

## Scope

### In Scope

1. SQLite 컬럼 추가 및 로컬 order 저장 계약 반영
2. 서버 Todo/Category order 계약 반영
3. sync payload / patch 경로 반영
4. reorder write 경로 수정
5. `TODO SCREEN` 정렬 모드 로컬 저장

### Out of Scope

1. `NativeManagedList` iOS 인터랙션 자체 개선
2. Android `NativeManagedList` 구현
3. 즐겨찾기 UI/화면 전체 구현
4. category/favorite/todo list 최종 UI polish
