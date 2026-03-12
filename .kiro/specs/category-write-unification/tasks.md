# Implementation Plan: Category Write Unification (Local-first + Pending)

## Overview

본 계획은 `.kiro/specs/category-write-unification/requirements.md`와 `.kiro/specs/category-write-unification/design.md`를 구현 가능한 작업 단위로 분해한다.

원칙:

1. Offline-first 가드레일 준수 (SQLite SOT, UUID v4, sync order 유지)
2. Category write는 UI에서 서버 응답을 기다리지 않는다 (pending 기반)
3. 변경 범위를 “Category write 경로 통합”에 집중한다

## Task List

- [ ] 1. 스펙 Freeze
  - requirements/design/tasks 상호 링크 정리
  - must-decide(Out of Scope 포함) 항목 합의

- [ ] 2. Client: `useCategories`를 read-only로 정리
  - `client/src/hooks/queries/useCategories.js`에서 mutation exports 제거
  - 관련 import 에러가 나지 않도록 사용처를 모두 canonical hooks로 마이그레이션

- [ ] 3. Client: Category write hooks를 “항상 pending + non-blocking”으로 통일
  - `client/src/hooks/queries/useCreateCategory.js`
  - `client/src/hooks/queries/useUpdateCategory.js`
  - `client/src/hooks/queries/useDeleteCategory.js`
  - 공통: SQLite write → `addPendingChange` 항상 enqueue → 온라인이면 `syncAll` background trigger
  - deleteCategory: 로컬에서 Category -> Todo -> Completion cascade를 즉시 반영 (서버 대기 없음)

- [ ] 4. Client: CategoryFormScreen 경로 통일
  - `client/src/screens/CategoryFormScreen.js`에서
    - create/update를 canonical hooks로 import
    - server-first 경로 제거

- [ ] 5. Client: CategoryGroupList에서 direct API 호출 제거
  - `client/src/components/domain/category/CategoryGroupList.js`
    - deleteCategoryApi 직접 호출 제거
    - canonical `useDeleteCategory` 사용으로 전환
    - 삭제 성공/실패 토스트 동작 점검 (local-first 기준)

- [ ] 5.1. Direct API(write) 잔존 여부 검색/제거
  - `rg "from '../../api/categories'" client/src`
  - `rg "api/categories" client/src`

- [ ] 6. Client: Reorder를 offline-first로 전환
  - `client/src/hooks/queries/useReorderCategory.js`
    - SQLite `order_index` 즉시 업데이트
    - pending `updateCategory` enqueue
    - 온라인이면 sync 백그라운드 트리거

- [ ] 7. Sync: `createCategory` 409 success-equivalent 처리
  - `client/src/services/sync/syncErrorPolicy.js`에 특례 추가

- [ ] 8. 문서 업데이트(구현 반영)
  - `PROJECT_CONTEXT.md`에 “Category write 통합”과 409 정책 반영
  - 필요 시 관련 spec 링크 갱신

- [ ] 9. Manual Validation (필수 시나리오)
  - 아래 Validation Scenarios 실행 후 로그/동작 확인

## Checkpoints

- [ ] Checkpoint A: Hook/API 경로 정리
  - Tasks 2~6 완료
  - 더 이상 Category write에서 UI direct API / server-first 경로가 남지 않음

- [ ] Checkpoint B: Pending replay 안정화
  - Task 7 완료
  - createCategory 409가 dead_letter로 남지 않음

- [ ] Checkpoint C: End-to-end 수동 검증
  - Task 9 완료
  - 오프라인/온라인 전환 포함 시나리오 PASS

## Validation Scenarios (필수)

1. (온라인) My Page → 카테고리 생성 → 즉시 목록 반영 + 백그라운드 sync 트리거
2. (오프라인) My Page → 카테고리 생성 → 즉시 목록 반영 → 온라인 복귀 후 서버에 생성됨(Delta Pull 후 확인)
3. (오프라인) 카테고리 이름/색상 수정 → 즉시 반영 → 온라인 복귀 후 서버 반영
4. (오프라인) 카테고리 정렬 변경 → 즉시 반영(리스트가 되돌아가지 않음) → 온라인 복귀 후 서버 반영
5. (오프라인) 카테고리 삭제 → 즉시 목록에서 제거 → 온라인 복귀 후 서버 반영
5.1 (오프라인) 카테고리 삭제 직후 해당 카테고리의 Todo/Completion이 즉시 보이지 않는지(로컬 cascade) 확인
6. (409) `createCategory`가 서버에 적용됐지만 클라가 타임아웃으로 실패 처리한 뒤 재시도 → 409가 나와도 pending이 제거되고 sync가 진행되는지 확인
7. Todo Form(Quick)에서 카테고리 생성 → 동일 hook 경로로 동작하는지 확인

## Requirements Traceability Matrix

- R1(Single write path): Tasks 2, 4, 5
- R2(Non-blocking writes): Tasks 3, 6
- R3(Pending only server apply): Tasks 3, 5, 6
- R4(409 handling): Task 7
- R5(Reorder offline): Task 6
- R6(Validation): Task 9

## Out of Scope

1. Server createCategory의 응답을 완전 멱등화(409 대신 existing category 반환)
2. Pending queue coalescing/compaction (order 업데이트 최적화)
