# Phase 2.5 Technical Spec: Data Normalization (Floating Date)

Status: Draft (Review Pending)  
Feature Path: `.kiro/specs/calendar-data-integration/`  
Depends On: Phase 2 완료, Phase 3 착수 전 선행 필수

## 1. Goal

Phase 2.5의 목표는 다음과 같다.

1. Client(UI/SQLite) -> API -> Server(MongoDB) 전 구간의 날짜 데이터를 `YYYY-MM-DD` 문자열로 통일한다.
2. Todo CRUD/반복 계산 경로에서 `new Date()` 기반 자동 캐스팅을 제거한다.
3. 반복 종료일(`recurrenceEndDate`)을 클라이언트/서버 모두 date-only 문자열로 저장하여 타임존 오차를 제거한다.
4. 위 정규화를 선행하여 Phase 3 반복 엔진의 정확성을 보장한다.

## 2. Problem Statement

현재 구조는 계층별 날짜 타입이 혼재되어 있다.

1. Client Form State는 문자열(`YYYY-MM-DD`) 중심이다.
2. Client Payload 생성 시 `recurrenceEndDate`는 `Date` 객체로 변환된다.
3. Server Controller는 `startDate + startTime`을 `Date`로 조합해 `startDateTime/endDateTime`에 저장한다.
4. Server Schema는 `startDate/endDate`는 String, `startDateTime/endDateTime/recurrenceEndDate`는 Date로 혼합 저장한다.

결과적으로 동일 개념(날짜)이 String/Date를 왕복하면서 타임존 오차(Off-by-one) 위험이 발생한다.

## 3. Scope

## 3.1 In Scope

1. Client Form/Mutation/API의 date-only 문자열 계약 강제
2. SQLite `todos`에 `recurrence_end_date TEXT` 컬럼 추가 및 백필
3. Server Todo 스키마에서 Date 기반 일정 필드 제거/대체
4. Server Controller의 `Date` 조합/캐스팅 로직 제거
5. MongoDB 기존 Date 데이터 -> String 데이터 마이그레이션 스크립트
6. 회귀 방지를 위한 검증 규칙(Validation + 테스트 체크리스트)

## 3.2 Out of Scope

1. Completion의 `completedAt`, `deletedAt`, 문서 `createdAt/updatedAt` 타임스탬프 정책 변경
2. 캘린더 UI 개선/신규 인터랙션
3. Phase 3 반복 계산 알고리즘 자체 구현

## 4. Canonical Data Contract

정규화 이후 Todo 날짜/시간 계약은 아래로 고정한다.

1. `startDate`: `YYYY-MM-DD` (required)
2. `endDate`: `YYYY-MM-DD | null`
3. `startTime`: `HH:mm | null`
4. `endTime`: `HH:mm | null`
5. `recurrenceEndDate`: `YYYY-MM-DD | null`
6. `recurrence`: `string[] | null` (RRULE 포함 가능)

규칙:

1. API 요청/응답에서 Date/ISO datetime 필드(`startDateTime`, `endDateTime`)를 사용하지 않는다.
2. DB는 date/time 분리 저장을 강제한다 (`startDate`, `startTime`, `endDate`, `endTime`).
3. Todo 단위 `timeZone` 컬럼은 저장하지 않는다(삭제 대상).
4. 기준 타임존은 `userSettings.timeZone` 단일 소스만 사용한다.
5. Google Calendar 연동 시 필요한 datetime 변환은 "연동 어댑터 경계"에서만 수행한다(도메인 저장값 불변).

## 5. Design

## 5.1 Client Design

1. `useTodoFormLogic`:
- `payload.recurrenceEndDate = dayjs(...).toDate()` 제거
- `recurrenceEndDate`를 그대로 `YYYY-MM-DD | null`로 전송

2. SQLite 스키마:
- `todos.recurrence_end_date TEXT NULL` 추가
- 인덱스 추가:
  - `idx_todos_recurrence_window(start_date, recurrence_end_date)`
- 기존 row 백필:
  - `recurrence`의 `UNTIL` 우선
  - 없으면 기존 소스에서 `recurrenceEndDate` 문자열 추출

3. SQLite 서비스:
- serialize/deserialize에 `recurrenceEndDate <-> recurrence_end_date` 매핑 추가
- 반복 후보 조회 SQL에 `(recurrence_end_date IS NULL OR recurrence_end_date >= ?)` 조건 반영

## 5.2 Server Design

1. `Todo` 스키마 변경:
- 제거 대상:
  - `startDateTime: Date`
  - `endDateTime: Date`
  - `recurrenceEndDate: Date`
  - `timeZone: String`
- 유지 대상:
  - `startDate: String`
  - `endDate: String`
  - `recurrenceEndDate: String | null` (`YYYY-MM-DD`)
- 신규 추가 대상:
  - `[NEW] startTime: String | null`
  - `[NEW] endTime: String | null`

2. Controller 변경:
- 생성/수정 시 `new Date(...)` 조합 금지
- 요청 값 검증 후 문자열 그대로 저장
- 필드 검증:
  - `startDate/endDate/recurrenceEndDate`: `/^\d{4}-\d{2}-\d{2}$/`
  - `startTime/endTime`: `/^\d{2}:\d{2}$/`

3. Google Calendar 연동:
- Phase 2.5 범위는 "호환성 패치"로 제한한다(로직 고도화 금지).
- DB 문자열 필드 + `userSettings.timeZone`으로 Google API payload를 구성한다.
- Date -> String 전환으로 발생 가능한 Type Error를 막는 수준의 어댑터 수정만 수행한다.

## 6. Migration Strategy (MongoDB)

## 6.1 배포 순서 (Safe Rollout)

1. Step A: 호환 릴리스
- 서버가 구필드(Date)와 신필드(String)를 모두 읽고, 쓰기는 신필드만 수행

2. Step B: 데이터 마이그레이션 실행
- 배치 기반 스크립트로 기존 문서 변환

3. Step C: 정리 릴리스
- 구필드 참조 제거, 스키마 strict 적용, 검증 강화

## 6.2 변환 규칙

각 Todo 문서별 변환 절차:

1. 사용자 타임존 해석 (필수 선행):
- Todo의 `userId`로 `User` 문서를 조회한다.
- `user.settings.timeZone` 값을 가져오고, 없으면 기본값 `'Asia/Seoul'`을 사용한다.
- 성능 최적화를 위해 `Map<userId, timeZone>` 캐시를 사용하여 중복 User 조회를 방지한다.

2. `startDateTime` 분해 -> `startDate + startTime`:
- `startDateTime`이 있으면, `userSettings.timeZone` 기준으로 변환한다.
- 변환 결과를 동일 소스에서 동시에 생성한다.
  - date 파트(`YYYY-MM-DD`) -> `startDate`
  - time 파트(`HH:mm`) -> `[NEW] startTime`
- 기존 `startDate`가 유효 문자열이면 우선 유지할 수 있으나, `startTime`은 신규 필드이므로 `startDateTime`에서 추출 저장한다.

3. `endDateTime` 분해 -> `endDate + endTime` (단일 블록 처리):
- `endDateTime`이 있으면, `userSettings.timeZone` 기준으로 변환한다.
- 변환 결과를 동일 소스에서 동시에 생성한다.
  - date 파트(`YYYY-MM-DD`) -> `endDate`
  - time 파트(`HH:mm`) -> `[NEW] endTime`
- `endDateTime`이 없고 `endDate`만 있는 문서는 `endDate`를 유지하고 `endTime`은 `null`로 둔다.

4. `recurrenceEndDate` 변환:
- `recurrence`에 `UNTIL`이 있으면 이를 1순위로 사용
- 없으면 기존 `recurrenceEndDate(Date)`를 `userSettings.timeZone` 기준 `YYYY-MM-DD`로 변환

5. 정합성 보정:
- `endDate < startDate`면 변환 실패로 기록하고 스킵(수동 검토 대상)
- `recurrenceEndDate < startDate`면 변환 실패로 기록하고 스킵

6. 기준 타임존 정책:
- 디바이스 타임존 감지는 사용하지 않는다.
- 마이그레이션/연동 모두 `userSettings.timeZone`을 Source of Truth로 사용한다.

## 6.3 안전장치

1. 마이그레이션 전 `todos_backup_phase2_5_YYYYMMDD` 백업 컬렉션 생성
2. `--dry-run` 모드 제공 (변환 통계만 출력)
3. 배치 크기: 500 (bulkWrite)
4. 실패 문서는 별도 로그(JSONL)로 저장 후 재처리 가능하도록 유지
5. 완료 후 샘플 검증(랜덤 N건) + 카운트 검증(total/updated/failed)

## 7. File Change List

## 7.1 Client

1. `client/src/features/todo/form/useTodoFormLogic.js`
2. `client/src/api/todos.js`
3. `client/src/services/db/database.js`
4. `client/src/services/db/todoService.js`
5. `client/src/features/todo-calendar/services/calendarTodoService.js`
6. `client/src/utils/recurrenceUtils.js`

## 7.2 Server

1. `server/src/models/Todo.js`
2. `server/src/controllers/todoController.js`
3. `server/src/controllers/authController.js`
4. `server/src/services/googleCalendar.js`
5. `server/src/utils/dateString.js` (new)
6. `server/src/scripts/migrateTodoDateFieldsToString.js` (new)

## 7.3 Spec/Docs

1. `.kiro/specs/calendar-data-integration/phase2_5_data_normalization_technical_spec.md` (this doc)
2. `.kiro/specs/calendar-data-integration/tasks.md` (Phase 2.5 task linking)
3. `.kiro/specs/calendar-data-integration/log.md` (migration execution log)

## 8. Implementation Order (Work Sequence)

1. Spec 승인: 본 문서 리뷰/승인
2. Client 선반영:
- Form payload에서 Date 변환 제거
- SQLite 스키마/서비스에 `recurrence_end_date` 추가
3. Server 호환 릴리스:
- 스키마/컨트롤러를 String 저장 중심으로 변경
- 구필드 읽기 fallback 유지
4. Mongo 마이그레이션:
- dry-run -> backup -> 본실행 -> 검증 리포트
5. Server 정리 릴리스:
- Date fallback 제거
- strict validation 활성화
6. 통합 검증:
- 오프라인 생성/수정
- 온라인 동기화
- 반복 종료일 경계 테스트

## 9. Acceptance Criteria

1. Todo 생성/수정 API payload에 Date/ISO datetime 값이 포함되지 않는다.
2. SQLite `todos.recurrence_end_date`가 존재하고, 반복 일정 조회에 사용된다.
3. MongoDB Todo 문서에 `startDateTime/endDateTime` 의존 없이 문자열 필드만으로 CRUD가 동작한다.
4. `recurrenceEndDate`는 Client/Server/DB 모두 `YYYY-MM-DD | null` 형식이다.
5. 기존 데이터 마이그레이션 후 샘플 검증에서 날짜 밀림(±1 day)이 0건이다.

## 10. Risks and Mitigations

1. Risk: 기존 Date 데이터의 timezone 복원 오류
- Mitigation: `recurrence UNTIL` 우선 복원 + `userSettings.timeZone` 기준 포맷 + dry-run diff 검토

2. Risk: Google Calendar 동기화 시 시간 이벤트 회귀
- Mitigation: 문자열 필드 -> RFC3339 변환 유틸 단일화 + 회귀 체크리스트 실행

3. Risk: 단계적 배포 중 구/신 클라이언트 혼재
- Mitigation: 서버 호환 릴리스를 선행하여 양쪽 payload를 모두 수용
