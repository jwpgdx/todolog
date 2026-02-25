## 참고 문서
- `.kiro/specs/common-query-aggregation-layer/todo-calendar-first-entry-lag-postmortem-2026-02-24.md`

## 1-1. 변경전
📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N source=strip-calendar total=160.6ms query=159.8ms adapt=0.3ms store=0.3ms stage(c=89,d=89,a=168) common(total=158.8,cand=155.6,dec=2.3,agg=0.3) diag(itemDays=30,items=168,summaryDays=30,todoDays=30,dotDays=30,dotTotal=52,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N covered=Y loadedRanges=1 storedDays=30 todoDays=30 dotDays=30 dotTotal=52
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=pending targetTopWeekStart=2026-02-22 targetIndex=520 weekStarts=1041
2database.js:110 📦 [DB] Already initialized
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-02-22 targetIndex=520 weekStarts=1041
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2026-01-01~2026-03-28 cacheHit=N source=strip-calendar total=414.9ms query=414.7ms adapt=0ms store=0.1ms stage(c=8,d=8,a=54) common(total=412.6,cand=411.8,dec=0.6,agg=0.1) diag(itemDays=44,items=222,summaryDays=44,todoDays=44,dotDays=44,dotTotal=80,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-01-01~2026-03-28 cacheHit=N covered=Y loadedRanges=1 storedDays=44 todoDays=44 dotDays=44 dotTotal=80
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-04-19 targetIndex=528 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2026-03-01~2026-05-30 cacheHit=N source=strip-calendar total=23.6ms query=23.3ms adapt=0.1ms store=0.1ms stage(c=8,d=8,a=238) common(total=22.7,cand=20.3,dec=1.9,agg=0.4) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-03-01~2026-05-30 cacheHit=N covered=Y loadedRanges=1 storedDays=91 todoDays=91 dotDays=91 dotTotal=182
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-06-14 targetIndex=536 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2026-05-01~2026-07-30 cacheHit=N source=strip-calendar total=34.3ms query=34ms adapt=0.2ms store=0.1ms stage(c=8,d=8,a=230) common(total=33.5,cand=31.4,dec=1.8,agg=0.2) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-05-01~2026-07-30 cacheHit=N covered=Y loadedRanges=1 storedDays=91 todoDays=91 dotDays=91 dotTotal=182
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-09-13 targetIndex=549 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2026-08-01~2026-10-30 cacheHit=N source=strip-calendar total=36.7ms query=36.2ms adapt=0.1ms store=0.3ms stage(c=8,d=8,a=344) common(total=35.9,cand=32.8,dec=2.5,agg=0.5) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-08-01~2026-10-30 cacheHit=N covered=Y loadedRanges=2 storedDays=91 todoDays=91 dotDays=91 dotTotal=182
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-12-13 targetIndex=562 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2026-11-01~2027-01-31 cacheHit=N source=strip-calendar total=14.6ms query=14.1ms adapt=0.2ms store=0.3ms stage(c=8,d=8,a=348) common(total=13.8,cand=10.9,dec=2.4,agg=0.4) diag(itemDays=92,items=348,summaryDays=92,todoDays=92,dotDays=92,dotTotal=184,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-11-01~2027-01-31 cacheHit=N covered=Y loadedRanges=3 storedDays=92 todoDays=92 dotDays=92 dotTotal=184



## 1-2. 변경전 (todo-calendar를 들어갔다가 strip-calendar 들어가서 weekly->monthly 전환했을때)
[CalendarStore] Initialized with 5 months: (5) ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04']
useInfiniteCalendar.js:31 [useInfiniteCalendar] Initialize: 1.6669921875 ms
calendarStore.js:106 [CalendarStore] Added 6 past months, total: 11
useInfiniteCalendar.js:77 [useInfiniteCalendar] Add 6 past months: 0.907958984375 ms
useTodoCalendarData.js:76 [useTodoCalendarData] Visible months: 2026-02 ~ 2026-03
useTodoCalendarData.js:92 [useTodoCalendarData] Prefetch range (±2): 2025-12 ~ 2026-05 (6 months)
useTodoCalendarData.js:102 [useTodoCalendarData] Cache miss: 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05 (6 months)
calendarTodoService.js:58 [CalendarTodoService] Common range query: 2025-11-30 ~ 2026-06-06 (6 months)
database.js:110 📦 [DB] Already initialized
calendarTodoService.js:71 [CalendarTodoService] Range cache: hit=N, inFlightDeduped=N
calendarTodoService.js:87 [CalendarTodoService] Adapted in 472.70ms | stage(c=90, d=90, a=487)
useTodoCalendarData.js:119 [useTodoCalendarData] Fetched 6 months in 473.30ms
useTodoCalendarData.js:124 [useTodoCalendarData] Store updated successfully
useTodoCalendarData.js:76 [useTodoCalendarData] Visible months: 2026-02 ~ 2026-03
useTodoCalendarData.js:92 [useTodoCalendarData] Prefetch range (±2): 2025-12 ~ 2026-05 (6 months)
useTodoCalendarData.js:98 [useTodoCalendarData] All months cached, no fetch needed
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N source=strip-calendar total=1.9ms query=1.1ms adapt=0.3ms store=0.2ms stage(c=90,d=90,a=487) common(total=468.5,cand=461.6,dec=5.5,agg=0.9) diag(itemDays=30,items=168,summaryDays=30,todoDays=30,dotDays=30,dotTotal=52,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N covered=Y loadedRanges=1 storedDays=30 todoDays=30 dotDays=30 dotTotal=52
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=pending targetTopWeekStart=2026-02-22 targetIndex=520 weekStarts=1041
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2026-01-01~2026-03-28 cacheHit=N source=strip-calendar total=79ms query=78.7ms adapt=0.1ms store=0.2ms stage(c=90,d=90,a=487) common(total=468.5,cand=461.6,dec=5.5,agg=0.9) diag(itemDays=44,items=222,summaryDays=44,todoDays=44,dotDays=44,dotTotal=80,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-01-01~2026-03-28 cacheHit=N covered=Y loadedRanges=1 storedDays=44 todoDays=44 dotDays=44 dotTotal=80
[strip-calendar:ui] monthly align=pending targetTopWeekStart=2027-03-07 targetIndex=574 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2027-02-01~2027-04-30 cacheHit=N source=strip-calendar total=16.3ms query=15.9ms adapt=0.1ms store=0.2ms stage(c=8,d=8,a=336) common(total=15.5,cand=12.4,dec=2.6,agg=0.5) diag(itemDays=89,items=336,summaryDays=89,todoDays=89,dotDays=89,dotTotal=178,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2027-02-01~2027-04-30 cacheHit=N covered=Y loadedRanges=2 storedDays=89 todoDays=89 dotDays=89 dotTotal=178
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=pending targetTopWeekStart=2027-11-28 targetIndex=612 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2027-10-01~2027-12-30 cacheHit=N source=strip-calendar total=60.3ms query=59.9ms adapt=0.2ms store=0.2ms stage(c=8,d=8,a=344) common(total=59.4,cand=54.8,dec=4,agg=0.5) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2027-10-01~2027-12-30 cacheHit=N covered=Y loadedRanges=3 storedDays=91 todoDays=91 dotDays=91 dotTotal=182
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=pending targetTopWeekStart=2028-04-16 targetIndex=632 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2028-03-01~2028-05-30 cacheHit=N source=strip-calendar total=13.2ms query=12.7ms adapt=0.1ms store=0.3ms stage(c=8,d=8,a=344) common(total=12.3,cand=9.6,dec=2.3,agg=0.4) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2028-03-01~2028-05-30 cacheHit=N covered=Y loadedRanges=4 storedDays=91 todoDays=91 dotDays=91 dotTotal=182
MonthlyStripList.js:318 [strip-calendar:ui] monthly align=pending targetTopWeekStart=2028-10-01 targetIndex=656 weekStarts=1041
database.js:110 📦 [DB] Already initialized
stripCalendarDataAdapter.js:40 [strip-calendar:perf] reason=monthly:settled range=2028-09-01~2028-11-30 cacheHit=N source=strip-calendar total=44.2ms query=43.7ms adapt=0.1ms store=0.4ms stage(c=8,d=8,a=344) common(total=43.2,cand=40.4,dec=2.3,agg=0.4) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2028-09-01~2028-11-30 cacheHit=N covered=Y loadedRanges=5 storedDays=91 todoDays=91 dotDays=91 dotTotal=182




## 2-1. 변경후
📦 [DB] Already initialized
candidateQueryService.js:486 [common-candidate:perf] mode=range range=2026-02-08~2026-03-14 total=139.7ms ensure=3.3ms todoQuery=136.2ms todoDeserialize=0.1ms todoRows=89 completionQuery=136.1ms completionDeserialize=0ms completionRows=52
candidateQueryService.js:225 [common-candidate:explain] mode=range trigger=slow todosPlan= (16) ['CO-ROUTINE candidate_ids', 'COMPOUND QUERY', 'LEFT-MOST SUBQUERY', 'SEARCH todos USING INDEX idx_todos_active_date (date>? AND date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_active_range (start_date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_active_start_open (start_date>? AND start_date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_active_recur_window (start_date>? AND start_date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_recurrence_window (start_date=?)', 'SCAN ids', 'SEARCH t USING INDEX sqlite_autoindex_todos_1 (_id=?)', 'SEARCH c USING INDEX sqlite_autoindex_categories_1 (_id=?) LEFT-JOIN', 'USE TEMP B-TREE FOR ORDER BY']
candidateQueryService.js:226 [common-candidate:explain] mode=range trigger=slow completionsPlan= (5) ['COMPOUND QUERY', 'LEFT-MOST SUBQUERY', 'SEARCH completions USING INDEX idx_completions_date (date>? AND date<?)', 'UNION ALL', 'SEARCH completions USING INDEX idx_completions_date (date=?)']
stripCalendarDataAdapter.js:44 [strip-calendar:perf] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N source=strip-calendar total=148.2ms query=147.4ms adapt=0.3ms store=0.2ms stage(c=89,d=89,a=168) common(total=146.2,cand=139.7,dec=1.9,agg=0.3) profile(ensure=3.3,todoQ=136.2,todoDe=0.1,compQ=136.1,compDe=0) diag(itemDays=30,items=168,summaryDays=30,todoDays=30,dotDays=30,dotTotal=52,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N covered=Y loadedRanges=1 storedDays=30 todoDays=30 dotDays=30 dotTotal=52

## 2-2. 변경전 (todo-calendar를 들어갔다가 strip-calendar 들어가서 weekly->monthly 전환했을때)
[CalendarStore] Initialized with 5 months: (5) ['2025-12', '2026-01', '2026-02', '2026-03', '2026-04']
useInfiniteCalendar.js:31 [useInfiniteCalendar] Initialize: 3.60400390625 ms
calendarStore.js:106 [CalendarStore] Added 6 past months, total: 11
useInfiniteCalendar.js:77 [useInfiniteCalendar] Add 6 past months: 0.822998046875 ms
useTodoCalendarData.js:76 [useTodoCalendarData] Visible months: 2026-02 ~ 2026-03
useTodoCalendarData.js:92 [useTodoCalendarData] Prefetch range (±2): 2025-12 ~ 2026-05 (6 months)
useTodoCalendarData.js:102 [useTodoCalendarData] Cache miss: 2025-12, 2026-01, 2026-02, 2026-03, 2026-04, 2026-05 (6 months)
calendarTodoService.js:58 [CalendarTodoService] Common range query: 2025-11-30 ~ 2026-06-06 (6 months)
database.js:115 📦 [DB] Already initialized
candidateQueryService.js:486 [common-candidate:perf] mode=range range=2025-11-30~2026-06-06 total=427.1ms ensure=405.8ms todoQuery=21.2ms todoDeserialize=0ms todoRows=90 completionQuery=21.1ms completionDeserialize=0ms completionRows=52
candidateQueryService.js:225 [common-candidate:explain] mode=range trigger=slow todosPlan= (16) ['CO-ROUTINE candidate_ids', 'COMPOUND QUERY', 'LEFT-MOST SUBQUERY', 'SEARCH todos USING INDEX idx_todos_active_date (date>? AND date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_active_range (start_date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_active_start_open (start_date>? AND start_date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_active_recur_window (start_date>? AND start_date<?)', 'UNION USING TEMP B-TREE', 'SEARCH todos USING INDEX idx_todos_recurrence_window (start_date=?)', 'SCAN ids', 'SEARCH t USING INDEX sqlite_autoindex_todos_1 (_id=?)', 'SEARCH c USING INDEX sqlite_autoindex_categories_1 (_id=?) LEFT-JOIN', 'USE TEMP B-TREE FOR ORDER BY']
candidateQueryService.js:226 [common-candidate:explain] mode=range trigger=slow completionsPlan= (5) ['COMPOUND QUERY', 'LEFT-MOST SUBQUERY', 'SEARCH completions USING INDEX idx_completions_date (date>? AND date<?)', 'UNION ALL', 'SEARCH completions USING INDEX idx_completions_date (date=?)']
calendarTodoService.js:71 [CalendarTodoService] Range cache: hit=N, inFlightDeduped=N
calendarTodoService.js:87 [CalendarTodoService] Adapted in 438.80ms | stage(c=90, d=90, a=487) elapsed(total=435.3, cand=427.1, dec=4.4, agg=0.7) profile(ensure=405.8, todoQ=21.2, todoDe=0, compQ=21.1, compDe=0)
useTodoCalendarData.js:119 [useTodoCalendarData] Fetched 6 months in 439.10ms
useTodoCalendarData.js:124 [useTodoCalendarData] Store updated successfully
useTodoCalendarData.js:76 [useTodoCalendarData] Visible months: 2026-02 ~ 2026-03
useTodoCalendarData.js:92 [useTodoCalendarData] Prefetch range (±2): 2025-12 ~ 2026-05 (6 months)
useTodoCalendarData.js:98 [useTodoCalendarData] All months cached, no fetch needed
stripCalendarDataAdapter.js:44 [strip-calendar:perf] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N source=strip-calendar total=1.8ms query=1.2ms adapt=0.3ms store=0.1ms stage(c=90,d=90,a=487) common(total=435.3,cand=427.1,dec=4.4,agg=0.7) profile(ensure=405.8,todoQ=21.2,todoDe=0,compQ=21.1,compDe=0) diag(itemDays=30,items=168,summaryDays=30,todoDays=30,dotDays=30,dotTotal=52,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=weekly:settled range=2026-02-08~2026-03-14 cacheHit=N covered=Y loadedRanges=1 storedDays=30 todoDays=30 dotDays=30 dotTotal=52
MonthlyStripList.js:327 [strip-calendar:ui] monthly align=pending targetTopWeekStart=2026-02-22 targetIndex=520 weekStarts=1041
stripCalendarDataAdapter.js:44 [strip-calendar:perf] reason=monthly:settled range=2026-01-01~2026-03-28 cacheHit=N source=strip-calendar total=83.9ms query=83.7ms adapt=0ms store=0.1ms stage(c=90,d=90,a=487) common(total=435.3,cand=427.1,dec=4.4,agg=0.7) profile(ensure=405.8,todoQ=21.2,todoDe=0,compQ=21.1,compDe=0) diag(itemDays=44,items=222,summaryDays=44,todoDays=44,dotDays=44,dotTotal=80,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-01-01~2026-03-28 cacheHit=N covered=Y loadedRanges=1 storedDays=44 todoDays=44 dotDays=44 dotTotal=80
MonthlyStripList.js:327 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-02-22 targetIndex=520 weekStarts=1041
MonthlyStripList.js:327 [strip-calendar:ui] monthly align=ready targetTopWeekStart=2026-04-12 targetIndex=527 weekStarts=1041
stripCalendarDataAdapter.js:44 [strip-calendar:perf] reason=monthly:settled range=2026-03-01~2026-05-30 cacheHit=N source=strip-calendar total=4.8ms query=4.3ms adapt=0.2ms store=0.1ms stage(c=90,d=90,a=487) common(total=435.3,cand=427.1,dec=4.4,agg=0.7) profile(ensure=405.8,todoQ=21.2,todoDe=0,compQ=21.1,compDe=0) diag(itemDays=91,items=344,summaryDays=91,todoDays=91,dotDays=91,dotTotal=182,missingColorDays=0)
useStripCalendarDataRange.js:152 [strip-calendar:state] reason=monthly:settled range=2026-03-01~2026-05-30 cacheHit=N covered=Y loadedRanges=1 storedDays=91 todoDays=91 dotDays=91 dotTotal=182
