SQLite 마이그레이션 작업 체크리스트
Phase 0: 기반 작업 ✅
 expo-sqlite 설치
 
db/database.js
 생성
 스키마 정의 (todos, completions, categories, pending_changes, metadata)
 WAL 모드 설정
 DebugScreen 버튼 [0-1] DB 초기화
 DebugScreen 버튼 [0-2] 버전 확인
Phase 1: 마이그레이션 ✅
 
migrateFromAsyncStorage()
 구현
 백업 생성 로직
 
rollbackMigration()
 구현
 
simulateMigration()
 구현
 DebugScreen 버튼 [1-1] 시뮬레이션
 DebugScreen 버튼 [1-2] 실제 실행
 DebugScreen 버튼 [1-3] 롤백
Phase 2: Todo Service ✅
 
db/todoService.js
 생성
 
getTodosByDate()
 구현
 
getTodosByMonth()
 구현
 
upsertTodo()
 구현
 
deleteTodo()
 구현
 DebugScreen 버튼 [2-1] ~ [2-3]
Phase 3: Completion Service ✅
 
db/completionService.js
 생성
 
getCompletionsByDate()
 구현
 
getCompletionsByMonth()
 구현
 
getCompletionStats()
 구현
 
toggleCompletion()
 구현
 DebugScreen 버튼 [3-1] ~ [3-3]
Phase 4: Pending Service ✅
 
db/pendingService.js
 생성
 
addPendingChange()
 구현
 
getPendingChanges()
 구현
 
removePendingChange()
 구현
 DebugScreen 버튼 [4-1] ~ [4-3]
 
db/categoryService.js
 생성
Phase 5: Hooks 리팩토링 (진행중)
 
useTodos.js
 수정 → SQLite 기반
 
useToggleCompletion.js
 수정 → SQLite 기반
 
useCalendarEvents.js
 수정 → SQLite 기반
 
useMonthEvents.js
 수정 → SQLite 기반
 웹/네이티브 테스트
 기존 storage 임포트 정리
Phase 6: 동기화
 
useSyncTodos.js
 수정
 
mergeDelta()
 SQLite로 변경
 
processPendingChanges()
 수정
 DebugScreen 버튼 [6-1], [6-2]
Phase 7: 정리
 기존 storage 파일 삭제
 불필요한 임포트 제거
 콘솔 로그 정리
 전체 시나리오 테스트
현재 진행 상황
완료: Phase 0~4 (기반 + 마이그레이션 + SQLite Services)
다음: Phase 5 (Hooks 리팩토링)
⚠️ 중요: 웹 + 네이티브 SQLite 지원
SDK 업그레이드 (2026-02-02)
SDK 52 → SDK 54 업그레이드
expo-sqlite 15.1.4 → 16.0.10 업그레이드
웹에서 SQLite 완전 작동 ✅
expo-sqlite 16.x부터 웹 지원 포함 (wa-sqlite 기반)
PRAGMA (WAL, synchronous, foreign_keys) 웹에서 정상 작동
플랫폼 분기 불필요, 동일 코드로 웹/iOS/Android 지원
Metro 설정 (metro.config.js)
// WASM 지원
config.resolver.assetExts.push('wasm');
// SharedArrayBuffer 헤더
config.server.enhanceMiddleware = (middleware, server) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};