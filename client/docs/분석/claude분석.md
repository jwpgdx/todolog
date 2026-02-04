흥미로운 성능 문제네요. SQLite WASM의 지연 로딩(lazy loading) 특성과 관련된 것으로 보입니다. 분석과 해결 방안을 제시하겠습니다.

## 문제 분석

### 1. 근본 원인 (가장 가능성 높은 순서)

**A. SQLite의 지연 로딩 (Lazy Loading)**
- 워밍업에서 `WHERE date = '1970-01-01'`은 빈 결과를 반환
- SQLite는 실제 데이터 블록을 메모리에 로드하지 않음
- 첫 실제 데이터 조회 시 디스크(WASM 가상 파일시스템)에서 페이지를 읽어옴

**B. WASM 파일시스템 초기화**
- expo-sqlite는 OPFS(Origin Private File System) 또는 IndexedDB를 사용
- 첫 실제 I/O 작업 시 비동기 파일 시스템 초기화 발생
- 워밍업 쿼리가 빈 결과라 I/O가 발생하지 않음

**C. 쿼리 플랜 캐싱**
- 다른 파라미터 값(`'1970-01-01'` vs `'2026-02-04'`)으로 인한 쿼리 플랜 캐시 미스
- 하지만 prepared statement를 사용하므로 가능성은 낮음

## 테스트 방법

다음 코드를 `database.js`에 추가하여 정확한 원인을 파악하세요:

```javascript
// database.js에 추가
export async function detailedWarmup(db) {
  console.log('🔬 [상세 워밍업] 시작...');
  
  // Test 1: 빈 결과 쿼리
  const t1 = performance.now();
  await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['1970-01-01']);
  const d1 = performance.now() - t1;
  console.log(`  ✅ 빈 결과 쿼리: ${d1.toFixed(2)}ms`);
  
  // Test 2: LIMIT 1 (첫 행만)
  const t2 = performance.now();
  await db.getAllAsync('SELECT * FROM completions LIMIT 1');
  const d2 = performance.now() - t2;
  console.log(`  ✅ LIMIT 1: ${d2.toFixed(2)}ms`);
  
  // Test 3: 실제 데이터 조회
  const t3 = performance.now();
  const realData = await db.getAllAsync('SELECT * FROM completions LIMIT 10');
  const d3 = performance.now() - t3;
  console.log(`  ✅ 실제 데이터 10개: ${d3.toFixed(2)}ms (${realData.length} rows)`);
  
  // Test 4: 전체 테이블 스캔
  const t4 = performance.now();
  const allData = await db.getAllAsync('SELECT COUNT(*) as cnt FROM completions');
  const d4 = performance.now() - t4;
  console.log(`  ✅ COUNT(*): ${d4.toFixed(2)}ms (${allData[0]?.cnt} rows)`);
  
  // Test 5: 인덱스 사용 쿼리 (날짜 범위)
  const t5 = performance.now();
  await db.getAllAsync(
    'SELECT * FROM completions WHERE date BETWEEN ? AND ?', 
    ['2026-01-01', '2026-12-31']
  );
  const d5 = performance.now() - t5;
  console.log(`  ✅ 날짜 범위 쿼리: ${d5.toFixed(2)}ms`);
  
  // Test 6: 페이지 캐시 강제 로드
  const t6 = performance.now();
  await db.execAsync('PRAGMA cache_size = -2000'); // 2MB 캐시
  await db.getAllAsync('SELECT * FROM completions');
  const d6 = performance.now() - t6;
  console.log(`  ✅ 전체 테이블 로드: ${d6.toFixed(2)}ms`);
  
  console.log('🔬 [상세 워밍업] 완료');
}

// initDatabase()에서 호출
await detailedWarmup(db);
```

## 추천 해결 방안

### 해결책 1: 실제 데이터 워밍업 (가장 효과적)

```javascript
async function warmupTables(db) {
  console.log('🔥 [DB] 테이블 워밍업 시작...');
  const start = performance.now();
  
  // 각 테이블의 실제 데이터 페이지를 메모리에 로드
  const tables = [
    { name: 'todos', query: 'SELECT * FROM todos LIMIT 5' },
    { name: 'categories', query: 'SELECT * FROM categories LIMIT 5' },
    { 
      name: 'completions', 
      // 최근 30일 데이터를 미리 로드 (실제 사용 패턴에 맞춤)
      query: `SELECT * FROM completions 
              WHERE date >= date('now', '-30 days') 
              ORDER BY date DESC LIMIT 100` 
    }
  ];
  
  for (const table of tables) {
    const t = performance.now();
    const result = await db.getAllAsync(table.query);
    console.log(`  ✅ [Warmup] ${table.name}: ${(performance.now() - t).toFixed(2)}ms (${result.length} rows)`);
  }
  
  console.log(`🔥 [DB] 테이블 워밍업 완료 (${(performance.now() - start).toFixed(2)}ms)`);
}
```

### 해결책 2: PRAGMA 최적화

```javascript
async function optimizeDatabase(db) {
  // 페이지 캐시 크기 증가 (기본값은 작음)
  await db.execAsync('PRAGMA cache_size = -4000'); // 4MB
  
  // 메모리 매핑 활성화 (WASM에서 효과적일 수 있음)
  await db.execAsync('PRAGMA mmap_size = 30000000000'); // 30GB
  
  // 임시 저장소를 메모리로 설정
  await db.execAsync('PRAGMA temp_store = MEMORY');
  
  // 동기화 모드 조정 (웹에서는 영향 적음)
  await db.execAsync('PRAGMA synchronous = NORMAL');
  
  console.log('⚙️ [DB] PRAGMA 최적화 완료');
}
```

### 해결책 3: 인덱스 확인 및 추가

```javascript
async function ensureIndexes(db) {
  // completions 테이블의 date 컬럼에 인덱스가 있는지 확인
  const indexes = await db.getAllAsync(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='completions'"
  );
  
  console.log('📇 [DB] 인덱스:', indexes);
  
  // date 컬럼 인덱스가 없으면 생성
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_completions_date 
    ON completions(date DESC)
  `);
  
  // 복합 인덱스도 고려 (자주 사용하는 쿼리 패턴에 따라)
  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_completions_date_todo 
    ON completions(date, todo_id)
  `);
}
```

### 해결책 4: 백그라운드 프리로딩

```javascript
// App.js 또는 최상위 컴포넌트
useEffect(() => {
  const preloadData = async () => {
    const db = await getDatabase();
    
    // 백그라운드에서 데이터 프리로드 (UI 블로킹 없음)
    requestIdleCallback(async () => {
      console.log('🔄 [Background] 데이터 프리로딩 시작');
      const start = performance.now();
      
      // 오늘 날짜 기준 데이터 미리 로드
      const today = new Date().toISOString().split('T')[0];
      await db.getAllAsync('SELECT * FROM completions WHERE date = ?', [today]);
      
      // 이번 주 데이터도 프리로드
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      await db.getAllAsync(
        'SELECT * FROM completions WHERE date >= ?', 
        [weekAgo.toISOString().split('T')[0]]
      );
      
      console.log(`🔄 [Background] 프리로딩 완료 (${(performance.now() - start).toFixed(2)}ms)`);
    }, { timeout: 2000 });
  };
  
  preloadData();
}, []);
```

## 통합 솔루션

```javascript
// database.js - 개선된 initDatabase()
export async function initDatabase() {
  if (dbInstance) return dbInstance;
  
  console.log('🚀 [DB] 초기화 시작...');
  const start = performance.now();
  
  try {
    const db = await SQLite.openDatabaseAsync('mydb.db');
    console.log('✅ [DB] Database opened');
    
    // 1. PRAGMA 최적화
    await db.execAsync('PRAGMA journal_mode = WAL');
    await db.execAsync('PRAGMA cache_size = -4000'); // 4MB 캐시
    await db.execAsync('PRAGMA temp_store = MEMORY');
    console.log('✅ [DB] PRAGMA 설정 완료');
    
    // 2. 스키마 생성
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category_id INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      
      CREATE TABLE IF NOT EXISTS completions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        todo_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        completed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (todo_id) REFERENCES todos (id)
      );
      
      -- 인덱스 생성
      CREATE INDEX IF NOT EXISTS idx_completions_date 
      ON completions(date DESC);
      
      CREATE INDEX IF NOT EXISTS idx_completions_date_todo 
      ON completions(date, todo_id);
    `);
    console.log('✅ [DB] Schema created');
    
    // 3. 실제 데이터 워밍업
    const warmupStart = performance.now();
    
    // 각 테이블의 실제 데이터 로드
    const tables = ['todos', 'categories', 'completions'];
    for (const table of tables) {
      const t = performance.now();
      const result = await db.getAllAsync(`SELECT * FROM ${table} LIMIT 10`);
      console.log(`  ✅ [Warmup] ${table}: ${(performance.now() - t).toFixed(2)}ms (${result.length} rows)`);
    }
    
    // 최근 데이터 프리로드
    const today = new Date().toISOString().split('T')[0];
    const t = performance.now();
    await db.getAllAsync('SELECT * FROM completions WHERE date >= ?', [today]);
    console.log(`  ✅ [Warmup] 오늘 데이터: ${(performance.now() - t).toFixed(2)}ms`);
    
    console.log(`🔥 [DB] 워밍업 완료 (${(performance.now() - warmupStart).toFixed(2)}ms)`);
    
    dbInstance = db;
    console.log(`✅ [App] SQLite 초기화 완료 (${(performance.now() - start).toFixed(2)}ms)`);
    
    return db;
    
  } catch (error) {
    console.error('❌ [DB] 초기화 실패:', error);
    throw error;
  }
}
```

## 추가 디버깅 로그

```javascript
// services/todoService.js - getCompletionsByDate 수정
export async function getCompletionsByDate(date) {
  const start = performance.now();
  const db = await getDatabase();
  
  // 쿼리 플랜 확인
  const plan = await db.getAllAsync(
    'EXPLAIN QUERY PLAN SELECT * FROM completions WHERE date = ?',
    [date]
  );
  console.log('📋 [Query Plan]:', plan);
  
  const result = await db.getAllAsync(
    'SELECT * FROM completions WHERE date = ?',
    [date]
  );
  
  const duration = performance.now() - start;
  console.log(`⏱️ [getCompletionsByDate] ${duration.toFixed(2)}ms (${result.length} rows)`);
  
  // 느린 쿼리 경고
  if (duration > 100) {
    console.warn(`⚠️ 느린 쿼리 감지! ${duration.toFixed(2)}ms`);
  }
  
  return result;
}
```

## 권장 조치 순서

1. **즉시 적용**: 해결책 1 (실제 데이터 워밍업) - 가장 효과적
2. **함께 적용**: 해결책 2 (PRAGMA 최적화) - 부작용 없음
3. **확인**: 인덱스가 제대로 생성되었는지 체크
4. **선택 적용**: 해결책 4 (백그라운드 프리로딩) - UX 개선

테스트 후 결과를 공유해주시면 추가 분석 도와드리겠습니다!