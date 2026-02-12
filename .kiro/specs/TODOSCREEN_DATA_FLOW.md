# TodoScreen 데이터 흐름 분석

> **작성일**: 2026-02-12  
> **목적**: TodoScreen의 데이터 조회 및 렌더링 흐름 이해

## 📋 목차

1. [개요](#개요)
2. [전체 데이터 흐름](#전체-데이터-흐름)
3. [계층별 상세 분석](#계층별-상세-분석)
4. [핵심 특징](#핵심-특징)
5. [성능 최적화](#성능-최적화)

---

## 개요

**TodoScreen은 SQLite에서 직접 데이터를 조회하여 화면에 표시합니다.**

- ✅ **서버 API 호출 없음** (Offline-First)
- ✅ **SQLite가 Source of Truth**
- ✅ **React Query 캐싱** (5분)
- ✅ **완료 상태 메모리 병합**

---

## 전체 데이터 흐름

```
┌─────────────────────────────────────────────────────────────┐
│ TodoScreen.js                                               │
│  - currentDate 상태 관리 (dateStore)                        │
│  - useTodos(currentDate) 호출                               │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ React Query (useTodos Hook)                                │
│  - queryKey: ['todos', date]                               │
│  - staleTime: 5분 (캐시 유지)                               │
│  - queryFn 실행 ──────────────────────┐                    │
└───────────────────────────────────────┼─────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────┐
│ SQLite 직접 조회 (Offline-First)                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 1. getTodosByDate(date)                             │   │
│  │    - todos 테이블 조회                               │   │
│  │    - categories 테이블 JOIN                         │   │
│  │    - 단일/기간/반복 일정 필터링                      │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 2. getCompletionsByDate(date)                       │   │
│  │    - completions 테이블 조회                         │   │
│  │    - date = ? OR date IS NULL                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 3. 메모리에서 병합                                   │   │
│  │    - todos.map(todo => ({                           │   │
│  │        ...todo,                                     │   │
│  │        completed: !!completions[key]                │   │
│  │      }))                                            │   │
│  └─────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ DailyTodoList 컴포넌트                                      │
│  - 완료 상태 포함된 Todo 리스트 렌더링                      │
│  - 정렬/필터링/체크박스 토글                                │
└─────────────────────────────────────────────────────────────┘
```

---

## 계층별 상세 분석

### 1️⃣ TodoScreen.js (UI Layer)

**파일**: `client/src/screens/TodoScreen.js`

```javascript
export default function TodoScreen({ navigation }) {
  // 현재 선택된 날짜 (전역 상태)
  const { currentDate, setCurrentDate } = useDateStore();
  
  // SQLite에서 해당 날짜의 Todo 조회
  const { data: todos, isLoading } = useTodos(currentDate);
  
  // 완료 토글 Mutation
  const { mutate: toggleCompletion } = useToggleCompletion();
  
  return (
    <SafeAreaView>
      {/* 날짜 네비게이션 헤더 */}
      <View style={styles.dateHeader}>
        {/* ◀️ 이전 날짜 | 현재 날짜 | 다음 날짜 ▶️ */}
      </View>
      
      {/* Todo 리스트 */}
      <DailyTodoList
        date={currentDate}
        todos={todos}
        isLoading={isLoading}
        onToggleComplete={handleToggleComplete}
      />
    </SafeAreaView>
  );
}
```

**역할**:
- 날짜 상태 관리 (`dateStore`)
- `useTodos` 훅으로 데이터 조회
- 사용자 인터랙션 처리 (날짜 변경, 완료 토글)

---

### 2️⃣ useTodos Hook (Data Layer)

**파일**: `client/src/hooks/queries/useTodos.js`

```javascript
export const useTodos = (date) => {
  return useQuery({
    queryKey: ['todos', date],  // 날짜별 캐시 키
    queryFn: async () => {
      // 1. SQLite 초기화 확인
      await ensureDatabase();

      // 2. SQLite에서 Todo 조회
      const todos = await getTodosByDate(date);
      // 결과: [{ _id, title, date, startDate, endDate, recurrence, ... }]

      // 3. SQLite에서 Completion 조회
      const completions = await getCompletionsByDate(date);
      // 결과: { "todoId_date": { todoId, date, completedAt }, ... }

      // 4. 메모리에서 병합
      const todosWithCompletion = todos.map(todo => {
        const isRecurring = !!todo.recurrence;
        
        // 완료 키 생성 규칙
        const completionKey = isRecurring
          ? `${todo._id}_${date}`    // 반복 일정: 날짜별 완료
          : `${todo._id}_null`;      // 비반복: 한 번만 완료

        return {
          ...todo,
          completed: !!completions[completionKey]  // 완료 상태 추가
        };
      });

      return todosWithCompletion;
    },
    enabled: !!date,
    staleTime: 1000 * 60 * 5,  // 5분간 캐시 유지
  });
};
```

**역할**:
- React Query로 SQLite 조회 결과 캐싱
- Todo + Completion 데이터 병합
- 반복/비반복 일정 완료 상태 구분

---

### 3️⃣ todoService.js (SQLite Layer)

**파일**: `client/src/services/db/todoService.js`

```javascript
export async function getTodosByDate(date) {
  const db = getDatabase();

  const result = await db.getAllAsync(`
    SELECT 
      t.*,
      c.name as category_name, 
      c.color as category_color,
      c.icon as category_icon
    FROM todos t
    LEFT JOIN categories c ON t.category_id = c._id
    WHERE (
      -- 단일 일정 (date = 2026-02-12)
      t.date = ?
      
      -- 기간 일정 (startDate <= 2026-02-12 <= endDate)
      OR (t.start_date <= ? AND t.end_date >= ?)
      
      -- 반복 일정 (recurrence 있고, 시작일 이전)
      OR (t.recurrence IS NOT NULL AND t.start_date <= ?)
    )
    AND t.deleted_at IS NULL
    ORDER BY t.is_all_day DESC, t.start_time ASC, t.created_at ASC
  `, [date, date, date, date]);

  return result.map(deserializeTodo);
}
```

**쿼리 로직**:
1. **단일 일정**: `date = '2026-02-12'`
2. **기간 일정**: `startDate <= '2026-02-12' <= endDate`
3. **반복 일정**: `recurrence IS NOT NULL AND startDate <= '2026-02-12'`
4. **카테고리 JOIN**: 한 번에 색상/아이콘 정보 조회
5. **정렬**: 종일 일정 → 시간순 → 생성순

---

### 4️⃣ completionService.js (SQLite Layer)

**파일**: `client/src/services/db/completionService.js`

```javascript
export async function getCompletionsByDate(date) {
  const db = getDatabase();

  // 해당 날짜 + date=null (비반복 일정) 모두 조회
  const result = await db.getAllAsync(
    'SELECT * FROM completions WHERE date = ? OR date IS NULL',
    [date]
  );

  // Map 형태로 변환
  const map = {};
  result.forEach(row => {
    map[row.key] = {  // key: "todoId_date" or "todoId_null"
      _id: row._id,
      todoId: row.todo_id,
      date: row.date,
      completedAt: row.completed_at,
    };
  });

  return map;
}
```

**쿼리 로직**:
- `date = '2026-02-12'`: 해당 날짜의 반복 일정 완료
- `date IS NULL`: 비반복 일정 완료 (날짜 무관)

---

## 핵심 특징

### ✅ 1. Offline-First Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ 클라이언트 (SQLite)                                         │
│  - Source of Truth                                         │
│  - 모든 읽기/쓰기 작업                                      │
│  - 서버 없이도 완전 동작                                    │
└────────────────────┬────────────────────────────────────────┘
                     │
                     │ (백그라운드 동기화)
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ 서버 (MongoDB)                                              │
│  - 백업/동기화 용도                                         │
│  - 선택적 (Guest 모드 가능)                                 │
└─────────────────────────────────────────────────────────────┘
```

### ✅ 2. React Query 캐싱 전략

```javascript
queryKey: ['todos', '2026-02-12']  // 날짜별 캐시
staleTime: 5분                     // 5분간 재조회 안 함

// 날짜 변경 시
'2026-02-12' → '2026-02-13'  // 새 쿼리 실행 (캐시 미스)
'2026-02-13' → '2026-02-12'  // 캐시 히트 (5분 이내)
```

### ✅ 3. 완료 상태 병합 로직

```javascript
// 반복 일정 (매일/매주)
completionKey = "todoId_2026-02-12"  // 날짜별 완료 추적
// → 2/12 완료해도 2/13은 미완료

// 비반복 일정 (단일/기간)
completionKey = "todoId_null"  // 한 번만 완료
// → 한 번 완료하면 모든 날짜에서 완료 표시
```

### ✅ 4. 일정 타입별 조회 규칙

| 타입 | 조건 | 예시 |
|------|------|------|
| **단일 일정** | `date = targetDate` | 2/12 일정 → 2/12만 표시 |
| **기간 일정** | `startDate <= targetDate <= endDate` | 2/10~2/15 → 2/12 표시 |
| **반복 일정** | `recurrence != null AND startDate <= targetDate` | 매일 반복 → 모든 날짜 표시 |

---

## 성능 최적화

### 1️⃣ SQLite 인덱스

```sql
-- todos 테이블
CREATE INDEX idx_todos_date ON todos(date);
CREATE INDEX idx_todos_start_date ON todos(start_date);
CREATE INDEX idx_todos_end_date ON todos(end_date);
CREATE INDEX idx_todos_category_id ON todos(category_id);

-- completions 테이블
CREATE INDEX idx_completions_date ON completions(date);
CREATE INDEX idx_completions_key ON completions(key);
```

### 2️⃣ JOIN 최적화

```javascript
// ❌ N+1 쿼리 (비효율)
const todos = await getTodos();
for (const todo of todos) {
  const category = await getCategoryById(todo.categoryId);
}

// ✅ JOIN으로 한 번에 조회
SELECT t.*, c.name, c.color, c.icon
FROM todos t
LEFT JOIN categories c ON t.category_id = c._id
```

### 3️⃣ React Query 캐싱

```javascript
// 5분간 캐시 유지 → SQLite 재조회 방지
staleTime: 1000 * 60 * 5

// 날짜별 독립 캐시
['todos', '2026-02-12']  // 캐시 1
['todos', '2026-02-13']  // 캐시 2
```

### 4️⃣ 메모리 병합 (DB JOIN 대신)

```javascript
// ✅ 유연성: 반복/비반복 완료 로직 분리
// ✅ 성능: 2개 쿼리 + 메모리 병합 (빠름)
// ❌ DB JOIN: 복잡한 CASE WHEN 필요
```

---

## 성능 측정 결과

```
⚡ [useTodos] 전체: 15개 (8.42ms)
  📝 getTodosByDate: 15개 (3.21ms)
  ✅ getCompletionsByDate: 8개 (2.15ms)
  🔀 병합: (3.06ms)
```

**특징**:
- 전체 조회 < 10ms (대부분)
- SQLite 쿼리 최적화 (인덱스)
- 메모리 병합 오버헤드 최소

---

## 관련 파일

### UI Layer
- `client/src/screens/TodoScreen.js` - 메인 화면
- `client/src/features/todo/list/DailyTodoList.js` - Todo 리스트 컴포넌트

### Data Layer
- `client/src/hooks/queries/useTodos.js` - React Query 훅
- `client/src/hooks/queries/useToggleCompletion.js` - 완료 토글 Mutation

### SQLite Layer
- `client/src/services/db/todoService.js` - Todo CRUD
- `client/src/services/db/completionService.js` - Completion CRUD
- `client/src/services/db/database.js` - SQLite 초기화

### Store
- `client/src/store/dateStore.js` - 현재 날짜 상태 관리

---

## 참고 문서

- [README.md](../../README.md) - 전체 아키텍처 개요
- [SQLITE_MIGRATION_COMPLETE.md](./archive/SQLITE_MIGRATION_COMPLETE.md) - SQLite 마이그레이션
- [CACHE_INVALIDATION_ANALYSIS.md](./archive/CACHE_INVALIDATION_ANALYSIS.md) - 캐시 전략
- [OPTIMISTIC_UPDATE_COMPLETED.md](./archive/OPTIMISTIC_UPDATE_COMPLETED.md) - Optimistic Update

---

**작성자**: Kiro AI  
**최종 수정**: 2026-02-12
