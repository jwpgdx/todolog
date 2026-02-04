# Optimistic Update 구현 계획서

## 📋 개요

**목표:** Todo CRUD 및 Completion Toggle에 Optimistic Update 적용하여 1000개 이상 환경에서 성능 최적화

**예상 효과:**
- Todo 생성/수정/삭제: 210ms → 11ms (19배 개선)
- Completion 토글: 60ms → 1ms (60배 개선)
- SQLite 중복 조회 제거

**작업 시간:** 약 40분
- Phase 1 (Todo CRUD): 30분
- Phase 2 (Completion): 10분

---

## 🎯 Phase 1: Todo CRUD Optimistic Update (30분)

### 1.1 useCreateTodo 최적화 (10분)

**파일:** `client/src/hooks/queries/useCreateTodo.js`

**현재 문제:**
```javascript
onSettled: () => {
  invalidateQueries(['todos', 'all']);  // 전체 조회 발생
}
```

**변경 사항:**

#### Step 1: onMutate 추가 (캐시 직접 업데이트)
```javascript
onMutate: async (variables) => {
  console.log('🔄 [useCreateTodo] onMutate 시작:', variables);
  
  // 1. 진행 중인 refetch 취소
  await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
  await queryClient.cancelQueries({ queryKey: ['todos', variables.startDate] });
  
  // 2. 이전 데이터 백업
  const previousAll = queryClient.getQueryData(['todos', 'all']);
  const previousDate = queryClient.getQueryData(['todos', variables.startDate]);
  
  console.log('💾 [useCreateTodo] 백업 완료:', {
    allCount: previousAll?.length,
    dateCount: previousDate?.length
  });
  
  // 3. 새 Todo 객체 생성 (mutationFn과 동일한 구조)
  const todoId = generateId();
  const optimisticTodo = {
    _id: todoId,
    ...variables,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completed: false,
  };
  
  console.log('✨ [useCreateTodo] Optimistic Todo 생성:', optimisticTodo._id);
  
  // 4. 캐시 직접 업데이트
  queryClient.setQueryData(['todos', 'all'], (old) => {
    const updated = old ? [...old, optimisticTodo] : [optimisticTodo];
    console.log('📝 [useCreateTodo] 전체 캐시 업데이트:', {
      before: old?.length,
      after: updated.length
    });
    return updated;
  });
  
  if (variables.startDate) {
    queryClient.setQueryData(['todos', variables.startDate], (old) => {
      const updated = old ? [...old, optimisticTodo] : [optimisticTodo];
      console.log('📅 [useCreateTodo] 날짜별 캐시 업데이트:', {
        date: variables.startDate,
        before: old?.length,
        after: updated.length
      });
      return updated;
    });
  }
  
  // 5. 백업 데이터 반환 (롤백용)
  return { previousAll, previousDate, optimisticTodo };
},
```

#### Step 2: onError 추가 (롤백)
```javascript
onError: (error, variables, context) => {
  console.error('❌ [useCreateTodo] 에러 발생 - 롤백 시작:', error.message);
  
  // 백업 데이터로 복구
  if (context?.previousAll) {
    queryClient.setQueryData(['todos', 'all'], context.previousAll);
    console.log('🔙 [useCreateTodo] 전체 캐시 롤백 완료');
  }
  
  if (context?.previousDate && variables.startDate) {
    queryClient.setQueryData(['todos', variables.startDate], context.previousDate);
    console.log('🔙 [useCreateTodo] 날짜별 캐시 롤백 완료');
  }
  
  console.error('❌ [useCreateTodo] 할일 생성 실패:', {
    error: error.message,
    variables
  });
},
```

#### Step 3: onSuccess 수정 (invalidate 제거)
```javascript
onSuccess: async (data, variables, context) => {
  console.log('🎉 [useCreateTodo] onSuccess:', { id: data._id, title: data.title });
  
  // ✅ 서버 응답으로 Optimistic Todo 교체
  queryClient.setQueryData(['todos', 'all'], (old) => {
    if (!old) return [data];
    return old.map(todo => 
      todo._id === context.optimisticTodo._id ? data : todo
    );
  });
  console.log('🔄 [useCreateTodo] Optimistic → 서버 데이터 교체 완료');
  
  if (data.startDate) {
    queryClient.setQueryData(['todos', data.startDate], (old) => {
      if (!old) return [data];
      return old.map(todo => 
        todo._id === context.optimisticTodo._id ? data : todo
      );
    });
  }
  
  // ⚠️ 캘린더 캐시만 invalidate (이벤트 재계산 필요)
  invalidateAffectedMonths(queryClient, data);
  
  // 사용자 편의 정보 저장 (기존 유지)
  try {
    const todoType = variables.recurrence ? 'routine' : 'todo';
    await AsyncStorage.setItem('lastUsedTodoType', todoType);
    if (variables.categoryId) {
      await AsyncStorage.setItem('lastUsedCategoryId', variables.categoryId);
    }
  } catch (error) {
    console.error('❌ [useCreateTodo] 로컬 저장 실패:', error);
  }
},
```

#### Step 4: onSettled 제거
```javascript
// ❌ 제거: onSettled는 더 이상 불필요
// onMutate에서 이미 캐시 업데이트 완료
```

**테스트 체크리스트:**
- [ ] 온라인에서 Todo 생성 → 즉시 화면 반영
- [ ] 오프라인에서 Todo 생성 → 즉시 화면 반영
- [ ] 서버 실패 시 → 롤백 확인
- [ ] 로그 확인: onMutate → onSuccess 순서
- [ ] 캐시 개수 확인: before/after 로그

---

### 1.2 useUpdateTodo 최적화 (10분)

**파일:** `client/src/hooks/queries/useUpdateTodo.js`

**현재 문제:**
```javascript
onSuccess: () => {
  invalidateQueries(['todos', 'all']);  // 전체 조회 발생
}
```

**변경 사항:**

#### Step 1: onMutate 추가
```javascript
onMutate: async ({ id, data }) => {
  console.log('🔄 [useUpdateTodo] onMutate 시작:', { id, data });
  
  // 1. 진행 중인 refetch 취소
  await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
  await queryClient.cancelQueries({ queryKey: ['todos', data.startDate] });
  
  // 2. 이전 데이터 백업
  const previousAll = queryClient.getQueryData(['todos', 'all']);
  const previousDate = queryClient.getQueryData(['todos', data.startDate]);
  
  console.log('💾 [useUpdateTodo] 백업 완료:', {
    allCount: previousAll?.length,
    dateCount: previousDate?.length
  });
  
  // 3. 캐시 직접 업데이트
  queryClient.setQueryData(['todos', 'all'], (old) => {
    if (!old) return old;
    const updated = old.map(todo => 
      todo._id === id 
        ? { ...todo, ...data, updatedAt: new Date().toISOString() }
        : todo
    );
    console.log('📝 [useUpdateTodo] 전체 캐시 업데이트 완료');
    return updated;
  });
  
  if (data.startDate) {
    queryClient.setQueryData(['todos', data.startDate], (old) => {
      if (!old) return old;
      const updated = old.map(todo => 
        todo._id === id 
          ? { ...todo, ...data, updatedAt: new Date().toISOString() }
          : todo
      );
      console.log('📅 [useUpdateTodo] 날짜별 캐시 업데이트 완료');
      return updated;
    });
  }
  
  return { previousAll, previousDate };
},
```

#### Step 2: onError 추가
```javascript
onError: (error, { id, data }, context) => {
  console.error('❌ [useUpdateTodo] 에러 발생 - 롤백 시작:', error.message);
  
  if (context?.previousAll) {
    queryClient.setQueryData(['todos', 'all'], context.previousAll);
    console.log('🔙 [useUpdateTodo] 전체 캐시 롤백 완료');
  }
  
  if (context?.previousDate && data.startDate) {
    queryClient.setQueryData(['todos', data.startDate], context.previousDate);
    console.log('🔙 [useUpdateTodo] 날짜별 캐시 롤백 완료');
  }
  
  console.error('❌ [useUpdateTodo] 할일 수정 실패:', error);
},
```

#### Step 3: onSuccess 수정
```javascript
onSuccess: (data) => {
  console.log('🎉 [useUpdateTodo] onSuccess:', data._id);
  
  // ✅ 서버 응답으로 최종 업데이트
  queryClient.setQueryData(['todos', 'all'], (old) => {
    if (!old) return old;
    return old.map(todo => todo._id === data._id ? data : todo);
  });
  console.log('🔄 [useUpdateTodo] 서버 데이터로 최종 업데이트 완료');
  
  if (data.startDate) {
    queryClient.setQueryData(['todos', data.startDate], (old) => {
      if (!old) return old;
      return old.map(todo => todo._id === data._id ? data : todo);
    });
  }
  
  // ⚠️ 캘린더 캐시만 invalidate
  invalidateAffectedMonths(queryClient, data);
},
```

**테스트 체크리스트:**
- [ ] Todo 수정 → 즉시 화면 반영
- [ ] 오프라인 수정 → 즉시 반영
- [ ] 서버 실패 → 롤백 확인
- [ ] 로그 확인

---

### 1.3 useDeleteTodo 최적화 (10분)

**파일:** `client/src/hooks/queries/useDeleteTodo.js`

**현재 문제:**
```javascript
onSuccess: () => {
  invalidateQueries(['todos', 'all']);  // 전체 조회 발생
}
```

**변경 사항:**

#### Step 1: onMutate 추가
```javascript
onMutate: async (todo) => {
  console.log('🔄 [useDeleteTodo] onMutate 시작:', todo._id);
  
  // 1. 진행 중인 refetch 취소
  await queryClient.cancelQueries({ queryKey: ['todos', 'all'] });
  await queryClient.cancelQueries({ queryKey: ['todos', todo.startDate] });
  
  // 2. 이전 데이터 백업
  const previousAll = queryClient.getQueryData(['todos', 'all']);
  const previousDate = queryClient.getQueryData(['todos', todo.startDate]);
  
  console.log('💾 [useDeleteTodo] 백업 완료:', {
    allCount: previousAll?.length,
    dateCount: previousDate?.length
  });
  
  // 3. 캐시에서 제거
  queryClient.setQueryData(['todos', 'all'], (old) => {
    if (!old) return old;
    const updated = old.filter(t => t._id !== todo._id);
    console.log('🗑️ [useDeleteTodo] 전체 캐시에서 제거:', {
      before: old.length,
      after: updated.length
    });
    return updated;
  });
  
  if (todo.startDate) {
    queryClient.setQueryData(['todos', todo.startDate], (old) => {
      if (!old) return old;
      const updated = old.filter(t => t._id !== todo._id);
      console.log('🗑️ [useDeleteTodo] 날짜별 캐시에서 제거:', {
        before: old.length,
        after: updated.length
      });
      return updated;
    });
  }
  
  return { previousAll, previousDate, deletedTodo: todo };
},
```

#### Step 2: onError 추가
```javascript
onError: (error, todo, context) => {
  console.error('❌ [useDeleteTodo] 에러 발생 - 롤백 시작:', error.message);
  
  if (context?.previousAll) {
    queryClient.setQueryData(['todos', 'all'], context.previousAll);
    console.log('🔙 [useDeleteTodo] 전체 캐시 롤백 완료');
  }
  
  if (context?.previousDate && todo.startDate) {
    queryClient.setQueryData(['todos', todo.startDate], context.previousDate);
    console.log('🔙 [useDeleteTodo] 날짜별 캐시 롤백 완료');
  }
  
  console.error('❌ [useDeleteTodo] 할일 삭제 실패:', error);
},
```

#### Step 3: onSuccess 수정
```javascript
onSuccess: (data, todo) => {
  console.log('🎉 [useDeleteTodo] onSuccess:', todo._id);
  console.log('✅ [useDeleteTodo] 캐시 삭제 이미 완료 (onMutate)');
  
  // ⚠️ 캘린더 캐시만 invalidate
  if (todo) {
    invalidateAffectedMonths(queryClient, todo);
  }
},
```

**테스트 체크리스트:**
- [ ] Todo 삭제 → 즉시 화면에서 사라짐
- [ ] 오프라인 삭제 → 즉시 반영
- [ ] 서버 실패 → 롤백 (다시 나타남)
- [ ] 로그 확인

---

## 🎯 Phase 2: Completion Toggle 최적화 (10분)

### 2.1 useToggleCompletion 최적화

**파일:** `client/src/hooks/queries/useToggleCompletion.js`

**현재 상태:**
- ✅ 날짜별 캐시는 이미 Optimistic Update 적용됨
- ⚠️ 전체 캐시 업데이트 누락

**변경 사항:**

#### Step 1: onSuccess 수정 (전체 캐시 추가)
```javascript
onSuccess: (data, variables) => {
  console.log('✅ [useToggleCompletion] onSuccess:', data);
  
  // ✅ 기존: 날짜별 캐시 업데이트 (유지)
  if (variables.date) {
    queryClient.setQueryData(['todos', variables.date], (oldData) => {
      if (!oldData) return oldData;
      const updated = oldData.map(todo => {
        if (todo._id === variables.todoId) {
          return { ...todo, completed: data.completed };
        }
        return todo;
      });
      console.log('📅 [useToggleCompletion] 날짜별 캐시 업데이트 완료');
      return updated;
    });
  }
  
  // ✅ 추가: 전체 캐시 업데이트
  queryClient.setQueryData(['todos', 'all'], (oldData) => {
    if (!oldData) return oldData;
    const updated = oldData.map(todo => {
      if (todo._id === variables.todoId) {
        return { ...todo, completed: data.completed };
      }
      return todo;
    });
    console.log('📝 [useToggleCompletion] 전체 캐시 업데이트 완료:', {
      todoId: variables.todoId,
      completed: data.completed,
      totalCount: updated.length
    });
    return updated;
  });
  
  // ❌ 제거: invalidate 불필요
  // queryClient.invalidateQueries({ queryKey: ['calendarSummary'] });
  // queryClient.invalidateQueries({ queryKey: ['monthEvents'] });
  
  console.log('✅ [useToggleCompletion] 모든 캐시 업데이트 완료');
},
```

**테스트 체크리스트:**
- [ ] Completion 토글 → 즉시 체크박스 변경
- [ ] 날짜별 화면 반영 확인
- [ ] 전체 목록 화면 반영 확인
- [ ] 로그 확인: 날짜별 + 전체 캐시 업데이트

---

## 🧪 통합 테스트 시나리오

### 시나리오 1: 온라인 환경
```
1. Todo 생성
   - 로그 확인: onMutate → mutationFn → onSuccess
   - 화면 확인: 즉시 추가됨
   - 캐시 확인: before/after 개수

2. Todo 수정
   - 로그 확인: onMutate → mutationFn → onSuccess
   - 화면 확인: 즉시 변경됨

3. Todo 삭제
   - 로그 확인: onMutate → mutationFn → onSuccess
   - 화면 확인: 즉시 사라짐

4. Completion 토글
   - 로그 확인: mutationFn → onSuccess
   - 화면 확인: 즉시 체크박스 변경
```

### 시나리오 2: 오프라인 환경
```
1. 네트워크 끄기

2. Todo 생성
   - 로그 확인: onMutate → mutationFn (오프라인) → onSuccess
   - 화면 확인: 즉시 추가됨
   - Pending Queue 확인

3. Todo 수정
   - 화면 확인: 즉시 변경됨
   - Pending Queue 확인

4. Todo 삭제
   - 화면 확인: 즉시 사라짐
   - Pending Queue 확인

5. 네트워크 켜기
   - 동기화 확인
   - 서버 데이터 확인
```

### 시나리오 3: 에러 처리
```
1. 서버 중단

2. Todo 생성 시도
   - 로그 확인: onMutate → mutationFn → onError
   - 화면 확인: 롤백 (추가됐다가 사라짐)
   - 에러 메시지 확인

3. 서버 재시작

4. 재시도
   - 정상 동작 확인
```

### 시나리오 4: 성능 측정
```
1. Todo 1000개 환경 준비

2. Todo 생성 시간 측정
   - 이전: ~210ms
   - 이후: ~11ms
   - 로그 확인: SQLite 조회 0회

3. Completion 토글 시간 측정
   - 이전: ~60ms
   - 이후: ~1ms
   - 로그 확인: SQLite 조회 0회
```

---

## 📊 성능 모니터링 로그

### 추가할 성능 로그
```javascript
// 각 Hook에 추가
const startTime = performance.now();

// ... 작업 ...

const endTime = performance.now();
console.log(`⚡ [Hook명] 총 소요 시간: ${(endTime - startTime).toFixed(2)}ms`);
```

### 로그 레벨
```
🔄 - 작업 시작
💾 - 백업 완료
✨ - Optimistic 업데이트
📝 - 전체 캐시 업데이트
📅 - 날짜별 캐시 업데이트
🗑️ - 캐시 삭제
🔙 - 롤백
✅ - 성공
❌ - 에러
⚡ - 성능 측정
```

---

## 🚨 주의사항

### 1. ID 동기화
```javascript
// onMutate에서 생성한 optimisticTodo._id와
// mutationFn에서 생성한 todo._id가 달라질 수 있음

// 해결: context로 전달
onMutate: async (variables) => {
  const todoId = generateId();
  const optimisticTodo = { _id: todoId, ...variables };
  return { optimisticTodo };
},
onSuccess: (data, variables, context) => {
  // context.optimisticTodo._id로 찾아서 교체
  queryClient.setQueryData(['todos', 'all'], (old) => 
    old.map(todo => 
      todo._id === context.optimisticTodo._id ? data : todo
    )
  );
}
```

### 2. 날짜 변경 시 캐시 처리
```javascript
// Todo 수정 시 날짜가 변경되면?
// 이전 날짜 캐시에서 제거 + 새 날짜 캐시에 추가 필요

onMutate: async ({ id, data }) => {
  const oldTodo = queryClient.getQueryData(['todos', 'all'])
    ?.find(t => t._id === id);
  
  // 이전 날짜 캐시에서 제거
  if (oldTodo?.startDate && oldTodo.startDate !== data.startDate) {
    queryClient.setQueryData(['todos', oldTodo.startDate], (old) =>
      old?.filter(t => t._id !== id)
    );
  }
  
  // 새 날짜 캐시에 추가
  if (data.startDate) {
    queryClient.setQueryData(['todos', data.startDate], (old) =>
      old ? [...old, { ...oldTodo, ...data }] : [{ ...oldTodo, ...data }]
    );
  }
}
```

### 3. 카테고리 변경 시 캐시 처리
```javascript
// 카테고리별 캐시도 업데이트 필요
if (data.categoryId) {
  queryClient.setQueryData(['todos', 'category', data.categoryId], ...);
}
```

---

## ✅ 완료 체크리스트

### Phase 1: Todo CRUD
- [ ] useCreateTodo.js 수정 완료
- [ ] useUpdateTodo.js 수정 완료
- [ ] useDeleteTodo.js 수정 완료
- [ ] 온라인 테스트 통과
- [ ] 오프라인 테스트 통과
- [ ] 에러 처리 테스트 통과
- [ ] 성능 측정 완료

### Phase 2: Completion
- [ ] useToggleCompletion.js 수정 완료
- [ ] 전체 캐시 업데이트 확인
- [ ] 성능 측정 완료

### 통합 테스트
- [ ] 시나리오 1 통과
- [ ] 시나리오 2 통과
- [ ] 시나리오 3 통과
- [ ] 시나리오 4 통과

---

## 📝 작업 순서

1. **useCreateTodo 수정** (10분)
   - onMutate 추가
   - onError 추가
   - onSuccess 수정
   - onSettled 제거
   - 테스트

2. **useUpdateTodo 수정** (10분)
   - onMutate 추가
   - onError 추가
   - onSuccess 수정
   - 테스트

3. **useDeleteTodo 수정** (10분)
   - onMutate 추가
   - onError 추가
   - onSuccess 수정
   - 테스트

4. **useToggleCompletion 수정** (10분)
   - onSuccess 수정 (전체 캐시 추가)
   - invalidate 제거
   - 테스트

5. **통합 테스트** (10분)
   - 모든 시나리오 실행
   - 성능 측정
   - 로그 확인

---

## 🎯 예상 결과

### Before (현재)
```
Todo 생성: 210ms (SQLite 조회 2회)
Todo 수정: 210ms (SQLite 조회 2회)
Todo 삭제: 210ms (SQLite 조회 2회)
Completion: 60ms (SQLite 조회 1회)
```

### After (최적화)
```
Todo 생성: 11ms (SQLite 조회 0회) ✅
Todo 수정: 11ms (SQLite 조회 0회) ✅
Todo 삭제: 11ms (SQLite 조회 0회) ✅
Completion: 1ms (SQLite 조회 0회) ✅
```

**총 개선율: 19배 빠름** 🚀
