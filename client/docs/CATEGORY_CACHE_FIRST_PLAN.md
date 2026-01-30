# Categories Cache-First 전략 구현 계획

## 🎯 목표

`useCategories`를 `useAllTodos`와 동일한 Cache-First 전략으로 변경하여 오프라인/서버 다운 시에도 즉시 카테고리 색상 표시

---

## 📊 현재 vs 목표

### 현재 (useCategories)
```javascript
queryFn: async () => {
  // ❌ 서버 요청만 시도
  const categories = await categoryApi.getCategories();
  await saveCategories(categories);
  return categories;
}

// useEffect로 로컬 로드 (타이밍 늦음)
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

**문제점**:
- queryFn이 서버 요청 실패 시 에러 throw
- useEffect는 컴포넌트 마운트 후 실행 (늦음)
- 첫 렌더링에서 categories = undefined

---

### 목표 (useAllTodos 패턴)
```javascript
queryFn: async () => {
  // ⚡ Cache-First: 캐시 먼저 확인
  const cachedCategories = queryClient.getQueryData(['categories']);
  if (cachedCategories) {
    // 백그라운드에서 서버 요청 (비동기)
    categoryApi.getCategories()
      .then(categories => {
        saveCategories(categories);
        queryClient.setQueryData(['categories'], categories);
        console.log('🔄 [useCategories] 백그라운드 업데이트 완료');
      })
      .catch(() => {
        // 백그라운드 업데이트 실패는 무시
      });
    
    // 즉시 반환
    console.log('⚡ [useCategories] 캐시 즉시 반환:', cachedCategories.length, '개');
    return cachedCategories;
  }
  
  // 캐시 없으면 서버 요청
  try {
    console.log('🌐 [useCategories] 캐시 없음 - 서버 요청');
    const categories = await categoryApi.getCategories();
    await saveCategories(categories);
    return categories;
  } catch (error) {
    console.log('⚠️ [useCategories] 서버 요청 실패 - AsyncStorage 확인');
    
    // 서버 실패하면 AsyncStorage
    const storedCategories = await loadCategories();
    queryClient.setQueryData(['categories'], storedCategories);
    
    console.log('✅ [useCategories] AsyncStorage에서 로드:', storedCategories.length, '개');
    return storedCategories;
  }
}
```

**장점**:
- ✅ 캐시 있으면 즉시 반환 (0ms)
- ✅ 서버 요청 실패 시 AsyncStorage fallback
- ✅ 백그라운드 업데이트로 최신 데이터 유지
- ✅ useEffect 제거 가능 (중복 로직 제거)

---

## 🔧 구현 계획

### 1단계: useCategories queryFn 수정
```javascript
// client/src/hooks/queries/useCategories.js

export const useCategories = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // ⚡ Cache-First: 캐시 먼저 확인
      const cachedCategories = queryClient.getQueryData(['categories']);
      if (cachedCategories) {
        // 백그라운드에서 서버 요청 (비동기)
        categoryApi.getCategories()
          .then(categories => {
            saveCategories(categories);
            queryClient.setQueryData(['categories'], categories);
            console.log('🔄 [useCategories] 백그라운드 업데이트 완료');
          })
          .catch(() => {
            // 백그라운드 업데이트 실패는 무시 (캐시 데이터 사용 중)
          });
        
        // 즉시 반환
        console.log('⚡ [useCategories] 캐시 즉시 반환:', cachedCategories.length, '개');
        return cachedCategories;
      }
      
      // 캐시 없으면 서버 요청
      try {
        console.log('🌐 [useCategories] 캐시 없음 - 서버 요청');
        const categories = await categoryApi.getCategories();
        await saveCategories(categories);
        return categories;
      } catch (error) {
        console.log('⚠️ [useCategories] 서버 요청 실패 - AsyncStorage 확인');
        
        // 서버 실패하면 AsyncStorage
        const storedCategories = await loadCategories();
        queryClient.setQueryData(['categories'], storedCategories);
        
        console.log('✅ [useCategories] AsyncStorage에서 로드:', storedCategories.length, '개');
        return storedCategories;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // ❌ useEffect 제거 (queryFn에서 처리)
  
  return query;
};
```

---

### 2단계: SyncProvider에 Categories 초기 캐시 주입 (선택)

이미 `useSyncTodos`에서 Todos 캐시를 주입하고 있으므로, Categories도 함께 주입하면 더 빠른 초기 로딩 가능:

```javascript
// client/src/hooks/useSyncTodos.js

import { loadCategories } from '../storage/categoryStorage';

// prepareCache 함수 수정
useEffect(() => {
  const prepareCache = async () => {
    try {
      // Todos
      const localTodos = await loadTodos();
      if (localTodos.length > 0) {
        console.log('⚡ [useSyncTodos] 초기 Todos 캐시 준비:', localTodos.length, '개');
        populateCache(localTodos);
      } else {
        console.log('⚠️ [useSyncTodos] 로컬 Todos 없음');
      }
      
      // ✅ Categories 추가
      const localCategories = await loadCategories();
      if (localCategories.length > 0) {
        console.log('⚡ [useSyncTodos] 초기 Categories 캐시 준비:', localCategories.length, '개');
        queryClient.setQueryData(['categories'], localCategories);
      } else {
        console.log('⚠️ [useSyncTodos] 로컬 Categories 없음');
      }
    } catch (error) {
      console.error('❌ [useSyncTodos] 초기 캐시 준비 실패:', error);
    }
  };
  
  // 즉시 캐시 준비 (로그인 여부 무관)
  prepareCache();
}, []);
```

---

## 📈 실행 흐름 비교

### Before (현재)
```
1. 앱 시작
2. useSyncTodos → Todos 캐시 주입 ✅
3. UltimateCalendar 마운트
4. useCategories 호출
   - queryFn: 서버 요청 시도
   - 오프라인 → 에러 throw
   - useEffect: 로컬 로드 시도 (늦음)
5. useCalendarDynamicEvents
   - categories = undefined ❌
   - 회색 dot 표시
6. useEffect 완료 → 재렌더링
   - 색상 정상 표시 (늦음)
```

### After (수정 후)
```
1. 앱 시작
2. useSyncTodos
   - Todos 캐시 주입 ✅
   - Categories 캐시 주입 ✅ (2단계 적용 시)
3. UltimateCalendar 마운트
4. useCategories 호출
   - queryFn: 캐시 확인
   - 캐시 히트 → 즉시 반환 ✅
   - 백그라운드 업데이트 (비동기)
5. useCalendarDynamicEvents
   - categories = [...] ✅
   - 색상 정상 표시 (즉시)
```

---

## ✅ 예상 효과

### 성능
- **초기 로딩**: 0ms (캐시 히트)
- **오프라인**: AsyncStorage fallback으로 즉시 표시
- **백그라운드 업데이트**: 사용자 경험 방해 없음

### 안정성
- ✅ 오프라인/서버 다운 시에도 색상 정상 표시
- ✅ 첫 렌더링부터 올바른 색상
- ✅ Todos와 동일한 전략 (일관성)

### 코드 품질
- ✅ useEffect 제거 (중복 로직 제거)
- ✅ useAllTodos와 동일한 패턴 (유지보수 용이)
- ✅ 책임 분리 유지

---

## 🎯 구현 순서

1. **useCategories queryFn 수정** (필수)
   - Cache-First 로직 추가
   - AsyncStorage fallback 추가
   - useEffect 제거

2. **SyncProvider 초기화 추가** (선택, 권장)
   - prepareCache에 Categories 추가
   - 앱 시작 즉시 캐시 주입

3. **테스트**
   - 온라인 시나리오
   - 오프라인 시나리오
   - 서버 다운 시나리오

---

## 📝 변경 파일

1. `client/src/hooks/queries/useCategories.js` (필수)
2. `client/src/hooks/useSyncTodos.js` (선택, 권장)

---

## 🚀 다음 단계

1. 코드 수정 진행
2. 테스트 (오프라인 모드)
3. 로그 확인
4. 문서 업데이트
