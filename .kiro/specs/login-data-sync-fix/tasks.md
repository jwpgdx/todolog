# Implementation Plan: Sync Architecture Refactoring

## Overview

분산된 로직을 `/services/` 폴더로 통합하고, 로그인 후 데이터 동기화 문제를 해결합니다.

## Folder Structure (NEW)

```
client/src/services/
├── db/                      # SQLite (기존 db/ 폴더 이동)
│   ├── database.js
│   ├── todoService.js
│   ├── categoryService.js
│   ├── completionService.js
│   └── pendingService.js
└── sync/                    # 서버 동기화
    ├── categorySync.js
    ├── completionSync.js
    ├── todoSync.js
    └── index.js             # ★ useSyncService
```

## Impact Analysis (영향 범위)

### db/ → services/db/ 이동 시 수정 파일 (18개)

**hooks/queries/ (13개)**
- `useCreateCategory.js`
- `useUpdateCategory.js`
- `useDeleteCategory.js`
- `useCategories.js`
- `useCreateTodo.js`
- `useUpdateTodo.js`
- `useDeleteTodo.js`
- `useTodos.js`
- `useAllTodos.js`
- `useTodosByCategory.js`
- `useToggleCompletion.js`
- `useMonthEvents.js`

**기타 (5개)**
- `store/authStore.js`
- `hooks/useSyncTodos.js`
- `hooks/useCalendarEvents.js`
- `screens/DebugScreen.js`
- `test/guestDataHelper.js`

### useSyncTodos → useSyncService 변경 시 수정 파일 (2개)

- `providers/SyncProvider.js`
- `hooks/useSyncTodos.js` (삭제)

### 리스크 평가

| 항목 | 리스크 | 이유 |
|------|--------|------|
| db/ 이동 | 🔴 높음 | 18개 파일 수정 |
| sync/ 생성 | 🟢 낮음 | 새 파일 추가 |
| useSyncService | 🟡 중간 | 로직 검증 필요 |

---

## Tasks (세분화 + 체크포인트)

### Phase 1: 기반 작업

- [x] 1.1 authStore에 isLoggedIn 추가
- [x] 1.2 ✅ **체크포인트**: 빌드 확인
- [x] 1.3 서버 API 추가 (`GET /completions/all`)
- [x] 1.4 ✅ **체크포인트**: API 테스트 (Postman/curl)
- [x] 1.5 **커밋**: "feat: add isLoggedIn + completions/all API"

---

### Phase 2: services/db/ 폴더 마이그레이션

- [x] 2.1 `services/db/` 폴더 생성
- [x] 2.2 `git mv db/* services/db/`로 파일 이동
- [x] 2.3 ✅ **체크포인트**: 빌드 에러 확인 (에러 예상됨)
- [x] 2.4 hooks/queries/ 13개 파일 import 수정
- [x] 2.5 ✅ **체크포인트**: 빌드 확인
- [x] 2.6 나머지 5개 파일 import 수정
- [x] 2.7 ✅ **체크포인트**: 빌드 + 앱 실행 테스트
- [x] 2.8 **커밋**: "refactor: move db/ to services/db/"

---

### Phase 3: services/sync/ 폴더 생성

- [x] 3.1 `categorySync.js` 생성
- [x] 3.2 `todoSync.js` 생성
- [x] 3.3 `completionSync.js` 생성
- [x] 3.4 `index.js` (useSyncService) 생성
- [x] 3.5 ✅ **체크포인트**: 빌드 확인
- [x] 3.6 **커밋**: "feat: add services/sync/ folder"

---

### Phase 4: Sync 연결 및 정리

- [x] 4.1 `SyncProvider.js`에서 useSyncService import
- [x] 4.2 `useSyncTodos.js` 삭제
- [x] 4.3 ✅ **체크포인트**: 빌드 + 동기화 테스트
- [x] 4.4 **커밋**: "refactor: replace useSyncTodos with useSyncService"

---

### Phase 5: Query Hooks 단순화

- [x] 5.1 useTodos.js 백그라운드 서버 호출 삭제
- [x] 5.2 useCategories.js 백그라운드 서버 호출 삭제
- [x] 5.3 ✅ **체크포인트**: 빌드 + Network 탭 확인
- [x] 5.4 **커밋**: "perf: remove background API calls from query hooks"

---

### Phase 6: 최종 테스트

- [x] 6.1 로그인 후 동기화 확인
- [x] 6.2 백그라운드 복귀 시 동기화 확인
- [x] 6.3 오프라인 → 온라인 전환 확인
- [x] 6.4 ✅ **최종 체크포인트**: 전체 기능 정상 동작

---

## Notes

- 각 Phase 완료 후 **커밋** 필수 (롤백 용이)
- ✅ 체크포인트에서 에러 발생 시 **즉시 수정** 후 진행
- `git mv` 사용하면 git history 유지 가능
