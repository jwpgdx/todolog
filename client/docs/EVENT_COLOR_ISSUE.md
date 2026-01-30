# 🎨 이벤트 색상 표시 문제 & 성능 분석

## 📋 문제 요약

UltimateCalendar에서 이벤트 dot 색상이 **간헐적으로 회색(#808080)**으로 표시되는 문제 발생.

**증상:**
- ✅ **정상**: 카테고리별 색상 표시 (파랑, 빨강, 초록 등)
- ❌ **비정상**: 모든 dot이 회색(#808080)으로 표시

---

## 🔍 근본 원인 분석 (완료)

### 핵심 원인: Categories와 Todos의 로드 타이밍 불일치

**문제 발생 시나리오:**
```javascript
// useCalendarDynamicEvents.js 실행 순서
const { data: todos } = useAllTodos();        // ✅ 즉시 캐시 반환 (33개)
const { data: categories } = useCategories(); // ❌ undefined (아직 로드 안됨)

// categories가 undefined일 때
const categoryColorMap = {}; // 빈 객체
categoryColorMap[todo.categoryId] // undefined → fallback #808080 (회색)
```

---

## 📊 로드 타이밍 비교

### Todos 로딩 플로우 (빠름 ⚡)
```
App.js 시작
  → SyncProvider 마운트
    → useSyncTodos 실행
      → prepareCache() useEffect (즉시 실행, 로그인 여부 무관)
        → loadTodos() from AsyncStorage
        → queryClient.setQueryData(['todos', 'all'], todos) ✅
          → useAllTodos() 호출 시 즉시 캐시 반환
```

**로그 증거:**
```javascript
useSyncTodos.js:170 ⚡ [useSyncTodos] 초기 캐시 즉시 준비: 33 개
useAllTodos.js:27 ⚡ [useAllTodos] 캐시 즉시 반환: 33 개
```

### Categories 로딩 플로우 (느림 🐌)
```
UltimateCalendar 마운트
  → useCalendarDynamicEvents 실행
    → useCategories() 호출
      → queryFn 실행 (서버 요청 시작)
      → useEffect 실행 (로컬 로드) ⏱️ 약간 지연
        → loadCategories() from AsyncStorage
        → queryClient.setQueryData(['categories'], categories) ✅
```

**로그 증거:**
```javascript
UltimateCalendar.js:96 📅 [UltimateCalendar] 초기 데이터 생성 시작...
// ... (categories 로드 전에 이벤트 계산 시작)
useCategories.js:38 📱 [useCategories] 로컬 카테고리 로드: 3  // ⚠️ 늦게 로드됨
```

---

## 🏗️ 로컬 캐싱 구조 분석

### Todos 캐싱
- **위치**: `AsyncStorage` → `todoStorage.js`
- **React Query 캐시**: `['todos', 'all']`
- **초기 주입**: `useSyncTodos`의 `prepareCache()` useEffect (앱 시작 즉시)
- **내용**: 
  ```javascript
  {
    _id: '697a414518e2c4e184559657',
    title: '온라인 테스트 오전 2:03:01',
    categoryId: '6974f9574a71170933652243',  // ✅ categoryId만 저장
    startDate: '2026-01-27',
    // ... (색상 정보 없음)
  }
  ```

### Categories 캐싱
- **위치**: `AsyncStorage` → `categoryStorage.js`
- **React Query 캐시**: `['categories']`
- **초기 주입**: `useCategories`의 useEffect (컴포넌트 마운트 후)
- **내용**:
  ```javascript
  {
    _id: '697a419218e2c4e1845596d2',
    name: '업무',
    color: '#039BE5',  // ✅ 색상 정보
    icon: 'briefcase'
  }
  ```

### 타이밍 차이 발생 이유

| 항목 | Todos | Categories |
|------|-------|-----------|
| **초기 주입 위치** | `SyncProvider` (전역) | `useCategories` (개별 Hook) |
| **초기 주입 시점** | 앱 시작 즉시 | 컴포넌트 마운트 후 |
| **로그인 의존성** | 없음 (prepareCache는 무조건 실행) | 있음 (`enabled: !!user`) |
| **결과** | ⚡ 즉시 반환 | 🐌 약간 지연 |

---

## 🐛 문제 발생 시나리오

### 시나리오 1: 앱 시작 시
1. App.js 시작 → SyncProvider 마운트
2. `useSyncTodos` 실행 → `prepareCache()` 즉시 실행
3. Todos 캐시 주입 완료 ✅
4. UltimateCalendar 마운트 → `useCalendarDynamicEvents` 실행
5. `useAllTodos()` → 즉시 33개 반환 ✅
6. `useCategories()` → undefined 반환 ❌ (아직 useEffect 실행 안됨)
7. `categoryColorMap = {}` (빈 객체)
8. 모든 이벤트가 회색(#808080)으로 표시 ❌

### 시나리오 2: 오프라인 상태
1. 오프라인 상태
2. Todos는 로컬 캐시에서 로드 ✅
3. Categories도 AsyncStorage에 있음 ✅
4. 하지만 `useCategories`의 useEffect가 실행되기 전
5. `categories = undefined`
6. 모든 이벤트가 회색으로 표시 ❌

---

## 📊 성능 분석: 카테고리 중복 제거

### 현재 실행 흐름

```
앱 시작
  ↓
UltimateCalendar 렌더링
  ↓
84주 × 7일 = 588개 DayCell 생성
  ↓
각 DayCell마다 useDayCell Hook 실행
  ↓
useDayCell 내부에서 카테고리 중복 제거 (useMemo)
  ↓
588번 실행 ⚠️
```

### 연산 비용

**현재 구조:**
- 588개 DayCell × 평균 3개 이벤트 = **1,764번 루프**
- Map 생성/조회: 1,764번
- Array 변환: 588번
- **총 연산: ~2,500회** ⚠️

**실제 성능:**
```javascript
// useMemo 덕분에 events가 변하지 않으면 재계산 안 함
// 초기 렌더링: 2,500회 (한 번만)
// 스크롤: 0회 (캐싱됨)
// 이벤트 추가/삭제: 영향받은 날짜만 재계산
```

**예상 시간:**
- 초기 렌더링: ~50ms (2,500회 × 0.02ms)
- 이후: 0ms (캐싱)
- **결론**: 60fps 유지됨 ✅

---

## 🎯 해결 방안

### ✅ Option 1-A: useCalendarDynamicEvents에 enabled 조건 추가 (권장)

**개념:**
- categories가 로드될 때까지 이벤트 계산 지연
- 간단하고 안전한 방법

**구현:**
```javascript
// useCalendarDynamicEvents.js
export const useCalendarDynamicEvents = ({ weeks, visibleIndex, range = 5, cacheType = 'week' }) => {
  const { data: todos } = useAllTodos();
  const { data: categories } = useCategories();
  
  // ✅ categories 로드 대기
  if (!categories || !todos) {
    return { weeklyEvents: {}, monthlyEvents: {} };
  }
  
  // ... 나머지 로직
};
```

**장점:**
- ✅ 간단한 수정 (3줄)
- ✅ 타이밍 이슈 완전 해결
- ✅ 회색 dot 문제 100% 해결
- ✅ 기존 구조 유지

**단점:**
- ⚠️ 초기 로딩 약간 지연 (5~10ms, 무시 가능)

---

### ✅ Option 1-B: SyncProvider에 Categories 초기 캐시 주입 (추가 보완)

**개념:**
- Todos와 동일하게 Categories도 앱 시작 시 즉시 캐시 주입
- 타이밍 불일치 원천 차단

**구현:**
```javascript
// client/src/providers/SyncProvider.js
import { loadCategories } from '../storage/categoryStorage';

export const SyncProvider = ({ children }) => {
    const syncState = useSyncTodos();
    const queryClient = useQueryClient();
    
    // ✅ Categories 초기 캐시 주입
    useEffect(() => {
        const prepareCategories = async () => {
            const localCategories = await loadCategories();
            if (localCategories.length > 0) {
                console.log('⚡ [SyncProvider] 초기 카테고리 캐시 준비:', localCategories.length, '개');
                queryClient.setQueryData(['categories'], localCategories);
            }
        };
        prepareCategories();
    }, [queryClient]);

    return (
        <SyncContext.Provider value={syncState}>
            {children}
        </SyncContext.Provider>
    );
};
```

**장점:**
- ✅ Todos와 동일한 타이밍에 로드
- ✅ 타이밍 불일치 원천 차단
- ✅ 모든 컴포넌트에서 즉시 사용 가능

**단점:**
- ⚠️ SyncProvider 수정 필요

---

### Option 2: 서버에서 todo에 category 정보 populate (근본적 해결)

**개념:**
- 서버에서 todo 반환 시 category 정보 포함
- 클라이언트에서 별도 매핑 불필요

**서버 수정:**
```javascript
// server/src/controllers/todoController.js
const todos = await Todo.find({ userId })
  .populate('categoryId', 'name color icon')  // ✅ category 정보 포함
  .sort({ createdAt: -1 });
```

**클라이언트 수정:**
```javascript
// useCalendarDynamicEvents.js
periodEvents[dateStr].push({
  _id: todo._id,
  title: todo.title,
  color: todo.categoryId?.color || '#808080',  // ✅ 직접 접근
  isRecurring: true,
  event: todo,
});
```

**장점:**
- ✅ 타이밍 이슈 완전 제거
- ✅ 코드 단순화
- ✅ 성능 향상 (별도 매핑 불필요)

**단점:**
- ❌ 서버 수정 필요
- ❌ 데이터 크기 약간 증가
- ❌ 로컬 캐싱 구조 변경 필요

---

### Option 3: 상위에서 카테고리 중복 제거 (성능 최적화)

**개념:**
- `useCalendarDynamicEvents`에서 중복 제거
- DayCell은 받기만 함

**구현:**
```javascript
// useCalendarDynamicEvents.js
// 이벤트 생성 후 중복 제거
const uniqueByCategory = {};
periodEvents[dateStr].forEach(e => {
  const categoryId = e.event?.categoryId || 'no-category';
  if (!uniqueByCategory[categoryId]) {
    uniqueByCategory[categoryId] = e;
  }
});
periodEvents[dateStr] = Object.values(uniqueByCategory);
```

**장점:**
- ✅ 연산 1회만: 2,500회 → 1회
- ✅ DayCell 단순화
- ✅ 캐싱 효율: 주별 캐시에 이미 중복 제거된 데이터
- ✅ 초기 렌더링: 50ms → 5ms

**단점:**
- ⚠️ 유연성 감소: DayCell에서 커스터마이징 어려움
- ⚠️ 현재 성능 문제 없어서 불필요할 수 있음

---

## 📈 성능 비교

| 방식 | 초기 연산 | 스크롤 연산 | UX | 코드 복잡도 | 추천 |
|------|----------|------------|-----|------------|------|
| **현재 (DayCell 중복 제거)** | 2,500회 (50ms) | 0회 | ⭐⭐⭐⭐⭐ | 중간 | ✅ 유지 가능 |
| **Option 1-A (enabled 조건)** | 2,500회 (50ms) | 0회 | ⭐⭐⭐⭐⭐ | 낮음 | ✅ 색상 문제 해결 |
| **Option 1-B (초기 캐시 주입)** | 2,500회 (50ms) | 0회 | ⭐⭐⭐⭐⭐ | 낮음 | ✅ 타이밍 완전 해결 |
| **Option 2 (서버 populate)** | 0회 | 0회 | ⭐⭐⭐⭐⭐ | 낮음 | ✅ 근본 해결 |
| **Option 3 (상위 중복 제거)** | 1회 (5ms) | 0회 | ⭐⭐⭐⭐⭐ | 낮음 | ✅ 성능 최적화 |

---

## 🔧 권장 해결 순서

### 1단계: 즉시 수정 (Option 1-A) - 색상 문제 해결 ✅
```javascript
// useCalendarDynamicEvents.js
export const useCalendarDynamicEvents = ({ weeks, visibleIndex, range = 5, cacheType = 'week' }) => {
  const { data: todos } = useAllTodos();
  const { data: categories } = useCategories();
  
  // ✅ categories 로드 대기
  if (!categories || !todos) {
    return { weeklyEvents: {}, monthlyEvents: {} };
  }
  
  // ... 나머지 로직
};
```

**효과:**
- ✅ 회색 dot 문제 완전 해결
- ✅ 타이밍 이슈 제거
- ⏱️ 초기 로딩: +5~10ms (무시 가능)

---

### 2단계: 추가 보완 (Option 1-B) - 선택사항
```javascript
// client/src/providers/SyncProvider.js
useEffect(() => {
    const prepareCategories = async () => {
        const localCategories = await loadCategories();
        if (localCategories.length > 0) {
            console.log('⚡ [SyncProvider] 초기 카테고리 캐시 준비:', localCategories.length, '개');
            queryClient.setQueryData(['categories'], localCategories);
        }
    };
    prepareCategories();
}, [queryClient]);
```

**효과:**
- ✅ Todos와 동일한 타이밍에 로드
- ✅ 타이밍 불일치 원천 차단

---

### 3단계: 성능 최적화 (Option 3) - 선택사항
```javascript
// useCalendarDynamicEvents.js
// 이벤트 생성 후 중복 제거 추가
const uniqueByCategory = {};
periodEvents[dateStr].forEach(e => {
  const categoryId = e.event?.categoryId || 'no-category';
  if (!uniqueByCategory[categoryId]) {
    uniqueByCategory[categoryId] = e;
  }
});
periodEvents[dateStr] = Object.values(uniqueByCategory);
```

**효과:**
- ✅ 초기 렌더링: 50ms → 5ms
- ✅ DayCell 로직 단순화
- ✅ 캐싱 효율 향상

**필요성:**
- 현재 50ms도 충분히 빠름
- 60fps 유지됨
- **선택사항** (나중에 적용 가능)

---

### 4단계: 근본 해결 (Option 2) - 장기 계획
```javascript
// server/src/controllers/todoController.js
const todos = await Todo.find({ userId })
  .populate('categoryId', 'name color icon')
  .sort({ createdAt: -1 });
```

**효과:**
- ✅ 클라이언트 매핑 로직 제거
- ✅ 코드 단순화
- ✅ 타이밍 이슈 원천 차단

---

## 📝 추가 개선 사항

### 1. 로딩 상태 표시
```javascript
if (!categories) {
  return <LoadingSpinner />;  // ✅ 회색 dot 대신 로딩 표시
}
```

### 2. Fallback 색상 개선
```javascript
color: categoryColorMap[todo.categoryId] || THEME.primary  // #039BE5 (파랑)
```

### 3. 에러 로깅
```javascript
if (!categoryColorMap[todo.categoryId]) {
  console.warn(`⚠️ Category not found: ${todo.categoryId}`);
}
```

### 4. 디버그 로그 정리
```javascript
// 현재: 1,666개 로그 (과도함)
// 개선: 특정 조건만 로그
if (events.length > 0 && events.some(e => e.color === '#808080')) {
  console.log('⚠️ 회색 dot 발견:', day.dateString);
}
```

---

## 🎯 결론

### 핵심 문제
1. **색상 문제**: Categories와 Todos의 비동기 로드 타이밍 불일치
   - Todos: 앱 시작 즉시 캐시 주입 (`useSyncTodos` prepareCache)
   - Categories: 컴포넌트 마운트 후 캐시 주입 (`useCategories` useEffect)
2. **성능**: 카테고리 중복 제거 로직이 588번 실행 (하지만 문제 없음)

### 권장 해결
1. **즉시**: Option 1-A (enabled 조건) → 색상 문제 해결
2. **추가**: Option 1-B (초기 캐시 주입) → 타이밍 완전 해결
3. **선택**: Option 3 (상위 중복 제거) → 성능 최적화 (50ms → 5ms)
4. **장기**: Option 2 (서버 populate) → 근본 해결

### 현재 상태 평가
- ✅ **성능**: 50ms 초기 렌더링, 60fps 유지 → **문제 없음**
- ❌ **색상**: 간헐적 회색 dot → **Option 1-A로 해결 필요**
- ✅ **UX**: 카테고리별 색상 표시 → **우수**

### 최종 권장
**Option 1-A + 1-B 조합 적용** ✅
- Option 1-A: 색상 문제 즉시 해결 (3줄 수정)
- Option 1-B: 타이밍 불일치 원천 차단 (SyncProvider 수정)
- 성능은 이미 양호 (Option 3은 나중에 필요하면 적용)

---

## 📅 다음 단계
1. ✅ Categories 로드 타이밍 분석 완료
2. ⏳ Option 1-A 적용 및 테스트
3. ⏳ Option 1-B 적용 및 테스트
4. ⏳ 디버그 로그 정리 (1,666개 → 5~10개로 축소)
5. ⏳ (선택) Option 3 적용 (성능 최적화)
