# 일정 CRUD 및 완료 기능 현황 분석

## 📋 목차
1. [일정 CRUD 구현 현황](#일정-crud-구현-현황)
2. [일정 완료 기능 구현 현황](#일정-완료-기능-구현-현황)
3. [델타 동기화 구현 현황](#델타-동기화-구현-현황)
4. [완료 기능 델타 동기화 구현 계획](#완료-기능-델타-동기화-구현-계획)

---

## 일정 CRUD 구현 현황

### 클라이언트 구현

#### 1. Create (생성) - `useCreateTodo.js`

**구현 방식**: Optimistic Update + Pending Queue

**흐름**:
```
1. 네트워크 상태 확인
2-A. 온라인:
   - 서버 요청 시도
   - 성공: 서버 데이터 로컬 저장 + 캐시 업데이트
   - 실패: 로컬 저장 + Pending Queue 추가
2-B. 오프라인:
   - tempId 생성 (temp_${timestamp}_${random})
   - 로컬 저장 (syncStatus: 'pending')
   - Pending Queue 추가
3. 캐시 업데이트:
   - ['todos', 'all'] 직접 업데이트
   - 날짜별 캐시 무효화
```

**Pending Change 구조**:
```javascript
{
  type: 'create',
  tempId: 'temp_1234567890_abc123',
  data: { title, startDate, ... },
  timestamp: '2026-01-30T...'
}
```


#### 2. Update (수정) - `useUpdateTodo.js`

**구현 방식**: Optimistic Update + Pending Queue

**흐름**:
```
1. 네트워크 상태 확인
2-A. 온라인:
   - 서버 요청 시도
   - 성공: 서버 데이터 로컬 저장 + 캐시 업데이트
   - 실패: 로컬 저장 + Pending Queue 추가
2-B. 오프라인:
   - 로컬 데이터 업데이트 (syncStatus: 'pending')
   - Pending Queue 추가
3. 캐시 업데이트:
   - ['todos', 'all'] 직접 업데이트 (배열 내 항목 교체)
   - 영향받는 월 캐시 무효화
```

**Pending Change 구조**:
```javascript
{
  type: 'update',
  todoId: '697a414518e2c4e184559657',
  data: { title: '수정된 제목', ... },
  timestamp: '2026-01-30T...'
}
```

#### 3. Delete (삭제) - `useDeleteTodo.js`

**구현 방식**: Optimistic Update + Pending Queue

**흐름**:
```
1. 네트워크 상태 확인
2-A. 온라인:
   - 서버 요청 시도
   - 성공: 로컬 삭제 + 캐시 업데이트
   - 실패: 로컬 삭제 + Pending Queue 추가
2-B. 오프라인:
   - 로컬 삭제
   - Pending Queue 추가
3. 캐시 업데이트:
   - ['todos', 'all'] 직접 업데이트 (필터링)
   - 영향받는 월 캐시 무효화
```

**Pending Change 구조**:
```javascript
{
  type: 'delete',
  todoId: '697a414518e2c4e184559657',
  timestamp: '2026-01-30T...'
}
```


### 서버 구현

#### 1. Create - `POST /todos`

**컨트롤러**: `todoController.createTodo`

**처리 흐름**:
```
1. 요청 데이터 검증
2. Todo 모델 생성 및 저장
3. Google Calendar 동기화 (선택적):
   - calendarSyncEnabled && hasCalendarAccess 확인
   - googleCalendar.createEvent() 호출
   - 성공: googleCalendarEventId 저장, syncStatus: 'synced'
   - 실패: syncStatus: 'failed' (Todo는 생성됨)
4. 응답 반환
```

**주요 필드**:
- `startDate`: "YYYY-MM-DD" (필수)
- `startTime`: "HH:MM" (isAllDay=false일 때)
- `isAllDay`: Boolean
- `recurrence`: RRULE 문자열 배열
- `syncStatus`: 'synced' | 'pending' | 'failed'

#### 2. Update - `PUT /todos/:id`

**컨트롤러**: `todoController.updateTodo`

**처리 흐름**:
```
1. 기존 Todo 조회 (userId 확인)
2. 허용된 필드만 업데이트 (보안)
3. startDateTime/endDateTime 재구성
4. Google Calendar 동기화:
   - googleCalendarEventId 있으면: updateEvent()
   - 없으면: createEvent()
5. 응답 반환
```

**보안**: allowedFields 화이트리스트 방식

#### 3. Delete - `DELETE /todos/:id`

**컨트롤러**: `todoController.deleteTodo`

**처리 흐름**:
```
1. Soft Delete: deletedAt 타임스탬프 설정
2. Google Calendar 이벤트 삭제
3. 관련 Completion 기록 삭제
4. 응답 반환
```

**Soft Delete 이유**: 복구 가능성, 감사 추적


---

## 일정 완료 기능 구현 현황

### 클라이언트 구현

#### `useToggleCompletion.js`

**구현 방식**: 서버 요청 후 캐시 무효화

**흐름**:
```
1. completionAPI.toggleCompletion(todoId, date) 호출
2. 서버 응답 대기
3. 성공 시:
   - ['todos', date] 캐시 무효화
   - ['calendarSummary'] 캐시 무효화
```

**문제점**:
- ❌ 오프라인 지원 없음
- ❌ Optimistic Update 없음
- ❌ Pending Queue 없음
- ❌ 즉시 UI 반영 안됨 (캐시 무효화 후 재조회 필요)

**API 호출**:
```javascript
completionAPI.toggleCompletion(todoId, date)
// POST /completions/toggle
// Body: { todoId, date }
```

### 서버 구현

#### 1. Completion 모델

**스키마**: `server/src/models/Completion.js`

```javascript
{
  todoId: ObjectId (ref: 'Todo'),
  userId: ObjectId (ref: 'User'),
  date: String,  // "YYYY-MM-DD" (기간 할일은 null)
  completedAt: Date
}
```

**인덱스**: `{ todoId: 1, date: 1 }` (unique)
- 같은 날짜에 같은 할일 중복 완료 방지
- 기간 할일(date=null)은 todoId만으로 unique


#### 2. Toggle Completion API

**엔드포인트**: `POST /completions/toggle`

**컨트롤러**: `completionController.toggleCompletion`

**처리 흐름**:
```
1. 기존 완료 기록 조회:
   - findOne({ todoId, userId, date })
2-A. 완료 기록 있음:
   - 삭제 (완료 취소)
   - 응답: { completed: false }
2-B. 완료 기록 없음:
   - 생성 (완료 처리)
   - 응답: { completed: true }
```

**특징**:
- 토글 방식 (생성/삭제 통합)
- 중복 완료 방지 (unique index)
- 기간 할일 지원 (date=null)

#### 3. 완료 여부 조회

**엔드포인트**: `GET /todos?date=YYYY-MM-DD`

**처리 흐름**:
```
1. 해당 날짜의 Todo 필터링
2. 해당 날짜의 Completion 조회:
   - date = 특정 날짜 (일반 할일, 루틴)
   - date = null (기간 할일)
3. completionMap 생성
4. Todo에 completed 필드 추가
```

**응답 예시**:
```javascript
{
  _id: '697a414518e2c4e184559657',
  title: '회의',
  startDate: '2026-01-30',
  completed: true,  // ← 완료 여부
  ...
}
```


---

## 델타 동기화 구현 현황

### 클라이언트 구현

#### `useSyncTodos.js`

**핵심 기능**:
1. 앱 시작 시 로컬 데이터 즉시 로드
2. 서버와 델타 동기화
3. Pending Changes 처리
4. 네트워크/앱 상태 감지

**동기화 흐름**:
```
1. 로컬 데이터 로드 → 캐시 주입 (즉시 화면 표시)
2. 네트워크 확인
3-A. 오프라인:
   - 로컬 데이터만 사용
3-B. 온라인:
   - Pending Changes 처리 (create/update/delete)
   - 델타 동기화:
     - 최초: getAllTodos() (전체 데이터)
     - 이후: getDeltaSync(lastSyncTime) (변경사항만)
   - 로컬 저장 + 캐시 업데이트
```

**Pending Changes 처리**:
```javascript
// 1. Create
const createRes = await todoAPI.createTodo(change.data);
await removeTodo(change.tempId);  // tempId 제거
await upsertTodo(createRes.data);  // 실제 ID로 저장
await replaceTempIdInPending(change.tempId, createRes.data._id);

// 2. Update
if (change.todoId.startsWith('temp_')) {
  // tempId 수정은 스킵 (create에서 처리됨)
} else {
  await todoAPI.updateTodo(change.todoId, change.data);
}

// 3. Delete
if (change.todoId.startsWith('temp_')) {
  // tempId 삭제는 스킵 (로컬에서만 삭제)
} else {
  await todoAPI.deleteTodo(change.todoId);
}
```

**lastSyncTime 관리**:
- 저장 위치: AsyncStorage (`@sync_metadata`)
- 업데이트 시점:
  - 델타 동기화 완료 후
  - Pending Changes 처리 후 (중복 방지)


### 서버 구현

#### 델타 동기화 API

**엔드포인트**: `GET /todos/delta-sync?lastSyncTime=ISO8601`

**컨트롤러**: `todoController.getDeltaSync`

**처리 흐름**:
```
1. lastSyncTime 이후 업데이트된 Todo 조회:
   - updatedAt > lastSyncTime
   - deletedAt = null (삭제 안된 것만)
2. lastSyncTime 이후 삭제된 Todo 조회:
   - deletedAt > lastSyncTime
3. 서버 현재 시간 반환 (다음 동기화용)
```

**응답 구조**:
```javascript
{
  updated: [
    { _id, title, startDate, ... }
  ],
  deleted: ['id1', 'id2'],
  syncTime: '2026-01-30T12:34:56.789Z'
}
```

**최적화**:
- 변경된 항목만 전송 (네트워크 효율)
- populate로 categoryId 정보 포함
- 서버 시간 기준 (클라이언트 시간 불일치 방지)

---

## 완료 기능 델타 동기화 구현 계획

### 현재 문제점

1. **오프라인 미지원**
   - 오프라인에서 완료 토글 불가
   - 네트워크 에러 시 실패

2. **Optimistic Update 없음**
   - 서버 응답 대기 필요
   - UI 반응 느림

3. **Pending Queue 없음**
   - 오프라인 변경사항 저장 안됨
   - 온라인 복귀 시 동기화 불가

4. **캐시 무효화 방식**
   - 전체 날짜 캐시 무효화 (비효율)
   - 재조회 필요 (네트워크 요청)


### 구현 계획

#### Phase 1: 클라이언트 Optimistic Update

**목표**: 즉시 UI 반영 + 오프라인 지원

**1. Completion Storage 추가**

**파일**: `client/src/storage/completionStorage.js` (신규)

```javascript
// AsyncStorage 키: @completions
// 구조: { todoId_date: { todoId, date, completedAt } }

export const loadCompletions = async () => {
  // AsyncStorage에서 완료 기록 로드
};

export const saveCompletions = async (completions) => {
  // AsyncStorage에 완료 기록 저장
};

export const toggleCompletionLocally = async (todoId, date) => {
  // 로컬에서 완료 토글
  // 있으면 삭제, 없으면 추가
};
```

**2. useToggleCompletion 리팩토링**

**파일**: `client/src/hooks/queries/useToggleCompletion.js`

**변경 사항**:
```javascript
export const useToggleCompletion = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, date }) => {
      // 1. 로컬 완료 토글 (즉시)
      const newState = await toggleCompletionLocally(todoId, date);
      
      // 2. 네트워크 확인
      const netInfo = await NetInfo.fetch();
      
      if (!netInfo.isConnected) {
        // 오프라인: Pending Queue 추가
        await addPendingChange({
          type: 'toggleCompletion',
          todoId,
          date,
          completed: newState
        });
        return { completed: newState, offline: true };
      }
      
      // 3. 온라인: 서버 요청
      try {
        const res = await completionAPI.toggleCompletion(todoId, date);
        return res.data;
      } catch (error) {
        // 서버 실패: Pending Queue 추가
        await addPendingChange({
          type: 'toggleCompletion',
          todoId,
          date,
          completed: newState
        });
        return { completed: newState, offline: true };
      }
    },
    onSuccess: (data, variables) => {
      // 캐시 직접 업데이트 (무효화 대신)
      queryClient.setQueryData(['todos', 'all'], (oldData) => {
        if (!oldData) return oldData;
        
        return oldData.map(todo => {
          if (todo._id === variables.todoId) {
            return { ...todo, completed: data.completed };
          }
          return todo;
        });
      });
      
      // 날짜별 캐시도 업데이트
      queryClient.setQueryData(['todos', variables.date], (oldData) => {
        if (!oldData) return oldData;
        
        return oldData.map(todo => {
          if (todo._id === variables.todoId) {
            return { ...todo, completed: data.completed };
          }
          return todo;
        });
      });
    }
  });
};
```


#### Phase 2: 서버 델타 동기화 지원

**목표**: Completion 변경사항 델타 동기화

**1. Completion 모델 수정**

**파일**: `server/src/models/Completion.js`

**추가 필드**:
```javascript
{
  // 기존 필드
  todoId: ObjectId,
  userId: ObjectId,
  date: String,
  completedAt: Date,
  
  // 추가 필드
  updatedAt: { type: Date, default: Date.now },
  deletedAt: { type: Date, default: null }  // Soft delete
}
```

**인덱스 추가**:
```javascript
completionSchema.index({ userId: 1, updatedAt: 1 });
completionSchema.index({ userId: 1, deletedAt: 1 });
```

**2. 델타 동기화 API 추가**

**엔드포인트**: `GET /completions/delta-sync?lastSyncTime=ISO8601`

**컨트롤러**: `completionController.getDeltaSync` (신규)

```javascript
exports.getDeltaSync = async (req, res) => {
  try {
    const { lastSyncTime } = req.query;
    const userId = req.userId;
    
    if (!lastSyncTime) {
      return res.status(400).json({ message: 'lastSyncTime이 필요합니다' });
    }
    
    const syncTime = new Date(lastSyncTime);
    
    // 업데이트된 완료 기록 (삭제 안된 것만)
    const updated = await Completion.find({
      userId,
      updatedAt: { $gt: syncTime },
      deletedAt: null
    });
    
    // 삭제된 완료 기록
    const deleted = await Completion.find({
      userId,
      deletedAt: { $gt: syncTime }
    }).select('_id todoId date deletedAt');
    
    const serverSyncTime = new Date().toISOString();
    
    res.json({
      updated: updated.map(c => ({
        _id: c._id,
        todoId: c.todoId,
        date: c.date,
        completedAt: c.completedAt,
        updatedAt: c.updatedAt
      })),
      deleted: deleted.map(c => ({
        _id: c._id,
        todoId: c.todoId,
        date: c.date
      })),
      syncTime: serverSyncTime
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```


**3. Toggle API 수정 (Soft Delete)**

**파일**: `server/src/controllers/completionController.js`

**변경 사항**:
```javascript
exports.toggleCompletion = async (req, res) => {
  try {
    const { todoId, date } = req.body;
    const userId = req.userId;
    
    // 기존 완료 기록 확인 (deletedAt=null만)
    const existingCompletion = await Completion.findOne({
      todoId,
      userId,
      date: date || null,
      deletedAt: null  // 추가
    });
    
    if (existingCompletion) {
      // Soft delete (Hard delete 대신)
      existingCompletion.deletedAt = new Date();
      existingCompletion.updatedAt = new Date();
      await existingCompletion.save();
      
      res.json({ completed: false, message: '완료 취소됨' });
    } else {
      // 새로 생성 또는 삭제된 기록 복구
      const deletedCompletion = await Completion.findOne({
        todoId,
        userId,
        date: date || null,
        deletedAt: { $ne: null }
      });
      
      if (deletedCompletion) {
        // 삭제된 기록 복구
        deletedCompletion.deletedAt = null;
        deletedCompletion.updatedAt = new Date();
        await deletedCompletion.save();
      } else {
        // 새로 생성
        const completion = new Completion({
          todoId,
          userId,
          date: date || null,
        });
        await completion.save();
      }
      
      res.json({ completed: true, message: '완료 처리됨' });
    }
  } catch (error) {
    console.error('Toggle completion error:', error);
    res.status(500).json({ message: error.message });
  }
};
```


#### Phase 3: 클라이언트 델타 동기화 통합

**목표**: useSyncTodos에 Completion 동기화 추가

**1. useSyncTodos 수정**

**파일**: `client/src/hooks/useSyncTodos.js`

**추가 사항**:
```javascript
// Pending Changes 처리에 toggleCompletion 추가
case 'toggleCompletion':
  await completionAPI.toggleCompletion(change.todoId, change.date);
  console.log('✅ [useSyncTodos] 완료 토글 동기화:', change.todoId);
  break;

// 델타 동기화에 Completion 추가
const syncTodos = useCallback(async (options = {}) => {
  // ... 기존 Todo 동기화 로직
  
  // Completion 델타 동기화
  if (metadata.lastCompletionSyncTime) {
    const completionRes = await api.get(
      `/completions/delta-sync?lastSyncTime=${metadata.lastCompletionSyncTime}`
    );
    const completionDelta = completionRes.data;
    
    if (completionDelta.updated.length > 0 || completionDelta.deleted.length > 0) {
      console.log('📥 [useSyncTodos] Completion 델타 수신:', {
        updated: completionDelta.updated.length,
        deleted: completionDelta.deleted.length
      });
      
      // 로컬 Completion 업데이트
      const localCompletions = await loadCompletions();
      const mergedCompletions = mergeCompletionDelta(
        localCompletions,
        completionDelta
      );
      await saveCompletions(mergedCompletions);
      
      // lastCompletionSyncTime 업데이트
      await saveSyncMetadata({
        ...metadata,
        lastCompletionSyncTime: completionDelta.syncTime
      });
    }
  } else {
    // 최초 동기화: 전체 Completion 로드
    // (현재는 Todo 조회 시 completed 필드로 제공되므로 불필요)
  }
}, []);
```

**2. Completion 병합 로직**

**파일**: `client/src/storage/completionStorage.js`

```javascript
export const mergeCompletionDelta = (local, delta) => {
  const completionMap = new Map();
  
  // 로컬 데이터 먼저 추가
  local.forEach(c => {
    const key = `${c.todoId}_${c.date || 'null'}`;
    completionMap.set(key, c);
  });
  
  // 서버 업데이트 반영
  delta.updated.forEach(c => {
    const key = `${c.todoId}_${c.date || 'null'}`;
    completionMap.set(key, c);
  });
  
  // 서버 삭제 반영
  delta.deleted.forEach(c => {
    const key = `${c.todoId}_${c.date || 'null'}`;
    completionMap.delete(key);
  });
  
  return Array.from(completionMap.values());
};
```


---

## 구현 순서 및 예상 시간

### Phase 1: 클라이언트 Optimistic Update (2-3시간)

**작업**:
1. ✅ `completionStorage.js` 생성 (30분)
2. ✅ `useToggleCompletion.js` 리팩토링 (1시간)
3. ✅ Pending Queue 통합 (30분)
4. ✅ 캐시 직접 업데이트 로직 (30분)
5. ✅ 테스트 (30분)

**검증**:
- 오프라인에서 완료 토글 가능
- UI 즉시 반영
- 온라인 복귀 시 서버 동기화

### Phase 2: 서버 델타 동기화 (2-3시간)

**작업**:
1. ✅ Completion 모델 수정 (30분)
2. ✅ 마이그레이션 스크립트 (30분)
3. ✅ `getDeltaSync` API 구현 (1시간)
4. ✅ `toggleCompletion` Soft Delete 수정 (30분)
5. ✅ 테스트 (30분)

**검증**:
- 델타 동기화 API 정상 작동
- Soft Delete 정상 작동
- 기존 기능 영향 없음

### Phase 3: 클라이언트 델타 동기화 통합 (1-2시간)

**작업**:
1. ✅ `useSyncTodos` 수정 (1시간)
2. ✅ `mergeCompletionDelta` 구현 (30분)
3. ✅ 통합 테스트 (30분)

**검증**:
- 앱 시작 시 Completion 동기화
- 온라인 복귀 시 Pending Changes 처리
- 델타 동기화 정상 작동

---

## 예상 효과

### 성능

| 항목 | Before | After | 개선 |
|------|--------|-------|------|
| 완료 토글 응답 | 200-500ms | 0ms | 즉시 |
| 오프라인 지원 | ❌ | ✅ | 100% |
| 네트워크 요청 | 매번 | 델타만 | 90% 감소 |
| 캐시 무효화 | 전체 | 직접 업데이트 | 효율 |

### 사용자 경험

- ✅ 즉시 UI 반영 (Optimistic Update)
- ✅ 오프라인에서도 완료 토글 가능
- ✅ 온라인 복귀 시 자동 동기화
- ✅ 네트워크 에러에 강건함

### 코드 품질

- ✅ Todo CRUD와 동일한 패턴
- ✅ 일관된 아키텍처
- ✅ 유지보수 용이

---

## 주의사항

### 1. 충돌 해결

**시나리오**: 같은 Todo를 여러 기기에서 동시에 완료 토글

**해결**: 서버 타임스탬프 기준 (Last Write Wins)
- `updatedAt` 필드로 최신 변경사항 판단
- 델타 동기화 시 서버 데이터 우선

### 2. 마이그레이션

**기존 Completion 데이터**:
- `updatedAt` 필드 추가 (기본값: `completedAt`)
- `deletedAt` 필드 추가 (기본값: `null`)

**마이그레이션 스크립트**:
```javascript
// server/src/scripts/migrateCompletions.js
const Completion = require('../models/Completion');

async function migrate() {
  const completions = await Completion.find({ updatedAt: { $exists: false } });
  
  for (const completion of completions) {
    completion.updatedAt = completion.completedAt;
    completion.deletedAt = null;
    await completion.save();
  }
  
  console.log(`✅ ${completions.length}개 Completion 마이그레이션 완료`);
}

migrate();
```

### 3. 테스트 시나리오

**필수 테스트**:
1. ✅ 오프라인 완료 토글 → 온라인 복귀 → 동기화
2. ✅ 여러 Todo 연속 토글 → Pending Queue 처리
3. ✅ 서버 에러 시 Pending Queue 추가
4. ✅ 델타 동기화 (updated/deleted)
5. ✅ 기존 기능 영향 없음 (Todo 조회 시 completed 필드)

---

## 다음 단계

1. **Phase 1 구현** (클라이언트 Optimistic Update)
2. **Phase 2 구현** (서버 델타 동기화)
3. **Phase 3 구현** (클라이언트 델타 동기화 통합)
4. **통합 테스트**
5. **문서 업데이트**

**시작 명령**:
```
완료 기능 델타 동기화를 구현하겠습니다.
Phase 1부터 시작해주세요: 클라이언트 Optimistic Update
```

---

**작성일**: 2026-01-30  
**작성자**: Senior Principal Engineer  
**상태**: 분석 완료, 구현 대기

