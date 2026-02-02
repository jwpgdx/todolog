# Completion 델타 동기화 완전 구현 계획

## 📋 개요

**목표**: Todo CRUD와 동일한 수준의 Completion 동기화 구현
- Optimistic Update
- Offline-First
- Delta Sync
- Range-Based Optimization (반복일정 최적화)

**예상 기간**: 1-2주
**현재 상태**: 분석 완료, 구현 대기

---

## 🎯 핵심 개선 사항

### 1. AI 피드백 반영

#### ⚠️ Toggle 위험성 해결 (ChatGPT, DeepSeek)
- **문제**: Toggle은 상태 반전이라 동기화 시 충돌 가능
- **해결**: 명시적 액션 사용 (`createCompletion`, `deleteCompletion`)

#### ⚠️ 반복일정 최적화 (Claude)
- **문제**: 매일 반복 1년 = 365개 레코드
- **해결**: Range-Based Completion (연속 날짜 압축)

#### ⚠️ Partial Index 필수 (Gemini)
- **문제**: Soft Delete 후 재완료 시 Unique 제약 위반
- **해결**: `deletedAt: null` 조건의 Partial Index

### 2. 프로젝트 특수성 고려

- 반복일정(RRULE) 중심
- 기간 할일 지원 (date=null)
- 루틴 할일 지원 (매일/매주)

---

## 📅 Phase별 구현 계획

### Phase 1: 클라이언트 Optimistic Update (2-3일)

**목표**: 즉시 UI 반영 + 오프라인 지원

**작업 항목**:

1. ✅ `completionStorage.js` 생성
2. ✅ `useToggleCompletion.js` 리팩토링 (명시적 액션)
3. ✅ Pending Queue 통합
4. ✅ 캐시 직접 업데이트
5. ✅ 테스트

**검증**:
- 오프라인에서 완료 토글 가능
- UI 즉시 반영
- 온라인 복귀 시 서버 동기화

---

### Phase 2: 서버 델타 동기화 (2-3일)

**목표**: Completion 변경사항 추적 + API

**작업 항목**:
1. ✅ Completion 모델 확장 (`updatedAt`, `deletedAt`)
2. ✅ **Partial Index 적용** (중요!)
3. ✅ 마이그레이션 스크립트
4. ✅ `GET /completions/delta-sync` API
5. ✅ `toggleCompletion` Soft Delete 수정
6. ✅ 테스트

**검증**:
- 델타 동기화 API 정상 작동
- Soft Delete 정상 작동
- 기존 기능 영향 없음

---

### Phase 3: Range-Based Completion (2-3일)

**목표**: 반복일정 완료 최적화

**작업 항목**:
1. ✅ Completion 모델 Range 필드 추가
2. ✅ Range 조회 로직 구현
3. ✅ Range 생성/분할 로직
4. ✅ 클라이언트 Range 처리
5. ✅ 마이그레이션 스크립트
6. ✅ 테스트

**검증**:
- 연속 완료 시 Range로 저장
- 중간 토글 시 Range 분할
- 조회 성능 향상

---

### Phase 4: 클라이언트 델타 동기화 통합 (1-2일)

**목표**: useSyncTodos에 Completion 동기화 추가

**작업 항목**:
1. ✅ `useSyncTodos` 수정
2. ✅ `mergeCompletionDelta` 구현
3. ✅ Pending Changes 처리 (create/delete)
4. ✅ 통합 테스트

**검증**:
- 앱 시작 시 Completion 동기화
- 온라인 복귀 시 Pending Changes 처리
- 델타 동기화 정상 작동

---

## 🔧 Phase 1: 클라이언트 Optimistic Update

### 1.1 completionStorage.js 생성

**파일**: `client/src/storage/completionStorage.js`

**구조**:
```javascript
// AsyncStorage 키: @completions
// 형식: { "todoId_date": { todoId, date, completedAt } }

export const loadCompletions = async () => { ... }
export const saveCompletions = async (completions) => { ... }
export const toggleCompletionLocally = async (todoId, date) => { ... }
export const getCompletion = async (todoId, date) => { ... }
export const mergeCompletionDelta = (local, delta) => { ... }
```

### 1.2 useToggleCompletion.js 리팩토링

**핵심 변경**:
- ❌ `type: 'toggleCompletion'`
- ✅ `type: 'createCompletion'` or `type: 'deleteCompletion'`

**흐름**:
```
1. 로컬 즉시 토글 (toggleCompletionLocally)
2. 캐시 직접 업데이트 (setQueryData)
3. 네트워크 확인
   - 온라인: 서버 요청 (백그라운드)
   - 오프라인: Pending Queue 추가
4. 실패 시: Pending Queue 추가
```

### 1.3 Pending Queue 통합

**pendingChangesStorage.js 확장**:
```javascript
{
  type: 'createCompletion',
  todoId: '697a414518e2c4e184559657',
  date: '2026-01-30',
  timestamp: '...'
}

{
  type: 'deleteCompletion',
  todoId: '697a414518e2c4e184559657',
  date: '2026-01-30',
  timestamp: '...'
}
```

### 1.4 useSyncTodos 수정

**Pending Changes 처리 추가**:
```javascript
case 'createCompletion':
  await completionAPI.create({ todoId: change.todoId, date: change.date });
  break;

case 'deleteCompletion':
  await completionAPI.delete(change.todoId, change.date);
  break;
```

---

## 🔧 Phase 2: 서버 델타 동기화

### 2.1 Completion 모델 확장

**파일**: `server/src/models/Completion.js`

**추가 필드**:
```javascript
{
  // 기존
  todoId, userId, date, completedAt,
  
  // 추가
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null }
}
```

**Partial Index (중요!)**:
```javascript
completionSchema.index(
  { todoId: 1, date: 1 },
  { 
    unique: true, 
    partialFilterExpression: { deletedAt: null } 
  }
);

// 추가 인덱스
completionSchema.index({ userId: 1, updatedAt: 1 });
completionSchema.index({ userId: 1, deletedAt: 1 });
```

### 2.2 델타 동기화 API

**엔드포인트**: `GET /completions/delta-sync?lastSyncTime=ISO8601`

**응답**:
```javascript
{
  updated: [
    { _id, todoId, date, completedAt, updatedAt }
  ],
  deleted: [
    { _id, todoId, date }
  ],
  syncTime: '2026-01-30T12:34:56.789Z'
}
```

### 2.3 Toggle API Soft Delete 수정

**변경 사항**:
- Hard Delete → Soft Delete
- 삭제된 레코드 복구 로직 추가

---

## 🔧 Phase 3: Range-Based Completion

### 3.1 Completion 모델 Range 필드

**추가 필드**:
```javascript
{
  // 기존
  todoId, userId, date, completedAt, updatedAt, deletedAt,
  
  // 추가 (반복일정 연속 완료용)
  startDate: String,  // "2026-01-01"
  endDate: String,    // "2026-01-31"
  isRange: Boolean    // true면 Range, false면 단일
}
```

**인덱스**:
```javascript
// Range 조회용
completionSchema.index({ todoId: 1, startDate: 1, endDate: 1 });
```

### 3.2 조회 로직

**특정 날짜 완료 여부**:
```javascript
const isCompleted = await Completion.findOne({
  todoId,
  userId,
  deletedAt: null,
  $or: [
    { date: targetDate },  // 정확한 날짜
    {  // Range 내 포함
      isRange: true,
      startDate: { $lte: targetDate },
      endDate: { $gte: targetDate }
    }
  ]
});
```

### 3.3 Range 생성/분할 로직

**연속 완료 감지**:
```javascript
// 클라이언트: 연속 완료 시 Range로 변환
const completeRange = async (todoId, dates) => {
  // dates = ['2026-01-01', '2026-01-02', ..., '2026-01-31']
  await completionAPI.createRange(todoId, {
    startDate: dates[0],
    endDate: dates[dates.length - 1]
  });
};
```

**중간 토글 시 분할**:
```javascript
// Range 중간 날짜 토글 → 2개로 분할
// Before: [01-01 ~ 01-31]
// Toggle: 01-15
// After: [01-01 ~ 01-14], [01-16 ~ 01-31]
```

---

## 🔧 Phase 4: 클라이언트 델타 동기화 통합

### 4.1 useSyncTodos 수정

**Completion 동기화 추가**:
```javascript
const syncTodos = async () => {
  // 1. Todo 동기화 (기존)
  await syncTodosDelta();
  
  // 2. Completion 동기화 (신규)
  if (metadata.lastCompletionSyncTime) {
    const res = await api.get(
      `/completions/delta-sync?lastSyncTime=${metadata.lastCompletionSyncTime}`
    );
    const delta = res.data;
    
    const merged = mergeCompletionDelta(localCompletions, delta);
    await saveCompletions(merged);
    await saveSyncMetadata({
      ...metadata,
      lastCompletionSyncTime: delta.syncTime
    });
  }
};
```

### 4.2 mergeCompletionDelta 구현

**병합 로직**:
```javascript
export const mergeCompletionDelta = (local, delta) => {
  const map = new Map();
  
  // 로컬 데이터
  Object.entries(local).forEach(([key, value]) => {
    map.set(key, value);
  });
  
  // 서버 업데이트
  delta.updated.forEach(c => {
    const key = `${c.todoId}_${c.date || 'null'}`;
    map.set(key, c);
  });
  
  // 서버 삭제
  delta.deleted.forEach(c => {
    const key = `${c.todoId}_${c.date || 'null'}`;
    map.delete(key);
  });
  
  // Object로 변환
  const result = {};
  map.forEach((value, key) => {
    result[key] = value;
  });
  
  return result;
};
```

---

## 📊 예상 효과

### 성능

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 완료 토글 응답 | 200-500ms | 0ms | 즉시 |
| 오프라인 지원 | ❌ | ✅ | 100% |
| 네트워크 요청 | 매번 | 델타만 | 90% 감소 |
| 반복일정 저장 | 365개/년 | 1-12개/년 | 97% 감소 |

### 사용자 경험

- ✅ 즉시 UI 반영
- ✅ 오프라인 완료 가능
- ✅ 자동 동기화
- ✅ 네트워크 에러 강건함

---

## 🚨 주의사항

### 1. 동기화 순서

**반드시 Todo → Completion 순서**:
```javascript
// Good
await syncTodosDelta();
await syncCompletionsDelta();

// Bad (Completion이 참조할 Todo 없을 수 있음)
await syncCompletionsDelta();
await syncTodosDelta();
```

### 2. 충돌 해결

**Last Write Wins (LWW)**:
- `updatedAt` 기준 최신 데이터 우선
- 서버 타임스탬프 신뢰

### 3. 마이그레이션

**기존 Completion 데이터**:
- `updatedAt` 추가 (기본값: `completedAt`)
- `deletedAt` 추가 (기본값: `null`)
- `isRange` 추가 (기본값: `false`)

---

## 📝 다음 단계

**Phase 1 시작**:
1. `completionStorage.js` 생성
2. `useToggleCompletion.js` 리팩토링
3. Pending Queue 통합
4. 테스트

**시작 명령**:
```
Phase 1 구현을 시작합니다.
completionStorage.js부터 생성해주세요.
```

---

**작성일**: 2026-01-30  
**작성자**: Senior Principal Engineer  
**상태**: 계획 완료, Phase 1 구현 대기
