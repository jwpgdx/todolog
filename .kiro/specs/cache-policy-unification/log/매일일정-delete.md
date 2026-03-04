🗑️ [TodoScreen] 삭제 버튼 클릭: c6a2fdee-a8d3-4a8d-8d3f-2edfa4eb2da0
useDeleteTodo.js:50 ⚡ [useDeleteTodo] onMutate 완료: 0.30ms
useDeleteTodo.js:90 ⚠️ [useDeleteTodo] 서버 요청 실패 → SQLite 삭제로 fallback: Network Error
mutationFn @ useDeleteTodo.js:90
await in mutationFn
fn @ mutation.js:74
run @ retryer.js:77
start @ retryer.js:119
execute @ mutation.js:115
await in execute
mutate @ mutationObserver.js:61
(익명) @ useMutation.js:33
(익명) @ TodoScreen.js:68
onPress @ TodoListItem.js:76
onClick @ PressResponder.js:314
executeDispatch @ react-dom-client.development.js:16368
runWithFiberInDEV @ react-dom-client.development.js:1519
processDispatchQueue @ react-dom-client.development.js:16418
(익명) @ react-dom-client.development.js:17016
batchedUpdates$1 @ react-dom-client.development.js:3262
dispatchEventForPluginEventSystem @ react-dom-client.development.js:16572
dispatchEvent @ react-dom-client.development.js:20658
dispatchDiscreteEvent @ react-dom-client.development.js:20626이 오류 이해하기
database.js:166 📦 [DB] Already initialized (phase=ready, runId=1, hasInitPromise=Y)
todos.js:47  DELETE http://localhost:5001/api/todos/c6a2fdee-a8d3-4a8d-8d3f-2edfa4eb2da0 net::ERR_CONNECTION_REFUSED
dispatchXhrRequest @ xhr.js:198
xhr @ xhr.js:15
dispatchRequest @ dispatchRequest.js:51
Promise.then
_request @ Axios.js:163
request @ Axios.js:40
Axios.<computed> @ Axios.js:211
wrap @ bind.js:12
deleteTodo @ todos.js:47
mutationFn @ useDeleteTodo.js:80
await in mutationFn
fn @ mutation.js:74
run @ retryer.js:77
start @ retryer.js:119
execute @ mutation.js:115
await in execute
mutate @ mutationObserver.js:61
(익명) @ useMutation.js:33
(익명) @ TodoScreen.js:68
onPress @ TodoListItem.js:76
onClick @ PressResponder.js:314
executeDispatch @ react-dom-client.development.js:16368
runWithFiberInDEV @ react-dom-client.development.js:1519
processDispatchQueue @ react-dom-client.development.js:16418
(익명) @ react-dom-client.development.js:17016
batchedUpdates$1 @ react-dom-client.development.js:3262
dispatchEventForPluginEventSystem @ react-dom-client.development.js:16572
dispatchEvent @ react-dom-client.development.js:20658
dispatchDiscreteEvent @ react-dom-client.development.js:20626이 오류 이해하기
useDeleteTodo.js:93 ⚡ [useDeleteTodo] mutationFn 완료 (서버 실패): 103.30ms
database.js:166 📦 [DB] Already initialized (phase=ready, runId=1, hasInitPromise=Y)
todoCalendarStore.js:163 [TodoCalendarStore] Invalidated adjacent months: 2026-02, 2026-03, 2026-04
useDeleteTodo.js:117 📅 [useDeleteTodo] Calendar cache invalidated for 2026-3
rangeCacheService.js:431 [range-cache] invalidateByDateRange reason=strip-store-range-invalidation range=2026-03-03~2026-05-31 removedEntries=1 remainingEntries=1
useDeleteTodo.js:123 ⚡ [useDeleteTodo] onSuccess 완료: 1.50ms
stripCalendarDataAdapter.js:102 [strip-calendar:timeline] ensure start reason=monthly:dirty-refresh range=2026-03-03~2026-05-31 covered=N trace=sc-mmafzpbh-7bda5u t=69111.7ms
rangeCacheService.js:237 [range-cache:trace] trace=sc-mmafzpbh-7bda5u start range=2026-03-03~2026-05-31 forceRefresh=N entries=1 inFlight=0 t=69112.6ms
rangeCacheService.js:301 [range-cache:trace] trace=sc-mmafzpbh-7bda5u uncovered-count=1 computeMs=0 t=69113.4ms
candidateQueryService.js:762 [common-candidate:perf] mode=range range=2026-03-03~2026-05-31 total=18.8ms ensure=0ms pairFetch=18.8ms todoQuery=18.3ms todoDeserialize=0ms todoRows=6 completionQuery=16.7ms completionDeserialize=0ms completionRows=48 ensurePhase=ready->ready ensurePath=fast-sync eventLoopLag0=11.4ms(fired=Y) trace=sc-mmafzpbh-7bda5u
rangeCacheService.js:165 [range-cache:trace] trace=sc-mmafzpbh-7bda5u loadRange common-layer done range=2026-03-03~2026-05-31 elapsed=20.8ms t=69134.9ms
rangeCacheService.js:343 [range-cache:trace] trace=sc-mmafzpbh-7bda5u miss-resolved loadWaitMs=21 assembleMs=0.1 totalMs=22.6 t=69135.2ms
stripCalendarDataAdapter.js:52 [strip-calendar:perf] reason=monthly:dirty-refresh range=2026-03-03~2026-05-31 cacheHit=N source=strip-calendar total=23.9ms query=22.7ms adapt=0.1ms store=0.2ms stage(c=6,d=5,a=31) common(total=20.7,cand=18.8,dec=1.6,agg=0.1) profile(ensure=0,todoQ=18.3,todoDe=0,compQ=16.7,compDe=0) diag(itemDays=30,items=31,summaryDays=30,todoDays=30,dotDays=30,dotTotal=30,missingColorDays=0) trace=sc-mmafzpbh-7bda5u
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-04-20 phase=update actual=5.9ms base=12.5ms start=69139.7ms commit=69160.7ms t=69161.2ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-05-04 phase=update actual=4.3ms base=13ms start=69145.6ms commit=69160.7ms t=69162ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=24.1ms base=78.8ms start=69136ms commit=69160.7ms t=69162.6ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=24.1ms base=79.2ms start=69136ms commit=69160.7ms t=69163.2ms
candidateQueryService.js:617 [common-candidate:perf] mode=date target=2026-03-03 total=42.2ms ensure=0ms pairFetch=42.2ms todoQuery=42.2ms todoDeserialize=0ms todoRows=3 completionQuery=42ms completionDeserialize=0ms completionRows=48 ensurePhase=ready->ready ensurePath=fast-sync
useTodos.js:57 ⚡ [useTodos] 전체: 0개 (42.60ms)
useTodos.js:58   📊 [useTodos] stage: candidate=3, decided=0, aggregated=0
useTodos.js:59   ⏱️ [useTodos] elapsed(ms): total=42.5, candidate=42.2, decision=0.1, aggregation=0
useTodos.js:60   🧭 [useTodos] stale: isStale=true, reason=sync_failed, lastSync=2026-02-27T14:47:16.578Z
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-30 phase=update actual=14.3ms base=13.4ms start=81745.2ms commit=81759.8ms t=81760.6ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=18.1ms base=81.2ms start=81741.5ms commit=81759.8ms t=81762.4ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=18.1ms base=81.6ms start=81741.5ms commit=81759.8ms t=81763ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-23 phase=update actual=15.5ms base=14.7ms start=81877.2ms commit=81893.2ms t=81894.1ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=19.1ms base=83ms start=81873.6ms commit=81893.2ms t=81895.9ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=19.1ms base=83.4ms start=81873.5ms commit=81893.2ms t=81896.6ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-16 phase=update actual=12.9ms base=12.2ms start=81976ms commit=81989.1ms t=81989.9ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=15.7ms base=82.6ms start=81973.2ms commit=81989.1ms t=81991.7ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=15.7ms base=83ms start=81973.2ms commit=81989.1ms t=81992.5ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-09 phase=update actual=15.4ms base=14.4ms start=82076.7ms commit=82092.3ms t=82093.2ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=18.8ms base=85ms start=82073.1ms commit=82092.3ms t=82095ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=18.8ms base=85.4ms start=82073.1ms commit=82092.3ms t=82095.7ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-02 phase=update actual=14.2ms base=13.1ms start=82377.9ms commit=82392.5ms t=82393.2ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=18.2ms base=86.6ms start=82373.9ms commit=82392.5ms t=82394.8ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=18.2ms base=87ms start=82373.9ms commit=82392.5ms t=82395.6ms
MonthlyStripList.js:881 [strip-calendar:ui] monthly align=ready phase=programmatic targetTopWeekStart=2026-03-09 targetIndex=521 weekStarts=1041 t=82760.7ms
useStripCalendarDataRange.js:209 [strip-calendar:timeline] ensure request mode=monthly range=2026-02-01~2026-04-30 trace=scm-mmafzzuo-9tx4n7 t=82762.6ms
stripCalendarDataAdapter.js:102 [strip-calendar:timeline] ensure start reason=monthly:settled range=2026-02-01~2026-04-30 covered=Y trace=scm-mmafzzuo-9tx4n7 t=82763.3ms
stripCalendarDataAdapter.js:52 [strip-calendar:perf] reason=monthly:settled range=2026-02-01~2026-04-30 cacheHit=Y source=l1-store total=0.6ms query=0ms adapt=0ms store=0ms trace=scm-mmafzzuo-9tx4n7
useStripCalendarDataRange.js:228 [strip-calendar:state] reason=monthly:settled range=2026-02-01~2026-04-30 cacheHit=Y covered=Y loadedRanges=1 storedDays=75 todoDays=75 dotDays=75 dotTotal=81 trace=scm-mmafzzuo-9tx4n7
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-04-13 phase=update actual=15ms base=13.8ms start=82773.6ms commit=82789ms t=82789.7ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=17.8ms base=86.2ms start=82770.7ms commit=82789ms t=82791.4ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=17.8ms base=86.7ms start=82770.6ms commit=82789ms t=82792.1ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-02 phase=update actual=13.9ms base=12.8ms start=83609.6ms commit=83623.9ms t=83624.8ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=17.7ms base=86.2ms start=83605.7ms commit=83623.9ms t=83626.5ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=17.7ms base=86.7ms start=83605.7ms commit=83623.9ms t=83627.2ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-02-23 phase=update actual=13.7ms base=12.7ms start=83745.7ms commit=83759.7ms t=83760.4ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=17.8ms base=88.2ms start=83741.6ms commit=83759.7ms t=83762.2ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=17.8ms base=88.7ms start=83741.6ms commit=83759.7ms t=83763ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-02-16 phase=update actual=14.2ms base=13.1ms start=83844.3ms commit=83858.7ms t=83859.4ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=17.2ms base=87.2ms start=83841.2ms commit=83858.7ms t=83861.1ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=17.2ms base=87.7ms start=83841.2ms commit=83858.7ms t=83861.8ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-30 phase=update actual=15ms base=14.1ms start=83955.1ms commit=83971.7ms t=83972.7ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=18.1ms base=88.2ms start=83952.1ms commit=83971.7ms t=83975ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=18.7ms base=88.8ms start=83951.5ms commit=83971.7ms t=83975.8ms
MonthlyStripList.js:881 [strip-calendar:ui] monthly align=ready phase=programmatic targetTopWeekStart=2026-02-23 targetIndex=519 weekStarts=1041 t=83979.2ms
useStripCalendarDataRange.js:209 [strip-calendar:timeline] ensure request mode=monthly range=2026-01-01~2026-03-31 trace=scm-mmag00si-bzd9ej t=83980.9ms
stripCalendarDataAdapter.js:102 [strip-calendar:timeline] ensure start reason=monthly:settled range=2026-01-01~2026-03-31 covered=N trace=scm-mmag00si-bzd9ej t=83981.5ms
rangeCacheService.js:237 [range-cache:trace] trace=scm-mmag00si-bzd9ej start range=2026-01-01~2026-03-31 forceRefresh=N entries=1 inFlight=0 t=83982.1ms
rangeCacheService.js:301 [range-cache:trace] trace=scm-mmag00si-bzd9ej uncovered-count=1 computeMs=0 t=83982.8ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-02-16 phase=update actual=13.1ms base=12.3ms start=83999.1ms commit=84012.3ms t=84013ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=16ms base=86.3ms start=83996.2ms commit=84012.3ms t=84014.6ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=16ms base=86.9ms start=83996.2ms commit=84012.3ms t=84015.1ms
candidateQueryService.js:762 [common-candidate:perf] mode=range range=2026-01-01~2026-01-31 total=37.4ms ensure=0ms pairFetch=37.4ms todoQuery=37ms todoDeserialize=0ms todoRows=1 completionQuery=35.7ms completionDeserialize=0ms completionRows=48 ensurePhase=ready->ready ensurePath=fast-sync eventLoopLag0=12.1ms(fired=Y) trace=scm-mmag00si-bzd9ej
rangeCacheService.js:165 [range-cache:trace] trace=scm-mmag00si-bzd9ej loadRange common-layer done range=2026-01-01~2026-01-31 elapsed=37.7ms t=84021.1ms
rangeCacheService.js:343 [range-cache:trace] trace=scm-mmag00si-bzd9ej miss-resolved loadWaitMs=37.8 assembleMs=0.1 totalMs=39.2 t=84021.3ms
stripCalendarDataAdapter.js:52 [strip-calendar:perf] reason=monthly:settled range=2026-01-01~2026-03-31 cacheHit=N source=strip-calendar total=40.3ms query=39.3ms adapt=0.1ms store=0.3ms stage(c=1,d=1,a=1) common(total=37.7,cand=37.4,dec=0,agg=0.1) profile(ensure=0,todoQ=37,todoDe=0,compQ=35.7,compDe=0) diag(itemDays=28,items=111,summaryDays=28,todoDays=28,dotDays=28,dotTotal=34,missingColorDays=0) trace=scm-mmag00si-bzd9ej
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-09 phase=update actual=5.4ms base=14.3ms start=84025.9ms commit=84055.2ms t=84055.9ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-23 phase=update actual=4.1ms base=15ms start=84031.5ms commit=84055.2ms t=84056.8ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-02-16 phase=update actual=5.7ms base=12.4ms start=84035.7ms commit=84055.2ms t=84057.4ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-02-23 phase=update actual=7.9ms base=12.8ms start=84041.5ms commit=84055.2ms t=84058ms
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-16 phase=update actual=5.3ms base=12.3ms start=84049.4ms commit=84055.2ms t=84058.6ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=32.2ms base=87.1ms start=84022.2ms commit=84055.2ms t=84059.2ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=32.2ms base=87.7ms start=84022.2ms commit=84055.2ms t=84059.8ms
useStripCalendarDataRange.js:228 [strip-calendar:state] reason=monthly:settled range=2026-01-01~2026-03-31 cacheHit=N covered=Y loadedRanges=1 storedDays=46 todoDays=46 dotDays=46 dotTotal=52 trace=scm-mmag00si-bzd9ej
MonthlyStripList.js:186 [strip-calendar:react-profiler] id=MonthlyWeekRow:2026-03-30 phase=update actual=13.7ms base=12.7ms start=84100.6ms commit=84114.6ms t=84115.5ms
MonthlyStripList.js:177 [strip-calendar:react-profiler] id=MonthlyFlashListSubtree phase=update actual=16.8ms base=87.4ms start=84097.4ms commit=84114.6ms t=84117.3ms
StripCalendarShell.js:87 [strip-calendar:react-profiler] id=StripCalendarMonthlySubtree phase=update actual=16.8ms base=88ms start=84097.4ms commit=84114.6ms t=84117.9ms