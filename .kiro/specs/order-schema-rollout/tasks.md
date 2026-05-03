# Implementation Plan: Order Schema Rollout

## Overview

본 계획은 `.kiro/specs/order-schema-rollout/requirements.md` 와
`.kiro/specs/order-schema-rollout/design.md` 를 구현 가능한 작업 단위로 분해한다.

원칙:

1. SQLite is local source of truth
2. Sync order guardrail 유지
3. UI 의미별 order lane 분리
4. 문서 전체 replace sync 금지, patch/op 유지

## Task List

- [x] 1. 스펙 Freeze
  - requirements/design/tasks 상호 링크 정리
  - must-decide 항목이 모두 문서에 반영되었는지 확인

- [x] 2. SQLite schema 확장
  - `client/src/services/db/database.js`
  - `todos.custom_order` 추가
  - `todos.category_order` 추가
  - `todos.favorite_order` 추가
  - 필요한 인덱스 추가

- [x] 3. 로컬 Todo read/write 서비스 반영
  - `client/src/services/db/todoService.js`
  - todo upsert / read DTO 에 새 order 필드 반영

- [x] 4. 서버 Todo/Category 계약 반영
  - `server/src/models/Todo.js`
  - `server/src/controllers/todoController.js`
  - 필요 시 Category read/write DTO 확인
  - `todo.order.keep` 제거 방향 반영

- [x] 5. reorder write 경로 분리
  - `client/src/hooks/queries/useReorderTodo.js`
  - custom/category/favorite reorder 경로를 의미별로 분리
  - lane별로 정확한 필드만 갱신

- [x] 6. moveCategory / edit form category change 규칙 반영
  - menu move
  - edit form category change
  - target category 맨 아래 append 로 통일

- [x] 7. favorite toggle order 반영
  - favorite 추가 시 `favorite max + STEP`
  - favorite 해제 시 `favorite_order = null`
  - custom/category 유지

- [ ] 8. TODO SCREEN 정렬 모드 로컬 저장
  - 저장 key 추가
  - 초기 복원 처리

- [x] 9. sync payload / patch 반영
  - custom/category/favorite order 변경 patch 정리
  - category move payload 정리

- [x] 10. 문서 구현 반영
  - `PROJECT_CONTEXT.md`
  - 필요 시 `ORDER_SCHEMA.md`
  - 필요 시 `IMPLEMENTATION_ORDER.md`

- [ ] 11. 최소 검증
  - [x] SQLite 컬럼 생성 확인
  - [x] 신규 todo create order 확인
  - [ ] custom reorder 확인
  - [x] category move / category order 확인
  - [ ] favorite toggle 확인
  - [ ] sort mode restore 확인

## Checkpoints

- [x] Checkpoint A: Schema Ready
  - Tasks 2~4 완료
  - SQLite / server 계약이 새 order lane 구조를 반영

- [x] Checkpoint B: Write Path Ready
  - Tasks 5~9 완료
  - custom/category/favorite reorder와 moveCategory가 새 계약으로 동작

- [ ] Checkpoint C: Validation
  - Task 11 완료
  - 최소 검증 PASS

## Validation Scenarios

1. 새 todo 생성 시:
   - `custom_order`
   - `category_order`
   - `favorite_order`
   값이 기대대로 들어가는지 확인
2. `TODO SCREEN > 사용자 지정` reorder 시 `custom_order`만 변경되는지 확인
3. `CATEGORY SCREEN` reorder 시 `category_order`만 변경되는지 확인
4. `ALL TODOS SCREEN`에서 category move 시 `categoryId + category_order`가 함께 바뀌는지 확인
5. favorite 추가 시 `favorite_order`가 append 되는지 확인
6. favorite 해제 시 `favorite_order = null` 이고 나머지 order는 유지되는지 확인
7. `TODO SCREEN` 정렬 모드 변경 후 재진입 시 마지막 선택이 복원되는지 확인

## Requirements Traceability Matrix

- R1(Canonical order lanes): Tasks 2, 3, 4
- R2(SQLite schema): Tasks 2, 3
- R3(Server contract): Task 4
- R4(Sync contract): Tasks 5, 9
- R5(Reorder semantics): Tasks 5, 6
- R6(Favorite toggle): Task 7
- R7(Sort mode persistence): Task 8

## Out of Scope

1. `NativeManagedList` iOS UI polish
2. Android `NativeManagedList` 구현
3. `FAVORITE SCREEN` 전체 UI 완성
4. Native list interaction animation tuning
