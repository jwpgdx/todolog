# Strip Calendar Monthly -> Weekly 전환 최종 결정 문서

작성일: 2026-02-16  
대상: 캘린더 전환 로직 수정 담당 개발자

## 1. 최종 목표

Monthly -> Weekly 전환 시, 아래 규칙으로 **항상 일관된 주차**를 표시한다.

1. 기본은 Monthly에서 현재 보고 있던 맨 위 주(`monthlyTopWeekStart`)를 Weekly에 반영한다.
2. 단, `currentDate`가 현재 Monthly 5주 뷰포트 안에 보이면 `currentWeekStart`를 Weekly에 우선 반영한다.
3. 과거 Weekly 타겟(`weeklyTargetWeekStart`)이 남아서 최신 값을 덮어쓰는 문제를 제거한다.

## 2. 현재 문제의 핵심 원인

`WeeklyStripList`의 렌더 우선순위가 다음과 같아서 stale 값이 남으면 덮어쓴다.

```js
targetWeekStart = weeklyTargetWeekStart || weeklyVisibleWeekStart || ...
```

즉, `monthlyTopWeekStart -> weeklyVisibleWeekStart` 전달이 정상이어도, `weeklyTargetWeekStart`가 null이 아니면 old target이 우선 적용된다.

## 3. 최종 구현 정책

## 3.1 StripCalendarShell에서 stale target 정리 (필수)

파일: `client/src/features/strip-calendar/ui/StripCalendarShell.js`

1. `onMonthlySettled`에서 `setWeeklyTargetWeekStart(null)` 수행
2. `monthly -> weekly` 토글 직전에도 `setWeeklyTargetWeekStart(null)` 수행

의도:
1. 월간에서 최신 위치가 결정됐으면 weekly target 임시값은 폐기
2. 모드 전환 시 남아 있는 stale target을 방어적으로 제거

## 3.2 Controller에서 전환 시 1회 계산 (필수)

파일: `client/src/features/strip-calendar/hooks/useStripCalendarController.js`

`handleToggleMode`의 `mode === 'monthly'` 분기에서 `nextWeek`를 아래 규칙으로 결정:

1. `baseTop = monthlyTopWeekStart || currentWeekStart`
2. `currentDate`가 `baseTop` 기준 5주 viewport 안에 보이면 `nextWeek = currentWeekStart`
3. 아니면 `nextWeek = baseTop`

주의:
1. 계산은 **모드 전환 순간 1회**만 수행
2. `onScroll`에 추가 계산/상태 업데이트를 넣지 않음

## 3.3 Date util 일반화 (권장)

파일: `client/src/features/strip-calendar/utils/stripCalendarDateUtils.js`

현재 today 전용 함수:

```js
isTodayVisibleInMonthlyViewport(topWeekStart, todayDate)
```

권장 추가:

```js
isDateVisibleInMonthlyViewport(topWeekStart, dateYmd)
```

그리고 today 전용 함수는 래퍼로 유지:

```js
return isDateVisibleInMonthlyViewport(topWeekStart, todayDate);
```

## 4. 성능 관점 최종 판단

이 방식이 최선인 이유:

1. 스크롤 중 실시간 계산 없음 (`onScroll` 부하 증가 없음)
2. 모드 전환 시 O(1) 계산 1회만 수행
3. 기존 스냅/정착 파이프라인을 건드리지 않아 리스크가 낮음
4. 상태 업데이트도 기존 전환 경로 내에서만 발생

비권장:

1. `onScroll`에서 매 프레임 `currentDate` 가시성 계산
2. 모드 전환 이외 타이밍에서 target 우선순위를 자주 뒤집는 방식

## 5. 구현 시 주의사항

1. `diffWeeks + new Date()` 신규 도입은 지양  
현재 코드가 `dayjs` 기반이므로 유틸 일관성을 유지한다.
2. 사용자가 월간 스크롤 도중(미정착) 바로 토글하면 `monthlyTopWeekStart`가 최신 화면과 약간 다를 수 있음  
이번 범위에서는 허용한다.
3. 위 케이스까지 완전 대응하려면 월간 실시간 top offset 추적 상태를 추가해야 하며, 이는 성능/복잡도 증가를 동반한다.

## 6. 검증 체크리스트

## 6.1 시나리오 검증

1. `weekly -> monthly -> monthly scroll -> weekly`  
예상: stale weekly target에 끌려가지 않고 규칙대로 표시
2. `weekly(arrow) -> monthly -> monthly scroll -> weekly`  
예상: 월간 최신 top 또는 currentDate 가시성 규칙대로 표시
3. `currentDate`가 월간 화면 내에 보이는 상태에서 Monthly -> Weekly  
예상: `currentWeekStart` 표시
4. `currentDate`가 월간 화면 밖에 있는 상태에서 Monthly -> Weekly  
예상: `monthlyTopWeekStart` 표시

## 6.2 로그 검증

1. `action:handleToggleMode:toWeekly`에서 최종 `nextWeek` 확인
2. 토글 직후 `state:snapshot`에서 `weeklyTargetWeekStart`가 null인지 확인
3. Weekly 마운트 시 `targetWeekStart`가 기대값과 일치하는지 확인

## 7. 적용 우선순위

1. Shell stale target 정리
2. Controller 전환 계산 규칙 적용
3. Date util 일반화(필요 시)
4. 로그 기반 회귀 테스트

## 8. 최종 결론

최종 채택안은 다음 조합이다.

1. `weeklyTargetWeekStart` stale 값 제거 (Shell)
2. Monthly -> Weekly 전환 시 1회 가시성 계산 (Controller)
3. 스크롤 실시간 계산 미도입 (성능 보호)

이 조합이 현재 요구사항(버그 수정 + UX 개선)과 성능 제약을 동시에 가장 안정적으로 만족한다.

