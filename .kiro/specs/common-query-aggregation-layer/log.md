## 3) completion key 패턴 검증

🔄 [toggleCompletion] 시작: key=a35b13b0-ee3f-4197-8c41-1732fc0bf848_2026-02-21, date="2026-02-21"
completionService.js:236 🔄 [toggleCompletion] 기존 데이터: 없음
completionService.js:254 🔄 [toggleCompletion] 생성 완료 → 완료 상태로 전환
useToggleCompletion.js:89 ⚡ [useToggleCompletion] mutationFn 완료 (온라인): 196.00ms
database.js:109 📦 [DB] Already initialized
todoCalendarStore.js:109 [TodoCalendarStore] Invalidated adjacent months: 2026-01, 2026-02, 2026-03
useToggleCompletion.js:118 📅 [useToggleCompletion] Calendar cache invalidated for 2026-2
useToggleCompletion.js:123 ⚡ [useToggleCompletion] onSuccess 완료: 0.60ms
database.js:109 📦 [DB] Already initialized
useTodos.js:50 ⚡ [useTodos] 전체: 7개 (7.30ms)
useTodos.js:51   📊 [useTodos] stage: candidate=8, decided=7, aggregated=7
useTodos.js:52   ⏱️ [useTodos] elapsed(ms): total=7.3, candidate=7.1, decision=0.1, aggregation=0
useTodos.js:53   🧭 [useTodos] stale: isStale=false, reason=none, lastSync=2026-02-21T10:59:31.434Z

## 4) DebugScreen 통합 검증

📋 로그
[오후 8:03:26] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:26] ✅ OVERALL PASS
[오후 8:03:26]   stage(c=8, d=7, a=7) | fresh/none
[오후 8:03:26] - sync-smoke: PASS @ 오후 8:03:24
[오후 8:03:26]   stage(c=8, d=8, a=20) | fresh/none
[오후 8:03:26] - common-range: PASS @ 오후 8:03:21
[오후 8:03:26]   stage(c=8, d=7, a=7) | fresh/none
[오후 8:03:26] - common-date: PASS @ 오후 8:03:19
[오후 8:03:26] 총 실행: 3 | PASS: 3 | FAIL: 0
[오후 8:03:26] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:26] 📄 공통 레이어 PASS/FAIL 요약
[오후 8:03:26] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:24] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:24] stale: isStale=false, reason=none
[오후 8:03:24] staleTransition: false -> false
[오후 8:03:24] ✅ PASS [sync-smoke]: stage(c=8, d=7, a=7)
[오후 8:03:24] 🔄 syncAll 호출 완료
[오후 8:03:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:23] 🧪 Sync 결합 스모크 시작
[오후 8:03:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:21] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:21] diag: completionCandidates=46, invalidRecurrence=0
[오후 8:03:21] stale: isStale=false, reason=none, lastSync=2026-02-21T11:03:11.241Z
[오후 8:03:21] elapsed: total=45.6ms | candidate=44.2ms | decision=0.7ms | aggregation=0.1ms
[오후 8:03:21] rangeDates=7
[오후 8:03:21] stage: candidate=8, decided=8, aggregated=20
[오후 8:03:21] ✅ PASS [common-range]
[오후 8:03:21] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:21] 🧩 공통 레이어 실행(range): 2026-02-21 ~ 2026-02-27
[오후 8:03:21] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:19] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:19]   [5] RQ-R-MONTHLY-21 | completed=N | key=6f9153d9-e03a-4ba8-a1e4-02007fe5d308_2026-02-21
[오후 8:03:19]   [4] RQ-R-WEEKLY-SAT-TIME | completed=Y | key=a35b13b0-ee3f-4197-8c41-1732fc0bf848_2026-02-21
[오후 8:03:19]   [3] RQ-SINGLE-0221 | completed=N | key=de8c6530-e9db-4976-b722-a7cd7f6b8f9d_null
[오후 8:03:19]   [2] RQ-REC-DAILY-0221 | completed=N | key=6411aa1f-91a2-4d3b-b31b-b6010050ea7d_2026-02-21
[오후 8:03:19]   [1] 테스트작업 | completed=Y | key=d2bd4013-a0ad-431a-bc70-8ca2805ba9dd_null
[오후 8:03:19] diag: completionCandidates=46, invalidRecurrence=0
[오후 8:03:19] stale: isStale=false, reason=none, lastSync=2026-02-21T11:03:11.241Z
[오후 8:03:19] elapsed: total=35.3ms | candidate=35ms | decision=0.3ms | aggregation=0ms
[오후 8:03:19] stage: candidate=8, decided=7, aggregated=7
[오후 8:03:19] ✅ PASS [common-date]
[오후 8:03:19] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 8:03:19] 🧩 공통 레이어 실행(date): 2026-02-21
[오후 8:03:19] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

---

## 5) Task 14 화면어댑터 스펙 인계 점검

점검일: 2026-02-21 (KST)

점검 범위:

1. `.kiro/specs/common-query-aggregation-layer/design.md`
2. `.kiro/specs/screen-adapter-layer/requirements.md`
3. `.kiro/specs/screen-adapter-layer/design.md`
4. `.kiro/specs/screen-adapter-layer/tasks.md`

점검 결과:

1. 경계 분리 일치
   - 공통 레이어: 조회/판정/병합 + handoff DTO까지
   - 화면어댑터: 화면별 shape 변환만 수행
2. 금지 규칙 일치
   - recurrence 최종 판정 재실행 금지
   - 서버 직접 조회 금지
   - completion 매칭 정책 변경 금지
3. 인계 계약 일치
   - handoff DTO + meta(`isStale`, `staleReason`, `lastSyncTime`)를 adapter 입력 계약으로 고정
4. 이행 가드 반영
   - TodoCalendar 브릿지 변환(`itemsByDate -> todosByMonth/completionsByMonth`) 명시
   - StripCalendar 전환 시 `ENABLE_STRIP_CALENDAR_SUMMARY` 활성화/제거 명시

판정:

PASS (Task 14 완료)
