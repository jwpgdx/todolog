# Validation Checklist: Sync Service Pending Push -> Delta Pull

작성일: 2026-02-18  
목적: Phase 0~3 구현 후 "정합성/안정성/성능"을 동일 기준으로 검증하기 위한 체크리스트

## 상태 안내 (2026-02-19)

1. 본 문서는 TO-BE 정책 기준으로 갱신됨.
2. 이전 baseline 검증(`Category delete -> default category 이동`) 결과는 참고용이며, 현재 계약의 완료 기준이 아님.
3. 현재 Phase 0 완료 조건은 아래 연쇄 tombstone 계약 검증 PASS다.
   - `Todo delete (tombstone) -> Completion cascade tombstone`
   - `Category delete (tombstone) -> Todo cascade tombstone -> Completion cascade tombstone`
4. Phase 0 Section 2 재검증(2-1~2-4)은 2026-02-19 기준 PASS/READY 상태다.

## 1. 사전 준비

1. 테스트 계정 1개, 샘플 데이터(카테고리/일정/완료) 준비
2. 앱 오프라인 전환 가능 환경 준비
3. 서버 로그 + 클라이언트 로그 수집 경로 확인

## 2. Phase 0 계약 검증 (필수)

## 2-1. Category delete tombstone 연쇄

1. 기본 카테고리가 아닌 카테고리 삭제
2. 삭제 전 해당 카테고리의 active todo 개수 기록
3. 삭제 전 해당 todo들의 completion 개수 기록
4. 삭제 후 검증:
   - category는 `deletedAt`이 채워진다.
   - 해당 category 소속 todo는 `deletedAt`이 채워진다.
   - 해당 todo들의 completion은 `deletedAt`이 채워진다.
   - hard delete가 발생하지 않는다.

PASS 기준:
1. 삭제 전후 row 총량이 급감하지 않고 tombstone 전환으로 처리됨
2. todo/completion delta에서 deleted 목록으로 추적 가능
3. 재호출 시 success-equivalent 응답

## 2-2. Todo delete tombstone + Completion 연쇄

1. todo 1건 삭제 API 호출
2. 삭제 후 검증:
   - todo row는 남아 있고 `deletedAt`이 채워짐
   - 해당 todo의 completion row도 남아 있고 `deletedAt`이 채워짐
   - todo/completion delta에서 deleted 목록에 노출됨

PASS 기준:
1. todo hard delete 없음
2. completion hard delete 없음
3. delta deleted 노출 확인

## 2-3. Completion delete tombstone

1. completion 생성
2. completion 삭제 API 호출
3. 삭제 후 검증:
   - row가 삭제되지 않고 `deletedAt`이 채워짐
   - completion delta에서 deleted 목록에 노출됨

PASS 기준:
1. delete 이후 DB row 존재
2. delta deleted에 해당 completion 식별자 포함

## 2-4. delete idempotency/404 정책

1. todo delete 2회 호출
   - 1회: 정상 삭제
   - 2회: success-equivalent 응답
2. category delete 2회 호출
   - 2회차 success-equivalent 응답
3. completion delete 2회 호출
   - 2회차 success-equivalent 응답

PASS 기준:
1. 재호출 시 pending에서 재시도 폭주 없음
2. 상태가 추가로 망가지지 않음
3. endpoint별 policy대로 success-equivalent 또는 terminal 처리

## 3. Pending Push 검증

1. 오프라인 상태에서 todo/category/completion create/update/delete enqueue
2. 온라인 복귀 후 pending 자동 처리
3. 실패 유도(네트워크 끊김/5xx) 후 backoff 및 status 전이 확인

PASS 기준:
1. `pending -> failed -> pending -> success` 경로가 정상 동작
2. 임계 초과 시 `dead_letter`로 이동
3. poison pending 1건이 전체 큐를 영구 블록하지 않음

## 4. Delta Pull + Cursor 검증

1. last cursor 기록
2. 서버에서 todo/completion 변경 발생
3. sync 실행 후 delta 반영 확인
4. pull 실패 시 cursor 미커밋 확인
5. 재시도 성공 시 동일 cursor 기준 복구 확인

PASS 기준:
1. 성공 시에만 cursor advance
2. 실패 시 cursor 유지 + 재시도 가능

## 5. 화면 정합성 검증

대상: `todo-screen`, `todo-calendar`, `strip-calendar`

1. 동일 날짜 기준으로 일정 개수/완료 상태/카테고리 색상 비교
2. 오프라인 편집 후 온라인 복귀 시 동일성 재검증

PASS 기준:
1. 세 화면 결과가 일치
2. 동기화 직후 화면별 불일치가 재현되지 않음

## 6. 성능 검증

1. 대량 pending(예: 500+)에서 sync run 시간 측정
2. cache invalidation 범위 확인(전역 clear 남용 여부)
3. 연속 trigger(app active/online/login)에서 중복 실행 억제 확인

PASS 기준:
1. UI freeze 체감 없음
2. 동기화 시간이 선형적으로 악화되지 않음
3. 로그 폭증/무한 재시도 없음

## 7. 검증 로그 포맷 (팀 공통)

아래 형식으로 케이스별 기록:

```md
[Case ID] P0-COMP-DELETE-001
[Date] 2026-02-18
[Env] iOS simulator / Android emulator / Web
[Precondition]
- completion 존재 (todoId=..., date=...)

[Action]
1. DELETE /completions/:todoId?date=...&isRecurring=true
2. GET /completions/delta-sync?lastSyncTime=...

[Expected]
- delete API success-equivalent
- row hard delete 없음
- delta.deleted에 노출

[Actual]
- ...

[Result]
- PASS | FAIL

[Evidence]
- client log: ...
- server log: ...
- sqlite snapshot: ...
```

## 8. 종료 기준

모든 아래 조건을 만족하면 검증 완료:

1. Phase 0 계약 케이스 전부 PASS
2. Pending Push / Delta Pull / Cursor 핵심 케이스 PASS
3. 3개 화면 정합성 PASS
4. 성능 기준 PASS

## 9. Quick Run (cURL 명령어)

아래는 수동 API 검증을 바로 실행하기 위한 예시다.

사전 환경 변수:

```bash
export BASE_URL="http://localhost:5001/api"
export TOKEN="<ACCESS_TOKEN>"
```

### 9-1. Category delete 연쇄 tombstone/멱등

```bash
# 1회 삭제
curl -X DELETE "$BASE_URL/categories/<CATEGORY_ID>" \
  -H "Authorization: Bearer $TOKEN"

# 2회 삭제 (멱등 확인)
curl -X DELETE "$BASE_URL/categories/<CATEGORY_ID>" \
  -H "Authorization: Bearer $TOKEN"
```

확인 포인트:
1. 2회차 응답에 `idempotent: true`, `alreadyDeleted: true`
2. 삭제 대상 category 소속 todo/completion이 tombstone 처리되었는지 DB 또는 delta로 확인

### 9-2. Completion create 멱등

```bash
# 1회 생성
curl -X POST "$BASE_URL/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"todoId":"<TODO_ID>","date":"2026-02-18","isRecurring":true,"_id":"<UUID_1>"}'

# 같은 key 재생성
curl -X POST "$BASE_URL/completions" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"todoId":"<TODO_ID>","date":"2026-02-18","isRecurring":true,"_id":"<UUID_2>"}'
```

확인 포인트:
1. 2회차가 `400`이 아니라 성공등가 응답

### 9-3. Completion delete tombstone/멱등

```bash
# 1회 삭제
curl -X DELETE "$BASE_URL/completions/<TODO_ID>?date=2026-02-18&isRecurring=true" \
  -H "Authorization: Bearer $TOKEN"

# 2회 삭제 (멱등)
curl -X DELETE "$BASE_URL/completions/<TODO_ID>?date=2026-02-18&isRecurring=true" \
  -H "Authorization: Bearer $TOKEN"
```

확인 포인트:
1. 2회차 응답이 success-equivalent
2. DB row hard delete가 아니라 `deletedAt` 기반 상태

### 9-4. Completion delta 삭제 노출

```bash
curl "$BASE_URL/completions/delta-sync?lastSyncTime=2026-02-18T00:00:00.000Z" \
  -H "Authorization: Bearer $TOKEN"
```

확인 포인트:
1. `deleted` 배열에 방금 삭제한 completion이 포함

### 9-5. Todo delete tombstone/멱등 + Completion 연쇄

```bash
# 1회 삭제
curl -X DELETE "$BASE_URL/todos/<TODO_ID>" \
  -H "Authorization: Bearer $TOKEN"

# 2회 삭제 (멱등)
curl -X DELETE "$BASE_URL/todos/<TODO_ID>" \
  -H "Authorization: Bearer $TOKEN"
```

확인 포인트:
1. 2회차 응답에 `idempotent: true`, `alreadyDeleted: true`
2. 해당 todo의 completion이 tombstone 처리되었는지 확인

## 10. Task12 Replay 상세 실행 순서 (DebugScreen 기준)

아래는 `Task12 (Replay validation scenarios)`를 팀에서 동일하게 재현하기 위한 고정 순서다.
각 케이스는 완료 후 `.kiro/specs/sync-service-pending-delta/log.md`에 클라이언트/서버 로그를 붙인다.

### 공통 준비

1. 서버 실행: `server`에서 `npm run dev`
2. 앱 실행: `client`에서 `npx expo start --dev-client -c`
3. DebugScreen 진입 후 다음 버튼 실행:
   - `🗑️ Pending 삭제`
   - `⏳ Pending Changes 확인`
4. PASS 기준:
   - `⏳ 전체 Pending: 0개`
   - `📊 상태 요약: pending=0, failed=0, dead_letter=0`

### T12-1. Offline Todo Create -> Online Replay

1. 오프라인 상태 만들기 (둘 중 하나):
   - 서버 터미널 중지 (`Ctrl+C`)
   - 네트워크 오프라인 전환
2. 앱에서 Todo 1개 생성 (제목 예: `T12-1-offline-create`)
3. DebugScreen에서 `⏳ Pending Changes 확인`
4. 기대:
   - `createTodo | status=pending | retry=0` 1건 이상
5. 온라인 복구:
   - 서버 재실행 또는 네트워크 온라인 전환
6. DebugScreen에서 `🚀 Pending Push 1회 실행`
7. 기대:
   - `ok=true`
   - `processed>=1`, `succeeded>=1`, `failed=0`
   - 이후 `⏳ Pending Changes 확인` 시 `전체 Pending: 0개`
8. 서버 로그 기대:
   - `POST /api/todos`
   - `✅ [createTodo] Todo 저장 완료: <동일 _id>`

### T12-2. Offline Completion Create -> Online Replay

1. 오프라인 상태 만들기
2. Todo 화면에서 미완료 Todo를 체크(완료 처리)
3. DebugScreen에서 `⏳ Pending Changes 확인`
4. 기대:
   - `createCompletion | status=pending | retry=0`
5. 온라인 복구 후 `🚀 Pending Push 1회 실행`
6. 기대:
   - `ok=true`, `succeeded>=1`, `failed=0`
   - `Pending 0개`
7. 서버 로그 기대:
   - `POST /api/completions`

### T12-3. Offline Completion Delete -> Online Replay

1. 오프라인 상태 만들기
2. 이미 완료된 Todo를 다시 체크 해제(미완료 전환)
3. DebugScreen에서 `⏳ Pending Changes 확인`
4. 기대:
   - `deleteCompletion | status=pending | retry=0`
5. 온라인 복구 후 `🚀 Pending Push 1회 실행`
6. 기대:
   - `ok=true`, `succeeded>=1`, `failed=0`
   - `Pending 0개`
7. 서버 로그 기대:
   - `DELETE /api/completions/<todoId>?date=...&isRecurring=...`

### T12-4. Push 실패/재시도/복구

1. 오프라인 상태에서 Todo 1개 생성
2. 아직 오프라인인 상태에서 `🚀 Pending Push 1회 실행`
3. 기대:
   - `ok=false`
   - `failed>=1`
   - `blockingFailure=true`
   - `lastError=[network_or_timeout] ...`
4. 다시 `⏳ Pending Changes 확인`
5. 기대:
   - 대상 항목 `status=failed`, `retry` 증가, `nextRetryAt` 설정
6. 온라인 복구 후 `🚀 Pending Push 1회 실행`
7. 기대:
   - `ok=true`
   - 대상 pending 제거(또는 terminal 처리 정책대로 감소)

### 동기화 1회 트리거 방법 (앱 전체 syncAll)

다음 중 한 가지를 하면 `useSyncService`의 1회 동기화가 트리거된다.

1. 앱 새로고침/재진입 (로그인 상태)
2. 오프라인 -> 온라인 전환
3. 앱 백그라운드 -> 포그라운드 전환

판정 로그:
1. 시작: `🚀 [useSyncService] 전체 동기화 시작`
2. Push 결과: `📤 [useSyncService] Pending Push 결과: ...`
3. Pull 결과: `📥 [useSyncService] Delta Pull 결과: ...`
4. 성공 커밋: `🧭 [useSyncService] Cursor commit 완료: {from: ..., to: ...}`

### Task13 실행 팁 (부분 처리 재현)

DebugScreen의 Pending Push 버튼 중 아래를 우선 사용한다.

1. `🚀 Pending Push 1건 실행`
2. `🚀 Pending Push 3건 실행`

목적:
1. 사람이 서버 `Ctrl+C` 타이밍을 맞추지 않아도 부분 처리/재개 시나리오를 안정적으로 재현
2. backlog가 남아있는 상태를 의도적으로 만들고 이후 재실행 복구 검증
