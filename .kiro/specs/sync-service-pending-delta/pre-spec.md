# Sync Service 개선 착수 문서

작성일: 2026-02-18  
대상: 동기화 서비스 개선 작업(Pending Push -> Delta Pull) 착수 전 합의 문서

## 1. 이 문서의 목적

이 문서는 바로 구현을 시작하기 위한 최종 스펙이 아니다.  
현재 프로젝트 상태를 정확히 정리하고, 다음 단계에서 `requirements.md`, `design.md`, `tasks.md`로 분해하기 위한 착수 기준 문서다.

## 2. 지금 코드 상태 요약 (As-Is)

### 2.1 이미 구현된 것

1. 중앙 동기화 훅이 앱 전역에 연결되어 있음  
- `client/App.js:135` (`<SyncProvider>`)
- `client/src/providers/SyncProvider.js:27`
- `client/src/services/sync/index.js:17`

2. 동기화 트리거가 존재함  
- 앱 활성화: `client/src/services/sync/index.js:103`
- 온라인 복귀: `client/src/services/sync/index.js:119`
- 로그인 감지: `client/src/services/sync/index.js:132`

3. 동기화 기본 순서는 Category -> Todo -> Completion  
- `client/src/services/sync/index.js:52`
- `client/src/services/sync/index.js:55`
- `client/src/services/sync/index.js:58`

4. 오프라인/서버 실패 시 pending 큐 적재는 이미 동작함  
- Todo create/update/delete:  
  `client/src/hooks/queries/useCreateTodo.js:82`  
  `client/src/hooks/queries/useUpdateTodo.js:136`  
  `client/src/hooks/queries/useDeleteTodo.js:61`
- Completion create/delete:  
  `client/src/hooks/queries/useToggleCompletion.js:60`
- Category create/update/delete:  
  `client/src/hooks/queries/useCreateCategory.js:36`  
  `client/src/hooks/queries/useUpdateCategory.js:36`  
  `client/src/hooks/queries/useDeleteCategory.js:26`

5. pending_changes 저장/조회/삭제 유틸은 있음  
- `client/src/services/db/pendingService.js`

6. 서버 Delta 엔드포인트 일부 존재  
- Todo delta: `server/src/routes/todos.js:18`
- Completion delta: `server/src/routes/completions.js:19`
- Category는 delta 라우트 없음: `server/src/routes/categories.js:9`

### 2.2 아직 부족한 핵심

1. pending queue를 실제로 서버로 밀어올리는 자동 처리 경로가 없음  
- `processPendingChanges` 함수는 정의만 존재  
  `client/src/services/db/pendingService.js:228`
- 호출처 없음 (`rg` 기준)

2. 현재 sync는 full pull 중심  
- Todo: `todoAPI.getAllTodos()` (`client/src/services/sync/todoSync.js:16`)
- Category: `getCategories()` (`client/src/services/sync/categorySync.js:16`)
- Completion: `/completions/all` (`client/src/services/sync/completionSync.js:16`)

3. 결과적으로 현재 구조는  
- 로컬 쓰기 + pending 적재는 됨  
- 하지만 pending 자동 비우기와 delta 기반 최적화가 미완성

## 3. 목표 상태 (To-Be)

최종 목표 파이프라인:

1. Sync Trigger
2. Pending Push (로컬 변경 -> 서버 반영)
3. Delta Pull (서버 변경 -> 로컬 반영)
4. SQLite upsert/soft-delete 반영
5. 캐시 무효화/재조회
6. 실패 건 재시도(backoff) + queue 유지

핵심 원칙:

1. 오프라인 퍼스트 유지 (UI는 항상 로컬 기준)
2. 동기화는 백그라운드 비차단
3. 재시도해도 중복 반영되지 않는 멱등성(idempotency)

## 4. 제안 아키텍처

### 4.1 Sync Coordinator 확장

`client/src/services/sync/index.js`의 `syncAll`을 아래 순서로 재구성:

1. 동시 실행 가드
2. DB 준비
3. pending push 단계
4. delta pull 단계
5. 캐시 처리 단계
6. 상태/에러 보고

### 4.2 Pending Push Processor (신규)

신규 모듈 예시:

- `client/src/services/sync/pendingPush.js`

역할:

1. `pending_changes` FIFO 조회
2. `type`별 서버 호출 라우팅
3. 성공 건 삭제
4. 실패 건 유지(재시도 대상)
5. 치명적 실패(스키마 불일치 등) 분리 로깅

타입 라우팅 초안:

1. `createTodo` -> `todoAPI.createTodo`
2. `updateTodo` -> `todoAPI.updateTodo`
3. `deleteTodo` -> `todoAPI.deleteTodo`
4. `createCategory` -> `createCategory API`
5. `updateCategory` -> `updateCategory API`
6. `deleteCategory` -> `deleteCategory API`
7. `createCompletion` / `deleteCompletion` -> completion API 경로 정리 필요

### 4.3 Delta Pull Processor (신규)

신규 모듈 예시:

- `client/src/services/sync/deltaPull.js`

역할:

1. 마지막 동기화 시각(lastSyncTime) 조회
2. Todo/Completion delta API 호출
3. 변경분 upsert + 삭제분 반영
4. 성공 시 lastSyncTime 갱신

저장 위치 제안:

1. SQLite metadata 사용 (`getMetadata`/`setMetadata`)
- `client/src/services/db/database.js:244`
- `client/src/services/db/database.js:252`

Category 전략:

1. 단기: full pull 유지
2. 중기: category delta API 추가 후 전환

### 4.4 캐시 정책

동기화 성공 후:

1. React Query invalidate (`todos`, `categories`)
2. todo-calendar 캐시 clear
3. strip-calendar summary 캐시 invalidation 범위 연동 검토

## 5. 단계별 실행 계획

### Phase A: 안전한 Pending Push

1. pending processor 도입
2. `syncAll`에 push 단계 연결
3. 단일 엔티티 멱등성 검증

완료 기준:

1. 오프라인 생성/수정/삭제 후 온라인 복귀 시 queue 감소 확인
2. 중복 push 시 데이터 오염 없음

### Phase B: Delta Pull 도입

1. Todo delta pull 적용
2. Completion delta pull 적용
3. metadata 기반 sync cursor 저장

완료 기준:

1. full pull 빈도 감소
2. 대량 데이터에서 동기화 시간 개선

### Phase C: Category 고도화 + 통합 안정화

1. Category 동기화 전략 확정(full 유지 또는 delta 추가)
2. 캐시 무효화 범위 최적화
3. 에러/재시도 정책 정교화

## 6. 테스트/검증 계획

### 6.1 필수 시나리오

1. 오프라인 createTodo 10건 후 온라인 복귀
2. 오프라인 update/delete 혼합 후 온라인 복귀
3. completion 토글 연속 수행 후 복귀
4. category create/update/delete 후 복귀
5. 앱 재시작 중간 끊김(부분 성공) 복구

### 6.2 정합성 검증

1. SQLite rows vs 서버 rows 개수/ID 일치
2. pending queue 최종 0 또는 실패건만 유지
3. todo-screen / todo-calendar / strip-calendar 표시 일치

### 6.3 성능 검증

1. full sync 대비 동기화 시간/네트워크 사용량
2. 앱 활성화 시 체감 지연(메인 스레드 블로킹 여부)

## 7. 리스크와 대응

1. Completion API 멱등성 부족 가능성  
- 대응: 서버 API 규약 확인 후 토글 대신 명시적 upsert/delete 경로 검토

2. Category delta 부재  
- 대응: 초기엔 full 유지, 이후 별도 API 추가

3. 부분 실패로 인한 순서 꼬임  
- 대응: FIFO + 엔티티 단위 재시도 + 실패 원인 분류 로그

## 8. 다음 단계 (스펙 문서 분해)

이 문서를 기준으로 아래 3개를 작성 후 구현 착수:

1. `requirements.md`  
- 사용자 시나리오, 성공 기준, 비기능(성능/안정성) 요구사항

2. `design.md`  
- Sync Coordinator/Pending Push/Delta Pull 컴포넌트 설계  
- 데이터 모델(metadata cursor, retry 정책)  
- 오류 처리/멱등성 전략

3. `tasks.md`  
- Phase A/B/C 태스크 분해  
- 체크포인트 테스트 태스크 포함

## 9. 한 줄 결론

현재는 "오프라인 적재는 되는데 자동 배출이 약한 상태"다.  
착수 우선순위는 `Pending Push 안정화 -> Delta Pull 전환 -> Category/캐시 고도화` 순으로 간다.
