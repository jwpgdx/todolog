# Requirements: 하이브리드 캐시 전략 리팩토링

## Overview
현재 Todo CRUD hooks의 onSuccess 로직이 복잡한 predicate 기반 캐시 무효화를 사용하고 있어 유지보수가 어렵습니다. Optimistic Update는 유지하면서 onSuccess를 단순화하여 코드 가독성과 유지보수성을 개선합니다.

## User Stories

### US-1: 개발자 생산성 향상
**AS a** developer  
**I WANT** to simplify cache invalidation logic  
**SO THAT** I can maintain and debug the code more easily

### US-2: 사용자 경험 유지
**AS a** user  
**I WANT** instant UI feedback when I interact with todos  
**SO THAT** the app feels responsive and smooth

### US-3: 코드 품질 개선
**AS a** developer  
**I WANT** to remove debug code and unnecessary logs  
**SO THAT** production code is clean and performant

## Acceptance Criteria

### AC-1: Optimistic Update 보존
- [ ] onMutate의 setQueryData 로직은 그대로 유지되어야 함
- [ ] 사용자가 체크박스/버튼을 누르면 즉시 UI가 반영되어야 함 (0ms 딜레이)
- [ ] 서버/DB 응답을 기다리지 않고 UI가 업데이트되어야 함

### AC-2: onSuccess 단순화
- [ ] 모든 hooks의 onSuccess는 3줄 이내로 작성되어야 함
- [ ] predicate 기반 분기 로직을 제거하고 `invalidateQueries(['todos'])` 한 줄로 교체
- [ ] ID 교체, 카테고리 교체 등의 복잡한 로직 제거

### AC-3: 디버그 코드 제거
- [ ] useUpdateTodo.js의 completions 테이블 전체 덤프 코드 삭제 (L201-213)
- [ ] 불필요한 console.log 제거 (performance 측정은 유지)
- [ ] 주석 처리된 코드 제거

### AC-4: UUID 생성 최적화
- [ ] useCreateTodo.js에서 UUID가 단 1번만 생성되어야 함
- [ ] onMutate와 mutationFn에서 동일한 UUID를 사용해야 함
- [ ] Optimistic Todo와 실제 저장된 Todo의 _id가 일치해야 함

### AC-5: 보안 검증
- [ ] 모든 SQLite 쿼리에서 SQL Injection 취약점이 없어야 함
- [ ] String interpolation 대신 파라미터 바인딩 사용 확인

## Glossary

### Optimistic Update
서버 응답을 기다리지 않고 클라이언트에서 먼저 UI를 업데이트하는 패턴. React Query의 `onMutate`에서 `setQueryData`를 사용하여 구현.

### Predicate Invalidation
조건부 캐시 무효화. `queryClient.invalidateQueries`에 predicate 함수를 전달하여 특정 조건에 맞는 쿼리만 무효화.

### Cache Invalidation
캐시된 데이터를 무효화하여 다음 접근 시 새로운 데이터를 fetch하도록 만드는 작업.

### Hybrid Cache Strategy
Optimistic Update (즉시 UI 반영) + Cache Invalidation (최종 정합성 보장)을 결합한 전략.

## Non-Goals

- WatermelonDB, TinyBase 등 다른 데이터 레이어로 전환하지 않음
- SQLite 쿼리 성능 최적화는 이번 스펙의 범위가 아님
- React Query 버전 업그레이드는 하지 않음

## Success Metrics

- onSuccess 코드 라인 수: 평균 50줄 → 3줄 이내
- UUID 생성 횟수: 2회 → 1회
- 디버그 console.log: 50+ → 0
- SQL Injection 취약점: 0개 유지

## Dependencies

- React Query v3/v4 (현재 버전 유지)
- expo-sqlite
- expo-crypto (UUID 생성)

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| invalidateQueries가 모든 쿼리를 무효화하여 성능 저하 | Medium | 현재 단일 캐시 전략(`['todos', 'all']`)을 사용 중이므로 영향 최소 |
| Optimistic Update 제거 시 UX 저하 | High | onMutate는 절대 수정하지 않음 |
| 리팩토링 중 버그 발생 | Medium | 각 hook별로 순차 작업, 수동 테스트 진행 |

## Timeline

- Requirements 검토: 완료
- Design 작성: 30분
- Implementation: 2시간
- Testing: 1시간
- **Total: 3.5시간**
