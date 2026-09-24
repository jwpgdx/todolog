# 결정 목록: Freeze / 미결정 / 보류

기준일: 2026-09-24. 기존 명시 결정과 문서를 정리한 색인이다. 2026-09-21 감사 이후 웹 GPT에서 사용자와 확정한 결정도 여기에 추가한다.
경로는 저장소 루트 기준이다. 구현 여부는 [구현 감사표](IMPLEMENTATION_AUDIT.md)와 별개다.

## 1. 유지할 freeze

| ID | 결정 | 근거 |
|---|---|---|
| F01 | SQLite local-first, UUID, 기존 pending 타입, Category -> Todo -> Completion sync | `AI_COMMON_RULES.md`, `PROJECT_CONTEXT.md` |
| F02 | TodoScreen은 native header / RN title+calendar / NativeManagedList scroll. 전체 단일 스크롤·calendar native 재작성은 1차 제외 | `.kiro/specs/todo-screen-v2/triage.md` layout |
| F03 | 캘린더 없는 native list는 native Stack title/large title + primary UICollectionView. pageTitle spike를 기준 구현으로 되돌리지 않음 | triage header |
| F04 | count/summary는 native list 내부 summary item. 큰 RN 헤더를 native list 앞에 추가하지 않음 | triage summary |
| F05 | Todo 정렬은 시간순/카테고리순. 시간 지정 일정은 lift 가능하되 일반 정렬 위치 변경 불가. 즐겨찾기 이동은 별도 허용 | `메뉴 구조.md` Todo 규칙 |
| F06 | Inbox는 최상단 pinned. 즐겨찾기 상단 section은 빈 상태에서도 존재, 접힘 상태 저장, drop 성공 시 펼침 | `메뉴 구조.md`, `IMPLEMENTATION_ORDER.md` |
| F07 | iOS header 메뉴는 pull-down, Android는 modal bottom/action sheet. 메뉴 데이터 계약은 공유 | triage header menu |
| F08 | 완료 항목 표시 설정은 일정 리스트 화면 간 공유 | triage completed visibility |
| F09 | 선택모드는 현 화면 scope/sort/section 유지. 원래 back 유지, 중앙 일정 선택/n개 선택됨, 오른쪽 완료 | triage, `PRESENTATION_IOS_TEST.md` selection |
| F10 | 선택 중 row tap toggle, completion 자리를 selection control로 대체. swipe/menu/reorder/collapse 비활성화 | 동일 |
| F11 | tab 숨기고 공통 RN action bar. 0개면 disabled. 액션 확장 가능 | 동일 |
| F12 | bulk complete는 반복 일정의 선택 occurrenceDate, 비반복은 completion date null. 이미 완료면 no-op | triage bulk |
| F13 | Favorites 이외에서는 즐겨찾기 추가만, 이미 추가된 항목 no-op. Favorites에서는 해제만. 다른 order lane 유지 | presentation bulk semantics |
| F14 | bulk move는 대상 category 마지막 뒤에 선택된 화면상 순서로 append. 이미 target이면 no-op. custom/favorite order 유지 | triage + presentation bulk semantics |
| F15 | bulk local transaction all-or-nothing, 기존 pending 여러 개. 로컬 성공이면 UI 성공 및 선택모드 종료. 원격 실패는 기존 retry | triage + presentation bulk semantics |
| F16 | 이동 picker는 modal, 취소 / 카테고리 선택 / 이동, row tap은 pending 선택 | presentation picker + `메뉴 구조.md` |
| F17 | 일반 탐색은 push, task는 modal, 짧은 panel은 formSheet 후보, 짧은 interruption은 alert/overlay. 신규 pageSheet 사용 안 함 | presentation 상위 정책 |
| F18 | category form은 modal, form 안 color는 push. color는 pending 선택 후 완료 | presentation category flow + 최신 `메뉴 구조.md`, `CategoryColorScreen.js` |
| F19 | modal도 native Stack header, task modal은 tab 위에서 덮음. root modal 우선 | presentation modal/chrome |
| F20 | 짧은 SelectionList는 non-scroll child, 부모가 scroll. 언어/timezone은 별도 긴 searchable screen, 검색은 header 아래 고정 | presentation selection list |
| F21 | 공통 Material 3 preset token을 content에 적용. 매 render palette 생성 안 함. iOS navigation appearance는 시스템 우선 | `메뉴 구조.md` 색상 정책 |
| F22 | Account Hub는 My Page에서 계정 modal, 내부 상세 push. 프로필/보안/연결 계정/로그아웃/계정 삭제 영역 | presentation Account Hub |
| F23 | category 삭제는 포함 todo/completion cascade와 경고 dialog. bulk 삭제는 확인 필요. 단일 삭제는 후속 freeze의 undo 전 확인 유지 정책을 기준으로 함 | presentation delete, DB 정책 |
| F24 | bulk action 실행 직전 로컬 SQLite 기준으로 선택 집합과 action의 필수 대상을 재검증한다. 선택 항목 중 삭제/tombstone·누락·현재 action scope 무효가 하나라도 있으면 아무 write/pending도 만들지 않고 전체 action을 중단한다. 무효 항목만 선택에서 제거하고 나머지 유효 선택은 유지하며 사용자가 다시 실행한다. 일시적 query/cache 공백은 삭제로 간주하지 않고, 기존 action별 idempotent no-op은 정상으로 본다. 검증과 write는 경쟁 상태로 부분 성공하지 않도록 같은 local transaction 경계에서 보장한다. | 2026-09-24 사용자 확정 D02; `.kiro/specs/todo-screen-v2/triage.md` stale selection policy |
| F25 | TodoScreen도 별도 selection route/page를 만들지 않고 현재 화면 안에서 선택모드로 전환한다. 진입 시 현재 날짜·정렬·section 및 calendar의 mode/viewport 상태를 보존하되 RN title/date/calendar chrome은 화면에서 숨기고 조작할 수 없게 한다. NativeManagedList가 남은 본문 영역을 사용하며 공통 selection header/action bar 계약을 따른다. 선택 종료 시 진입 전 calendar 상태를 복원한다. | 2026-09-24 사용자 확정 D03; `.kiro/specs/todo-screen-v2/triage.md` TodoScreen selection chrome |

F03은 AllTodos 과거 실험의 최종 결론이다. 초기에 pageTitle을 권했던 외부 AI 답변은 최신 freeze가 아니다. F18은 form 내부 color의 예외이며 "모든 선택 화면을 새 modal로 연다"로 확대하지 않는다.

## 2. 웹 GPT에서 논의할 항목

| ID | 질문 | 현재 근거 / 처리 방향 |
|---|---|---|
| D04 | Android todo/favorite long-press·선택·reorder 진입 UX | 메뉴 구조의 long-press reorder와 사용자 후속 선택/순서모드 논의가 함께 존재. category baseline을 전체 화면 freeze로 간주하지 말 것 |
| D05 | summary item의 최종 표시·액션, 선택모드에서 노출 여부 | summary item 방향은 F04. 화면별 문구/지우기 범위/selection 표시 일부는 후보 |
| D06 | 문서 정리 후 첫 구현 범위를 어디까지로 묶을지 | 추천: 환경 확인 후 calendar-free 선택/bulk 이동부터. settings/theme/account를 동시에 펼치지 않음 |

한 번에 모든 질문을 다시 묻지 않는다. D02는 F24, D03은 F25로 2026-09-24 freeze했다. 이제 D04처럼 다음 작업에 영향을 주는 미결정부터 확인하고, 사용자의 결정으로 정해진 항목은 반복 토론하지 않는다. D04는 Android 실제 사용 감각을 확인할 prototype이 필요할 수 있다.

## 3. 논의보다 구현·검증이 필요한 항목

- R01: 단일 삭제는 초기 raw memo의 즉시 삭제 요청 이후 presentation 문서에서 undo 전 확인 유지로 freeze되었다. 최신 정책을 유지하며, 사용자가 변경을 요청하지 않는 한 다시 결정받지 않는다.
- A03 같은 target-category no-op은 이미 F14로 확정됐다. 다시 사용자에게 같은 정책을 선택하게 하지 않는다.
- A06의 missing/stale selection 처리와 A13의 필수 target 유효성은 F24로 확정됐다. 현재 코드는 아직 이 계약을 구현하지 않았으므로 구현·검증 대상으로 남긴다.
- TodoScreen 선택모드 chrome은 F25로 확정됐다. 현재 TodoScreen에는 선택모드 자체가 미연결이므로 calendar hide/state restore와 공통 selection chrome은 구현·기기 검증 대상으로 남긴다.
- bulk 순서 보존과 성공 후 selection 종료도 이미 확정됐다. 코드 수정과 테스트 대상이다.
- native header가 가능한지 다시 처음부터 실험하지 않는다. 현재 wrapper/layout 상태를 먼저 검증한다.
- 색상 staged commit은 현재 코드와 최신 결정이 일치한다. 오래된 immediate-commit 문구는 폐기한다.
- timezone/language 검색 고정은 이미 freeze다. 아직 구현되지 않은 점을 기록한다.
- `requirements/design/tasks`로 승격하는 일은 기존 확정사항을 명확히 옮기는 작업이다. 새로운 기능 승인이 아니다.

## 4. 명시적으로 보류할 일

- Todo form 전체 재설계: 날짜 없음, 반복/알림/picker/input 세부 정책.
- Account Hub 구현, My Page/Settings 전면 native 전환, Material preset 전체 rollout.
- preview 미관 polish 및 사용자 요청 없는 새 디자인.
- TodoScreen one-page-scroll overlay/spacer 실험, calendar native 재구현.
- broad Expo/RN dependency upgrade. 먼저 보존된 lockfile baseline과 새 장비 호환성을 확인한다.
- 현재 목적과 무관한 웹 지원 부활, 구조 전면 재작성.

## 5. 결정 반영 방법

웹 GPT와 결정할 때 ID, 질문, 기존 근거, 결정, 적용 화면/플랫폼, 제외 범위, 검증 조건을 해당 spec에 기록한다. 이 목록에서는 상태와 연결만 갱신한다. 원문 메모와 과거 검증 이력은 삭제하지 않는다.

정책 확인이 끝나면 `.kiro/specs/todo-screen-v2/requirements.md`, `design.md`, `tasks.md`를 필요한 범위로 작성한다. 2026-09-21에는 raw-memo와 triage만 존재한다. 초안 작성 뒤 사용자 검토를 받고, 다음 구현 Gate를 자동 시작하지 않는다.
