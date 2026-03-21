# Implementation Plan: Guest Login Rework

## Overview

본 계획은 `.kiro/specs/guest-login-rework/requirements.md`와
`.kiro/specs/guest-login-rework/design.md`를 구현 가능한 작업 단위로 분해한다.

원칙:

1. guest bootstrap은 serverless local-only
2. 앱 기본 진입은 Todo route
3. 로그인/회원가입은 My Page에서만 시작
4. guest migration은 move semantics
5. 모든 guest todo는 target account Inbox로 이관
6. guest category 구조는 대상 계정에 재생성하지 않음

## Task List

- [x] 1. 스펙 Freeze
  - requirements/design/tasks 상호 일치 확인
  - `guest_local`, Todo 기본 진입, all-to-Inbox migration, 2-step signup migration 결정 확인

- [x] 2. Entry Route를 TodoScreen 기본 진입으로 전환
  - `client/app/index.js`
  - `client/app/_layout.js`
  - startup auth/boot 순서 회귀 확인

- [x] 3. Auth Store를 local-only guest bootstrap으로 전환
  - `client/src/store/authStore.js`
  - `loginAsGuest()`에서 `/auth/guest` 제거
  - `loadAuth()`에서 regular session 부재 시 `guest_local` bootstrap
  - token/refreshToken 없는 guest contract 반영
  - local guest Inbox ensure
  - guest data detection에서 seeded Inbox-only 제외

- [x] 4. Welcome 의존 제거 / legacy route 정리
  - `client/src/screens/WelcomeScreen.js`
  - primary startup route에서 Welcome 제거
  - 필요 시 수동 진입 route로만 유지

- [x] 5. My Page guest CTA를 primary auth entry로 정리
  - `client/src/screens/MyPageScreen.js`
  - guest banner CTA copy/route 정리
  - CTA 진입 시 guest session 사전 파기 금지

- [x] 6. Existing login flow에 guest-data choice 연결
  - `client/src/screens/LoginScreen.js`
  - `checkGuestData()`
  - `가져오기 / 버리기 / 취소`
  - ActionSheet에 “Inbox 이관 / 카테고리 구조 미보존” 문구 반영
  - cancel 시 login abort

- [x] 7. Signup flow에 guest-data choice 연결
  - `client/src/screens/ConvertGuestScreen.js`
  - `checkGuestData()`
  - `register -> migrateGuestData` 2-step orchestration
  - ActionSheet에 “Inbox 이관 / 카테고리 구조 미보존” 문구 반영
  - partial-success failure policy 반영
  - migration 성공 전 regular session commit 금지

- [x] 8. Guest migration 계약을 all-to-Inbox 기준으로 정렬
  - `.kiro/specs/guest-data-migration/requirements.md`
  - `.kiro/specs/guest-data-migration/design.md`
  - `.kiro/specs/guest-data-migration/tasks.md`
  - `server/src/controllers/authController.js`
  - single migrated category 전략 제거
  - category recreation 전략 제거
  - 모든 guest todo -> target Inbox mapping 반영
  - canonical migration DTO 반영

- [x] 9. Deprecated endpoint 경계 정리
  - `/auth/guest`, `/auth/convert-guest`를 product flow에서 제거
  - compatibility/deprecation note 정리

- [ ] 10. Validation
  - 아래 Validation Scenarios 실행

- [x] 11. 문서 업데이트
  - `PROJECT_CONTEXT.md`
  - `README.md`
  - `ROADMAP.md`

## Checkpoints

- [x] Checkpoint A: Local guest bootstrap 완료
  - Tasks 2~4 완료
  - 서버 없이도 Todo route 진입 + guest session 유지

- [x] Checkpoint B: Auth entry UX 완료
  - Tasks 5~7 완료
  - 로그인/회원가입 시 guest-data choice 동작

- [x] Checkpoint C: Migration contract alignment 완료
  - Task 8 완료
  - all-to-Inbox 규칙이 스펙/서버 구현에서 일치

- [ ] Checkpoint D: Validation 완료
  - Task 10 완료
  - guest local-only + migration move semantics 검증 PASS

## Validation Scenarios

1. [ ] 서버 불가 상태 첫 실행 -> Todo route 진입 성공
2. [ ] 첫 실행 guest session = `_id='guest_local'`, `token=null`
3. [x] 첫 실행 시 local guest Inbox seed 존재
4. [ ] seeded Inbox만 있는 빈 guest -> login/signup에서 choice UI 미표시
5. [ ] guest 상태에서 todo/category/completion 생성 -> 앱 재시작 후 유지
6. [x] guest 상태에서 sync 미실행 유지
7. [x] 기존 계정 로그인 + `취소` -> guest session/data 그대로 유지
8. [x] 기존 계정 로그인 + `버리기` -> guest SQLite clear 후 normal login
9. [x] 기존 계정 로그인 + `가져오기` -> migration 성공 후 guest local clear
10. [x] 신규 가입 + `취소` -> signup abort, guest session/data 유지
11. [x] 신규 가입 + `버리기` -> guest SQLite clear 후 normal register
12. [x] 신규 가입 + `가져오기` -> `register -> migrateGuestData` 성공 후 guest local clear
13. [ ] signup `가져오기`에서 migration 실패 시 guest session이 active 상태로 유지됨
14. [x] ActionSheet copy가 Inbox 이관 / 카테고리 구조 미보존을 명시함
15. [x] 모든 guest todo가 target Inbox category로 매핑됨
16. [x] guest categories가 대상 계정에 recreated되지 않음
17. [ ] migration 실패 시 guest local data 유지

## Requirements Traceability Matrix

- R1(Local guest bootstrap): Tasks 2, 3
- R2(Default entry route): Task 2
- R3(Guest sync policy): Task 3
- R4(My Page auth entry): Task 5
- R5(Existing login choice): Task 6
- R6(Signup choice): Task 7
- R7(All guest todos -> target Inbox): Task 8
- R8(Move semantics): Tasks 6, 7, 8, 10
- R9(Compatibility boundary): Task 9
- R10(Validation): Task 10
