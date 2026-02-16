좋은 분석이고, 적용 가능합니다.
다만 그대로 2번만 넣으면 1번 이슈는 남습니다.

핵심 판단

1번 원인 진단은 정확합니다.
weeklyTargetWeekStart가 남아 있으면 monthlyTopWeekStart를 덮어씁니다.
근거: StripCalendarShell.js (line 332)
2번 로직도 맞습니다.
monthlyTopWeekStart 기준으로 현재 주가 0~4주 범위면 currentWeekStart를 쓰는 방식은 타당합니다.
근거: MONTHLY_VISIBLE_WEEK_COUNT=5, stripCalendarConstants.js (line 9)
중요 보완점

handleToggleMode(컨트롤러)만 바꾸면 부족합니다.
렌더 우선순위 1순위인 weeklyTargetWeekStart를 비우지 않으면 여전히 override 됩니다.
즉, 1번 이슈 해결은 Shell 레벨에서 타겟 정리가 반드시 같이 들어가야 합니다.
2번 이슈 해결은 전환 시 nextWeek 선택 로직을 넣으면 됩니다.
권장 구현(최소 변경, 안정성 높음)

monthly -> weekly 전환 직전에 setWeeklyTargetWeekStart(null) 수행
위치: StripCalendarShell.js (line 277) 주변
monthly settle 시에도 방어적으로 weeklyTargetWeekStart 정리
위치: StripCalendarShell.js (line 300) 주변
nextWeek 선택 시 규칙 적용
monthlyTopWeekStart 기준으로 currentWeekStart가 월간 viewport(5주) 안이면 currentWeekStart, 아니면 monthlyTopWeekStart
가시성 판정 유틸은 일반화 추천
현재 isTodayVisibleInMonthlyViewport(...)는 이름이 today 전용이라, isDateVisibleInMonthlyViewport(...)로 분리하는 게 유지보수에 좋습니다.
위치: stripCalendarDateUtils.js (line 33)
더 나은 방법(중장기)

weeklyTargetWeekStart를 “애니메이션 중 임시값”으로만 쓰고, 모드 전환 시에는 항상 비우는 정책으로 통일
weekly 렌더 우선순위를 상황 기반으로 분기
예: weekly 모드 내 네비게이션 동작일 때만 target 우선, 모드 전환 복귀는 visible 우선
이렇게 하면 지금 같은 시나리오 의존 동작 차이가 사라집니다.
주의할 점

monthlyTopWeekStart는 settle 이후 값입니다.
사용자가 스크롤 중간에 바로 토글하면 “보이는 화면”과 다를 수 있습니다.
이 케이스까지 맞추려면 월간의 실시간 top offset을 별도로 들고 있어야 합니다.
요약하면, 제안하신 방향은 맞고 실무 적용도 가능합니다.
단, 컨트롤러 수정 + Shell에서 stale target 정리를 같이 해야 완결됩니다.

원하시면 제가 이 방식으로 실제 코드 변경안(최소 diff)까지 바로 적용하겠습니다.