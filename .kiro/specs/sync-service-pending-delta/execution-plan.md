# Execution Plan: Sync Service Pending Push -> Delta Pull

작성일: 2026-02-18  
목적: 동기화 서비스를 “재작업 없이” 안전하게 완성하기 위한 착수용 실행 계획서

## 1. 목표

이번 작업의 1차 목표는 기능 추가가 아니라 **데이터 정합성 보호**다.

1. Category/Completion 삭제 계약 리스크를 먼저 제거한다.
2. 그 다음 `Pending Push -> Delta Pull` 파이프라인으로 전환한다.
3. 마지막에 캐시/성능/운영 가시성을 마무리한다.

## 2. 현재 상태 요약

1. 클라이언트 동기화는 아직 full sync 중심이다.
2. pending enqueue는 있으나 coordinator에서 자동 flush 파이프라인이 없다.
3. Phase 0 계약 블로커는 해소되었고 검증 완료 상태다.
   - category delete 안전성 검증 완료
   - completion tombstone/delta 추적 검증 완료
   - delete idempotency 정책 검증 완료

## 3. 절대 원칙

1. **블로커 해결 전 파이프라인 구현 금지**
2. **Push 성공 전 Pull 진행 금지** (현재 정책 유지)
3. **Cursor는 전체 성공 시에만 commit**
4. **성능 저하 유발 구현 금지**
   - 과도한 전역 cache invalidation 금지
   - 대기열 단건 처리로 인한 과도한 네트워크 왕복 최소화

## 4. 단계별 실행 계획

## Phase 0. 계약 블로커 고정 (필수 선행)

1. Category delete 계약 확정
   - 삭제 시 연결 todo 처리 정책을 명시적으로 고정한다.
   - “하드 삭제”가 기본 동작이 되지 않도록 서버 계약을 수정한다.
2. Completion delete 계약 확정
   - delete를 tombstone(soft-delete) 기반으로 정렬한다.
   - delta pull에서 삭제 추적이 유지되도록 `deletedAt` 규칙을 맞춘다.
3. delete 404 정책 확정
   - todo/category/completion 엔드포인트별로 `404`를 success-equivalent로 볼지, terminal error로 볼지 문서에 고정한다.

**Phase 0 Gate (통과 기준)**
1. [x] 계약 문서(`design.md`, `tasks.md`)에 엔드포인트별 정책이 명시되어 있다.
2. [x] 팀 리뷰에서 “삭제 재생 시 데이터 유실 없음”이 합의된다.
3. [x] 검증 리포트가 남아 있다. (`PHASE0_VALIDATION_REPORT.md`, `PHASE0_VALIDATION_SUMMARY.md`)

## Phase 1. Pending Push 기반 구축

1. pending schema v5 반영
   - `retry_count`, `last_error`, `next_retry_at`, `status`
2. pending 상태 API 확장
   - retry/dead-letter/eligible 조회 함수 추가
3. completion 명시 API 경로 확정
   - toggle replay 금지
   - create/delete 명시 API만 pending replay에 사용
4. pendingPush 처리기 구현
   - FIFO, 오류 분류, backoff, dead-letter, defer 처리

**Phase 1 Gate**
1. 오프라인에서 누적된 pending이 온라인 복귀 시 자동 처리된다.
2. poison pending 1건이 있어도 전체 큐가 장시간 멈추지 않는다.

## Phase 2. Delta Pull + Cursor

1. deltaPull 처리기 구현
   - category full pull(임시) + todo/completion delta
2. deleted payload shape 정규화 적용
3. cursor commit 규칙 구현
   - push + pull + apply 모두 성공할 때만 commit

**Phase 2 Gate**
1. 부분 실패에서 cursor가 유지된다.
2. 재시도 후 동일 cursor에서 누락 없이 회복된다.

## Phase 3. 캐시 정합성 + 성능 + 운영

1. 캐시 무효화 범위 최적화
   - changed range/changed entity 기반으로 축소
2. 3개 화면 정합성 검증
   - todo / todo-calendar / strip-calendar 결과 일치
3. 운영 지표/로그 정리
   - processed/succeeded/failed/dead-letter
4. 성능 검증
   - 대량 pending, 네트워크 불안정, 앱 재시작 시나리오

**Phase 3 Gate**
1. 동기화 후 3개 화면 결과가 일치한다.
2. full sync 대비 성능/비용 개선 근거가 확보된다.

## 5. 작업 순서 고정표 (실제 착수 순서)

1. Phase 0 계약 고정
2. Phase 1 pending 기반
3. Phase 2 delta + cursor
4. Phase 3 캐시/성능/운영

순서를 바꾸지 않는다.  
특히 Phase 0 이전에 coordinator 리팩터링을 먼저 시작하지 않는다.

## 6. 성능 기준 (최소 합의안)

1. 동기화 실행 중 UI freeze 체감이 없어야 한다.
2. 대량 pending 처리 시 단일 run이 과도하게 길어지지 않아야 한다.
3. 실패 반복 상황에서 로그 폭증/무한 재시도가 없어야 한다.
4. cache invalidation은 전체 clear보다 범위 기반을 우선한다.

## 7. 리스크와 대응

1. 리스크: 계약 미확정 상태에서 구현 선행
   - 대응: Phase 0 Gate 전 코드 구현 금지
2. 리스크: delete 재생 정책 불일치
   - 대응: 엔드포인트별 404 정책 표준화
3. 리스크: completion 삭제 누락
   - 대응: tombstone + delta 검증 케이스 필수화

## 8. 문서 연계

1. 요구사항 기준: `requirements.md`
2. 설계 기준: `design.md`
3. 구현 태스크: `tasks.md`
4. 검증 체크리스트/로그 포맷: `validation-checklist.md`
5. 본 문서: 실행 순서와 Gate를 고정하는 운영 계획서

## 9. 시작 체크리스트

1. [x] Phase 0 정책 문서 합의 완료
2. [ ] 서버/클라이언트 담당자 역할 분리 완료
3. [ ] 테스트 시나리오(오프라인->온라인, 부분실패, 재시작) 준비 완료
4. [ ] 성능/로그 측정 항목 합의 완료
