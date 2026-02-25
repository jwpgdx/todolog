# Cache Policy Unification Validation Log

## 기록 규칙

1. Option A 전/후 로그를 분리해서 기록한다.
2. Option B 전환 후에는 cache hit/miss와 screen-compare를 항상 같이 기록한다.
3. 실패 로그도 삭제하지 않고 원인/조치와 함께 남긴다.

---

## Phase A (Option A) Baseline

날짜: 2026-02-23 (KST)

메모:

1. Option A 적용 전 기준선으로 사용한 screen-compare/sync/common 로그를 확보했다.
2. DebugScreen 기준으로 공통 레이어/화면 비교 PASS를 baseline으로 고정했다.
3. 본 baseline은 "기능 일치 + 캐시 통계 초기 상태" 확인 목적이다.

로그:

```text
[오전 12:51:22] ✅ PASS [common-range]
[오전 12:51:25] ✅ PASS [sync-smoke]: stage(c=5, d=3, a=3)
[오전 12:51:28] ✅ PASS [screen-compare]
[오전 12:51:28] ID diff: onlyTodoScreen=0, onlyTodoCalendar=0
[오전 12:51:28] StripCalendar(date): hasTodo=Y, dotCount=2, overflow=0
```

## Phase A (Option A) After

날짜: 2026-02-23 (KST)

메모:

1. Strip monthly 범위가 3개월 정책으로 동작하는 로그를 확보했다.
2. prefetch/settled 경로에서 range 확장 로드가 동작하며 Strip L1 cache에 반영됨을 확인했다.
3. DoD(C7-1) 정량 검증 완료: `option-a-benchmark`에서 elapsed 개선 62.3%를 기록했다.

로그:

```text
[오전 1:07:29] loadedRanges=1, summariesByDate=37
[오전 1:07:29] [1] 2026-01-01 ~ 2026-03-28
[오전 1:08:24] loadedRanges=3, summariesByDate=829
[오전 1:08:24] [1] 2026-01-01 ~ 2027-07-30
[오전 1:08:24] [2] 2027-08-01 ~ 2027-10-30
[오전 1:08:24] [3] 2027-11-01 ~ 2028-05-30
[오전 1:34:22] legacy_9week: elapsed=75.9ms, missΔ=6, hitΔ=0, loadsΔ=6
[오전 1:34:22] three_month: elapsed=28.6ms, missΔ=6, hitΔ=0, loadsΔ=6
[오전 1:34:22] improvement(elapsed)=62.3%
[오전 1:34:22] ✅ PASS [option-a-benchmark]: 30%+ 개선 충족
```

## Phase B (Option B) Baseline

날짜: 2026-02-23 (KST)

메모:

1. shared range cache 도입 직후 baseline에서 hit=0, miss 증가 패턴을 확인했다.
2. 이는 새 범위 확장 이동 테스트가 중심이었기 때문에 정상 패턴이다.

로그:

```text
[오전 1:07:27] entries=1, inFlight=0
[오전 1:07:27] hit=0, miss=2, inFlightDeduped=0, loads=3
[오전 1:08:22] entries=3, inFlight=0
[오전 1:08:22] hit=0, miss=16, inFlightDeduped=0, loads=17
```

## Phase B (Option B) After

날짜: 2026-02-23 (KST)

메모:

1. `range-hit-smoke` 추가 후 동일 range 2회 호출 검증으로 miss->hit 패턴을 확정했다.
2. 1차(forceRefresh) miss, 2차(same-range) hit가 재현되어 shared cache 동작을 증명했다.
3. Strip L1 clear 전용 버튼으로 local/store 캐시와 shared cache 상태를 분리 관측 가능해졌다.

로그:

```text
[오전 1:15:36] 🧪 Range Cache hit 스모크: 2026-02-23 ~ 2026-03-01
[오전 1:15:36] 1차(forceRefresh): missΔ=1, hitΔ=0
[오전 1:15:36] 2차(same-range): missΔ=0, hitΔ=1
[오전 1:15:36] ✅ PASS [range-hit-smoke]: 1차 miss, 2차 hit 확인
[오전 1:15:36] stats: hit=1, miss=17, loads=18, inFlightDeduped=0
```

## Screen Compare Summary

날짜: 2026-02-23 (KST)

요약:

```text
[오전 12:51:28] ✅ PASS [screen-compare]
[오전 12:51:28] ID diff: onlyTodoScreen=0, onlyTodoCalendar=0
[오전 12:51:28] TodoScreen: count=3
[오전 12:51:28] TodoCalendar(date): count=3
[오전 12:51:28] StripCalendar(date): hasTodo=Y, dotCount=2, overflow=0
```

## Task 9 Regression Sets (Final)

날짜: 2026-02-23 (KST)

요약:

```text
Set A - 일반 일정 (2026-02-23)
- common-date: 일반 일정/일반일정2/일반 일정3 확인
- screen-compare: PASS, ID diff=0
- sync-smoke: PASS, stale=false

Set B - 반복(일/주/월) (2026-02-25)
- common-date: 반복 일간/주간 반복일정/매월 25일 반복일정 확인
- screen-compare: PASS, ID diff=0
- sync-smoke: PASS, stale=false

Set C - 시간 포함 반복 (2026-02-27)
- common-date: 시간이 있는 반복일정 + 반복 일간 확인
- screen-compare: PASS, ID diff=0
- sync-smoke: PASS, stale=false
```

## Validation Closure

날짜: 2026-02-23 (KST)

요약:

```text
1) C7-1 (Option A 30% 개선): PASS
   - option-a-benchmark elapsed 개선 62.3%

2) C7-3 (3화면 diff=0, recurrence 포함): PASS
   - Set A/B/C 모두 screen-compare PASS, ID diff=0

3) C7-4 (sync 후 stale 회귀 없음): PASS
   - Set A/B/C 모두 sync-smoke PASS, stale=false

4) Blocking 미해결 항목: 없음
```

---

## Retention Window (Anchor ±6 Months)

날짜: 2026-02-25 (KST)

메모:

1. FlashList UI virtualization은 셀을 재활용하지만, shared range cache / screen L1 caches는 별개이므로 장기 스크롤 시 메모리 누적 가능성이 있다.
2. overlap/adjacent merge로 인해 `maxEntries`만으로는 1개의 거대 엔트리(수년치)가 생성될 수 있어, date-window prune(keep-range) 기반 retention을 추가했다.
3. retention은 상한(upper bound)이며, 실제 캐시 크기는 “가시 범위/프리패치 정책”에 따라 더 작게 유지될 수 있다.

검증 로그(요약):

```text
1) StripCalendar(월간) retention 테스트
🗓️ summaryDate 범위(키 기준): 2040-03-01 ~ 2040-05-30
  [1] 2040-03-01 ~ 2040-05-30
📦 strip loadedRanges:
loadedRanges=1, summariesByDate=91

2) TodoCalendar retention 테스트
📦 cached months(sample): 2040-09, 2040-10, 2040-11, 2040-12, 2041-01
🗓️ month 범위(키 기준): 2040-09 ~ 2041-01
items(total): todos=791, completions=0
```

판정:

- PASS (장기 스크롤로 캐시가 무한히 누적되는 구조가 아니라, anchor 기준 retention으로 상한이 생김)
