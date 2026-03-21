# Implementation Plan: Guest Data Migration

## Overview

본 계획은 guest 데이터를 대상 계정의 Inbox로 이관하는
최신 정책을 기준으로 구현 단위를 정리한다.

원칙:

1. guest 카테고리 구조는 보존하지 않는다.
2. 모든 guest todo는 target account Inbox로 이관한다.
3. guest completion은 imported todo ids를 따라간다.
4. 성공 전에는 guest local SQLite를 비우지 않는다.

## Task List

- [x] 1. 스펙 Freeze
  - `.kiro/specs/guest-login-rework/*` 와 본 스펙 상호 일치 확인
  - all-to-Inbox / no-category-preservation 결정 확인

- [x] 2. Server `migrateGuestData` 계약 수정
  - `server/src/controllers/authController.js`
  - target account Inbox resolve
  - single migrated category 생성 제거
  - guest category recreation 제거
  - 모든 imported todo의 `categoryId = targetInboxCategoryId`
  - completion import 시 todo id linkage 보존

- [x] 3. Client payload / store 정렬
  - `client/src/store/authStore.js`
  - `client/src/api/auth.js`
  - active guest todos는 canonical migration DTO로 변환
  - active guest completions는 canonical completion DTO로 변환
  - guest categories는 detection/cleanup 용도로만 사용하고 payload에서 제거
  - legacy `date` 제거, `startDate/endDate/startTime/endTime/recurrence/recurrenceEndDate` 유지
  - seeded guest Inbox-only 상태는 empty guest로 판정
  - success 후 guest local clear + signed-in full sync
  - signup `가져오기`에서는 migration 성공 전 regular session commit 금지

- [x] 4. Auth flow 통합
  - `client/src/screens/LoginScreen.js`
  - `client/src/screens/ConvertGuestScreen.js`
  - existing login / signup 모두 `가져오기 / 버리기 / 취소` 연결
  - choice copy에 Inbox 이관 / 카테고리 미보존 문구 반영

- [ ] 5. Validation
  - 아래 Validation Scenarios 실행

- [x] 6. 문서 업데이트
  - `PROJECT_CONTEXT.md`
  - `README.md`
  - `ROADMAP.md`

## Checkpoints

- [x] Checkpoint A: Server contract alignment 완료
  - Task 2 완료
  - migrated category 생성이 사라지고 Inbox resolve/import로 정렬됨

- [x] Checkpoint B: Client migration handoff 완료
  - Tasks 3~4 완료
  - login/signup에서 동일한 migration contract 사용

- [ ] Checkpoint C: Validation 완료
  - Task 5 완료
  - all-to-Inbox + move semantics PASS

## Validation Scenarios

1. [x] seeded Inbox만 있는 빈 guest -> choice UI 미표시
2. [x] existing login + `취소` -> guest local data 유지
3. [x] existing login + `버리기` -> guest local SQLite clear 후 normal login
4. [x] existing login + `가져오기` -> migration 성공 후 guest local clear
5. [x] signup + `취소` -> guest local data 유지
6. [x] signup + `버리기` -> guest local SQLite clear 후 normal register
7. [x] signup + `가져오기` -> `register -> migrateGuestData` 성공 후 guest local clear
8. [x] signup `가져오기`에서 migration 실패 시 guest session이 active 상태로 유지됨
9. [ ] migration request가 canonical todo DTO를 사용하고 legacy `date` 를 보내지 않음
10. [x] ActionSheet copy가 Inbox 이관 / 카테고리 미보존을 명시함
11. [x] 모든 imported guest todo가 target Inbox category로 들어감
12. [x] guest categories가 대상 계정에 recreated되지 않음
13. [x] imported completions가 imported todo ids를 참조함
14. [x] migration 실패 시 guest local SQLite가 그대로 유지됨

## Requirements Traceability Matrix

- R1(Migration entry handoff): Tasks 3, 4
- R2(Source data selection): Task 3
- R3(Target Inbox resolution): Task 2
- R4(Todo / completion import): Task 2
- R5(Transaction and move semantics): Tasks 2, 3, 5
- R6(Post-success client state): Task 3
- R7(Discard and failure boundary): Tasks 3, 4, 5
- R8(Data integrity validation): Task 5
