# Design Document: Category Write Unification (Local-first + Pending)

## Overview

본 문서는 `.kiro/specs/category-write-unification/requirements.md`를 구현하기 위한 클라이언트(React Native/Expo) 설계를 정의한다.

핵심 목표:

1. Category write 경로를 **단일 hook 경로로 통합**한다.
2. 모든 write는 **SQLite 즉시 반영 + pending enqueue**로 끝나며, 서버 반영은 SyncService(Pending Push)가 담당한다.
3. “온라인이면 서버 먼저/await” 같은 server-first 경로 및 UI direct API 호출을 제거한다.
4. Pending replay에서 `createCategory` 409는 **success-equivalent**로 처리해 queue dead-letter 노이즈를 방지한다.

## Current State (AS-IS)

Category write 경로가 최소 3갈래로 혼재:

1. **`useCategories.js` 내부 mutation (server-first)**
   - `client/src/hooks/queries/useCategories.js`가 `useCreateCategory/useUpdateCategory/useDeleteCategory`를 export
   - 동작: 서버 호출 성공 시 SQLite upsert, pending enqueue 없음
   - 사용처: `client/src/screens/CategoryFormScreen.js`에서 import하여 My Page Category Form에 사용

2. **별도 hook 파일(local-first + pending, but online await)**
   - `client/src/hooks/queries/useCreateCategory.js`
   - `client/src/hooks/queries/useUpdateCategory.js`
   - `client/src/hooks/queries/useDeleteCategory.js`
   - 동작: SQLite 즉시 반영 후, 온라인이면 서버 호출을 await, 실패/오프라인이면 pending enqueue
   - 사용처: `client/src/features/todo/form/useTodoFormLogic.js`에서 `useCreateCategory` 사용

3. **UI에서 직접 API 호출**
   - `client/src/components/domain/category/CategoryGroupList.js`가 `deleteCategoryApi` 직접 호출 후 SQLite 삭제

추가로 reorder는 server-first:

- `client/src/hooks/queries/useReorderCategory.js`가 `updateCategory`(API) 호출을 mutationFn으로 사용 (오프라인에서 실패 시 revert 가능)

## Target State (TO-BE)

### 1) Read/Write 분리 원칙

- `useCategories`는 **read-only query hook**만 제공한다.
- Category write는 별도 hooks로 제공하며, 모든 화면은 이를 사용한다.

### 2) Canonical Category Write Hooks

Canonical hooks (파일 유지, 내부 로직만 통일):

- `client/src/hooks/queries/useCreateCategory.js`
- `client/src/hooks/queries/useUpdateCategory.js`
- `client/src/hooks/queries/useDeleteCategory.js`
- `client/src/hooks/queries/useReorderCategory.js`

**공통 write flow (create/update/delete/reorder):**

1. `ensureDatabase()`
2. SQLite 즉시 반영 (upsert / soft delete / order_index update)
3. `addPendingChange({ type, entityId, data })` (항상 enqueue)
4. `invalidateAllScreenCaches({ queryClient, reason })`
5. 온라인이면 `syncAll()`을 **백그라운드**로 트리거 (절대 await 하지 않음)

### 3) Import/Usage 정책

- `client/src/hooks/queries/useCategories.js`에서 mutation export 제거
- `CategoryFormScreen` 등은 아래로 import 변경:
  - create: `client/src/hooks/queries/useCreateCategory.js`
  - update: `client/src/hooks/queries/useUpdateCategory.js`
  - delete: `client/src/hooks/queries/useDeleteCategory.js`
  - reorder: `client/src/hooks/queries/useReorderCategory.js`
- `client/src/api/categories.js`는 **UI write 경로에서는 사용 금지**
- Sync layer(`pendingPush`, `deltaPull`) 및 read fallback(예: SQLite 실패 시 서버 폴백)에서는 사용 가능

## Sync Integration

### Pending routing (existing)

`client/src/services/sync/pendingPush.js`는 이미 category pending type을 올바른 API로 라우팅한다:

- `createCategory` -> `apiCreateCategory(payload)`
- `updateCategory` -> `apiUpdateCategory({ id, data })`
- `deleteCategory` -> `apiDeleteCategory(id)`

### Error policy update (required)

문제:

- 서버 `createCategory`는 duplicate `_id`에 409를 반환한다.
- pending replay에서 네트워크 타임아웃 이후 재시도 시 409가 발생할 수 있고,
  현재 `syncErrorPolicy`는 4xx를 non-retryable로 분류하여 dead_letter 노이즈를 만든다.

해결:

- `client/src/services/sync/syncErrorPolicy.js`에서:
  - `pendingType === 'createCategory' && status === 409` 인 경우
    - `successEquivalent: true`
    - `reasonCode: 'category_create_conflict_success_equivalent'`
  로 분류한다.
- Pending Push는 success-equivalent를 `remove` 액션으로 처리하므로, queue 진행이 안정화된다.

## Reorder Design

### Representation

Reorder는 새로운 pending type을 추가하지 않고, 기존 `updateCategory`를 사용한다.

- SQLite: `categories.order_index`를 즉시 업데이트
- Pending: `type: 'updateCategory'`, `entityId: categoryId`, `data: { order: newOrder }`

### Why not server-first?

- Offline-first 원칙: 정렬 변경이 네트워크 상태에 의해 되돌아가면 UX가 깨진다.
- 서버 반영은 Pending Push에서 처리하면 된다.

## Validation Plan (Manual)

1. (온라인) My Page → 카테고리 생성/수정/삭제/정렬: 즉시 반영 + 동기화 후 유지
2. (오프라인) 카테고리 생성/수정/삭제/정렬: 즉시 반영 + 온라인 복귀 후 pendingPush로 서버 반영
3. (409) createCategory 요청이 타임아웃된 뒤 재시도 상황에서 409가 나와도 pending이 dead_letter로 남지 않고 제거되는지 확인
4. Todo Form에서 카테고리 생성(Quick): 동일 write hook 사용으로 즉시 반영 + sync 백그라운드 트리거

## DeleteCategory 로컬 cascade (필수)

서버 deleteCategory가 tombstone cascade(Category -> Todo -> Completion)를 수행하므로,
클라에서도 deleteCategory local-first 처리 시점에 동일한 의미가 UI에 즉시 반영되어야 한다.

### 로컬 DB 적용 규칙

- Category: `categories.deleted_at` tombstone
- Todos: target `category_id`에 대해 `todos.deleted_at` tombstone
- Completions:
  - 서버는 delta 가시성을 위해 tombstone을 쓰지만, 현재 클라 SQLite `completions`에는 `deleted_at` 컬럼이 없다.
  - 따라서 “삭제된 Todo에 속한 completion rows”는 **로컬에서는 삭제(DELETE)** 로 처리한다.

### Pending 규칙

- `pending_changes`에는 `deleteCategory` 1건만 enqueue 한다. (서버에서 cascade 수행)

## Risk Notes

1. `createCategory` 409를 success-equivalent로 처리하면, “이미 생성됨” 상황에서는 안전하지만,
   (극히 희박한 UUID collision 등) 진짜로 생성이 실패한 케이스를 숨길 가능성이 있다.
   - 완화: Delta Pull(full snapshot) 후 서버에 해당 category가 실제로 존재하는지 결국 수렴한다는 점을 활용한다.
2. Reorder를 pending으로 보내면 pending queue에 `updateCategory`가 여러 개 쌓일 수 있다(연속 reorder).
   - 본 스펙에서는 coalescing은 범위 밖(후속 최적화로 분리).
