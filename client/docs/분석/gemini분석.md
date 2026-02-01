## 🚀 최종 결론: SQLite (압도적 승리)

제공해주신 프로젝트 스펙(Offline-First, 헤비 유저 5만+ 데이터, 글로벌/저사양 기기 지원)을 분석한 결과, **SQLite**가 유일한 정답입니다.

MMKV는 훌륭하지만 본질적으로 Key-Value 저장소입니다. 데이터가 5만 개가 넘어갈 때 `JSON.parse()`와 `filter()`를 자바스크립트 스레드에서 수행하는 비용은 MMKV의 빠른 I/O 속도를 상쇄하고도 남습니다. 특히 **배터리 효율**과 **콜드 스타트** 면에서 SQLite 구조가 필수적입니다.

---

## 1. 저장소 선정 및 아키텍처 제안

### A. 저장소 분할 전략 (Hybrid Approach)

모든 데이터를 하나에 몰아넣지 않고, 데이터 특성에 맞는 저장소를 사용합니다.

| 데이터 유형 | 추천 저장소 | 이유 |
| --- | --- | --- |
| **Todos** | **SQLite** | 날짜 범위 쿼리, 정렬, 부분 업데이트 필수 |
| **Completions** | **SQLite** | 가장 방대한 양, 단순 조회/토글 빈번, FK 관계 |
| **Settings** | **MMKV** | 단순 Key-Value, 앱 실행 시 즉시 로드 필요 |
| **Categories** | **MMKV** | 데이터 양이 적음(30개 미만), 자주 안 바뀜 |
| **Sync Queue** | **SQLite** | 트랜잭션 보장 필요 (네트워크 실패 시 롤백 등) |

### B. React Query + SQLite 통합 패턴

**"SQLite를 로컬 서버처럼 취급하십시오."**

React Query의 캐싱 메커니즘은 그대로 유지하되, `fetcher` 함수가 네트워크가 아닌 **SQLite**를 바라보게 합니다.

1. **Read (조회):** `useQuery`가 SQLite를 호출합니다. (메모리 캐싱 효과)
2. **Write (수정):** SQLite에 직접 씁니다 (`INSERT/UPDATE`).
3. **Reaction (반영):** 쓰기 성공 후 `queryClient.invalidateQueries()`를 호출하여 UI를 갱신합니다.

---

## 2. 상세 구현 가이드

### A. 스키마 설계 (JSON 컬럼 활용)

과도한 정규화(Normalization)는 피하고, 쿼리에 필요한 필드만 컬럼으로 빼고 나머지는 JSON으로 저장하는 **Hybrid Schema**를 추천합니다.

```sql
-- Todos 테이블
CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,       -- UUID
  date TEXT,                 -- 조회용: YYYY-MM-DD
  is_synced INTEGER DEFAULT 0, -- 동기화 상태
  payload TEXT,              -- 나머지 데이터(recurrence, color 등) 통째로 JSON 저장
  updated_at INTEGER,
  deleted_at INTEGER
);
CREATE INDEX idx_todos_date ON todos(date);

-- Completions 테이블
CREATE TABLE IF NOT EXISTS completions (
  id TEXT PRIMARY KEY,       -- UUID or todoId_date
  todo_id TEXT NOT NULL,
  date TEXT NOT NULL,
  completed_at INTEGER,
  is_synced INTEGER DEFAULT 0
);
CREATE INDEX idx_comp_lookup ON completions(todo_id, date);
CREATE INDEX idx_comp_date ON completions(date);

```

### B. 쿼리 최적화 (일별 조회)

AsyncStorage/MMKV 방식과 비교하여 획기적으로 가벼워집니다.

```javascript
// db/todoService.js
export const getTodosByDate = async (date) => {
  // 전체 로드(X) -> 해당 날짜만 로드(O)
  const result = await db.getAllAsync(
    `SELECT * FROM todos 
     WHERE (date = ? OR date IS NULL) -- 반복 일정 고려 로직 필요
     AND deleted_at IS NULL`,
    [date]
  );
  
  // payload JSON 파싱 비용은 '오늘 할 일' 갯수만큼만 발생 (수천 개 -> 수십 개)
  return result.map(row => ({
    ...JSON.parse(row.payload),
    _id: row.id,
    isSynced: !!row.is_synced
  }));
};

```

### C. Completion 토글 (속도 핵심)

전체 파일을 다시 쓰는 것이 아니라, 딱 한 줄만 건드립니다.

```javascript
// db/completionService.js
export const toggleCompletion = async (todoId, date) => {
  const existing = await db.getFirstAsync(
    'SELECT id FROM completions WHERE todo_id = ? AND date = ?', 
    [todoId, date]
  );

  if (existing) {
    await db.runAsync('DELETE FROM completions WHERE id = ?', [existing.id]);
  } else {
    await db.runAsync(
      'INSERT INTO completions (id, todo_id, date, completed_at, is_synced) VALUES (?, ?, ?, ?, 0)',
      [uuidv4(), todoId, date, Date.now()]
    );
  }
  // React Query 무효화 -> UI 자동 갱신
  queryClient.invalidateQueries(['todos', date]);
};

```

---

## 3. 마이그레이션 전략 (점진적 적용)

한 번에 모든 코드를 뒤집는 것은 위험합니다. 다음 순서로 진행하는 것을 권장합니다.

### 1단계: MMKV 도입 및 유틸리티 교체 (Risk: 낮음)

* **대상:** `Settings`, `Categories`, `AuthToken`
* **작업:** `AsyncStorage.getItem/setItem`을 `mmkv.getString/set`으로 교체.
* **효과:** 앱 실행 시 설정 로딩 속도 즉시 개선.

### 2단계: Completion 분리 (Risk: 중간, 효과: 최상)

* **이유:** 데이터 양이 가장 많고(수만 개), 구조가 단순하며, AsyncStorage 용량 제한의 주범입니다.
* **작업:**
1. `completions` 테이블 생성.
2. 앱 시작 시 기존 AsyncStorage의 `completions`를 읽어 SQLite로 `INSERT` (Bulk Insert).
3. `useSyncTodos` 등에서 Completion 관련 로직만 SQLite로 변경.


* **효과:** 6MB 용량 제한 해결, 토글 반응 속도 극대화.

### 3단계: Todo 마이그레이션 (Risk: 높음)

* **작업:** `todos` 테이블 생성 및 로직 이관.
* **주의:** 기존 델타 싱크 로직(`mergeDelta`)을 `INSERT OR REPLACE` 쿼리로 재작성해야 합니다.

---

## 4. 글로벌/동남아 시장 고려사항 (기술적 조언)

1. **SQLite WAL (Write-Ahead Logging) 모드 활성화:**
* 동시 읽기/쓰기 성능이 향상됩니다. 백그라운드 싱크 중에 유저가 UI를 조작해도 버벅임이 줄어듭니다.
* `PRAGMA journal_mode = WAL;`


2. **트랜잭션(Transaction) 필수:**
* 동남아 지역의 저가형 안드로이드 기기는 I/O 중 앱이 강제 종료될 확률이 높습니다.
* 데이터 정합성을 위해 일괄 쓰기 작업은 반드시 트랜잭션으로 묶어야 합니다.


3. **마이그레이션 코드의 안전장치:**
* 기존 유저가 업데이트 후 첫 실행 시, 마이그레이션이 완료되기 전까지 앱 사용을 막는 Splash Screen 로직이 필요합니다 (수 초 소요 가능).



---

## 5. 결론 및 다음 단계

**귀하의 상황(개발자, 코딩 가능)에 맞춘 추천:**

1. **MMKV**는 `Settings`와 `Categories`에만 사용하십시오.
2. **SQLite**를 도입하여 `Todos`와 `Completions`를 관리하십시오.
3. **마이그레이션 순서:** Settings (MMKV) → Completions (SQLite) → Todos (SQLite).

**제가 해드릴 수 있는 다음 단계:**
SQLite 테이블 생성 쿼리(Schema)와, 기존 `AsyncStorage` 데이터를 SQLite로 옮기는 **'마이그레이션 유틸리티 스크립트'** 초안을 작성해 드릴까요?