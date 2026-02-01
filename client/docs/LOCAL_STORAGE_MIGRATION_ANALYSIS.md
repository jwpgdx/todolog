# 로컬 저장소 마이그레이션 분석: MMKV vs SQLite

## 프로젝트 개요

**앱 유형:** React Native (Expo) Todo/일정 앱  
**타겟 시장:** 글로벌 (동남아시아 포함)  
**아키텍처:** Offline-First + Delta Sync  
**상태 관리:** React Query (메모리 캐시) + AsyncStorage (영구 저장)  
**서버:** Node.js + Express + MongoDB

### 핵심 요구사항

| 요구사항 | 우선순위 | 이유 |
|---|---|---|
| **오프라인 완벽 지원** | 🔴 필수 | 동남아 시장 - 불안정한 네트워크 환경 |
| **앱 시작 속도** | 🔴 필수 | Cold start 200ms 이내 목표 |
| **데이터 스케일링** | 🔴 필수 | 헤비 유저 50,000+ Completions 대응 |
| **배터리 효율** | 🟡 중요 | 불필요한 I/O 최소화 |

---

## 현재 구현 분석

### 1. 저장소 구조

```
┌─────────────────────────────────────────────────────┐
│                    클라이언트                        │
│                                                     │
│  AsyncStorage (영구 저장)    React Query (메모리)    │
│  ├── @todos (JSON Array)  → ['todos', 'all']        │
│  ├── @completions (JSON)  → ['completions']         │
│  ├── @categories (JSON)   → ['categories']          │
│  ├── @userSettings (JSON) → ['settings']            │
│  └── @sync_metadata       →                         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 2. 데이터 흐름

#### 앱 시작 시
```javascript
// useSyncTodos.js - 초기 캐시 준비
const localTodos = await loadTodos();           // AsyncStorage 전체 로드
const localCompletions = await loadCompletions(); // AsyncStorage 전체 로드
queryClient.setQueryData(['todos', 'all'], localTodos);
queryClient.setQueryData(['completions'], localCompletions);
```

#### 일별 Todo 조회 시
```javascript
// useTodos.js - 날짜별 필터링
const allTodos = queryClient.getQueryData(['todos', 'all']); // 메모리에서 가져옴
const filtered = filterByDate(allTodos, date);  // JS에서 필터링
const completions = queryClient.getQueryData(['completions']); // 메모리에서 가져옴
// O(1) 해시맵 조회로 완료 상태 확인
```

#### Todo/Completion 수정 시
```javascript
// todoStorage.js / completionStorage.js
await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(todos)); // 전체 덮어쓰기
```

### 3. 예상 데이터 규모 (글로벌 출시 기준)

> **참고:** 현재는 개발/테스트 중이라 소량. 글로벌 앱 출시 후 헤비 유저 기준으로 예상.

| 데이터 | 일반 유저 (1년) | 헤비 유저 (3년) | 극단적 케이스 |
|---|---|---|---|
| Todos | ~500개 | ~2,000개 | ~5,000개+ |
| Completions | ~3,650개 | ~15,000개 | ~50,000개+ |
| Categories | ~20개 | ~50개 | ~100개 |

**헤비 유저 가정:**
- 매일 10개 이상 할일 완료
- 반복 일정 다수 사용
- 카테고리 세분화

### 4. 현재 방식의 문제점

1. **쓰기 비효율**: 1개 수정해도 전체 JSON stringify + 디스크 쓰기
2. **초기 로딩**: 모든 데이터 전체 로드 후 메모리에 상주
3. **쿼리 불가**: 날짜별 조회도 전체 로드 후 JS에서 필터링
4. **iOS 제한**: AsyncStorage 6MB 제한 (Completions 3년이면 ~1.7MB)

---

## 마이그레이션 옵션

### Option A: MMKV

```javascript
import { MMKV } from 'react-native-mmkv';
const storage = new MMKV();

// 사용법 (AsyncStorage와 거의 동일)
storage.set('todos', JSON.stringify(todos));
const todos = JSON.parse(storage.getString('todos'));
```

**장점:**
- AsyncStorage보다 30배 빠름
- 동기식 API (await 불필요)
- 마이그레이션 쉬움 (거의 동일한 API)
- Expo 지원 (expo-dev-client 필요)

**단점:**
- 여전히 전체 덮어쓰기
- 쿼리 불가 (날짜별 조회 불가)
- 메모리 상주 필요

### Option B: SQLite

```javascript
import * as SQLite from 'expo-sqlite';

// 테이블 구조
CREATE TABLE todos (
  _id TEXT PRIMARY KEY,
  title TEXT,
  date TEXT,
  startDate TEXT,
  endDate TEXT,
  recurrence TEXT,
  categoryId TEXT,
  isAllDay INTEGER,
  color TEXT,
  updatedAt TEXT,
  deletedAt TEXT
);
CREATE INDEX idx_todos_date ON todos(date);
CREATE INDEX idx_todos_startDate ON todos(startDate);

CREATE TABLE completions (
  key TEXT PRIMARY KEY,  -- todoId_date
  todoId TEXT,
  date TEXT,
  completedAt TEXT
);
CREATE INDEX idx_completions_date ON completions(date);
CREATE INDEX idx_completions_todoId ON completions(todoId);
```

**장점:**
- 부분 쿼리 가능: `SELECT * FROM todos WHERE date = ?`
- 부분 쓰기 가능: `INSERT OR REPLACE INTO todos ... WHERE _id = ?`
- 메모리 효율: 필요한 것만 로드
- JOIN 쿼리: `todos JOIN completions`

**단점:**
- 마이그레이션 공수 (스키마 설계, 쿼리 작성)
- 복잡한 객체 저장 시 직렬화 필요 (recurrence 등)

---

## 사용 패턴별 분석

### 1. 일별 Todo 조회 (가장 빈번)

| 방식 | 현재 (AsyncStorage) | MMKV | SQLite |
|---|---|---|---|
| 방법 | 전체 로드 → JS 필터 | 전체 로드 → JS 필터 | `WHERE date = ?` |
| 속도 (1,000개) | 100ms | 3ms | **0.1ms** |
| 메모리 | 전체 상주 | 전체 상주 | 필요한 것만 |

### 2. 캘린더 월별 조회 (RRule 전개)

```javascript
// 현재: useCalendarEvents.js
const allTodos = queryClient.getQueryData(['todos', 'all']);
const filtered = filterByMonth(allTodos, year, month);
// + RRule 전개하여 eventsByDate 맵 생성
```

| 방식 | 현재 | MMKV | SQLite |
|---|---|---|---|
| 데이터 로드 | 전체 | 전체 | `WHERE date LIKE '2026-02%'` |
| RRule 처리 | JS | JS | JS (동일) |

**참고:** RRule 전개는 어느 방식이든 JS에서 해야 함

### 3. Completion 토글 (자주 발생)

| 방식 | 현재 | MMKV | SQLite |
|---|---|---|---|
| 1개 토글 | 전체 stringify + 쓰기 | 전체 stringify + 쓰기 | `INSERT OR REPLACE` 1개 |
| 속도 (10,000개) | 50-100ms | 5-10ms | **0.1ms** |

### 4. 앱 시작 (Cold Start)

| 방식 | 현재 | MMKV | SQLite |
|---|---|---|---|
| 로드 방식 | Todo 전체 + Completion 전체 | 동일 (더 빠름) | 오늘 것만 로드 가능 |
| 속도 (10,000개) | 100-200ms | 10-30ms | **5-10ms** |

---

## 질문

### 1. 어떤 저장소가 이 프로젝트에 적합한가?

**고려 사항:**
- Offline-First 앱 (전체 데이터 로컬 보관)
- 날짜별 조회가 주 패턴
- 캘린더 dot 표시 (월별 완료 현황)
- 앱 시작 속도 중요

### 2. SQLite 도입 시 아키텍처

**Option B-1: SQLite + React Query (하이브리드)**
```
SQLite (영구 저장) → React Query (메모리 캐시)
- 앱 시작: 오늘 데이터만 SQLite → React Query
- 조회: React Query 먼저, 없으면 SQLite 쿼리
- 수정: SQLite 직접 + React Query invalidate
```

**Option B-2: SQLite Only**
```
SQLite만 사용 (React Query 캐시 최소화)
- 모든 조회: SQLite 직접 쿼리
- 수정: SQLite 직접
- React Query: 서버 동기화 상태만 관리
```

### 3. 마이그레이션 우선순위

**Option 1: Completion만 먼저**
- Completion이 가장 빠르게 증가 (매일 10개+)
- 토글 빈도 높음
- Todo보다 구조 단순

**Option 2: Todo + Completion 동시**
- 일관된 아키텍처
- JOIN 쿼리 가능
- 마이그레이션 1회

### 4. Settings/Categories는?

| 데이터 | 크기 | 변경 빈도 | 추천 |
|---|---|---|---|
| Settings | 매우 작음 | 드묾 | AsyncStorage 유지 or MMKV |
| Categories | 작음 (~30개) | 드묾 | AsyncStorage 유지 or SQLite |

---

## 현재 코드 참고

### todoStorage.js (전체 덮어쓰기)
```javascript
export const saveTodos = async (todos) => {
  await AsyncStorage.setItem(STORAGE_KEYS.TODOS, JSON.stringify(todos));
};

export const upsertTodo = async (todo) => {
  const todos = await loadTodos();  // 전체 로드
  const index = todos.findIndex(t => t._id === todo._id);
  if (index !== -1) {
    todos[index] = todo;
  } else {
    todos.push(todo);
  }
  await saveTodos(todos);  // 전체 저장
};
```

### completionStorage.js (전체 덮어쓰기)
```javascript
export const toggleCompletionLocally = async (todoId, date) => {
  const completions = await loadCompletions();  // 전체 로드
  const key = `${todoId}_${date || 'null'}`;
  
  if (completions[key]) {
    delete completions[key];
  } else {
    completions[key] = { todoId, date, completedAt: new Date().toISOString() };
  }
  
  await saveCompletions(completions);  // 전체 저장
};
```

### useTodos.js (메모리에서 필터링)
```javascript
const allTodos = queryClient.getQueryData(['todos', 'all']);  // 메모리
const filtered = filterByDate(allTodos, date);  // JS 필터
const completions = queryClient.getQueryData(['completions']);  // 메모리
const todosWithCompletion = filtered.map(todo => {
  const key = `${todo._id}_${date || 'null'}`;
  return { ...todo, completed: !!completions[key] };  // O(1) 조회
});
```

---

## 요청사항

1. **MMKV vs SQLite** - 이 프로젝트에 어떤 것이 더 적합한가?
2. **React Query와의 통합** - SQLite 도입 시 기존 React Query 캐시와 어떻게 통합해야 하는가?
3. **마이그레이션 전략** - 점진적 마이그레이션이 가능한가? 어떤 순서가 좋은가?
4. **글로벌 출시 시 고려사항** - 다양한 디바이스/네트워크 환경에서의 안정성은?

---

## 서버 컨텍스트 (참고)

```
서버: Node.js + Express + MongoDB
동기화: Delta Sync (lastSyncTime 기반)
압축: 현재 미적용 (compression 미들웨어 추가 예정)
Hard Delete: 현재 Soft Delete만 (90일 Hard Delete 정책 추가 예정)
```

클라이언트 로컬 저장소 변경은 서버에 영향 없음.

---

## SQLite 전환 시 델타 동기화 영향

> **핵심: 델타 동기화 프로토콜은 변경 없음. Storage 레이어만 교체.**

### 변경 없음 (서버 & 프로토콜)
- 서버 API (`/todos/delta-sync`, `/completions/delta-sync`)
- 응답 형식 (`{ updated: [], deleted: [], syncTime }`)
- `lastSyncTime` 기반 동기화 흐름
- Pending Changes 오프라인 큐 로직

### 변경됨 (클라이언트 Storage만)

| 현재 (AsyncStorage) | SQLite 전환 후 |
|---|---|
| `mergeDelta()` → `saveTodos(전체)` | `INSERT OR REPLACE INTO todos ...` |
| 전체 JSON stringify + 덮어쓰기 | 개별 row INSERT/UPDATE/DELETE |

---

## 구현 참고사항

- **구현 주체:** AI가 코딩 (시간 제약 없음)
- **마이그레이션 공수:** 고려하지 않아도 됨
- **최적의 아키텍처에만 집중**
