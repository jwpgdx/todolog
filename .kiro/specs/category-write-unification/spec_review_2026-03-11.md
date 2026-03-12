# Spec Review: Category Write Unification (Local-first + Pending)

**Reviewer:** Codex (GPT-5.2)
**Date:** 2026-03-11
**Model:** GPT-5.2 (Codex CLI)

**Documents reviewed:**
1. `requirements.md`
2. `design.md`
3. `tasks.md`

**Reference docs:**
1. `AI_COMMON_RULES.md`
2. `PROJECT_CONTEXT.md`
3. `.kiro/specs/sync-service-pending-delta/requirements.md`
4. `.kiro/specs/inbox-system-category/requirements.md`

**Codebase cross-referenced:**
- `client/src/hooks/queries/useCategories.js`
- `client/src/hooks/queries/useCreateCategory.js`
- `client/src/hooks/queries/useUpdateCategory.js`
- `client/src/hooks/queries/useDeleteCategory.js`
- `client/src/hooks/queries/useReorderCategory.js`
- `client/src/screens/CategoryFormScreen.js`
- `client/src/components/domain/category/CategoryGroupList.js`
- `client/src/services/db/categoryService.js`
- `client/src/services/query-aggregation/candidateQueryService.js`
- `client/src/services/sync/pendingPush.js`
- `client/src/services/sync/deltaPull.js`
- `client/src/services/sync/syncErrorPolicy.js`
- `server/src/controllers/categoryController.js`

---

## 1) Findings (severity order)

### [Critical] C1. Category delete의 “tombstone cascade”가 로컬에서 즉시 반영되지 않음 (Offline-first 의미 훼손)

**증거(스펙):**
- `requirements.md` Out of Scope에 “Category 삭제 시 로컬에서 Todo/Completion까지 즉시 cascade tombstone 적용”이 제외되어 있음.

**증거(현재 구현/UX):**
- UI는 카테고리 삭제 시 “해당 카테고리의 모든 할일도 함께 삭제됩니다.”를 명시한다.  
  - `client/src/components/domain/category/CategoryGroupList.js`에서 confirm/alert 문자열
- SQLite의 카테고리 삭제는 `categories.deleted_at`만 설정한다. (관련 Todo에는 영향 없음)  
  - `client/src/services/db/categoryService.js` `deleteCategory(id)`
- Todo 조회는 `todos.deleted_at IS NULL`만 필터링하며, `categories.deleted_at`는 고려하지 않는다.  
  - `client/src/services/query-aggregation/candidateQueryService.js` (LEFT JOIN categories, category deleted 여부 필터 없음)
- 서버 deleteCategory는 Todo/Completion까지 tombstone cascade를 수행한다.  
  - `server/src/controllers/categoryController.js` (Todo updateMany + Completion updateMany)

**리스크:**
- Local-first로 전환하면 오프라인/불안정 네트워크에서 “카테고리는 사라졌는데 해당 카테고리의 Todo는 계속 보이는” 상태가 장시간 지속될 수 있다.  
- 이는 Offline-first 원칙(사용자 액션 즉시 반영)과 UI 경고 문구/서버 계약(삭제는 cascade) 모두와 충돌한다.

**수정 방향(둘 중 반드시 결정 필요):**
- **Option A (권장, Offline-first 정합):** `deleteCategory` 로컬 처리 시점에 SQLite에서
  1) category tombstone
  2) 해당 categoryId의 todos tombstone
  3) 해당 todos의 completions 삭제(또는 tombstone 전략이 없다면 hard delete)
  를 즉시 적용한다. (서버 반영은 `pending_changes: deleteCategory` 1건만 유지)
- Option B (비권장): 로컬 cascade는 하지 않되,
  - Todo 조회 경로에서 “삭제된 카테고리의 todo”를 UI에서 숨기거나,
  - 삭제 confirm 문구를 “동기화 후 삭제”로 변경하는 등 의미를 바꿔야 한다.

> 결론: 본 스펙은 “통합” 자체는 타당하지만, C1의 결정 없이는 구현 후 UX/정합성 회귀 가능성이 매우 높다.

---

### [High] H1. `api/categories.js` 사용 범위에 대한 design 문구가 현재 코드/정책과 불일치

**증거(스펙):**
- `design.md` “`client/src/api/categories.js`는 SyncService(Pending Push) 내부에서만 사용”으로 기술되어 있음.

**증거(코드):**
- Category full snapshot pull은 Delta Pull에서 `getCategories`를 사용한다.  
  - `client/src/services/sync/deltaPull.js`
- `useCategories`는 SQLite 실패 시 서버로 폴백한다.  
  - `client/src/hooks/queries/useCategories.js`

**리스크:**
- 팀원이 design을 그대로 따르면 “Delta Pull/읽기 폴백도 금지”로 오해할 수 있다.

**최소 수정:**
- design 문구를 “UI write 경로에서는 금지, Sync layer(pendingPush + deltaPull) 및 read fallback에서는 허용”으로 정정.

---

### [Medium] M1. “UI에서 직접 API 호출 금지” 검증 절차가 tasks에 명시되어 있지 않음

**증거:**
- `tasks.md`는 파일별 전환을 나열하지만, 누락된 direct call 탐지(검색/검증) 스텝이 없다.
- 현재도 `CategoryGroupList`에 direct call이 존재한다.  
  - `client/src/components/domain/category/CategoryGroupList.js` (`deleteCategoryApi`)

**리스크:**
- 마이그레이션 누락으로 direct call이 남으면 통합 목표가 깨진다.

**최소 수정:**
- tasks에 “`rg api/categories` / `rg createCategory\\(|updateCategory\\(|deleteCategory\\(` 등 검색으로 write direct call 잔존 여부 확인”을 추가.

---

## 2) Open Questions (must-decide)

### OQ-1. Category delete의 로컬 tombstone cascade를 이번 스펙 범위에 포함할 것인가?

- 포함(권장): Offline-first 의미/UX/서버 계약에 가장 잘 부합.
- 제외: “삭제”의 의미가 화면마다 달라지고, 오프라인에서 사용자 액션이 즉시 반영되지 않을 수 있음.

> 결론: OQ-1 결론 없이는 스펙 Freeze 불가(최소 C1을 must-fix로 처리 필요).

---

## 3) Triage

- **must-fix**
  - C1 (OQ-1 결정 + 스펙/태스크 반영)
  - H1 (design 문구 정정)
- **optional**
  - M1 (tasks에 검색/검증 스텝 추가)

---

## 4) Patch Proposal (copy-pastable)

### Patch 1 (must-fix): `design.md` — `api/categories.js` 사용 범위 정정

```diff
--- a/.kiro/specs/category-write-unification/design.md
+++ b/.kiro/specs/category-write-unification/design.md
@@
 - - `client/src/api/categories.js`는 **SyncService(Pending Push) 내부에서만** 사용
 + - `client/src/api/categories.js`는 **UI write 경로에서는 사용 금지**
 + - Sync layer(`pendingPush`, `deltaPull`) 및 read fallback(예: SQLite 실패 시 서버 폴백)에서는 사용 가능
```

### Patch 2 (must-fix, Option A 권장): `requirements.md` — 로컬 cascade 포함으로 스코프 조정

```diff
--- a/.kiro/specs/category-write-unification/requirements.md
+++ b/.kiro/specs/category-write-unification/requirements.md
@@
 ### Requirement 2: Offline-first Non-Blocking Writes
@@
 3. WHEN deleting a category, THEN the category SHALL disappear immediately (SQLite tombstone), without waiting for server.
 +5. WHEN deleting a category, THEN related todos (and their completions) SHALL be removed from the UI immediately via local cascade (SQLite first), without waiting for server.
@@
 ### Out of Scope (본 스펙에서는 다루지 않음)
@@
 -2. Category 삭제 시 로컬에서 Todo/Completion까지 즉시 cascade tombstone 적용 — 별도 스펙으로 분리 가능
 +2. (삭제) 로컬 cascade의 범위는 본 스펙에서 다룬다. (Category -> Todo -> Completion)
```

### Patch 3 (must-fix, Option A 권장): `design.md` — 로컬 cascade 설계 추가

```diff
--- a/.kiro/specs/category-write-unification/design.md
+++ b/.kiro/specs/category-write-unification/design.md
@@
 ## Target State (TO-BE)
@@
 **공통 write flow (create/update/delete/reorder):**
@@
 5. 온라인이면 `syncAll()`을 **백그라운드**로 트리거 (절대 await 하지 않음)
+
+### 4) DeleteCategory 로컬 cascade (권장)
+
+서버 deleteCategory가 tombstone cascade(Category -> Todo -> Completion)를 수행하므로,
+클라에서도 deleteCategory local-first 처리 시점에 동일한 의미가 UI에 즉시 반영되어야 한다.
+
+- SQLite:
+  - `categories.deleted_at` tombstone
+  - `todos.deleted_at` tombstone (target: `category_id = <deletedCategoryId>`)
+  - `completions`는 tombstone 컬럼이 없으므로, 해당 todoId들의 completion rows를 삭제한다.
+- Pending:
+  - `pending_changes`에는 `deleteCategory` 1건만 enqueue 한다. (서버에서 cascade 수행)
```

### Patch 4 (optional): `tasks.md` — direct API 잔존 탐지 스텝 + delete cascade 검증 시나리오

```diff
--- a/.kiro/specs/category-write-unification/tasks.md
+++ b/.kiro/specs/category-write-unification/tasks.md
@@
 - [ ] 5. Client: CategoryGroupList에서 direct API 호출 제거
   - `client/src/components/domain/category/CategoryGroupList.js`
@@
     - 삭제 성공/실패 토스트 동작 점검 (local-first 기준)
+
+- [ ] 5.1. Direct API(write) 잔존 여부 검색/제거
+  - `rg \"from '../../api/categories'\" client/src`
+  - `rg \"api/categories\" client/src`
@@
 ## Validation Scenarios (필수)
@@
 5. (오프라인) 카테고리 삭제 → 즉시 목록에서 제거 → 온라인 복귀 후 서버 반영
+5.1 (오프라인) 카테고리 삭제 직후 해당 카테고리의 Todo가 즉시 보이지 않는지(로컬 cascade) 확인
```

---

## 5) Final Verdict

**Conditionally ready.**  
H1은 문서 정정으로 즉시 해결 가능하고, C1(OQ-1)은 반드시 결정/반영 후 구현에 들어가는 것을 권장한다.

---

## 6) Resolution Log

이 리뷰의 must-fix 항목은 “스펙 반영(문서 수정)”이 선행되어야 하므로, 구현 착수 전 스펙 업데이트로 처리한다.

- C1: **Accept (Option A)** — Category delete 로컬 cascade를 본 스펙 In Scope로 포함하고, requirements/design/tasks에 반영
- H1: **Accept** — `api/categories.js` 사용 범위를 “UI write 금지, sync/read fallback 허용”으로 design에 정정
- M1: **Accept (optional)** — direct API(write) 잔존 여부를 tasks에 검색 스텝으로 추가
