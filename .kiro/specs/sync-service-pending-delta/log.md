## 1) 정상 처리량(Throughput) 테스트
📋 로그
[오후 7:44:22] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:44:22] ✅ Pending 없음
[오후 7:44:22] 
[오후 7:44:22] ✅ Completion Pending: 0개
[오후 7:44:22] 📊 상태 요약: pending=0, failed=0, dead_letter=0
[오후 7:44:22] 🚀 즉시 처리 가능(ready): 0개
[오후 7:44:22] ⏳ 전체 Pending: 0개
[오후 7:44:22] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:44:22] ⏳ Pending Changes 확인
[오후 7:44:22] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:44:07] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:44:07] 📊 현재 Pending: 0개
[오후 7:44:07] lastError=null
[오후 7:44:07] blockingFailure=false
[오후 7:44:07] removed=48, deadLetter=0, deferred=0
[오후 7:44:07] processed=48, succeeded=48, failed=0
[오후 7:44:07] ok=true
[오후 7:44:00] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:44:00] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:44:00] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

## 2) 배치 처리 동작(batch size) 테스트

📋 로그
[오후 7:48:26] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:47:13
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: a4793dcc
[오후 7:48:26]   [10] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:47:09
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: ecb6e306
[오후 7:48:26]   [9] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:47:07
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: c512d74c
[오후 7:48:26]   [8] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:47:03
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: f7cbd728
[오후 7:48:26]   [7] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:47:01
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: 287d858e
[오후 7:48:26]   [6] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:46:59
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: de06544a
[오후 7:48:26]   [5] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:46:56
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: 779e1ab8
[오후 7:48:26]   [4] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:46:53
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: 05327134
[오후 7:48:26]   [3] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:46:51
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: db9e8096
[오후 7:48:26]   [2] createTodo | status=pending | retry=0
[오후 7:48:26] 
[오후 7:48:26]       created: 2026. 2. 20. 오후 7:46:48
[오후 7:48:26]       lastError: null
[오후 7:48:26]       nextRetryAt: null
[오후 7:48:26]       date: null
[오후 7:48:26]       todoId: ad24421c
[오후 7:48:26]   [1] createTodo | status=pending | retry=0
[오후 7:48:26] 📋 최근 Pending (최대 10개):
[오후 7:48:26] 
[오후 7:48:26] ✅ Completion Pending: 23개
[오후 7:48:26] 📊 상태 요약: pending=38, failed=0, dead_letter=0
[오후 7:48:26] 🚀 즉시 처리 가능(ready): 38개
[오후 7:48:26] ⏳ 전체 Pending: 38개
[오후 7:48:26] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:26] ⏳ Pending Changes 확인
[오후 7:48:26] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:23] 📊 현재 Pending: 38개
[오후 7:48:23] lastError=null
[오후 7:48:23] blockingFailure=false
[오후 7:48:23] removed=3, deadLetter=0, deferred=0
[오후 7:48:23] processed=3, succeeded=3, failed=0
[오후 7:48:23] ok=true
[오후 7:48:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:23] 🚀 Pending Push 실행 (maxItems=3)
[오후 7:48:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━




📋 로그
[오후 7:48:43] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:21
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: 7131b9b7
[오후 7:48:43]   [10] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:18
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: 5550be3d
[오후 7:48:43]   [9] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:16
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: 81cf33c3
[오후 7:48:43]   [8] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:13
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: a4793dcc
[오후 7:48:43]   [7] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:09
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: ecb6e306
[오후 7:48:43]   [6] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:07
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: c512d74c
[오후 7:48:43]   [5] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:03
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: f7cbd728
[오후 7:48:43]   [4] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:47:01
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: 287d858e
[오후 7:48:43]   [3] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:46:59
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: de06544a
[오후 7:48:43]   [2] createTodo | status=pending | retry=0
[오후 7:48:43] 
[오후 7:48:43]       created: 2026. 2. 20. 오후 7:46:56
[오후 7:48:43]       lastError: null
[오후 7:48:43]       nextRetryAt: null
[오후 7:48:43]       date: null
[오후 7:48:43]       todoId: 779e1ab8
[오후 7:48:43]   [1] createTodo | status=pending | retry=0
[오후 7:48:43] 📋 최근 Pending (최대 10개):
[오후 7:48:43] 
[오후 7:48:43] ✅ Completion Pending: 23개
[오후 7:48:43] 📊 상태 요약: pending=35, failed=0, dead_letter=0
[오후 7:48:43] 🚀 즉시 처리 가능(ready): 35개
[오후 7:48:43] ⏳ 전체 Pending: 35개
[오후 7:48:43] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:43] ⏳ Pending Changes 확인
[오후 7:48:43] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:40] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:40] 📊 현재 Pending: 35개
[오후 7:48:40] lastError=null
[오후 7:48:40] blockingFailure=false
[오후 7:48:40] removed=3, deadLetter=0, deferred=0
[오후 7:48:40] processed=3, succeeded=3, failed=0
[오후 7:48:40] ok=true
[오후 7:48:40] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:40] 🚀 Pending Push 실행 (maxItems=3)
[오후 7:48:40] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━




📋 로그
[오후 7:48:59] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:27
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: bd8_null
[오후 7:48:59]   [10] createCompletion | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:26
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: 0e778f9e
[오후 7:48:59]   [9] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:23
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: 3f0459c2
[오후 7:48:59]   [8] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:21
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: 7131b9b7
[오후 7:48:59]   [7] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:18
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: 5550be3d
[오후 7:48:59]   [6] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:16
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: 81cf33c3
[오후 7:48:59]   [5] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:13
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: a4793dcc
[오후 7:48:59]   [4] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:09
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: ecb6e306
[오후 7:48:59]   [3] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:07
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: c512d74c
[오후 7:48:59]   [2] createTodo | status=pending | retry=0
[오후 7:48:59] 
[오후 7:48:59]       created: 2026. 2. 20. 오후 7:47:03
[오후 7:48:59]       lastError: null
[오후 7:48:59]       nextRetryAt: null
[오후 7:48:59]       date: null
[오후 7:48:59]       todoId: f7cbd728
[오후 7:48:59]   [1] createTodo | status=pending | retry=0
[오후 7:48:59] 📋 최근 Pending (최대 10개):
[오후 7:48:59] 
[오후 7:48:59] ✅ Completion Pending: 23개
[오후 7:48:59] 📊 상태 요약: pending=32, failed=0, dead_letter=0
[오후 7:48:59] 🚀 즉시 처리 가능(ready): 32개
[오후 7:48:59] ⏳ 전체 Pending: 32개
[오후 7:48:59] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:59] ⏳ Pending Changes 확인
[오후 7:48:59] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:57] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:57] 📊 현재 Pending: 32개
[오후 7:48:57] lastError=null
[오후 7:48:57] blockingFailure=false
[오후 7:48:57] removed=3, deadLetter=0, deferred=0
[오후 7:48:57] processed=3, succeeded=3, failed=0
[오후 7:48:57] ok=true
[오후 7:48:57] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:48:57] 🚀 Pending Push 실행 (maxItems=3)
[오후 7:48:57] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━




📋 로그
[오후 7:49:28] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:49:28] ✅ Pending 없음
[오후 7:49:28] 
[오후 7:49:28] ✅ Completion Pending: 0개
[오후 7:49:28] 📊 상태 요약: pending=0, failed=0, dead_letter=0
[오후 7:49:28] 🚀 즉시 처리 가능(ready): 0개
[오후 7:49:28] ⏳ 전체 Pending: 0개
[오후 7:49:28] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:49:28] ⏳ Pending Changes 확인
[오후 7:49:28] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:49:20] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:49:20] 📊 현재 Pending: 0개
[오후 7:49:20] lastError=null
[오후 7:49:20] blockingFailure=false
[오후 7:49:20] removed=32, deadLetter=0, deferred=0
[오후 7:49:20] processed=32, succeeded=32, failed=0
[오후 7:49:20] ok=true
[오후 7:49:15] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:49:15] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:49:15] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



## 3) 재시도 압력(retry/dead-letter) 테스트
### 2
📋 로그
[오후 7:52:07] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:07] 📊 현재 Pending: 10개
[오후 7:52:07] lastError=[network_or_timeout] status=n/a Network Error
[오후 7:52:07] blockingFailure=true
[오후 7:52:07] removed=0, deadLetter=0, deferred=0
[오후 7:52:07] processed=1, succeeded=0, failed=1
[오후 7:52:07] ok=false
[오후 7:52:07] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:07] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:52:07] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:06] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:06] 📊 현재 Pending: 10개
[오후 7:52:06] lastError=[network_or_timeout] status=n/a Network Error
[오후 7:52:06] blockingFailure=true
[오후 7:52:06] removed=0, deadLetter=0, deferred=0
[오후 7:52:06] processed=1, succeeded=0, failed=1
[오후 7:52:06] ok=false
[오후 7:52:06] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:06] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:52:06] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:05] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:05] 📊 현재 Pending: 10개
[오후 7:52:05] lastError=[network_or_timeout] status=n/a Network Error
[오후 7:52:05] blockingFailure=true
[오후 7:52:05] removed=0, deadLetter=0, deferred=0
[오후 7:52:05] processed=1, succeeded=0, failed=1
[오후 7:52:05] ok=false
[오후 7:52:05] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:05] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:52:05] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:51:50] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:51:50] 📊 현재 Pending: 10개
[오후 7:51:50] lastError=[network_or_timeout] status=n/a Network Error
[오후 7:51:50] blockingFailure=true
[오후 7:51:50] removed=0, deadLetter=0, deferred=0
[오후 7:51:50] processed=1, succeeded=0, failed=1
[오후 7:51:50] ok=false
[오후 7:51:50] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:51:50] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:51:50] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



### 3
📋 로그
[오후 7:52:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:29
[오후 7:52:23]       lastError: null
[오후 7:52:23]       nextRetryAt: null
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 4e79b199
[오후 7:52:23]   [10] createTodo | status=pending | retry=0
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:27
[오후 7:52:23]       lastError: null
[오후 7:52:23]       nextRetryAt: null
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 49c4ed7c
[오후 7:52:23]   [9] createTodo | status=pending | retry=0
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:23
[오후 7:52:23]       lastError: null
[오후 7:52:23]       nextRetryAt: null
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 573d3f54
[오후 7:52:23]   [8] createTodo | status=pending | retry=0
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:20
[오후 7:52:23]       lastError: null
[오후 7:52:23]       nextRetryAt: null
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 28f07fda
[오후 7:52:23]   [7] createTodo | status=pending | retry=0
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:12
[오후 7:52:23]       lastError: null
[오후 7:52:23]       nextRetryAt: null
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 0dd_null
[오후 7:52:23]   [6] createCompletion | status=pending | retry=0
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:12
[오후 7:52:23]       lastError: null
[오후 7:52:23]       nextRetryAt: null
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: cf3_null
[오후 7:52:23]   [5] createCompletion | status=pending | retry=0
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:11
[오후 7:52:23]       lastError: [network_or_timeout] status=n/a Network Error
[오후 7:52:23]       nextRetryAt: 2026-02-20T10:52:37.375Z
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: ead_null
[오후 7:52:23]   [4] createCompletion | status=failed | retry=1
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:10
[오후 7:52:23]       lastError: [network_or_timeout] status=n/a Network Error
[오후 7:52:23]       nextRetryAt: 2026-02-20T10:52:36.418Z
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 91d_null
[오후 7:52:23]   [3] createCompletion | status=failed | retry=1
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:09
[오후 7:52:23]       lastError: [network_or_timeout] status=n/a Network Error
[오후 7:52:23]       nextRetryAt: 2026-02-20T10:52:35.150Z
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 542_null
[오후 7:52:23]   [2] createCompletion | status=failed | retry=1
[오후 7:52:23] 
[오후 7:52:23]       created: 2026. 2. 20. 오후 7:51:08
[오후 7:52:23]       lastError: [network_or_timeout] status=n/a Network Error
[오후 7:52:23]       nextRetryAt: 2026-02-20T10:52:20.710Z
[오후 7:52:23]       date: null
[오후 7:52:23]       todoId: 453_null
[오후 7:52:23]   [1] createCompletion | status=failed | retry=1
[오후 7:52:23] 📋 최근 Pending (최대 10개):
[오후 7:52:23] 
[오후 7:52:23] ✅ Completion Pending: 6개
[오후 7:52:23] 📊 상태 요약: pending=6, failed=4, dead_letter=0
[오후 7:52:23] 🚀 즉시 처리 가능(ready): 7개
[오후 7:52:23] ⏳ 전체 Pending: 10개
[오후 7:52:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:52:23] ⏳ Pending Changes 확인
[오후 7:52:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━



### 4
📋 로그
[오후 7:53:32] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:53:32] ✅ Pending 없음
[오후 7:53:32] 
[오후 7:53:32] ✅ Completion Pending: 0개
[오후 7:53:32] 📊 상태 요약: pending=0, failed=0, dead_letter=0
[오후 7:53:32] 🚀 즉시 처리 가능(ready): 0개
[오후 7:53:32] ⏳ 전체 Pending: 0개
[오후 7:53:32] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:53:32] ⏳ Pending Changes 확인
[오후 7:53:32] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:53:24] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:53:24] 📊 현재 Pending: 0개
[오후 7:53:24] lastError=null
[오후 7:53:24] blockingFailure=false
[오후 7:53:24] removed=10, deadLetter=0, deferred=0
[오후 7:53:24] processed=10, succeeded=10, failed=0
[오후 7:53:24] ok=true
[오후 7:53:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[오후 7:53:23] 🚀 Pending Push 실행 (maxItems=200)
[오후 7:53:23] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━


## 4) 트리거 폭주/중복 실행 억제 테스트

### 관찰 로그(브라우저 콘솔)

```text
🌐 [useSyncService] 온라인 복귀 → 동기화 트리거
⏱️ [useSyncService] 디바운스: 이전 타이머 취소
⏱️ [useSyncService] 디바운스: 300ms 후 실행 예약
⏱️ [useSyncService] 디바운스: 이전 타이머 취소
⏱️ [useSyncService] 디바운스: 300ms 후 실행 예약
🚀 [useSyncService] 전체 동기화 시작
⏭️ [useSyncService] 이미 동기화 중 - 스킵
```

### 판정

1. 동일 시점에 다중 트리거가 발생해도 디바운스로 병합됨 (`이전 타이머 취소` 반복).
2. 동기화 실행 중 재진입은 run-guard로 차단됨 (`이미 동기화 중 - 스킵`).
3. Task14-4 PASS.

## 2026-09-28 Windows local-intent / pull atomicity hardening

Scope: local source/test work only. No live API replay, application SQLite mutation, schema migration, deployment, or device run.

Fail-first source harness: `client/scripts/audit-sync-local-intent.test.cjs` Babel-loads the actual sync/DB modules with network/SQLite adapters mocked.

- Before runtime edits: **0 PASS / 9 FAIL**. Reproduced active/future-backoff pending not blocking pull, an in-flight local write not fencing apply, partial Category apply before later fetch failure, malformed snapshots treated as empty, no shared apply transaction/rollback, and Category `INSERT OR REPLACE`.
- After remediation: original 9 cases **9 PASS / 0 FAIL**.
- Added dead-letter progress coverage: final focused suite **10 PASS / 0 FAIL**.

Implemented behavior:

1. Delta Pull preflights active pending intent before network work and re-checks it inside the same native exclusive write transaction used for local apply.
2. `pending` and `failed` (including future-backoff) rows block pull; `dead_letter` does not.
3. Category/Todo/Completion remote reads and shape validation complete before local mutation.
4. Category full snapshot + Todo delta + Completion delta apply under one write transaction; apply failure rolls back the local pull.
5. DB batch helpers accept an existing transaction connection so Delta Pull does not open nested per-service transactions.
6. Category upsert now uses `ON CONFLICT(_id) DO UPDATE` rather than `INSERT OR REPLACE`, avoiding replacement-triggered FK cascade behavior.

At this local-intent checkpoint, the cursor read-window gap remained intentionally separate. It was handled in the following bounded continuation.

## 2026-09-28 Windows cursor watermark / read-window hardening

Scope: bounded Todo/Completion delta cursor protocol only, continuing from the completed local-intent package. No live API request, Mongo/SQLite mutation, schema migration, dependency update, deployment, or device run.

Fail-first harness: `client/scripts/audit-sync-cursor-watermark.test.cjs`. It executes the actual server controllers with mocked Mongo query chains/clock and the actual client `deltaPull.js` with mocked adapters.

- Before cursor runtime edits: **0 PASS / 6 FAIL**.
- Reproduced: endpoint `syncTime` captured after reads, unbounded `$gt` queries, same-millisecond boundary loss, server-clock cursor rollback, Todo invalid cursor acceptance, and client selection of the later sequential endpoint watermark.
- After remediation: **6 PASS / 0 FAIL**.
- Existing local-intent regression remained **10/10 PASS** and settings/form regression remained **27/27 PASS**.

Implemented protocol:

1. Todo and Completion endpoints validate the input cursor, capture an upper boundary before any async query, and clamp it to at least the supplied cursor.
2. `updatedAt` and `deletedAt` query ranges are inclusive: `$gte cursor` + `$lte boundary`. The overlap deliberately replays cursor-millisecond rows so a write that commits just after the previous read is not lost.
3. Each endpoint returns that pre-read boundary rather than a timestamp captured after its reads.
4. The client commits the earliest of the Todo/Completion endpoint boundaries. Since calls are sequential, this preserves the earlier endpoint's unread interval while the later endpoint safely replays overlap on the next run.
5. Client rejects any combined server cursor that would move behind the current cursor.

Validation here is deterministic source execution with mocked DB/network timing. It proves the bounded-window contract in source but is not evidence of a live multi-request Mongo race or production clock behavior.
