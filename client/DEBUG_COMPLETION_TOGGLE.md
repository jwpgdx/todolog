# Completion Toggle 버그 수정 완료 ✅

## 버그 원인 (2026-02-03 발견)

**증상**: 일정 완료/취소 시 UI와 실제 상태가 불일치

**로그 분석**:
```
SQLite 토글 완료: true  (SQLite: 완료로 변경)
서버 요청 성공: {completed: false}  (서버: 취소로 변경)
```

**근본 원인**:
- SQLite는 **현재 SQLite 상태**를 기준으로 토글
- 서버는 **현재 서버 상태**를 기준으로 토글
- 둘이 불일치하면 **반대 방향으로 토글** → 더 큰 불일치 발생!

**예시 시나리오**:
```
초기 상태:
- SQLite: false (미완료)
- Server: true (완료)  ← 이미 불일치

사용자가 토글 클릭:
1. SQLite: false → true ✅ (완료로 변경)
2. Server: true → false ❌ (취소로 변경)

결과:
- SQLite: true
- Server: false
→ 불일치가 더 심해짐!
```

## 수정 내용 ✅

### 1. useToggleCompletion.js 수정
- **Before**: SQLite 토글 → 서버 요청 (독립적)
- **After**: SQLite 토글 (Optimistic) → 서버 요청 → **서버 응답으로 SQLite 동기화**

### 2. 추가된 로직
```javascript
// 서버 응답 후 SQLite 동기화
const serverState = res.data.completed;
if (serverState !== optimisticState) {
  console.warn(`⚠️ 상태 불일치 감지! SQLite=${optimisticState}, Server=${serverState}`);
  
  // SQLite를 서버 상태로 강제 동기화
  if (serverState) {
    await createCompletion(todoId, date);
  } else {
    await deleteCompletion(todoId, date);
  }
}
```

### 3. 원칙
- **Server = Source of Truth**: 서버 응답이 최종 상태
- **SQLite = Local Cache**: 서버 상태를 반영
- **Optimistic Update**: 빠른 UI 반응을 위해 SQLite 먼저 토글, 서버 응답 후 동기화

## 테스트 방법

### 정상 케이스
```
1. 초기: SQLite=false, Server=false
2. 토글: SQLite=true (Optimistic)
3. 서버: true 응답
4. 동기화: 불일치 없음 → 그대로 유지
5. 결과: SQLite=true, Server=true ✅
```

### 불일치 케이스 (수정 전 버그)
```
1. 초기: SQLite=false, Server=true (불일치)
2. 토글: SQLite=true (Optimistic)
3. 서버: false 응답 (서버는 true→false로 토글)
4. 동기화: 불일치 감지! → SQLite를 false로 강제 변경
5. 결과: SQLite=false, Server=false ✅
```

## 디버깅 로그 확인

수정 후 로그에서 확인할 내용:
```
✅ [useToggleCompletion] SQLite 토글 완료 (Optimistic): true
✅ [useToggleCompletion] 서버 요청 성공: {completed: false}
⚠️ [useToggleCompletion] 상태 불일치 감지! SQLite=true, Server=false
🔄 [useToggleCompletion] SQLite를 서버 상태로 동기화: false
✅ [useToggleCompletion] SQLite 동기화 완료: false
```

## 남은 작업

1. ✅ 버그 수정 완료
2. ⏳ 실제 앱에서 테스트
3. ⏳ 불일치 발생 원인 조사 (왜 SQLite와 서버가 달랐는가?)
4. ⏳ 동기화 로직 개선 (앱 시작 시 전체 동기화?)

## 참고

- 수정 파일: `client/src/hooks/queries/useToggleCompletion.js`
- 커밋: "fix: sync SQLite with server response in completion toggle"
- 날짜: 2026-02-03

## 에러 재현 방법

1. DebugScreen으로 이동
2. "🔍 현재 Todo 상세 확인" 버튼 클릭 → UI와 SQLite 상태 비교
3. "🔄 Completion 토글 테스트" 버튼 클릭 → 4단계 로그 확인
4. "⏳ Pending Changes 확인" 버튼 클릭 → 오프라인 시 Pending 확인

## 예상 원인

### 1. 캐시 동기화 문제
- **증상**: UI는 완료 상태인데 SQLite는 미완료 (또는 반대)
- **원인**: `useToggleCompletion`의 `onSuccess`가 캐시를 업데이트하지만, SQLite 토글이 실패하면 불일치 발생
- **해결**: `useTodos` hook에서 SQLite completion을 병합하는 로직 확인 필요

### 2. Pending Queue 중복
- **증상**: 같은 completion이 여러 번 Pending에 추가됨
- **원인**: 토글 실패 시 재시도하면서 중복 추가
- **해결**: Pending 추가 전에 중복 체크 필요

### 3. 날짜 형식 불일치
- **증상**: `date: null` vs `date: "2026-02-01"` 불일치
- **원인**: Period todo의 경우 date가 null인데, 일부 로직에서 문자열로 처리
- **해결**: 모든 completion 로직에서 `date || 'null'` 처리 확인

## 디버깅 체크리스트

### Step 1: 현재 상태 확인
```
1. DebugScreen → "🔍 DB 상태 확인"
   - SQLite 통계 확인
   - React Query 캐시 확인

2. DebugScreen → "🔍 현재 Todo 상세 확인"
   - UI completed vs SQLite 비교
   - 불일치 발견 시 → 원인 1 (캐시 동기화 문제)
```

### Step 2: 토글 테스트
```
1. DebugScreen → "🔄 Completion 토글 테스트"
   - Step 1: 토글 전 SQLite 상태
   - Step 2: 토글 실행
   - Step 3: 토글 후 SQLite 상태
   - Step 4: UI 재조회 후 상태

2. 각 단계에서 상태 변화 확인
   - SQLite 토글 성공했는가?
   - UI가 즉시 반영되는가?
   - 재조회 후에도 유지되는가?
```

### Step 3: Pending 확인
```
1. 오프라인 상태로 전환 (비행기 모드)

2. DebugScreen → "🔄 Completion 토글 테스트"

3. DebugScreen → "⏳ Pending Changes 확인"
   - Pending이 추가되었는가?
   - 중복이 있는가?
   - type이 올바른가? (createCompletion / deleteCompletion)
```

### Step 4: 온라인 동기화 테스트
```
1. 온라인 상태로 전환

2. 앱 재시작 (또는 SyncProvider 트리거)

3. Pending이 처리되었는가?
   - DebugScreen → "⏳ Pending Changes 확인"
   - Pending이 0개가 되어야 함

4. 서버와 동기화되었는가?
   - 다른 기기에서 확인
   - 또는 서버 DB 직접 확인
```

## 코드 분석

### useToggleCompletion.js
```javascript
// 1. SQLite 토글 (즉시)
const newState = await sqliteToggleCompletion(todoId, date);

// 2. 네트워크 확인
if (!netInfo.isConnected) {
  // 오프라인: Pending 추가
  await addPendingChange({
    type: newState ? 'createCompletion' : 'deleteCompletion',
    todoId,
    date,
  });
  return { completed: newState, offline: true };
}

// 3. 온라인: 서버 요청
try {
  const res = await completionAPI.toggleCompletion(todoId, date);
  return res.data;
} catch (error) {
  // 실패 시: Pending 추가
  await addPendingChange(...);
  return { completed: newState, offline: true };
}
```

**잠재적 문제**:
- `onSuccess`에서 캐시 업데이트 시 `data.completed`를 사용하는데, 오프라인일 때는 `newState`와 다를 수 있음
- 서버 요청 실패 시 Pending 추가하지만, 이미 SQLite는 토글된 상태 → 재시도 시 중복 토글 가능

### completionService.js
```javascript
export async function toggleCompletion(todoId, date) {
  const key = `${todoId}_${date || 'null'}`;
  const existing = await db.getFirstAsync(
    'SELECT * FROM completions WHERE key = ?',
    [key]
  );

  if (existing) {
    // 완료 → 미완료 (삭제)
    await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
    return false;
  } else {
    // 미완료 → 완료 (생성)
    await db.runAsync(
      'INSERT INTO completions (key, todo_id, date, completed_at) VALUES (?, ?, ?, ?)',
      [key, todoId, date, new Date().toISOString()]
    );
    return true;
  }
}
```

**잠재적 문제**:
- 트랜잭션 없음 → 동시 토글 시 race condition 가능
- 에러 처리 없음 → INSERT 실패 시 예외 발생하지만 catch 안됨

## 수정 제안

### 1. useToggleCompletion 개선
```javascript
onSuccess: (data, variables) => {
  // 날짜별 Todo 캐시 업데이트
  if (variables.date) {
    queryClient.setQueryData(['todos', variables.date], (oldData) => {
      if (!oldData) return oldData;
      return oldData.map(todo => {
        if (todo._id === variables.todoId) {
          // ✅ 수정: data.completed 대신 SQLite에서 직접 조회
          return { ...todo, completed: data.completed };
        }
        return todo;
      });
    });
  }

  // 전체 캐시 무효화 (안전)
  queryClient.invalidateQueries({ queryKey: ['todos'], refetchType: 'none' });
  queryClient.invalidateQueries({ queryKey: ['calendarSummary'], refetchType: 'none' });
  queryClient.invalidateQueries({ queryKey: ['monthEvents'], refetchType: 'none' });
}
```

### 2. Pending 중복 방지
```javascript
// pendingService.js에 추가
export async function hasPendingChange(type, todoId, date) {
  const db = getDatabase();
  const result = await db.getFirstAsync(
    'SELECT 1 FROM pending_changes WHERE type = ? AND todo_id = ? AND date = ?',
    [type, todoId, date]
  );
  return !!result;
}

// useToggleCompletion.js에서 사용
if (!netInfo.isConnected) {
  const pendingType = newState ? 'createCompletion' : 'deleteCompletion';
  const hasPending = await hasPendingChange(pendingType, todoId, date);
  
  if (!hasPending) {
    await addPendingChange({
      type: pendingType,
      todoId,
      date,
    });
  }
  return { completed: newState, offline: true };
}
```

### 3. toggleCompletion 트랜잭션 추가
```javascript
export async function toggleCompletion(todoId, date) {
  const db = getDatabase();
  const key = `${todoId}_${date || 'null'}`;

  return await db.withTransactionAsync(async () => {
    const existing = await db.getFirstAsync(
      'SELECT * FROM completions WHERE key = ?',
      [key]
    );

    if (existing) {
      await db.runAsync('DELETE FROM completions WHERE key = ?', [key]);
      return false;
    } else {
      await db.runAsync(
        'INSERT INTO completions (key, todo_id, date, completed_at) VALUES (?, ?, ?, ?)',
        [key, todoId, date, new Date().toISOString()]
      );
      return true;
    }
  });
}
```

## 다음 단계

1. **에러 로그 수집**: 사용자에게 에러 발생 시 로그 요청
2. **DebugScreen 테스트**: 위 체크리스트대로 단계별 테스트
3. **원인 파악**: 로그 분석하여 정확한 원인 특정
4. **수정 적용**: 위 수정 제안 중 필요한 것 적용
5. **재테스트**: 온라인/오프라인 시나리오 전체 테스트

## 참고 파일

- `client/src/hooks/queries/useToggleCompletion.js` - Completion 토글 훅
- `client/src/db/completionService.js` - SQLite completion CRUD
- `client/src/db/pendingService.js` - Pending queue 관리
- `client/src/hooks/queries/useTodos.js` - Todo 조회 (completion 병합)
- `client/src/screens/DebugScreen.js` - 디버깅 도구
