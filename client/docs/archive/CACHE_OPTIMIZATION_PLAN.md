# 캐시 최적화 구현 계획서

## 📋 프로젝트 개요

**목표**: 3중 캐시 구조를 단일 캐시로 단순화하여 성능 99% 개선

**예상 소요 시간**: 2-3시간

**영향 범위**:
- ✅ 수정 필요: 4개 파일
- ✅ 신규 생성: 1개 파일
- ✅ 테스트 필요: 3개 화면

**위험도**: 낮음 (기존 로직 유지, 캐시 전략만 변경)

**예상 효과**:
- 오프라인 로딩: 30초 → 100ms (99.7% 개선)
- 캐시 주입: 5초 → 10ms (99.8% 개선)
- 메모리 사용: 3MB → 1MB (66% 감소)

---

## 🎯 핵심 변경 사항

### Before (3중 캐시)
```javascript
// useSyncTodos.js - populateCache (100+ 줄)
populateCache(todos) {
  // 6개월치 일별 캐시 생성 (180개 엔트리)
  queryClient.setQueryData(['todos', '2026-01-28'], ...);
  queryClient.setQueryData(['todos', '2026-01-29'], ...);
  // ... 180개
  
  // 월별 캐시 생성
  queryClient.setQueryData(['events', 2026, 1], ...);
  
  // 전체 캐시 생성
  queryClient.setQueryData(['todos', 'all'], todos);
}
```

### After (단일 캐시)
```javascript
// useSyncTodos.js - populateCache (10줄)
populateCache(todos) {
  // 전체 캐시만 생성
  queryClient.setQueryData(['todos', 'all'], todos);
}

// useTodos.js - 필요할 때 필터링
const allTodos = queryClient.getQueryData(['todos', 'all']);
const filtered = filterByDate(allTodos, date);  // ~1ms
// React Query가 ['todos', date]로 자동 캐싱
```

---

## 📝 단계별 구현 계획


### Step 0: 사전 준비 (5분)

**작업**:
1. 현재 브랜치 백업
2. 새 브랜치 생성

**명령어**:
```bash
git checkout -b feature/optimize-cache-strategy
```

**체크리스트**:
- [ ] 브랜치 생성 완료
- [ ] 현재 코드 정상 작동 확인

---

### Step 1: 필터링 유틸 함수 생성 (15분)

**파일**: `client/src/utils/todoFilters.js` (신규)

**작업 내용**:
- `filterByDate(todos, date)` 함수 생성
- `filterByMonth(todos, year, month)` 함수 생성

**구현**:
```javascript
import { occursOnDate } from './recurrenceUtils';

/**
 * 특정 날짜에 해당하는 할일만 필터링
 */
export function filterByDate(todos, date) {
  if (!todos || !Array.isArray(todos)) return [];
  
  return todos.filter(todo => {
    if (todo.isAllDay) {
      if (todo.recurrence) {
        return occursOnDate(todo, date);
      } else {
        const startDateStr = todo.startDate;
        const endDateStr = todo.endDate || todo.startDate;
        return date >= startDateStr && date <= endDateStr;
      }
    } else {
      if (!todo.startDateTime) return false;
      
      const startDate = new Date(todo.startDateTime);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      if (!todo.recurrence) {
        if (todo.endDateTime) {
          const endDate = new Date(todo.endDateTime);
          const endDateStr = endDate.toISOString().split('T')[0];
          return date >= startDateStr && date <= endDateStr;
        }
        return date === startDateStr;
      }
      
      return occursOnDate(todo, date);
    }
  });
}

/**
 * 특정 월에 해당하는 할일만 필터링
 */
export function filterByMonth(todos, year, month) {
  if (!todos || !Array.isArray(todos)) return [];
  
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];
  
  return todos.filter(todo => {
    if (!todo.startDate) return false;
    
    // 반복 일정
    if (todo.recurrence) {
      if (todo.recurrenceEndDate && todo.recurrenceEndDate < monthStart) {
        return false;
      }
      if (todo.startDate > monthEnd) {
        return false;
      }
      return true;
    }
    
    // 단일/기간 일정
    const endDate = todo.endDate || todo.startDate;
    return !(endDate < monthStart || todo.startDate > monthEnd);
  });
}
```

**테스트**:
```javascript
// DebugScreen에서 간단히 테스트
import { filterByDate, filterByMonth } from '../utils/todoFilters';

const testTodos = [
  { _id: '1', title: 'Test', startDate: '2026-01-28', isAllDay: true },
];
console.log('filterByDate:', filterByDate(testTodos, '2026-01-28'));
console.log('filterByMonth:', filterByMonth(testTodos, 2026, 1));
```

**체크리스트**:
- [ ] 파일 생성 완료
- [ ] filterByDate 함수 작성
- [ ] filterByMonth 함수 작성
- [ ] 간단한 테스트 통과

---

### Step 2: populateCache 단순화 (20분)

**파일**: `client/src/hooks/useSyncTodos.js`

**작업 내용**:
- 기존 populateCache 함수 주석 처리 (삭제 X)
- 새로운 단순 버전으로 교체

**변경 전** (100+ 줄):
```javascript
const populateCache = useCallback((todos) => {
  // 복잡한 월별/일별 그룹핑
  // 6개월치 반복 일정 계산
  // 3중 캐시 주입
  // ...
}, [queryClient]);
```

**변경 후** (10줄):
```javascript
const populateCache = useCallback((todos) => {
  if (!todos || todos.length === 0) {
    console.log('⚠️ [useSyncTodos.populateCache] 데이터 없음');
    return;
  }

  console.log('📦 [useSyncTodos.populateCache] 캐시 주입:', todos.length, '개');
  
  // 전체 캐시만 주입 (빠름!)
  queryClient.setQueryData(['todos', 'all'], todos);
  
  console.log('✅ [useSyncTodos.populateCache] 완료');
}, [queryClient]);
```

**성능 측정 추가**:
```javascript
const populateCache = useCallback((todos) => {
  const startTime = performance.now();
  
  if (!todos || todos.length === 0) {
    console.log('⚠️ [useSyncTodos.populateCache] 데이터 없음');
    return;
  }

  console.log('📦 [useSyncTodos.populateCache] 캐시 주입:', todos.length, '개');
  queryClient.setQueryData(['todos', 'all'], todos);
  
  const endTime = performance.now();
  console.log(`✅ [useSyncTodos.populateCache] 완료 (${(endTime - startTime).toFixed(2)}ms)`);
}, [queryClient]);
```

**체크리스트**:
- [ ] 기존 코드 주석 처리
- [ ] 새 코드 작성
- [ ] 성능 측정 로그 추가
- [ ] 컴파일 에러 없음

---

### Step 3: useTodos 수정 (30분)

**파일**: `client/src/hooks/queries/useTodos.js`

**작업 내용**:
- import 추가
- queryFn 로직 수정

**추가 import**:
```javascript
import { filterByDate } from '../../utils/todoFilters';
import { useQueryClient } from '@tanstack/react-query';
```

**변경**:
```javascript
export const useTodos = (date) => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['todos', date],
    queryFn: async () => {
      try {
        const res = await todoAPI.getTodos(date);
        return res.data;
      } catch (error) {
        console.log('⚠️ [useTodos] 서버 요청 실패 - 로컬 데이터 사용');
        
        // 1. 전체 캐시 확인
        const allTodos = queryClient.getQueryData(['todos', 'all']);
        if (allTodos) {
          const filtered = filterByDate(allTodos, date);
          console.log('✅ [useTodos] 캐시에서 필터링:', filtered.length, '개');
          return filtered;
        }
        
        // 2. AsyncStorage 확인
        console.log('📂 [useTodos] 캐시 없음 - AsyncStorage 확인');
        const storedTodos = await loadTodos();
        const filtered = filterByDate(storedTodos, date);
        
        // 3. 전체 캐시에 저장
        queryClient.setQueryData(['todos', 'all'], storedTodos);
        
        console.log('✅ [useTodos] AsyncStorage에서 필터링:', filtered.length, '개');
        return filtered;
      }
    },
    enabled: !!date && !!user,
    staleTime: 1000 * 60 * 5,
  });
};
```

**체크리스트**:
- [ ] import 추가
- [ ] queryClient 추가
- [ ] 전체 캐시 확인 로직 추가
- [ ] 필터링 로직 추가
- [ ] 로그 메시지 개선
- [ ] 컴파일 에러 없음

---

### Step 4: useCalendarEvents 수정 (40분)

**파일**: `client/src/hooks/useCalendarEvents.js`

**작업 내용**:
- import 추가
- useQueries의 queryFn 로직 수정

**추가 import**:
```javascript
import { useQueryClient } from '@tanstack/react-query';
import { filterByMonth } from '../utils/todoFilters';
import { loadTodos } from '../storage/todoStorage';
```

**변경**:
```javascript
export const useCalendarEvents = (year, month, options = {}) => {
  const { isLoggedIn } = useAuthStore();
  const queryClient = useQueryClient();
  const { monthRange = 1 } = options;

  // ... monthsToLoad 생성 로직 동일 ...

  const queries = useQueries({
    queries: monthsToLoad.map(({ year: y, month: m }) => ({
      queryKey: ['events', y, m],
      queryFn: async () => {
        try {
          const response = await todoAPI.getMonthEvents(y, m);
          return response.data;
        } catch (error) {
          console.log(`⚠️ [useCalendarEvents] 서버 요청 실패 (${y}-${m}) - 로컬 데이터 사용`);
          
          // 1. 전체 캐시 확인
          const allTodos = queryClient.getQueryData(['todos', 'all']);
          if (allTodos) {
            const filtered = filterByMonth(allTodos, y, m);
            console.log(`✅ [useCalendarEvents] 캐시에서 필터링 (${y}-${m}):`, filtered.length, '개');
            return filtered;
          }
          
          // 2. AsyncStorage 확인
          console.log(`📂 [useCalendarEvents] 캐시 없음 - AsyncStorage 확인 (${y}-${m})`);
          const storedTodos = await loadTodos();
          const filtered = filterByMonth(storedTodos, y, m);
          
          // 3. 전체 캐시에 저장
          queryClient.setQueryData(['todos', 'all'], storedTodos);
          
          console.log(`✅ [useCalendarEvents] AsyncStorage에서 필터링 (${y}-${m}):`, filtered.length, '개');
          return filtered;
        }
      },
      enabled: isLoggedIn && !!y && !!m,
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    })),
  });

  // ... 나머지 로직 동일 (RRule 전개 등) ...
};
```

**주의사항**:
- RRule 전개 로직은 변경하지 않음
- eventsByDate 생성 로직 유지

**체크리스트**:
- [ ] import 추가
- [ ] queryClient 추가
- [ ] try-catch 추가
- [ ] 전체 캐시 확인 로직 추가
- [ ] 월별 필터링 로직 추가
- [ ] 로그 메시지 개선
- [ ] RRule 전개 로직 유지 확인
- [ ] 컴파일 에러 없음

---

### Step 5: axios 타임아웃 설정 (5분)

**파일**: `client/src/api/axios.js`

**작업 내용**:
- timeout 설정 추가

**변경**:
```javascript
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5001/api',
  timeout: 5000, // ⭐ 5초 타임아웃 추가
  headers: {
    'Content-Type': 'application/json',
  },
});
```

**체크리스트**:
- [ ] timeout 설정 추가
- [ ] 컴파일 에러 없음

---

## 🧪 테스트 계획

### 테스트 시나리오

#### 1. 오프라인 최초 실행 테스트 (최우선)

**목적**: Race Condition 해결 확인

**절차**:
```
1. 앱 완전 종료 (백그라운드에서도 제거)
2. 네트워크 오프라인 설정
3. 앱 실행
4. 로그 확인:
   - populateCache 소요 시간 확인 (10ms 이하 예상)
   - useTodos 로그 확인 (캐시에서 필터링 확인)
5. TodoScreen 확인:
   - 데이터 즉시 표시되는지 확인 (100ms 이내)
   - DailyTodoList에 할일 표시 확인
6. UltimateCalendar 확인:
   - 이벤트 점 표시되는지 확인
   - 주간/월간 전환 정상 작동 확인
7. CalendarScreen 이동:
   - 36개월 캘린더 정상 표시 확인
   - 스크롤 부드러운지 확인
```

**예상 결과**:
- ✅ 로딩 시간: ~100ms
- ✅ populateCache: ~10ms
- ✅ 데이터 즉시 표시
- ✅ 모든 화면 정상 작동

**체크리스트**:
- [ ] 오프라인 최초 실행 성공
- [ ] 로딩 시간 100ms 이내
- [ ] TodoScreen 정상 표시
- [ ] UltimateCalendar 정상 작동
- [ ] CalendarScreen 정상 표시

---

#### 2. 온라인 동기화 테스트

**목적**: 서버 동기화 정상 작동 확인

**절차**:
```
1. 네트워크 온라인 설정
2. 앱 재시작
3. 로그 확인:
   - 서버 동기화 성공 확인
   - 캐시 업데이트 확인
4. 데이터 최신 상태 확인
```

**예상 결과**:
- ✅ 서버 동기화 성공
- ✅ 캐시 자동 업데이트
- ✅ 최신 데이터 표시

**체크리스트**:
- [ ] 서버 동기화 성공
- [ ] 캐시 업데이트 확인
- [ ] 최신 데이터 표시

---

#### 3. 캐시 전환 테스트

**목적**: React Query 자동 캐싱 확인

**절차**:
```
1. TodoScreen에서 날짜 변경 (오늘 → 내일)
2. 로그 확인:
   - 첫 번째: 전체 캐시에서 필터링
   - 두 번째: React Query 캐시에서 즉시 반환
3. 다시 오늘로 변경
4. 로그 확인: 캐시에서 즉시 반환
5. UltimateCalendar 주간/월간 전환
6. 정상 작동 확인
```

**예상 결과**:
- ✅ 첫 번째: 필터링 (~1ms)
- ✅ 두 번째: 캐시 즉시 반환 (~0ms)
- ✅ 부드러운 전환

**체크리스트**:
- [ ] 날짜 변경 정상 작동
- [ ] React Query 자동 캐싱 확인
- [ ] 캐시 재사용 확인
- [ ] UltimateCalendar 정상 작동

---

#### 4. CRUD 테스트

**목적**: 캐시 업데이트 정상 작동 확인

**절차**:
```
1. 할일 생성:
   - 새 할일 생성
   - TodoScreen에 즉시 표시 확인
   - CalendarScreen에 표시 확인
2. 할일 수정:
   - 제목 수정
   - 변경사항 즉시 반영 확인
3. 할일 삭제:
   - 할일 삭제
   - 화면에서 즉시 제거 확인
4. 반복 일정 생성:
   - 매일 반복 일정 생성
   - UltimateCalendar에 이벤트 점 표시 확인
   - CalendarScreen에 표시 확인
```

**예상 결과**:
- ✅ 모든 CRUD 정상 작동
- ✅ 캐시 자동 업데이트
- ✅ UI 즉시 반영

**체크리스트**:
- [ ] 할일 생성 성공
- [ ] 할일 수정 성공
- [ ] 할일 삭제 성공
- [ ] 반복 일정 생성 성공
- [ ] 캐시 자동 업데이트 확인

---

## 📊 성능 측정

### 측정 항목

1. **populateCache 소요 시간**:
   ```javascript
   // useSyncTodos.js
   const startTime = performance.now();
   queryClient.setQueryData(['todos', 'all'], todos);
   const endTime = performance.now();
   console.log(`⏱️ [populateCache] ${(endTime - startTime).toFixed(2)}ms`);
   ```

2. **useTodos 필터링 시간**:
   ```javascript
   // useTodos.js
   const startTime = performance.now();
   const filtered = filterByDate(allTodos, date);
   const endTime = performance.now();
   console.log(`⏱️ [useTodos] 필터링: ${(endTime - startTime).toFixed(2)}ms`);
   ```

3. **전체 로딩 시간**:
   ```javascript
   // App.js
   const appStartTime = performance.now();
   // ... 앱 로딩 ...
   const appEndTime = performance.now();
   console.log(`⏱️ [App] 로딩: ${(appEndTime - appStartTime).toFixed(2)}ms`);
   ```

### 예상 결과

| 항목 | 현재 | 최적화 후 | 개선율 |
|------|------|-----------|--------|
| populateCache | 5초 | 10ms | 99.8% ↑ |
| useTodos 필터링 | - | 1ms | - |
| 오프라인 로딩 | 30초 | 100ms | 99.7% ↑ |
| 메모리 사용 | 3MB | 1MB | 66% ↓ |

---

## 🔄 롤백 계획

### 문제 발생 시

**전체 롤백**:
```bash
git checkout main
git branch -D feature/optimize-cache-strategy
```

**특정 파일만 롤백**:
```bash
git checkout main -- client/src/hooks/useSyncTodos.js
git checkout main -- client/src/hooks/queries/useTodos.js
git checkout main -- client/src/hooks/useCalendarEvents.js
```

**안전장치**:
- ✅ 기존 코드 주석 처리 (삭제 X)
- ✅ 브랜치 분리 작업
- ✅ 단계별 커밋
- ✅ 각 단계마다 테스트

---

## 📝 커밋 전략

### 커밋 단위

1. **Step 1**: `feat: add todoFilters utility`
2. **Step 2**: `refactor: simplify populateCache`
3. **Step 3**: `refactor: update useTodos to use single cache`
4. **Step 4**: `refactor: update useCalendarEvents to use single cache`
5. **Step 5**: `feat: add axios timeout`
6. **최종**: `feat: optimize cache strategy (3x → 1x)`

### 최종 커밋 메시지

```
feat: optimize cache strategy (3x → 1x)

- Simplify populateCache: 100+ lines → 10 lines
- Add todoFilters utility (filterByDate, filterByMonth)
- Update useTodos to use single cache with filtering
- Update useCalendarEvents to use single cache with filtering
- Add axios timeout: 5 seconds
- Performance: 99% improvement (35s → 5s offline loading)

BREAKING CHANGE: None (backward compatible)

Closes #[이슈번호]
```

---

## ✅ 최종 체크리스트

### 구현 완료

- [ ] Step 0: 브랜치 생성
- [ ] Step 1: todoFilters 생성
- [ ] Step 2: populateCache 단순화
- [ ] Step 3: useTodos 수정
- [ ] Step 4: useCalendarEvents 수정
- [ ] Step 5: axios timeout 설정

### 테스트 완료

- [ ] 오프라인 최초 실행 테스트
- [ ] 온라인 동기화 테스트
- [ ] 캐시 전환 테스트
- [ ] CRUD 테스트

### 성능 확인

- [ ] populateCache: 10ms 이하
- [ ] useTodos 필터링: 1ms 이하
- [ ] 오프라인 로딩: 100ms 이하
- [ ] 메모리 사용: 1MB 이하

### 정리

- [ ] 주석 처리된 코드 삭제
- [ ] 불필요한 로그 제거
- [ ] 코드 포맷팅
- [ ] 커밋 메시지 작성
- [ ] PR 생성

---

## 📚 참고 자료

- [React Query - Important Defaults](https://tanstack.com/query/latest/docs/react/guides/important-defaults)
- [Offline First Architecture](https://offlinefirst.org/)
- [AsyncStorage Best Practices](https://react-native-async-storage.github.io/async-storage/docs/advanced/best-practices)
- [캐시 전략 분석 문서](./CACHE_STRATEGY_ANALYSIS.md)

---

## 🎯 다음 단계

구현 완료 후:
1. ✅ 성능 측정 결과 문서화
2. ✅ 팀 공유 및 리뷰
3. ✅ 프로덕션 배포
4. ✅ 사용자 피드백 수집

추가 최적화 고려:
- [ ] 프리페칭 (다음 달 데이터 미리 로드)
- [ ] 낙관적 업데이트 (즉시 UI 반영)
- [ ] 백그라운드 동기화 최적화
