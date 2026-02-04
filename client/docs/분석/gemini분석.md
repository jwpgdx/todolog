매우 상세한 분석과 로그 감사합니다. React Native Web (Expo) 환경의 SQLite WASM에서 발생하는 전형적인 **"콜드 캐시(Cold Cache)와 페이징 I/O"** 문제입니다.

1390ms라는 지연 시간은 단순히 쿼리가 느린 것이 아니라, **파일 시스템(OPFS)에서 실제 데이터 페이지를 메모리로 퍼 올리는 물리적(가상) I/O 시간**과 **동시성 큐 대기 시간**이 합쳐진 결과일 가능성이 매우 높습니다.

분석 내용과 해결 방안을 정리해 드립니다.

---

### 1. 근본 원인 분석 (Root Cause)

#### 가설 검증

* **워밍업 데이터 (False Positive):** 작성하신 워밍업 쿼리(`SELECT 1 ... WHERE date = '1970...'`)는 **인덱스 스캔(Index Scan)**만으로 처리가 끝났을 확률이 높습니다. `date` 컬럼에 인덱스가 있다면, SQLite는 실제 데이터 파일(Table Heap)을 열어보지 않고 인덱스 트리에서만 "없음"을 확인하고 종료합니다. 그래서 1ms로 매우 빠릅니다.
* **실제 쿼리 (The Bottleneck):** `SELECT * ...`는 인덱스에서 RowID를 찾은 후, 실제 데이터가 저장된 페이지(Page)를 디스크(OPFS)에서 읽어와야 합니다.
* **문제의 핵심:** **"인덱스 페이지는 메모리에 올라왔지만, 실제 데이터 페이지는 여전히 디스크(Cold) 상태"**입니다. WASM 환경에서 첫 I/O는 브라우저의 보안 레이어와 파일 시스템을 거치느라 네이티브보다 오버헤드가 큽니다.

#### 추가 원인: 동시성 병목 (Concurrency Bottleneck)

로그를 보면 `Todo Screen` 진입 시 4개의 쿼리가 동시에 발생합니다.

1. `useAllTodos`
2. `useCategories`
3. `getTodosByDate`
4. `getCompletionsByDate` (가장 느림)

JS는 비동기이지만, **SQLite WASM 스레드(또는 워커)는 기본적으로 한 번에 하나의 쿼리를 처리(Serialize)**할 수 있습니다. 앞선 3개의 쿼리가 실행되는 동안 `getCompletionsByDate`는 큐에서 대기했을 수 있으며, 앞선 쿼리들이 I/O를 일으키며 락을 걸었다면 대기 시간은 기하급수적으로 늘어납니다.

---

### 2. 해결 방안 (Solutions)

#### Option 1: 워밍업 쿼리 수정 (가장 효과적)

"가짜 데이터"가 아닌 **"존재하는 최신 데이터"**를 강제로 읽어야 합니다. `LIMIT 1`은 좋지만, 데이터가 존재하는 범위를 건드려야 합니다.

```javascript
// 수정된 워밍업 로직
// 1. 인덱스만 태우는 것이 아니라 실제 데이터 페이지를 로드하도록 유도
// 2. 가장 최근 데이터(사용자가 곧 볼 데이터)를 미리 로드
await db.getFirstAsync('SELECT * FROM completions ORDER BY date DESC LIMIT 1');

```

* **이유:** `ORDER BY date DESC`는 인덱스를 타고 내려와 실제 가장 최근의 데이터 페이지를 메모리(Page Cache)에 적재시킵니다.

#### Option 2: 페이지 캐시 크기 증량 (PRAGMA 설정)

10만 건 이상의 데이터를 다루신다면(이전 컨텍스트 기반), 기본 캐시 사이즈가 부족해 I/O가 빈번할 수 있습니다. 초기화 시 캐시를 늘려주세요.

```javascript
// initDatabase 함수 내
await db.execAsync(`
  PRAGMA cache_size = -20000; -- 약 20MB (음수는 kbyte 단위)
  PRAGMA mmap_size = 30000000; -- Memory Map I/O 활성화 (WASM 지원 시 속도 향상 큼)
`);

```

#### Option 3: 쿼리 최적화 (Covering Index)

만약 화면에서 `completions` 테이블의 모든 컬럼(`*`)이 필요한 게 아니라면, 필요한 컬럼만 인덱스에 포함(Include)시키거나 조회 컬럼을 줄이세요.

```sql
-- 나쁜 예
SELECT * FROM completions ...

-- 좋은 예 (필요한 컬럼만 조회하여 인덱스 커버링 유도 가능성 높임)
SELECT id, is_completed FROM completions ...

```

---

### 3. 검증 및 테스트 방법

분석이 맞는지 확인하기 위해 다음 단계로 디버깅해보시길 권장합니다.

#### Step 1: EXPLAIN QUERY PLAN 확인

로그를 찍어서 현재 워밍업과 실제 쿼리가 인덱스를 어떻게 타는지 확인해야 합니다.

```javascript
// 워밍업 직후 실행해 보세요
const plan1 = await db.getAllAsync('EXPLAIN QUERY PLAN SELECT 1 FROM completions WHERE date = "1970-01-01" LIMIT 1');
console.log('Warmup Plan:', plan1);

const plan2 = await db.getAllAsync('EXPLAIN QUERY PLAN SELECT * FROM completions WHERE date = "2026-02-04"');
console.log('Real Plan:', plan2);

```

* **예상 결과:**
* `Warmup Plan`: `SEARCH TABLE completions USING COVERING INDEX ...` (실제 테이블 접근 안 함)
* `Real Plan`: `SEARCH TABLE completions USING INDEX ...` (인덱스 사용 후 테이블 접근 필요)



#### Step 2: 동시성 테스트 (Isolation)

`Todo Screen` 진입 시 `getCompletionsByDate`만 단독으로 실행되도록 다른 훅(`useAllTodos` 등)을 주석 처리하고 테스트해보세요.

* 만약 1390ms -> 300ms 정도로 줄어든다면, **앞선 쿼리들에 의한 큐 대기(Blocking)**가 주요 원인입니다.

### 요약 및 추천

1. **근본 원인:** 워밍업 쿼리가 인덱스만 스치고 지나가서 실제 데이터 영역(Heap)은 여전히 Cold 상태였음 + 화면 진입 시 다수 쿼리 병목.
2. **즉시 조치:**
* 워밍업 쿼리를 `SELECT * FROM completions ORDER BY date DESC LIMIT 1`로 변경하세요.
* `initDatabase`에 `PRAGMA cache_size = -20000;`을 추가하세요.


3. **웹 환경 특성:** WASM 환경(특히 OPFS)은 첫 I/O 비용이 비쌉니다. "데이터가 있는 척"하는 쿼리로 워밍업해야 합니다.

이 방법으로 워밍업 쿼리를 수정한 뒤 로그 시간을 다시 확인해 보시기 바랍니다.