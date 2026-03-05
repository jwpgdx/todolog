# Design Document: Inbox(System Category, `systemKey='inbox'`)

## Overview

본 설계는 `.kiro/specs/inbox-system-category/requirements.md`의 요구사항을 구현하기 위한 서버/클라(SQLite)/동기화/UI 설계를 정의한다.

핵심 목표:

1. Inbox를 **`systemKey='inbox'`** 로 안정적으로 식별한다.
2. 온라인 계정에서 **서버 seed/ensure**로 Inbox 1개를 보장한다.
3. 클라 SQLite에 `system_key`를 저장하고, UI에서 Inbox를 **잠금 + 상단 고정**한다.
4. Todo의 `categoryId` 필수 구조를 유지한다.

## Current State (AS-IS)

### 1) Category 생성/동기화 구조

- 유저가 만드는 카테고리는 클라에서 UUID 생성 → SQLite 저장 → 온라인이면 서버 POST, 실패/오프라인이면 pending 저장 → 이후 pendingPush로 서버 전송.
- deltaPull은 Category를 **full snapshot pull**로 내려받아 SQLite upsert한다.

### 2) Inbox seed 구조

- 회원가입/로그인/게스트 생성에서 서버가 `name: 'Inbox'`로 카테고리를 생성/보정한다.
- 현재 Category 모델에는 `systemKey`가 없다.

## Target State (TO-BE)

### 핵심 규칙

- Inbox는 “카테고리 1 row”이며, `Category.systemKey === 'inbox'`로만 식별한다.
- 일반 카테고리는 `systemKey === null`이다.
- Todo는 항상 `categoryId`를 가진다. Inbox Todo는 inboxCategoryId를 가리킨다.

## Data Contracts

### Category DTO (server ↔ client)

필수:

- `_id: string` (UUID v4)
- `userId: string`
- `name: string`
- `color: string | null`
- `order: number` (server) / `order_index: number` (sqlite 저장)
- `systemKey: string | null`  ← 신규
- `deletedAt: string | null` (server) / `deleted_at: string | null` (sqlite 저장)
- `createdAt: string`
- `updatedAt: string`

규칙:

- Inbox: `systemKey === 'inbox'`
- 기타: `systemKey === null`
- 서버는 클라에서 `systemKey`를 받더라도 기본적으로 무시/거부한다(사용자 임의 설정 방지).
- 참고: 클라 SQLite에는 `icon` 컬럼이 존재하지만, 현재 서버 Category 모델/API에는 `icon` 필드가 없다. 따라서 온라인 동기화로 `icon`을 보장하지 않는다. (본 스펙의 Inbox “아이콘 변경 불가”는 UI 잠금 우선)

### SQLite `categories` table

신규 컬럼:

- `system_key TEXT` (nullable)

정합성 보조:

- `UNIQUE(system_key) WHERE deleted_at IS NULL AND system_key IS NOT NULL`
  - 로컬 DB는 “현재 로그인된 유저 1명 데이터만 보관” 전제를 따른다.

## Server Design

### 1) Category 모델 변경

- `server/src/models/Category.js`에 `systemKey`(nullable string) 추가
- 인덱스:
  - 유일성: partial unique index
    - key: `{ userId: 1, systemKey: 1 }`
    - filter: `deletedAt: null` AND `systemKey != null`

### 2) Inbox seed/ensure (온라인 계정)

원칙:

- 회원가입/로그인/소셜 로그인/게스트 생성(현재 서버 기반)/게스트→정회원 전환(`convertGuest`)에서 **ensureInbox(userId)**를 멱등 호출한다.
- ensure 기준은 `systemKey:'inbox'`이며, name은 식별에 쓰지 않는다.

권장 ensure 로직(개념):

1. active inbox 조회: `{ userId, systemKey:'inbox', deletedAt:null }`
2. 없으면 생성:
   - `_id: generateId()`
   - `name: 'Inbox'`
   - `systemKey: 'inbox'`
   - `order: 0`
3. 있으면 정책 보정:
   - `order`가 0이 아니면 0으로 보정
   - `name/color`가 canonical 값(`Inbox` / `#CCCCCC`)이 아니면 보정

### 3) Category CRUD 방어

`server/src/controllers/categoryController.js`에 아래 정책을 추가한다.

- deleteCategory:
  - 대상 category가 `systemKey==='inbox'`이면 400/403으로 거부
- updateCategory:
  - 대상 category가 inbox면 `name/color/icon/order` 변경 거부  
    (현재 서버 모델에 `icon`이 없더라도, `req.body.icon`이 들어오면 거부해서 잠금 정책을 유지한다.)
  - request에 `systemKey`가 있으면 무조건 거부/무시 (일반 카테고리도 마찬가지)
- createCategory:
  - request에 `systemKey`가 있으면 거부/무시
  - Inbox는 createCategory로 만들지 않는다(온라인 seed 전용)

## Client(SQLite) Design

### 1) DB Migration

- `client/src/services/db/database.js`
  - `MIGRATION_VERSION` 증가
  - migration 함수에서:
    - `ALTER TABLE categories ADD COLUMN system_key TEXT`
    - partial unique index 생성

주의:

- 기존 데이터가 있는 상태에서도 migration은 non-destructive로 수행되어야 한다.
- (테스트 버전이라 reset 가능하지만) 기본 설계는 reset 없이도 동작하게 한다.

### 2) Category Service 변경

- `client/src/services/db/categoryService.js`
  - upsert/deserialize에 `system_key` 저장/복원 추가
  - `getAllCategories()` 정렬 결과가 Inbox first가 되도록 보장(아래 중 택1):
    1) SQL ORDER BY에 inbox 우선 정렬 규칙 추가 (권장)
    2) JS sort로 inbox를 최상단으로 올림

> [!WARNING]
> `INSERT OR REPLACE`는 full-row replacement로 동작한다. upsert SQL column list에 `system_key`를 반드시 포함해야 하며, 누락 시 기존 `system_key` 값이 null로 덮어쓰인다.

권장 정렬 규칙:

1. `system_key === 'inbox'` 우선
2. `order_index ASC`
3. `created_at ASC`

### 3) UI: CategoryManagementScreen 잠금

- Inbox row는:
  - 삭제 버튼/액션 시트 제거
  - 편집 화면 진입 차단
  - reorder(드래그) 핸들 제거 및 reorder 리스트에서 제외

> 현 단계에서는 “카테고리 목록 안에 같이 노출”하되, locked row로 표시한다.

### 4) 새 Todo 기본 카테고리

현행 로직:

- `lastUsedCategoryId`가 유효하면 우선
- 아니면 `categories[0]`

TO-BE:

- `categories[0]`가 Inbox가 되도록 정렬/고정하면, 별도 로직 변경 없이 “기본=Inbox”가 성립한다.

## Sync Integration

- Category full snapshot pull이 우선 실행되므로, 서버가 `systemKey`를 내려주기만 하면 클라 저장은 `upsertCategories()`만으로 충분하다.
- 현행 서버 `getCategories`는 `deletedAt: null` 조건(active only)으로 반환한다.  
  - 삭제 전파는 “deleted row를 pull”하는 방식이 아니라, (full snapshot 단계에서) **serverIds diff → 로컬 soft delete**로 처리한다(현행 유지).
- 서버 `getCategories` 정렬은 현행(`order`, `createdAt`)을 유지한다. Inbox-first 정렬은 클라에서만 수행한다.
- pendingPush의 category create/update/delete는 기존대로 동작한다.
- Inbox는 online 계정에서는 “seed 전용”이므로 pendingPush로 생성하지 않는다.

## Validation Plan (Manual)

필수 시나리오:

1. 신규 회원가입 → categories pull 이후 Inbox 존재(`systemKey='inbox'`) + 목록 최상단 고정
2. 카테고리 관리에서 Inbox 삭제/이름 변경/정렬 시도 → UI 차단 + 서버도 차단
3. 일반 카테고리 생성(오프라인/온라인) → UUID 생성/SQLite 저장/서버 동기화 정상
4. Todo 생성 시 category 선택 기본값이 Inbox로 동작(최초 1회 기준)
5. 일반 카테고리 삭제 → tombstone cascade 유지, Inbox는 영향 없음
6. createCategory/updateCategory API로 `systemKey='inbox'` 주입 시도 → 거부/무시 확인
7. convertGuest(게스트→정회원 전환) 후 Inbox에 `systemKey='inbox'` 보정 확인

## Rollout / Risk Notes

1. 레거시 데이터 보정은 스코프 제외(테스트 버전). 필요 시 서버 DB 초기화 후 재가입으로 정합성 확보.
2. 서버/클라 버전 불일치 시 `systemKey` 누락이 발생할 수 있으므로, 테스트는 동일 브랜치/동일 버전으로 수행한다.
3. SQLite partial unique index(`system_key`)는 “로컬 DB는 현재 로그인된 유저 1명 데이터만 보관” 전제를 따른다. 로그아웃 시 데이터를 삭제/교체하지 않으면 유저 간 unique 충돌이 발생할 수 있다.
