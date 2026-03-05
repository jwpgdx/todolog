# Implementation Plan: Inbox(System Category, `systemKey='inbox'`)

## Overview

본 계획은 `.kiro/specs/inbox-system-category/requirements.md`와 `.kiro/specs/inbox-system-category/design.md`를 구현 가능한 작업 단위로 분해한다.

원칙:

1. Offline-first 가드레일 준수 (SQLite SOT, UUID v4, sync order 유지)
2. 온라인 계정 Inbox는 **서버 seed/ensure**로 보장
3. Inbox 잠금은 **서버 + 클라 UI** 양쪽에서 방어
4. 변경 범위를 최소화하고, 검증 시나리오를 먼저 고정한다.

## Task List

- [ ] 1. 요구/설계 문서 확정(스펙 Freeze)
  - requirements/design/tasks 상호 링크 정리
  - must-decide 항목이 추가로 없음을 확인

- [ ] 2. Server: Category 모델에 `systemKey` 추가 + 인덱스
  - `server/src/models/Category.js` 필드 추가 (nullable)
  - partial unique index 추가 (active + systemKey not null)
  - 기존 API 응답 직렬화 영향 점검
  - 검증: getCategories API 호출 → 응답 JSON에 `systemKey` 필드 포함 확인 (curl/Postman)

- [ ] 3. Server: authController Inbox seed를 `systemKey='inbox'` 기반 ensure로 변경
  - register/createGuest/login/googleLogin/googleLoginWeb/convertGuest 경로 멱등 ensure
  - `name:'Inbox'`만 기준으로 삼던 로직 제거/대체

- [ ] 4. Server: categoryController에 Inbox 잠금 정책 적용
  - deleteCategory: inbox 삭제 거부
  - updateCategory: inbox name/color/icon/order 변경 거부
  - createCategory/updateCategory: `systemKey` 변경/주입 거부

- [ ] 5. Client: SQLite migration으로 `categories.system_key` 추가
  - `client/src/services/db/database.js` MIGRATION_VERSION bump
  - `ALTER TABLE` + partial unique index
  - 마이그레이션 안전성(기존 DB 유지) 확인

- [ ] 6. Client: categoryService upsert/deserialize에 `system_key` 반영 + 정렬 규칙 확정
  - `client/src/services/db/categoryService.js` 수정
  - `getAllCategories()` 결과가 Inbox first가 되도록 보장

- [ ] 7. Client UI: CategoryManagementScreen Inbox 잠금 적용
  - edit/delete/reorder 액션 제거
  - locked row 시각적 표시(텍스트/배지 등)

- [ ] 8. 검증 시나리오 실행 (manual)
  - 회원가입/로그인 후 Inbox 존재 + systemKey 확인
  - Inbox CRUD/정렬 방어 확인(클라/서버)
  - 일반 카테고리 생성/삭제/동기화 회귀 확인
  - Todo 생성 기본 카테고리 동작 확인

- [ ] 9. 문서 업데이트(구현 반영)
  - `PROJECT_CONTEXT.md`에 계약/스키마 변경 반영
  - 필요 시 `README.md`/`ROADMAP.md` 업데이트

## Checkpoints

- [ ] Checkpoint A: Server 계약 확정
  - Tasks 2~4 완료
  - 서버에서 Inbox seed/잠금이 동작

- [ ] Checkpoint B: Client 저장/정렬 확정
  - Tasks 5~6 완료
  - SQLite에 `system_key` 저장 + Inbox first 정렬

- [ ] Checkpoint C: UI 잠금 확정
  - Task 7 완료
  - Inbox row에서 실수 조작 방지

- [ ] Checkpoint D: End-to-end 수동 검증
  - Task 8 완료
  - 주요 시나리오 PASS

## Validation Scenarios (필수)

1. 신규 회원가입 → 로그인 직후 sync → categories에 Inbox 1개(`systemKey='inbox'`)
2. 카테고리 관리에서 Inbox 삭제/이름변경/정렬 시도 → UI 차단 + 서버 차단(우회 불가)
3. 일반 카테고리 생성(오프라인/온라인) → pendingPush 포함 회귀 없음
4. Todo 생성 시 기본 카테고리 선택이 Inbox로 귀결(최초 1회)
5. 일반 카테고리 삭제 → tombstone cascade 유지, Inbox는 영향 없음
6. createCategory/updateCategory API로 `systemKey='inbox'` 주입 시도 → 거부/무시 확인
7. convertGuest(게스트→정회원 전환) 후 Inbox에 `systemKey='inbox'` 보정 확인

## Requirements Traceability Matrix

- R1(systemKey 계약): Tasks 2, 5, 6
- R2(Inbox 유일성): Tasks 2, 3, 5
- R3(온라인 seed/ensure): Tasks 3
- R4(게스트 local-only seed): (별도 스펙/후속)
- R5(잠금 정책): Tasks 4, 7
- R6(정렬/고정): Tasks 3, 4, 6, 7
- R7(Todo categoryId 필수): (현행 유지 + Task 6 정렬로 보장)
- R8(삭제 정책 유지): Task 4(예외: Inbox), 기존 로직 회귀 검증(Task 8)
- R9(SQLite migration/sync): Tasks 5, 6
- R10(검증/관측): Tasks 8, 9

## Out of Scope

1. guest local-only 전환 구현
2. Inbox 전용 화면 분리(독립 메뉴)
3. 휴지통(Trash) UX/복구 정책
4. Tag/Favorite 스키마
