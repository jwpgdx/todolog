/**
 * 기본 레이아웃/데이터 상수
 *
 * 주의:
 * - 여기 값들은 캘린더의 "기하(높이/개수/윈도우 범위)"를 결정한다.
 * - 튜닝값(보정 지연/임계값)과 다르게, 이 값들을 바꾸면 화면 구조 자체가 바뀐다.
 */
export const WEEK_ROW_HEIGHT = 76;
export const MONTHLY_VISIBLE_WEEK_COUNT = 5;
export const WEEK_WINDOW_BEFORE = 520;
export const WEEK_WINDOW_AFTER = 520;
export const WEEKDAY_COUNT = 7;

/**
 * 디버그 스위치
 *
 * DEBUG_STRIP_CALENDAR:
 * - strip-calendar 관련 로그 전체 on/off.
 * - 성능 이슈 분석/스냅 튜닝 중에만 true 권장.
 *
 * DEBUG_STRIP_CALENDAR_WEEK_BANDING:
 * - 주(week) 단위 배경 구분용 시각 디버그.
 * - 레이아웃 겹침/half snap 확인할 때만 사용.
 *
 * STRIP_CALENDAR_DETAIL_LOG_ENABLED:
 * - 요약 한 줄 로그 외 상세 객체 로그를 추가 출력.
 * - 로그량이 많이 늘어나므로 필요 시에만 true 권장.
 */
export const DEBUG_STRIP_CALENDAR = true;
export const DEBUG_STRIP_CALENDAR_WEEK_BANDING = false;
export const STRIP_CALENDAR_DETAIL_LOG_ENABLED = false;

/**
 * Weekly strip 튜닝값
 *
 * WEEKLY_DRIFT_CORRECTION_THRESHOLD_PX:
 * - settle 시 오차 허용 픽셀.
 * - 값이 작을수록 더 빡빡하게 맞춤(정확 ↑, 미세 보정 ↑).
 * - 값이 클수록 느슨하게 통과(정확 ↓, 보정 개입 ↓).
 *
 * WEEKLY_SCROLL_SAMPLE_LIMIT:
 * - onScroll 샘플 로그 최대 개수.
 * - 디버그 가독성/성능 밸런스를 위한 캡.
 *
 * WEEKLY_VIEWABILITY_PERCENT_THRESHOLD:
 * - "현재 보이는 주"로 판정할 가시 비율(%).
 * - 높이면 판정이 보수적, 낮추면 민감하게 바뀜.
 *
 * WEEKLY_LAYOUT_PAGE_DEBUG_SAMPLE_LIMIT:
 * - page layout 로그를 근처 타겟 외에 추가로 찍을 샘플 개수.
 * - 레이아웃 좌표 디버깅이 끝나면 낮게 유지 권장.
 *
 * WEEKLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS:
 * - 웹에서 프로그래밍 스크롤 후 fallback settle 대기 시간.
 * - 애니메이션 체감과 정착 안정성 사이의 타협값.
 */
export const WEEKLY_DRIFT_CORRECTION_THRESHOLD_PX = 1;
export const WEEKLY_SCROLL_SAMPLE_LIMIT = 12;
export const WEEKLY_VIEWABILITY_PERCENT_THRESHOLD = 60;
export const WEEKLY_LAYOUT_PAGE_DEBUG_SAMPLE_LIMIT = 4;
export const WEEKLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS = 220;

/**
 * Monthly strip 튜닝값 (특히 web)
 *
 * MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX:
 * - 정착 시 보정 개입 임계 오차(px). (|drift| > threshold 일 때 보정)
 * - 높이면 보정 횟수 감소, 낮추면 정렬 정확도는 올라가지만 개입이 잦아짐.
 *
 * MONTHLY_WEB_IDLE_SETTLE_DELAY_MS:
 * - 스크롤 멈춤으로 판단하기 전 대기 시간.
 * - 너무 짧으면 감속 중 개입해서 버벅임, 너무 길면 보정이 늦게 느껴짐.
 *
 * MONTHLY_WEB_CORRECTION_COOLDOWN_MS:
 * - 보정 직후 추가 보정을 잠시 막는 쿨다운.
 * - 연쇄 보정 루프를 줄이는 역할.
 *
 * MONTHLY_WEB_INITIAL_IDLE_GUARD_MS:
 * - 마운트/초기 정렬 직후 idle settle 비활성 시간.
 * - initialScrollIndex/프로그램 스크롤 부작용을 막음.
 *
 * MONTHLY_WEB_PROGRAMMATIC_SCROLL_GUARD_MS:
 * - 코드가 일으킨 스크롤 직후 사용자 스크롤로 오판하지 않기 위한 가드 시간.
 *
 * MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX:
 * - 한 번 정착된 뒤, 다음 idle settle을 다시 "활성화(arm)"하기 위한 최소 이동 거리.
 * - 값이 크면 미세 스크롤은 무시, 값이 작으면 작은 이동에도 다시 보정.
 *
 * MONTHLY_WEB_SETTLE_HARD_COOLDOWN_MS:
 * - 정착 직후 강제 재정착을 막는 하드 쿨다운.
 * - 웹에서 무입력 재정착 루프를 끊는 핵심 보호막.
 *
 * MONTHLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS:
 * - 웹에서 programmatic scroll 이후 fallback settle 호출까지의 지연.
 *
 * MONTHLY_MIN_SCROLL_DELTA_PX:
 * - arm 판단 시 무시할 최소 스크롤 변화량.
 * - 트랙패드/브라우저 미세 지터를 사용자 입력으로 오인하지 않게 함.
 *
 * MONTHLY_SCROLL_SAMPLE_LIMIT:
 * - 월간 onScroll 샘플 로그 최대 개수.
 */
export const MONTHLY_DRIFT_CORRECTION_THRESHOLD_PX = 18;
export const MONTHLY_WEB_IDLE_SETTLE_DELAY_MS = 100;
export const MONTHLY_WEB_CORRECTION_COOLDOWN_MS = 220;
export const MONTHLY_WEB_INITIAL_IDLE_GUARD_MS = 360;
export const MONTHLY_WEB_PROGRAMMATIC_SCROLL_GUARD_MS = 320;
export const MONTHLY_WEB_IDLE_REARM_THRESHOLD_PX = WEEK_ROW_HEIGHT;
export const MONTHLY_WEB_SETTLE_HARD_COOLDOWN_MS = 1200;
export const MONTHLY_WEB_PROGRAMMATIC_SETTLE_DELAY_MS = 220;
export const MONTHLY_MIN_SCROLL_DELTA_PX = 1;
export const MONTHLY_SCROLL_SAMPLE_LIMIT = 60;

/**
 * 한 줄 요약 로그에서 우선 노출할 키 순서.
 * - 자주 보는 필드(source, offset, drift, weekStart 등)를 앞에 배치.
 * - 복붙 분석 시 핵심 정보가 먼저 보이도록 유지한다.
 */
export const STRIP_CALENDAR_LOG_PRIORITY_KEYS = [
  'source',
  'mode',
  'offsetX',
  'offsetY',
  'drift',
  'rawIndex',
  'snappedIndex',
  'snappedOffset',
  'index',
  'weekStart',
  'topWeekStart',
  'targetWeekStart',
  'targetTopWeekStart',
  'anchorWeekStart',
  'weeklyVisibleWeekStart',
  'monthlyTopWeekStart',
  'currentWeekStart',
  'todayWeekStart',
  'startDate',
  'endDate',
  'x',
  'y',
  'width',
  'sample',
];
