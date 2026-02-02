SQLite 마이그레이션 구현 계획서
📌 프로젝트 개요
목표: AsyncStorage → SQLite 전환으로 성능 최적화
대상: Todos, Completions, Categories, Pending Changes, Sync Metadata
유지: Settings (AsyncStorage)

예상 성능 개선
지표	현재	전환 후	개선율
앱 시작 (10,000 completions)	150ms	10ms	15배
Completion 토글	80ms	0.5ms	160배
월별 캘린더 조회	100ms	8ms	12배
메모리 점유	10MB	1MB	10배
🏗️ 아키텍처 변경
Before
서버 (MongoDB)
   ↓ Delta Sync
AsyncStorage (전체 JSON)
   ↓ 전체 로드 → JS 필터링
React Query (['todos', 'all'], ['completions'])
   ↓
UI
After
서버 (MongoDB)
   ↓ Delta Sync (변경 없음)
SQLite (Source of Truth)
   ↓ SELECT (날짜/월별 쿼리)
React Query (['todos', '2026-02-01'], ['calendar', '2026-02'])
   ↓
UI
핵심 변경점
❌ ['todos', 'all'] → ✅ ['todos', date]
❌ ['completions'] → ✅ ['completions', date]
❌ 전체 로드 + JS 필터 → ✅ SQL WHERE 쿼리
📁 파일 구조
새로 생성
client/src/
├── db/
│   ├── database.js          # SQLite 초기화 + 스키마
│   ├── todoService.js       # Todo CRUD
│   ├── completionService.js # Completion CRUD
│   ├── categoryService.js   # Category CRUD
│   ├── syncService.js       # Sync Metadata
│   └── pendingService.js    # Pending Changes
수정
client/src/
├── hooks/
│   ├── queries/
│   │   ├── useTodos.js           # SQLite 쿼리로 변경
│   │   ├── useToggleCompletion.js # SQLite 직접 쓰기
│   │   └── useAllTodos.js        # 삭제 또는 수정
│   ├── useCalendarEvents.js      # SQLite 월별 쿼리
│   └── useSyncTodos.js           # SQLite 델타 병합
├── storage/
│   ├── todoStorage.js            # 삭제 (db/로 이동)
│   ├── completionStorage.js      # 삭제 (db/로 이동)
│   ├── categoryStorage.js        # 삭제 (db/로 이동)
│   └── settingsStorage.js        # 유지 (AsyncStorage)
├── screens/
│   └── DebugScreen.js            # SQLite 디버그 버튼 추가
삭제
- src/storage/todoStorage.js (→ db/todoService.js)
- src/storage/completionStorage.js (→ db/completionService.js)
- src/storage/categoryStorage.js (→ db/categoryService.js)
- src/storage/pendingChangesStorage.js (→ db/pendingService.js)
🗄️ SQLite 스키마
-- ============================================================
-- Phase 0: Metadata (마이그레이션 & 동기화 상태)
-- ============================================================
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);
-- 초기값: migration_version = '0', last_sync_time = null
-- ============================================================
-- Phase 1: Categories (Todo의 FK이므로 먼저)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);
-- ============================================================
-- Phase 2: Todos
-- ============================================================
CREATE TABLE IF NOT EXISTS todos (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,                    -- 단일 일정: YYYY-MM-DD
  start_date TEXT,              -- 기간 일정: 시작
  end_date TEXT,                -- 기간 일정: 종료
  recurrence TEXT,              -- JSON: RRule 객체
  category_id TEXT,
  is_all_day INTEGER DEFAULT 0,
  start_time TEXT,              -- HH:mm
  end_time TEXT,                -- HH:mm
  color TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(_id)
);
-- 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_range ON todos(start_date, end_date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_todos_updated ON todos(updated_at);
-- ============================================================
-- Phase 3: Completions
-- ============================================================
CREATE TABLE IF NOT EXISTS completions (
  key TEXT PRIMARY KEY,         -- todoId_date (또는 todoId_null)
  todo_id TEXT NOT NULL,
  date TEXT,                    -- YYYY-MM-DD (null for period todo)
  completed_at TEXT NOT NULL,
  FOREIGN KEY (todo_id) REFERENCES todos(_id) ON DELETE CASCADE
);
-- 인덱스
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
CREATE INDEX IF NOT EXISTS idx_completions_todo ON completions(todo_id);
-- ============================================================
-- Phase 4: Pending Changes (오프라인 큐)
-- ============================================================
CREATE TABLE IF NOT EXISTS pending_changes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- create, update, delete, createCompletion, deleteCompletion
  todo_id TEXT,
  data TEXT,                    -- JSON
  date TEXT,
  temp_id TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_changes(created_at);
🔧 구현 단계 (Phase별)
🟢 Phase 0: 기반 작업 (DB 초기화)
파일: db/database.js

// 마이그레이션 버전 관리
const MIGRATION_VERSION = 1;
// 초기화 함수
export async function initDatabase() {
  const db = await SQLite.openDatabaseAsync('todos.db');
  
  // WAL Mode (동시 읽기/쓰기)
  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA synchronous = NORMAL');
  
  // 테이블 생성
  await db.execAsync(SCHEMA_SQL);
  
  // 마이그레이션 체크
  const version = await getMetadata('migration_version');
  if (!version || parseInt(version) < MIGRATION_VERSION) {
    await migrateFromAsyncStorage();
    await setMetadata('migration_version', String(MIGRATION_VERSION));
  }
  
  return db;
}
테스트 버튼 (DebugScreen):

[0-1] DB 초기화 테스트 - DB 생성 + 스키마 확인
[0-2] 현재 버전 확인 - migration_version 조회
🟡 Phase 1: 마이그레이션 함수
파일: db/database.js (계속)

async function migrateFromAsyncStorage() {
  console.log('🚀 Migration started');
  
  // 1. AsyncStorage에서 데이터 로드
  const oldTodos = await AsyncStorage.getItem('@todos');
  const oldCompletions = await AsyncStorage.getItem('@completions');
  const oldCategories = await AsyncStorage.getItem('@categories');
  const oldPending = await AsyncStorage.getItem('@pending_changes');
  
  if (!oldTodos && !oldCompletions && !oldCategories) {
    console.log('✅ No data to migrate');
    return;
  }
  
  // 2. 트랜잭션으로 삽입
  await db.withTransactionAsync(async () => {
    // Categories
    if (oldCategories) {
      const categories = JSON.parse(oldCategories);
      for (const cat of categories) {
        await insertCategory(cat);
      }
    }
    
    // Todos
    if (oldTodos) {
      const todos = JSON.parse(oldTodos);
      for (const todo of todos) {
        await insertTodo(todo);
      }
    }
    
    // Completions
    if (oldCompletions) {
      const completions = JSON.parse(oldCompletions);
      for (const [key, comp] of Object.entries(completions)) {
        await insertCompletion(key, comp);
      }
    }
    
    // Pending Changes
    if (oldPending) {
      const pending = JSON.parse(oldPending);
      for (const p of pending) {
        await insertPendingChange(p);
      }
    }
  });
  
  // 3. 백업 생성
  await AsyncStorage.setItem('@todos_backup', oldTodos);
  await AsyncStorage.setItem('@completions_backup', oldCompletions);
  
  // 4. 원본 삭제
  await AsyncStorage.removeItem('@todos');
  await AsyncStorage.removeItem('@completions');
  await AsyncStorage.removeItem('@categories');
  await AsyncStorage.removeItem('@pending_changes');
  
  console.log('✅ Migration completed');
}
테스트 버튼 (DebugScreen):

[1-1] 마이그레이션 시뮬레이션 - AsyncStorage → SQLite (읽기만, 삭제 안함)
[1-2] 실제 마이그레이션 실행 - 실제 이관 + 원본 삭제
[1-3] 마이그레이션 롤백 - 백업에서 AsyncStorage 복원
🟡 Phase 2: Todo Service
파일: db/todoService.js

// 날짜별 조회 (핵심!)
export async function getTodosByDate(date) {
  const result = await db.getAllAsync(`
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE (
      t.date = ? 
      OR (t.start_date <= ? AND t.end_date >= ?)
      OR t.recurrence IS NOT NULL
    )
    AND t.deleted_at IS NULL
  `, [date, date, date]);
  
  return result.map(deserializeTodo);
}
// 월별 조회 (캘린더용)
export async function getTodosByMonth(year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
  
  const result = await db.getAllAsync(`
    SELECT t.*, c.name as category_name, c.color as category_color
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE (
      (t.date >= ? AND t.date <= ?)
      OR (t.start_date <= ? AND t.end_date >= ?)
      OR t.recurrence IS NOT NULL
    )
    AND t.deleted_at IS NULL
  `, [startDate, endDate, endDate, startDate]);
  
  return result.map(deserializeTodo);
}
// 단일 조회
export async function getTodoById(id) { ... }
// 삽입/수정
export async function upsertTodo(todo) {
  await db.runAsync(`
    INSERT OR REPLACE INTO todos 
    (_id, title, date, start_date, end_date, recurrence, 
     category_id, is_all_day, start_time, end_time, color, memo,
     created_at, updated_at, deleted_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, serializeTodo(todo));
}
// Soft Delete
export async function deleteTodo(id) {
  await db.runAsync(
    'UPDATE todos SET deleted_at = ? WHERE _id = ?',
    [new Date().toISOString(), id]
  );
}
테스트 버튼 (DebugScreen):

[2-1] 날짜별 Todo 조회 - 선택된 날짜의 Todo 목록
[2-2] 월별 Todo 조회 - 현재 월의 Todo 목록
[2-3] Todo 삽입 테스트 - 테스트 Todo 생성
[2-4] Todo 삭제 테스트 - 마지막 Todo soft delete
🟡 Phase 3: Completion Service
파일: db/completionService.js

// 날짜별 조회
export async function getCompletionsByDate(date) {
  const result = await db.getAllAsync(
    'SELECT * FROM completions WHERE date = ?',
    [date]
  );
  
  // Map으로 변환 (기존 형식 호환)
  const map = {};
  result.forEach(row => {
    map[row.key] = {
      todoId: row.todo_id,
      date: row.date,
      completedAt: row.completed_at
    };
  });
  return map;
}
// 월별 조회 (캘린더용)
export async function getCompletionsByMonth(year, month) {
  const pattern = `${year}-${String(month).padStart(2, '0')}%`;
  const result = await db.getAllAsync(
    'SELECT * FROM completions WHERE date LIKE ?',
    [pattern]
  );
  
  const map = {};
  result.forEach(row => {
    map[row.key] = { ... };
  });
  return map;
}
// 캘린더 dot용 통계
export async function getCompletionStats(year, month) {
  const pattern = `${year}-${String(month).padStart(2, '0')}%`;
  const result = await db.getAllAsync(`
    SELECT date, COUNT(*) as count
    FROM completions
    WHERE date LIKE ?
    GROUP BY date
  `, [pattern]);
  
  return result; // [{date: '2026-02-01', count: 3}, ...]
}
// 토글 (핵심!)
export async function toggleCompletion(todoId, date) {
  const key = `${todoId}_${date || 'null'}`;
  
  const existing = await db.getFirstAsync(
    'SELECT * FROM completions WHERE key = ?',
    [key]
  );
  
  if (existing) {
    await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
    return false; // 미완료
  } else {
    await db.runAsync(
      'INSERT INTO completions (key, todo_id, date, completed_at) VALUES (?, ?, ?, ?)',
      [key, todoId, date, new Date().toISOString()]
    );
    return true; // 완료
  }
}
테스트 버튼 (DebugScreen):

[3-1] 날짜별 Completion 조회 - 선택된 날짜
[3-2] 월별 Completion 조회 - 현재 월
[3-3] Completion 토글 테스트 - 첫 번째 Todo 토글
[3-4] 캘린더 통계 조회 - 월별 완료 count
🟡 Phase 4: Pending Service (오프라인 큐)
파일: db/pendingService.js

export async function addPendingChange(change) {
  await db.runAsync(`
    INSERT INTO pending_changes (id, type, todo_id, data, date, temp_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [
    change.id || uuidv4(),
    change.type,
    change.todoId,
    JSON.stringify(change.data),
    change.date,
    change.tempId,
    new Date().toISOString()
  ]);
}
export async function getPendingChanges() {
  const result = await db.getAllAsync(
    'SELECT * FROM pending_changes ORDER BY created_at ASC'
  );
  return result.map(row => ({
    ...row,
    data: JSON.parse(row.data)
  }));
}
export async function removePendingChange(id) {
  await db.runAsync('DELETE FROM pending_changes WHERE id = ?', [id]);
}
export async function clearPendingChanges() {
  await db.runAsync('DELETE FROM pending_changes');
}
테스트 버튼 (DebugScreen):

[4-1] Pending 목록 조회
[4-2] 테스트 Pending 추가
[4-3] Pending 전체 삭제
🟡 Phase 5: Hooks 리팩토링
5-1. useTodos.js
// Before
const allTodos = queryClient.getQueryData(['todos', 'all']);
const filtered = filterByDate(allTodos, date);
// After
export const useTodos = (date) => {
  return useQuery({
    queryKey: ['todos', date],
    queryFn: async () => {
      const todos = await getTodosByDate(date);
      const completions = await getCompletionsByDate(date);
      
      return todos.map(todo => ({
        ...todo,
        completed: !!completions[`${todo._id}_${date}`]
      }));
    },
    staleTime: 5 * 60 * 1000,
  });
};
5-2. useToggleCompletion.js
// Before
await toggleCompletionLocally(todoId, date); // AsyncStorage 전체 쓰기
// After
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ todoId, date }) => {
      // 1. SQLite 직접 토글 (0.1ms)
      const newState = await toggleCompletion(todoId, date);
      
      // 2. 오프라인이면 pending에 추가
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) {
        await addPendingChange({
          type: newState ? 'createCompletion' : 'deleteCompletion',
          todoId,
          date,
        });
      } else {
        // 3. 온라인이면 서버 동기화
        await api.post('/completions/toggle', { todoId, date });
      }
      
      return newState;
    },
    onSuccess: (_, { date }) => {
      // 4. 관련 캐시만 무효화
      queryClient.invalidateQueries(['todos', date]);
      queryClient.invalidateQueries(['calendar']);
    }
  });
};
5-3. useCalendarEvents.js
// Before
const allTodos = queryClient.getQueryData(['todos', 'all']);
const monthTodos = filterByMonth(allTodos, year, month);
// After
export const useCalendarEvents = (year, month) => {
  return useQuery({
    queryKey: ['calendar', year, month],
    queryFn: async () => {
      const todos = await getTodosByMonth(year, month);
      const completions = await getCompletionsByMonth(year, month);
      
      // RRule 전개 (기존 로직 유지)
      return expandRecurringEvents(todos, completions, year, month);
    },
    staleTime: 10 * 60 * 1000,
  });
};
테스트 버튼 (DebugScreen):

[5-1] useTodos 테스트 - 새 훅으로 데이터 조회
[5-2] useToggleCompletion 테스트 - 새 훅으로 토글
[5-3] useCalendarEvents 테스트 - 새 훅으로 캘린더 데이터
🟡 Phase 6: 동기화 리팩토링
파일: 
hooks/useSyncTodos.js

// Delta 병합
async function mergeDelta(updated, deleted) {
  await db.withTransactionAsync(async () => {
    // 업데이트
    for (const todo of updated.todos) {
      await upsertTodo(todo);
    }
    for (const comp of updated.completions) {
      await upsertCompletion(comp);
    }
    
    // 삭제
    for (const id of deleted.todoIds) {
      await deleteTodo(id);
    }
    for (const key of deleted.completionKeys) {
      await deleteCompletion(key);
    }
  });
  
  // 캐시 무효화
  queryClient.invalidateQueries(['todos']);
  queryClient.invalidateQueries(['calendar']);
}
테스트 버튼 (DebugScreen):

[6-1] 델타 동기화 시뮬레이션 - 서버에서 delta 가져와서 병합
[6-2] Pending 동기화 테스트 - pending changes 서버 전송
🧪 테스트 시나리오
시나리오 A: 온라인 기본 흐름
순서:
1. [0-1] DB 초기화 테스트
2. [1-2] 실제 마이그레이션 실행
3. [2-1] 날짜별 Todo 조회
4. [3-3] Completion 토글 테스트
5. [5-1] useTodos 테스트
✅ 성공 조건:
- 마이그레이션 완료 로그
- Todo 목록 표시
- 토글 반영 확인
시나리오 B: 오프라인 토글
준비:
- 비행기 모드 ON
순서:
1. [4-1] Pending 목록 조회 (빈 목록)
2. [3-3] Completion 토글 테스트
3. [4-1] Pending 목록 조회 (1개 추가됨)
4. [2-1] 날짜별 Todo 조회 (완료 상태 반영됨)
✅ 성공 조건:
- 토글 즉시 반영
- Pending에 추가됨
- 로컬 DB에 저장됨
시나리오 C: 오프라인 → 온라인 동기화
준비:
- 시나리오 B 완료 후
- 비행기 모드 OFF
순서:
1. [6-2] Pending 동기화 테스트
2. [4-1] Pending 목록 조회 (비어 있어야 함)
3. [6-1] 델타 동기화 시뮬레이션
✅ 성공 조건:
- Pending이 서버로 전송됨
- 서버 데이터와 동기화 완료
시나리오 D: 앱 재시작 (Cold Start)
순서:
1. 앱 완전 종료
2. 앱 재시작
3. [0-2] 현재 버전 확인
4. [2-1] 날짜별 Todo 조회
✅ 성공 조건:
- 마이그레이션 스킵 (이미 완료)
- SQLite에서 바로 로드
- 이전 상태 유지
시나리오 E: 마이그레이션 롤백
준비:
- 문제 발생 시
순서:
1. [1-3] 마이그레이션 롤백
2. 앱 재시작
3. 기존 AsyncStorage 로직으로 동작 확인
✅ 성공 조건:
- 백업에서 복원
- 기존 로직 정상 동작
📱 DebugScreen 버튼 구성
┌─────────────────────────────────────────────┐
│  🚀 SQLite 마이그레이션 테스트              │
├─────────────────────────────────────────────┤
│                                             │
│  === Phase 0: 기반 ===                      │
│  [0-1] DB 초기화       [0-2] 버전 확인      │
│                                             │
│  === Phase 1: 마이그레이션 ===              │
│  [1-1] 시뮬레이션      [1-2] 실제 실행      │
│  [1-3] 롤백                                 │
│                                             │
│  === Phase 2: Todos ===                     │
│  [2-1] 날짜별 조회     [2-2] 월별 조회      │
│  [2-3] 삽입 테스트     [2-4] 삭제 테스트    │
│                                             │
│  === Phase 3: Completions ===               │
│  [3-1] 날짜별 조회     [3-2] 월별 조회      │
│  [3-3] 토글 테스트     [3-4] 캘린더 통계    │
│                                             │
│  === Phase 4: Pending ===                   │
│  [4-1] 목록 조회       [4-2] 테스트 추가    │
│  [4-3] 전체 삭제                            │
│                                             │
│  === Phase 5: Hooks ===                     │
│  [5-1] useTodos        [5-2] useToggle      │
│  [5-3] useCalendar                          │
│                                             │
│  === Phase 6: 동기화 ===                    │
│  [6-1] 델타 시뮬       [6-2] Pending 동기화 │
│                                             │
│  === 시나리오 테스트 ===                    │
│  [A] 온라인 기본       [B] 오프라인 토글    │
│  [C] 재연결 동기화     [D] Cold Start       │
│  [E] 롤백                                   │
│                                             │
└─────────────────────────────────────────────┘
📋 체크리스트
Phase 0: 기반 작업
 expo-sqlite 설치
 db/database.js 생성
 스키마 정의
 WAL 모드 설정
 DebugScreen 버튼 [0-1], [0-2]
Phase 1: 마이그레이션
 migrateFromAsyncStorage() 구현
 백업 생성 로직
 롤백 로직
 DebugScreen 버튼 [1-1], [1-2], [1-3]
Phase 2: Todo Service
 db/todoService.js 생성
 getTodosByDate() 구현
 getTodosByMonth() 구현
 
upsertTodo()
 구현
 deleteTodo() 구현
 DebugScreen 버튼 [2-1] ~ [2-4]
Phase 3: Completion Service
 db/completionService.js 생성
 getCompletionsByDate() 구현
 getCompletionsByMonth() 구현
 getCompletionStats() 구현
 
toggleCompletion()
 구현
 DebugScreen 버튼 [3-1] ~ [3-4]
Phase 4: Pending Service
 db/pendingService.js 생성
 addPendingChange() 구현
 getPendingChanges() 구현
 removePendingChange() 구현
 DebugScreen 버튼 [4-1] ~ [4-3]
Phase 5: Hooks 리팩토링
 
useTodos.js
 수정
 
useToggleCompletion.js
 수정
 
useCalendarEvents.js
 수정
 기존 storage 임포트 제거
 DebugScreen 버튼 [5-1] ~ [5-3]
Phase 6: 동기화
 
useSyncTodos.js
 수정
 
mergeDelta()
 SQLite로 변경
 processPendingChanges() 수정
 DebugScreen 버튼 [6-1], [6-2]
Phase 7: 정리
 기존 storage 파일 삭제
 불필요한 임포트 제거
 콘솔 로그 정리
 전체 시나리오 테스트
⚠️ 주의사항
1. 마이그레이션 안전장치
항상 백업 생성 후 삭제
롤백 버튼 항상 활성화
마이그레이션 실패 시 AsyncStorage 유지
2. 트랜잭션 필수
다중 쓰기는 반드시 withTransactionAsync()
동남아 저가폰 I/O 불안정 대응
3. 캐시 무효화 범위
❌ invalidateQueries(['todos']) - 전체 무효화
✅ invalidateQueries(['todos', date]) - 해당 날짜만
4. 점진적 롤아웃
먼저 개발 환경에서 테스트
Feature Flag로 SQLite/AsyncStorage 전환 가능하게
문제 발생 시 즉시 롤백
🔗 참고 문서
expo-sqlite 공식 문서
AI 분석 - Claude
AI 분석 - Gemini
AI 분석 - GPT