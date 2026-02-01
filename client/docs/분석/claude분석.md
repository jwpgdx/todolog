이 문서를 자세히 분석해보니, **SQLite로의 전환이 명확히 더 적합**합니다. 특히 헤비 유저 대응과 오프라인 완벽 지원이라는 핵심 요구사항을 고려할 때, MMKV는 단기적 개선에 불과하고 근본적 해결책이 되지 못합니다.

## 1. MMKV vs SQLite - 결론: **SQLite 강력 추천**

### MMKV의 치명적 한계
```
헤비 유저 시나리오 (50,000 Completions):
- MMKV: 여전히 50,000개 전체를 stringify → 메모리 → 디스크
- 1개 토글에도 ~10MB JSON 처리
- 앱 시작마다 10MB+ 로드 필수
```

**MMKV는 속도만 빠를 뿐, 구조적 문제는 동일합니다.**

### SQLite가 결정적인 이유

| 시나리오 | AsyncStorage | MMKV | SQLite |
|---|---|---|---|
| **50,000 Completions 중 1개 토글** | 전체 쓰기 500ms | 전체 쓰기 50ms | **단일 row 0.1ms** |
| **앱 시작 (오늘 할일만)** | 전체 로드 200ms | 전체 로드 30ms | **10개만 SELECT 1ms** |
| **월별 캘린더 (30일치)** | 전체 필터링 100ms | 전체 필터링 10ms | **WHERE date LIKE 5ms** |
| **메모리 점유** | 전체 ~10MB | 전체 ~10MB | **필요한 것만 ~100KB** |

**실제 차이:**
- MMKV: 50,000개 → 5,000개로 줄어도 여전히 전체 처리
- SQLite: 50,000개든 500,000개든 필요한 10개만 처리

---

## 2. React Query 통합 전략 - **Option B-1 (하이브리드) 추천**

### 추천 아키텍처: SQLite + React Query 하이브리드

```javascript
┌─────────────────────────────────────────────────────┐
│                  React Query Layer                   │
│  - 현재 화면 데이터만 캐시 (오늘/이번주)              │
│  - 서버 동기화 상태 관리                              │
│  - Optimistic Updates                                │
└──────────────────┬──────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────┐
│              SQLite Layer (진실의 원천)              │
│  - 전체 데이터 영구 저장                              │
│  - 날짜별/월별 쿼리                                   │
│  - 동기화 메타데이터                                  │
└─────────────────────────────────────────────────────┘
```

### 구체적 구현 패턴

```javascript
// hooks/useTodos.js
export const useTodos = (date) => {
  return useQuery({
    queryKey: ['todos', 'date', date],
    queryFn: async () => {
      // SQLite에서 직접 쿼리 (오늘 것만)
      const todos = await db.getTodosByDate(date);
      const completions = await db.getCompletionsByDate(date);
      
      return todos.map(todo => ({
        ...todo,
        completed: completions[`${todo._id}_${date}`] ?? false
      }));
    },
    staleTime: 5 * 60 * 1000, // 5분간 fresh
    gcTime: 10 * 60 * 1000,   // 10분간 캐시 유지
  });
};

// hooks/useCalendarEvents.js
export const useCalendarEvents = (year, month) => {
  return useQuery({
    queryKey: ['calendar', year, month],
    queryFn: async () => {
      // 월별 데이터만 SQLite에서 가져오기
      const todos = await db.getTodosByMonth(year, month);
      const completions = await db.getCompletionsByMonth(year, month);
      
      // RRule 전개는 여기서 (변경 없음)
      return expandRecurringEvents(todos, completions, year, month);
    },
    staleTime: 10 * 60 * 1000,
  });
};
```

### 왜 하이브리드인가?

**React Query 유지 이유:**
1. **Optimistic Updates** - 즉각적인 UI 반영
2. **서버 동기화 상태** - `isFetching`, `isError` 등
3. **캐시 무효화** - `invalidateQueries` 편리함
4. **Background Refetch** - 자동 재검증

**SQLite가 진실의 원천인 이유:**
1. **앱 재시작 시** - SQLite에서 복원
2. **날짜 이동 시** - 새 쿼리 실행
3. **동기화 완료 시** - SQLite 업데이트 → React Query invalidate

---

## 3. 마이그레이션 전략 - **Option 2 (동시 전환) 추천**

### Phase 1: Completions 단독 전환 시 문제점

```javascript
// 안티패턴: 혼재된 저장소
const todos = await AsyncStorage.getItem('todos');        // 느림
const completions = await db.getCompletionsByDate(date);  // 빠름

// 문제 1: 날짜별 조회 시 여전히 전체 로드
const allTodos = JSON.parse(todos);  // 5,000개 전체
const filtered = allTodos.filter(t => t.date === date);  // JS 필터링

// 문제 2: JOIN 불가
// todos와 completions를 메모리에서 수동 병합
```

### 추천: Todos + Completions 동시 전환

```sql
-- 1단계: 스키마 생성
CREATE TABLE todos (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,
  startDate TEXT,
  endDate TEXT,
  recurrence TEXT,  -- JSON string
  categoryId TEXT,
  isAllDay INTEGER DEFAULT 0,
  color TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  deletedAt TEXT,
  FOREIGN KEY (categoryId) REFERENCES categories(_id)
);

CREATE TABLE completions (
  key TEXT PRIMARY KEY,
  todoId TEXT NOT NULL,
  date TEXT,
  completedAt TEXT NOT NULL,
  FOREIGN KEY (todoId) REFERENCES todos(_id) ON DELETE CASCADE
);

-- 인덱스 (핵심 성능 요소)
CREATE INDEX idx_todos_date ON todos(date) WHERE deletedAt IS NULL;
CREATE INDEX idx_todos_date_range ON todos(startDate, endDate) WHERE deletedAt IS NULL;
CREATE INDEX idx_completions_date ON completions(date);
CREATE INDEX idx_completions_todoId ON completions(todoId);

-- 2단계: 마이그레이션 함수
async function migrateToSQLite() {
  const oldTodos = await AsyncStorage.getItem('@todos');
  const oldCompletions = await AsyncStorage.getItem('@completions');
  
  if (!oldTodos) return; // 이미 마이그레이션됨
  
  const todos = JSON.parse(oldTodos);
  const completions = JSON.parse(oldCompletions);
  
  // Batch Insert (트랜잭션)
  await db.transaction(tx => {
    todos.forEach(todo => {
      tx.executeSql(`
        INSERT OR REPLACE INTO todos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        todo._id, todo.title, todo.date, 
        todo.startDate, todo.endDate,
        JSON.stringify(todo.recurrence),
        todo.categoryId, todo.isAllDay ? 1 : 0,
        todo.color, todo.createdAt, todo.updatedAt,
        todo.deletedAt
      ]);
    });
    
    Object.entries(completions).forEach(([key, comp]) => {
      tx.executeSql(`
        INSERT OR REPLACE INTO completions VALUES (?, ?, ?, ?)
      `, [key, comp.todoId, comp.date, comp.completedAt]);
    });
  });
  
  // 3단계: 백업 후 삭제
  await AsyncStorage.setItem('@todos_backup', oldTodos);
  await AsyncStorage.removeItem('@todos');
  await AsyncStorage.removeItem('@completions');
}
```

### 마이그레이션 타이밍

```javascript
// App.tsx - 앱 시작 시
export default function App() {
  useEffect(() => {
    (async () => {
      await initializeDatabase();
      await migrateToSQLite(); // 최초 1회만 실행
    })();
  }, []);
  
  // ...
}
```

---

## 4. 글로벌 출시 고려사항

### A. SQLite 안정성 (✅ 매우 안정적)

```
- iOS/Android 기본 탑재 (시스템 라이브러리)
- Expo SQLite: 10년+ 검증된 래퍼
- 파일 손상 복구: WAL mode + PRAGMA integrity_check
```

**오히려 AsyncStorage/MMKV보다 안전:**
- AsyncStorage: 6MB 제한 (iOS), 파편화된 구현
- MMKV: 상대적으로 신생 (2020년~), Expo 공식 지원 아님

### B. 성능 최적화

```javascript
// 1. WAL Mode 활성화 (동시 읽기/쓰기)
await db.execAsync('PRAGMA journal_mode = WAL');

// 2. 동기화 완화 (배터리 절약)
await db.execAsync('PRAGMA synchronous = NORMAL');

// 3. 캐시 크기
await db.execAsync('PRAGMA cache_size = -2000'); // 2MB

// 4. Batch 쓰기 (동기화 시)
await db.transaction(tx => {
  deltaUpdated.forEach(todo => {
    tx.executeSql('INSERT OR REPLACE INTO todos ...', [todo]);
  });
  deltaDeleted.forEach(id => {
    tx.executeSql('UPDATE todos SET deletedAt = ? WHERE _id = ?', [now, id]);
  });
});
```

### C. 네트워크 불안정 대응

```javascript
// useSyncTodos.js - 변경 최소화
const syncMutation = useMutation({
  mutationFn: async () => {
    const lastSyncTime = await db.getMetadata('lastSyncTime');
    
    // 1. 서버에서 델타 가져오기
    const response = await api.post('/todos/delta-sync', { lastSyncTime });
    
    // 2. SQLite에 병합 (트랜잭션)
    await db.mergeDelta(response.data.updated, response.data.deleted);
    
    // 3. React Query 무효화
    queryClient.invalidateQueries(['todos']);
    queryClient.invalidateQueries(['calendar']);
    
    return response.data.syncTime;
  },
  onSuccess: (syncTime) => {
    db.setMetadata('lastSyncTime', syncTime);
  }
});
```

---

## 5. 최종 아키텍처 제안

### 저장소 분리 원칙

```javascript
┌────────────────────────────────────────────┐
│             SQLite (Primary)               │
│  - todos, completions, categories          │
│  - sync_metadata (lastSyncTime)            │
│  - pending_changes (오프라인 큐)           │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│         AsyncStorage (Settings Only)       │
│  - @userSettings (테마, 알림 등)           │
│  - @onboardingCompleted                    │
└────────────────────────────────────────────┘
```

### Categories 처리

**옵션 1: SQLite 포함 (추천)**
```sql
CREATE TABLE categories (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  updatedAt TEXT
);

-- 장점: todos와 JOIN 가능
SELECT t.*, c.name as categoryName, c.color as categoryColor
FROM todos t
LEFT JOIN categories c ON t.categoryId = c._id
WHERE t.date = ?;
```

**옵션 2: AsyncStorage 유지**
- 소량 데이터 (~30개)
- 변경 드묾
- 단, JOIN 불가

---

## 핵심 구현 포인트

### 1. db.js - SQLite 래퍼

```javascript
import * as SQLite from 'expo-sqlite';

class TodoDatabase {
  constructor() {
    this.db = null;
  }
  
  async init() {
    this.db = await SQLite.openDatabaseAsync('todos.db');
    await this.db.execAsync('PRAGMA journal_mode = WAL');
    await this.createTables();
  }
  
  async getTodosByDate(date) {
    const result = await this.db.getAllAsync(
      `SELECT * FROM todos 
       WHERE (date = ? OR (startDate <= ? AND endDate >= ?))
       AND deletedAt IS NULL`,
      [date, date, date]
    );
    return result.map(row => ({
      ...row,
      recurrence: JSON.parse(row.recurrence || 'null'),
      isAllDay: Boolean(row.isAllDay)
    }));
  }
  
  async upsertTodo(todo) {
    await this.db.runAsync(
      `INSERT OR REPLACE INTO todos VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [todo._id, todo.title, /* ... */]
    );
  }
  
  async toggleCompletion(todoId, date) {
    const key = `${todoId}_${date || 'null'}`;
    const existing = await this.db.getFirstAsync(
      'SELECT * FROM completions WHERE key = ?',
      [key]
    );
    
    if (existing) {
      await this.db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
      return false;
    } else {
      await this.db.runAsync(
        'INSERT INTO completions VALUES (?, ?, ?, ?)',
        [key, todoId, date, new Date().toISOString()]
      );
      return true;
    }
  }
}

export const db = new TodoDatabase();
```

### 2. 동기화 병합

```javascript
// db.js
async mergeDelta(updated, deleted) {
  await this.db.withTransactionAsync(async () => {
    // 업데이트
    for (const todo of updated) {
      await this.upsertTodo(todo);
    }
    
    // Soft Delete
    const now = new Date().toISOString();
    for (const id of deleted) {
      await this.db.runAsync(
        'UPDATE todos SET deletedAt = ? WHERE _id = ?',
        [now, id]
      );
    }
  });
}
```

---

## 요약 및 실행 계획

### ✅ 최종 결론

1. **저장소: SQLite** (MMKV는 단기 개선에 불과)
2. **통합: SQLite + React Query 하이브리드**
3. **마이그레이션: Todos + Completions 동시 전환**
4. **Categories: SQLite 포함** (일관성 + JOIN 이점)

### 🚀 실행 순서

```
1. SQLite 스키마 설계 & 인덱스 최적화 (1일)
2. db.js 래퍼 구현 (1일)
3. 마이그레이션 함수 작성 & 테스트 (1일)
4. useTodos/useCalendar 리팩토링 (1일)
5. 동기화 로직 통합 (1일)
6. 프로덕션 배포 & 모니터링
```

### 📊 예상 성능 개선

| 지표 | 현재 | SQLite 전환 후 |
|---|---|---|
| 앱 시작 (10,000 completions) | 150ms | **10ms** (15배) |
| Completion 토글 | 80ms | **0.5ms** (160배) |
| 월별 캘린더 조회 | 100ms | **8ms** (12배) |
| 메모리 점유 | 10MB | **1MB** (10배) |

시작하시겠습니까? 어떤 부분부터 구현을 도와드릴까요?