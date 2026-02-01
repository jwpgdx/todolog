# Completion 캐시 스케일링 문제 분석

## 프로젝트 개요

**앱 유형:** React Native (Expo) Todo 앱  
**아키텍처:** Offline-First + Delta Sync  
**상태 관리:** React Query + AsyncStorage  
**서버:** Node.js + Express + MongoDB

---

## 현재 구현

### Completion 데이터 구조

```javascript
// React Query 캐시 + AsyncStorage
{
  "todoId_date": {
    todoId: "697f68193375012bec71e2d0",
    date: "2026-02-01",           // null for period todos
    completedAt: "2026-02-01T15:22:10.931Z"
  }
}
```

### 저장 위치

1. **React Query 캐시** (`['completions']`)
   - 메모리에 저장
   - 앱 재시작 시 초기화

2. **AsyncStorage**
   - 영구 저장
   - 앱 시작 시 React Query 캐시로 로드

### 동기화 흐름

```
1. 앱 시작
   └─> AsyncStorage에서 Completion 로드 (21개)
   └─> React Query 캐시에 저장

2. Todo 완료/취소
   └─> 로컬 즉시 토글 (Optimistic Update)
   └─> AsyncStorage 저장
   └─> React Query 캐시 업데이트
   └─> 서버 전송 (온라인) or Pending Queue (오프라인)

3. 델타 동기화 (온라인 복귀 시)
   └─> 서버: { updated: [], deleted: [] }
   └─> 로컬 병합: updated 추가, deleted 삭제
   └─> AsyncStorage + React Query 캐시 업데이트
```

### 삭제 로직

```javascript
// completionStorage.js - mergeCompletionDelta
deleted.forEach(completion => {
  const key = `${completion.todoId}_${completion.date || 'null'}`;
  map.delete(key);  // 로컬에서 삭제
});
```

**서버 Soft Delete → 델타 동기화 → 로컬 삭제**

---

## 현재 상태

- **Completion 개수:** 21개
- **용량:** ~3.4 KB
- **조회 성능:** 0ms (메모리 읽기)

---

## 문제점: 10,000개 시나리오

### 1️⃣ 용량 문제

**예상 용량:**
- 1개: ~160 bytes
- 10,000개: **1.6 MB**

**AsyncStorage 제한:**
- iOS: 6 MB (제한 있음)
- Android: 무제한

**메모리:**
- React Query 캐시: 1.6 MB는 문제 없음
- 하지만 JSON.parse/stringify 오버헤드

### 2️⃣ 성능 문제

**앱 시작 시:**
```javascript
// 10,000개 로드
const completions = await loadCompletions();  // AsyncStorage 읽기
queryClient.setQueryData(['completions'], completions);
```

**예상 시간:**
- AsyncStorage 읽기: 50-100ms
- JSON.parse: 20-50ms
- **총: 70-150ms**

**Todo 조회 시:**
```javascript
// 매번 10,000개 객체 순회
const completions = queryClient.getQueryData(['completions']) || {};
const key = `${todo._id}_${date}`;
return !!completions[key];  // O(1) 조회는 빠름
```

**문제 없음:** 객체 키 조회는 O(1)

### 3️⃣ 동기화 문제

**델타 동기화:**
```javascript
// 서버에서 deleted: [100개] 받음
deleted.forEach(completion => {
  map.delete(key);  // 10,000개 Map에서 100개 삭제
});
```

**예상 시간:**
- Map.delete: O(1) × 100 = 1ms
- **문제 없음**

### 4️⃣ 실제 문제: 서버 응답 크기

**델타 동기화 응답:**
```json
{
  "updated": [
    { "todoId": "...", "date": "...", "completedAt": "..." },
    // ... 1,000개
  ],
  "deleted": [
    { "todoId": "...", "date": "..." },
    // ... 100개
  ]
}
```

**문제:**
- 1,000개 updated: ~160 KB
- 네트워크 전송 시간: 1-2초 (3G)
- JSON.parse: 50-100ms

---

## 질문

### 1. Completion 캐시 크기 제한이 필요한가?

**옵션 A: 기간 제한 (30일)**
```javascript
// 30일 이전 Completion 삭제
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

Object.entries(completions).forEach(([key, comp]) => {
  if (new Date(comp.completedAt) < thirtyDaysAgo) {
    delete completions[key];
  }
});
```

**장점:**
- 용량 제한: 최대 ~300개 (30일 × 10개/일)
- 성능 유지

**단점:**
- 30일 이전 완료 기록 조회 불가 (서버에서 조회 필요)

**옵션 B: 개수 제한 (1,000개)**
```javascript
if (Object.keys(completions).length > 1000) {
  // 가장 오래된 것부터 삭제 (FIFO)
}
```

**옵션 C: 제한 없음 (현재)**
- 서버 Soft Delete → 델타 동기화 → 로컬 삭제
- 서버가 오래된 Completion Hard Delete하면 자동 정리

### 2. 델타 동기화 최적화가 필요한가?

**현재:**
```javascript
// 전체 Completion 객체 전송
{
  "updated": [
    { "todoId": "...", "date": "...", "completedAt": "..." }
  ]
}
```

**최적화 옵션:**
```javascript
// ID만 전송 (클라이언트가 서버에서 조회)
{
  "updatedIds": ["id1", "id2"],
  "deletedIds": ["id3", "id4"]
}
```

**효과:**
- 응답 크기: 160 KB → 20 KB (87% 감소)

**단점:**
- 추가 API 호출 필요

### 3. 페이지네이션이 필요한가?

**현재:**
- 앱 시작 시 전체 Completion 로드

**페이지네이션:**
- 필요한 날짜 범위만 로드 (예: ±30일)
- 스크롤 시 추가 로드

**효과:**
- 초기 로드: 10,000개 → 600개 (94% 감소)

**단점:**
- 복잡도 증가
- 캘린더 dot 표시 시 전체 데이터 필요

### 4. 서버 Hard Delete 정책이 필요한가?

**현재:**
- Soft Delete만 사용 (deletedAt 필드)
- 실제 삭제 없음

**Hard Delete 정책:**
- 30일 이전 Soft Delete된 Completion 삭제
- 또는 1년 이전 Completion 삭제

**효과:**
- 서버 DB 크기 감소
- 델타 동기화 시 자동으로 로컬도 정리

---

## 추가 정보

### 사용자 행동 패턴 (예상)

- 매일 10개 완료
- 1년 = 3,650개
- 10년 = 36,500개

### 현재 서버 구현

```javascript
// completionController.js - getDeltaSync
const updated = await Completion.find({
  userId,
  updatedAt: { $gt: lastSyncTime },
  deletedAt: null  // Soft Delete 제외
});

const deleted = await Completion.find({
  userId,
  deletedAt: { $gt: lastSyncTime }
}).select('todoId date');
```

### 현재 클라이언트 구현

```javascript
// useTodos.js - 완료 상태 조회
const completions = queryClient.getQueryData(['completions']) || {};
const todosWithCompletion = filtered.map(todo => {
  const key = `${todo._id}_${date || 'null'}`;
  return {
    ...todo,
    completed: !!completions[key]  // O(1) 조회
  };
});
```

---

## 요청사항

1. **10,000개 Completion 시나리오에서 성능 문제가 발생하는가?**
2. **캐시 크기 제한이 필요한가? (30일 or 1,000개 or 제한 없음)**
3. **델타 동기화 최적화가 필요한가?**
4. **페이지네이션이 필요한가?**
5. **서버 Hard Delete 정책이 필요한가?**
6. **다른 최적화 방안이 있는가?**

---

## 참고 코드

### completionStorage.js
```javascript
export const mergeCompletionDelta = (local, delta) => {
  const { updated = [], deleted = [] } = delta;
  const map = new Map();
  
  // 로컬 데이터 먼저 추가
  Object.entries(local).forEach(([key, value]) => {
    map.set(key, value);
  });
  
  // 서버 업데이트 반영
  updated.forEach(completion => {
    const key = `${completion.todoId}_${completion.date || 'null'}`;
    map.set(key, completion);
  });
  
  // 서버 삭제 반영
  deleted.forEach(completion => {
    const key = `${completion.todoId}_${completion.date || 'null'}`;
    map.delete(key);
  });
  
  return Object.fromEntries(map);
};
```

### useSyncTodos.js
```javascript
// 델타 동기화
const completionResponse = await api.get(
  `/completions/delta-sync?lastSyncTime=${metadata.lastCompletionSyncTime}`
);
const completionDelta = completionResponse.data;

const mergedCompletions = mergeCompletionDelta(localCompletions, completionDelta);
await saveCompletions(mergedCompletions);
queryClient.setQueryData(['completions'], mergedCompletions);
```
