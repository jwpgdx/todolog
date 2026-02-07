# Requirements Document: Sync Architecture Refactoring

## Introduction

로그인 후 서버 데이터가 SQLite로 동기화되지 않는 문제를 해결하고, 분산된 동기화 로직을 중앙 집중화하여 성능을 개선합니다.

## Current Problems

### 🔴 문제점 1: 백그라운드 서버 호출 중복

| 컴포넌트 | 위치 | 문제 |
|---------|------|------|
| `useTodos.js` | line 66-74 | 매 쿼리마다 `todoAPI.getTodos()` 호출 |
| `useCategories.js` | line 32-40 | 매 쿼리마다 `categoryApi.getCategories()` 호출 |
| `useSyncTodos.js` | 3곳 | AppState + NetInfo + isLoggedIn 트리거 |

**현재 흐름:**
```
앱 시작 → SQLite 조회 → [백그라운드 서버 호출] → 데이터 비교 → invalidateQueries
                            ↑ 매번 실행됨 (불필요)
```

### 🔴 문제점 2: 동기화 트리거 과다

`useSyncTodos.js`에서 동기화가 **3곳에서 트리거**:
- line 389-398: AppState `active` 전환 시
- line 403-412: NetInfo 온라인 전환 시
- line 468-473: `isLoggedIn` 변경 시

앱이 백그라운드에서 복귀하면서 네트워크가 연결되면 **동시에 2~3번 트리거** 가능.
(`isSyncingRef`로 중복 방지하지만, 체크 타이밍에 따라 경쟁 상태 발생 가능)

### 🟡 문제점 3: 스펙 문서와 코드 불일치

| 스펙 가정 | 실제 코드 |
|----------|----------|
| `GET /completions/all` 존재 | ❌ 없음 |
| Category 동기화 포함 | ❌ `useSyncTodos`에 없음 |
| `isLoggedIn` boolean | ❌ `authStore`에 미정의 |

## Glossary

- **SQLite**: 클라이언트 로컬 데이터베이스 (Source of Truth)
- **SyncManager**: 서버 동기화를 담당하는 중앙 모듈 (`useSyncTodos` 리팩토링)
- **Query Hooks**: `useTodos`, `useCategories` 등 SQLite 읽기 전용 hooks
- **Debounce**: 여러 트리거를 하나로 병합하는 기법
- **Full Sync**: 서버의 모든 데이터를 SQLite로 동기화
- **Delta Sync**: 마지막 동기화 시간 이후 변경사항만 동기화

## Requirements

### Requirement 1: Query Hooks 단순화

**User Story:** 개발자로서, Query hooks가 SQLite만 조회하고 서버 호출을 하지 않기를 원합니다.

#### Acceptance Criteria

1. `useTodos`는 SQLite에서만 데이터를 조회해야 함
2. `useCategories`는 SQLite에서만 데이터를 조회해야 함
3. 백그라운드 서버 동기화 코드를 Query hooks에서 제거해야 함
4. Query hooks는 `staleTime` 설정으로 불필요한 재조회 방지

### Requirement 2: 중앙 집중 동기화

**User Story:** 개발자로서, 모든 서버 동기화가 한 곳에서 관리되기를 원합니다.

#### Acceptance Criteria

1. `useSyncTodos`가 Category, Todo, Completion 모두 동기화
2. 동기화 순서: Settings → Category → Pending → Todo → Completion → 캐시 무효화
3. 동기화 완료 후 `invalidateQueries`로 UI 갱신
4. 동기화 상태(`isSyncing`, `error`)를 외부에 노출

### Requirement 3: 트리거 통합 및 디바운스

**User Story:** 개발자로서, 불필요한 중복 동기화를 방지하고 싶습니다.

#### Acceptance Criteria

1. AppState, NetInfo, isLoggedIn 트리거를 하나로 통합
2. 300ms 디바운스 적용으로 다중 트리거 병합
3. `isSyncingRef`로 동시 실행 방지
4. 트리거 발생 시 로그 출력

### Requirement 4: authStore에 isLoggedIn 추가

**User Story:** 개발자로서, 로그인 상태 변경을 reactive하게 감지하고 싶습니다.

#### Acceptance Criteria

1. `authStore`에 `isLoggedIn: boolean` 상태 추가
2. `setAuth`, `loadAuth`, `logout` 함수에서 `isLoggedIn` 업데이트
3. `isLoggedIn`은 `user && token && !user._id?.startsWith('guest_')` 조건

### Requirement 5: 서버 API 추가

**User Story:** 개발자로서, Completion Full Sync를 위한 API가 필요합니다.

#### Acceptance Criteria

1. `GET /completions/all` 엔드포인트 추가
2. 사용자의 모든 Completion 반환 (deletedAt IS NULL)
3. 응답 형식: `Completion[]`

### Requirement 6: 로그인 후 동기화

**User Story:** 사용자로서, 로그인 후 서버 데이터가 자동으로 표시되기를 원합니다.

#### Acceptance Criteria

1. 로그인 완료 시 `isLoggedIn`이 `true`로 변경
2. `isLoggedIn` 변경 시 `syncAll()` 자동 실행
3. 동기화 중 로딩 상태 표시
4. 동기화 완료 후 UI 자동 갱신
