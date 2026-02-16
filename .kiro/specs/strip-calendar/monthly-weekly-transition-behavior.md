# Strip Calendar: monthly -> weekly 전환 시 표시 주차 동작 분석

작성일: 2026-02-16  
대상: Strip Calendar 유지보수/개선 개발자

## 1. 문서 목적

`monthly -> weekly` 전환 시 weekly 화면에 어떤 주가 표시되는지, 현재 구현의 실제 동작을 코드와 함께 명확히 정리한다.  
본 문서는 "파일을 직접 열어 추적하지 않아도" 이해 가능하도록 핵심 코드 발췌를 포함한다.

## 2. 현상 요약

아래 두 시나리오에서 weekly 복귀 결과가 다르게 보인다.

1. `weekly -> monthly -> monthly 스크롤 -> weekly`  
monthly에서 맨 위에 보이는 주와 다르게, 이전 weekly에서 보던 주가 표시되는 케이스가 있다.
2. `weekly(arrow로 주 이동) -> monthly -> monthly 스크롤 -> weekly`  
monthly에서 맨 위에 보이는 주가 weekly에 표시되는 케이스가 있다.

## 3. 결론(핵심)

현재 구현은 "항상 currentDate 기준 주를 표시"하지 않는다.  
실제 우선순위 충돌 포인트는 `weeklyTargetWeekStart`이다.

1. `monthly -> weekly` 전환 자체는 `monthlyTopWeekStart`를 우선 사용하도록 되어 있다.
2. 그러나 weekly 렌더 타깃 결정에서 `weeklyTargetWeekStart`가 최우선이라, 이 값이 남아 있으면 monthly에서 정한 값을 덮어쓴다.
3. `weeklyTargetWeekStart`는 `onWeeklySettled`에서만 정리(null)되므로, 특정 흐름에서 stale 상태가 유지될 수 있다.

## 4. 코드 근거 (핵심 발췌)

### 4.1 currentWeekStart는 currentDate 기반 계산값

```js
// client/src/features/strip-calendar/hooks/useStripCalendarController.js
const currentWeekStart = useMemo(
  () => toWeekStart(currentDate, startDayOfWeek),
  [currentDate, startDayOfWeek]
);
```

### 4.2 monthly -> weekly 전환 시 컨트롤러 기준

```js
// client/src/features/strip-calendar/hooks/useStripCalendarController.js
const nextWeek = monthlyTopWeekStart || currentWeekStart;
setWeeklyVisibleWeekStart(nextWeek);
setAnchorWeekStart(nextWeek);
setMode('weekly');
```

정리:
1. `monthlyTopWeekStart`가 있으면 그것을 사용.
2. 없으면 `currentWeekStart`(= currentDate 기반) 사용.

### 4.3 weekly 렌더 타깃 우선순위

```js
// client/src/features/strip-calendar/ui/StripCalendarShell.js
targetWeekStart={
  weeklyTargetWeekStart ||
  weeklyVisibleWeekStart ||
  anchorWeekStart ||
  todayWeekStart ||
  currentWeekStart
}
```

정리:
1. weekly 화면에서 최우선은 `weeklyTargetWeekStart`.
2. `weeklyVisibleWeekStart`보다 `weeklyTargetWeekStart`가 우선한다.

### 4.4 weeklyTargetWeekStart 초기 설정과 해제 시점

```js
// client/src/features/strip-calendar/ui/StripCalendarShell.js (bootstrap)
setWeeklyTargetWeekStart(todayWeekStart);
```

```js
// client/src/features/strip-calendar/ui/StripCalendarShell.js
const onWeeklySettled = (weekStart) => {
  setWeeklyTargetWeekStart(null);
  handleWeeklySettled(weekStart);
};
```

정리:
1. `weeklyTargetWeekStart`는 초기 부트스트랩에서 값이 들어간다.
2. 이 값은 `onWeeklySettled`가 실행될 때만 null로 정리된다.

### 4.5 mode toggle 호출 경로

```js
// client/src/features/strip-calendar/ui/StripCalendarShell.js
if (mode === 'weekly') {
  const preferredWeeklyWeekStart =
    weeklyTargetWeekStart ||
    weeklyVisibleWeekStart ||
    anchorWeekStart ||
    currentWeekStart;

  if (preferredWeeklyWeekStart) {
    setMonthlyTargetWeekStart(preferredWeeklyWeekStart);
  }

  handleToggleMode({ weeklyWeekStart: preferredWeeklyWeekStart });
  return;
}

handleToggleMode(); // monthly -> weekly
```

정리:
1. `weekly -> monthly`는 명시적 옵션(`weeklyWeekStart`)을 넣어 보정한다.
2. `monthly -> weekly`는 옵션 없이 `handleToggleMode()`를 호출한다.

## 5. 시나리오별 상태 해석

### 시나리오 A

`weekly -> monthly -> monthly 스크롤 -> weekly`  
복귀 시 weekly에서 과거 weekly 주가 보이는 경우.

가능한 흐름:
1. `weeklyTargetWeekStart`가 null로 정리되지 않은 상태 유지.
2. `monthly -> weekly`에서 컨트롤러는 `weeklyVisibleWeekStart = monthlyTopWeekStart`를 세팅.
3. 실제 weekly 렌더는 `weeklyTargetWeekStart`를 먼저 사용.
4. 결과적으로 monthly top week가 아닌 기존 weekly target이 노출.

### 시나리오 B

`weekly(arrow 이동) -> monthly -> monthly 스크롤 -> weekly`  
복귀 시 monthly top week가 보이는 경우.

가능한 흐름:
1. arrow 이동 후 settle 사이클을 거치며 `onWeeklySettled` 실행.
2. 이때 `weeklyTargetWeekStart`가 null로 정리.
3. monthly -> weekly 복귀 시 `weeklyVisibleWeekStart`가 우선 적용.
4. 결과적으로 monthly top week가 weekly에 반영.

## 6. 왜 "항상 currentDate 주"로 보이지 않는가

`currentWeekStart`는 fallback 경로일 뿐이다.

1. 컨트롤러 우선순위: `monthlyTopWeekStart || currentWeekStart`
2. weekly 렌더 우선순위: `weeklyTargetWeekStart || weeklyVisibleWeekStart || ... || currentWeekStart`

즉, `currentWeekStart`는 상위 상태값이 없을 때만 사용된다.

## 7. 이슈 정의(개발 관점)

문제 핵심은 아래 한 줄로 요약된다.

`monthly -> weekly` 의도 결정값(`weeklyVisibleWeekStart`)과 실제 렌더 우선값(`weeklyTargetWeekStart`)이 분리되어 있고, `weeklyTargetWeekStart` 정리 시점이 settle 이벤트에만 묶여 있어 모드 전환 결과가 시나리오에 따라 달라진다.

## 8. 참고 파일

1. `client/src/features/strip-calendar/hooks/useStripCalendarController.js`
2. `client/src/features/strip-calendar/ui/StripCalendarShell.js`

