# 오프라인/서버 다운 시 카테고리 색상 문제 분석

## 🔴 문제 상황

**증상**:
1. 오프라인 환경 또는 서버 다운 시 카테고리 색상을 못 가져옴
2. UltimateCalendar에서 이벤트 dot이 회색(#808080)으로 표시됨
3. 카테고리 정보는 AsyncStorage에 저장되어 있음에도 불구하고 로드 안 됨

---

## 🔍 근본 원인 분석

### 1. Todos vs Categories 초기화 타이밍 차이

#### ✅ Todos (정상 작동)
```javascript
// useSyncTodos.js - useEffect (로그인 무관)
useEffect(() => {
  const prepareCache = async () => {
    const localTodos = await loadTodos();
    if (localTodos.length > 0) {
      console.log('⚡ 초기 캐시 즉시 준비:', localTodos.length, '개');
      populateCache(localTodos);  // ← React Query 캐시에 즉시 주입
    }
  };
  
  prepareCache();  // ← 앱 시작 즉시 실행 (로그인 무관)
}, []);
```

**특징**:
- ✅ 앱 시작 즉시 AsyncStorage에서 로드
- ✅ React Query 캐시에 즉시 주입 (`queryClient.setQueryData`)
- ✅ 로그인 여부와 무관하게 실행
- ✅ `useAllTodos()`가 호출되면 캐시된 데이터 즉시 반환

---

#### ❌ Categories (문제 발생)
```javascript
// useCategories.js
export const useCategories = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // ❌ 서버 요청만 시도 (실패 시 fallback 없음)
      const categories = await categoryApi.getCategories();
      await saveCategories(categories);
      return categories;
    },
    enabled: !!user,  // ← 로그인 필요
    staleTime: 1000 * 60 * 5,
  });

  // useEffect로 로컬 로드 시도
  useEffect(() => {
    const loadLocalFirst = async () => {
      const cached = queryClient.getQueryData(['categories']);
      if (!cached) {
        const local = await loadCategories();
        if (local.length > 0) {
          console.log('📱 로컬 카테고리 로드:', local.length);
          queryClient.setQueryData(['categories'], local);  // ← 캐시 주입
        }
      }
    };
    if (user) {
      loadLocalFirst();
    }
  }, [user, queryClient]);

  return query;
};
```

**문제점**:
1. ❌ `queryFn`이 서버 요청만 시도 (실패 시 에러 throw)
2. ❌ `useEffect`는 컴포넌트 마운트 후 실행 (늦음)
3. ❌ `enabled: !!user` → 로그인 필요
4. ❌ 서버 요청 실패 시 AsyncStorage fallback 없음

---

### 2. 실행 순서 비교

#### 정상 시나리오 (온라인)
```
1. 앱 시작
2. useSyncTodos useEffect 실행 → Todos 캐시 주입 ✅
3. SyncProvider 마운트
4. UltimateCalendar 마운트
5. useCategories useEffect 실행 → Categories 캐시 주입 ✅
6. useCalendarDynamicEvents 실행
   - todos: ✅ 있음 (캐시)
   - categories: ✅ 있음 (캐시)
   - 색상 매핑 성공 ✅
```

---

#### 문제 시나리오 (오프라인/서버 다운)
```
1. 앱 시작
2. useSyncTodos useEffect 실행 → Todos 캐시 주입 ✅
3. SyncProvider 마운트
4. UltimateCalendar 마운트
5. useCategories useEffect 실행
   - queryFn 서버 요청 시도 → ❌ 실패 (네트워크 에러)
   - useEffect의 loadLocalFirst 실행 → ⏰ 늦음 (이미 렌더링 시작)
6. useCalendarDynamicEvents 실행 (첫 렌더링)
   - todos: ✅ 있음 (캐시)
   - categories: ❌ undefined (아직 로드 안 됨)
   - Guard Clause: categories.length === 0 체크 → ❌ 통과 못함 (undefined !== [])
   - 색상 매핑 실패 → 회색 dot (#808080)
7. useEffect 완료 후 Categories 캐시 주입 (늦음)
8. 재렌더링 → 색상 정상 표시 (하지만 첫 렌더링은 회색)
```

---

### 3. Guard Clause 문제

```javascript
// useCalendarDynamicEvents.js
if (!todos || !categories || categories.length === 0) {
  return {};
}
```

**문제**:
- `categories === undefined` 체크 누락
- `categories.length === 0`은 빈 배열만 체크
- `undefined.length`는 에러 발생 가능

**실제 동작**:
```javascript
categories = undefined
!categories  // true → 조기 반환 ✅ (현재는 이것 때문에 에러 안 남)

// 하지만 타이밍 이슈로 첫 렌더링에서 categories가 undefined인 상태로 진행될 수 있음
```

---

## 🎯 핵심 문제 정리

### 1. Categories 초기화 전략 부재
- Todos: SyncProvider에서 앱 시작 즉시 캐시 주입
- Categories: useCategories Hook에서 컴포넌트 마운트 후 로드 (늦음)

### 2. queryFn에 Fallback 없음
```javascript
queryFn: async () => {
  // ❌ 서버 요청만 시도
  const categories = await categoryApi.getCategories();
  return categories;
}
```

**useAllTodos와 비교**:
```javascript
queryFn: async () => {
  try {
    const res = await todoAPI.getAllTodos();
    return res.data;
  } catch (error) {
    // ✅ 서버 실패 시 AsyncStorage fallback
    const storedTodos = await loadTodos();
    return storedTodos;
  }
}
```

### 3. useEffect 타이밍 이슈
- useEffect는 컴포넌트 마운트 후 실행
- UltimateCalendar가 먼저 렌더링 시작하면 categories가 없는 상태로 계산

---

## 📊 데이터 흐름 비교

### Todos (정상)
```
App.js
  └─ SyncProvider (useSyncTodos)
       └─ useEffect (즉시 실행)
            └─ loadTodos() → AsyncStorage
            └─ populateCache() → React Query 캐시 주입
            
UltimateCalendar
  └─ useCalendarDynamicEvents
       └─ useAllTodos()
            └─ queryClient.getQueryData(['todos', 'all'])
            └─ ✅ 캐시 히트 (즉시 반환)
```

### Categories (문제)
```
App.js
  └─ SyncProvider (useSyncTodos)
       └─ ❌ Categories 초기화 없음
       
UltimateCalendar
  └─ useCalendarDynamicEvents
       └─ useCategories()
            └─ queryFn 실행 (서버 요청)
            └─ ❌ 네트워크 에러 (오프라인)
            └─ useEffect 실행 (늦음)
                 └─ loadCategories() → AsyncStorage
                 └─ setQueryData(['categories'], local)
            └─ ❌ 첫 렌더링: categories = undefined
```

---

## 🔧 해결 방안

### Option A: useCategories queryFn에 Fallback 추가 (권장)
```javascript
queryFn: async () => {
  try {
    const categories = await categoryApi.getCategories();
    await saveCategories(categories);
    return categories;
  } catch (error) {
    // ✅ 서버 실패 시 AsyncStorage fallback
    console.log('⚠️ 서버 요청 실패 - AsyncStorage 확인');
    const storedCategories = await loadCategories();
    return storedCategories;
  }
}
```

**장점**:
- ✅ 최소 변경
- ✅ useAllTodos와 동일한 패턴
- ✅ 오프라인 시 즉시 로컬 데이터 반환

**단점**:
- useEffect의 로컬 로드와 중복 가능성 (하지만 캐시 체크로 방지 가능)

---

### Option B: SyncProvider에 Categories 초기화 추가
```javascript
// useSyncTodos.js
useEffect(() => {
  const prepareCache = async () => {
    // Todos
    const localTodos = await loadTodos();
    if (localTodos.length > 0) {
      populateCache(localTodos);
    }
    
    // ✅ Categories도 함께 초기화
    const localCategories = await loadCategories();
    if (localCategories.length > 0) {
      queryClient.setQueryData(['categories'], localCategories);
      console.log('⚡ 초기 카테고리 캐시 준비:', localCategories.length, '개');
    }
  };
  
  prepareCache();
}, []);
```

**장점**:
- ✅ Todos와 동일한 초기화 전략
- ✅ 앱 시작 즉시 캐시 주입
- ✅ 로그인 무관

**단점**:
- useSyncTodos가 Categories도 관리 (책임 증가)
- useCategories와 중복 로직

---

### Option C: 하이브리드 (A + B)
1. SyncProvider에서 초기 캐시 주입 (즉시 표시)
2. useCategories queryFn에 fallback 추가 (안전망)

**장점**:
- ✅ 최고의 안정성
- ✅ 빠른 초기 로딩
- ✅ 오프라인 대응 완벽

**단점**:
- 약간의 중복 (하지만 캐시 체크로 최소화)

---

## 🎯 권장 해결책

### 1단계: useCategories queryFn Fallback 추가 (필수)
```javascript
queryFn: async () => {
  try {
    const categories = await categoryApi.getCategories();
    await saveCategories(categories);
    return categories;
  } catch (error) {
    console.log('⚠️ [useCategories] 서버 요청 실패 - AsyncStorage 확인');
    const storedCategories = await loadCategories();
    queryClient.setQueryData(['categories'], storedCategories);
    return storedCategories;
  }
}
```

### 2단계: SyncProvider 초기화 추가 (선택, 권장)
```javascript
// useSyncTodos.js - prepareCache 함수 수정
const prepareCache = async () => {
  try {
    // Todos
    const localTodos = await loadTodos();
    if (localTodos.length > 0) {
      console.log('⚡ 초기 Todos 캐시 준비:', localTodos.length, '개');
      populateCache(localTodos);
    }
    
    // Categories
    const localCategories = await loadCategories();
    if (localCategories.length > 0) {
      console.log('⚡ 초기 Categories 캐시 준비:', localCategories.length, '개');
      queryClient.setQueryData(['categories'], localCategories);
    }
  } catch (error) {
    console.error('❌ 초기 캐시 준비 실패:', error);
  }
};
```

### 3단계: Guard Clause 강화 (이미 완료)
```javascript
// useCalendarDynamicEvents.js
if (!todos || !categories || categories.length === 0) {
  return {};
}
```

---

## 📈 예상 효과

### Before (현재)
```
오프라인 시나리오:
1. 앱 시작
2. UltimateCalendar 렌더링
3. categories = undefined
4. 회색 dot 표시 ❌
5. useEffect 완료 후 재렌더링
6. 색상 정상 표시 ✅ (늦음)
```

### After (수정 후)
```
오프라인 시나리오:
1. 앱 시작
2. SyncProvider: Categories 캐시 주입 ✅
3. UltimateCalendar 렌더링
4. categories = [...] (캐시 히트)
5. 색상 정상 표시 ✅ (즉시)
```

---

## 🔍 추가 발견 사항

### 1. useCategories useEffect 중복 로직
```javascript
useEffect(() => {
  const loadLocalFirst = async () => {
    const cached = queryClient.getQueryData(['categories']);
    if (!cached) {
      const local = await loadCategories();
      if (local.length > 0) {
        queryClient.setQueryData(['categories'], local);
      }
    }
  };
  if (user) {
    loadLocalFirst();
  }
}, [user, queryClient]);
```

**문제**:
- queryFn이 실패하면 useEffect가 실행되지만 타이밍이 늦음
- queryFn이 성공하면 useEffect가 불필요하게 실행됨 (캐시 체크로 스킵되긴 함)

**해결**:
- queryFn에 fallback 추가하면 useEffect는 제거 가능
- 또는 SyncProvider 초기화로 대체

---

### 2. Categories 동기화 전략 부재
```javascript
// useSyncTodos.js
// ✅ Todos는 델타 동기화 지원
const response = await todoAPI.getDeltaSync(metadata.lastSyncTime);

// ❌ Categories는 델타 동기화 없음
// 항상 전체 데이터 요청
```

**영향**:
- Categories는 변경이 적으므로 큰 문제는 아님
- 하지만 일관성을 위해 델타 동기화 추가 고려 가능

---

## 📝 요약

### 근본 원인
1. **Categories 초기화 전략 부재**: Todos는 SyncProvider에서 즉시 캐시 주입, Categories는 컴포넌트 마운트 후 로드
2. **queryFn Fallback 없음**: 서버 요청 실패 시 AsyncStorage fallback 없음
3. **useEffect 타이밍 이슈**: 컴포넌트 마운트 후 실행되어 첫 렌더링에 늦음

### 해결 방법
1. **useCategories queryFn에 Fallback 추가** (필수)
2. **SyncProvider에 Categories 초기화 추가** (권장)
3. **Guard Clause 강화** (이미 완료)

### 예상 효과
- ✅ 오프라인/서버 다운 시에도 색상 정상 표시
- ✅ 첫 렌더링부터 올바른 색상
- ✅ Todos와 동일한 초기화 전략
