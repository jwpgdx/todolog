# Native Settings Apply Matrix

**작성일:** 2026-03-18
**상태:** Draft
**목적:** Native Settings Subsystem을 우리 앱 화면에 어떻게 적용할지, 어떤 패턴이 필요한지, 무엇을 v1에 넣고 무엇을 미루는지 표 중심으로 정리한다.
**문서 역할:** 적용 매핑 / 우선순위 / 패턴 정리 문서
**함께 보는 문서:** [NATIVE_SETTINGS_SUBSYSTEM.md](/Users/admin/Documents/github/todo/client/docs/NATIVE_SETTINGS_SUBSYSTEM.md)

---

## 1. 이 문서와 아키텍처 문서의 차이

| 문서 | 역할 | 주 내용 |
|------|------|------|
| `NATIVE_SETTINGS_SUBSYSTEM.md` | 상위 아키텍처 기준 문서 | family 구조, contract, renderer split, native module 방향 |
| `NATIVE_SETTINGS_APPLY_MATRIX.md` | 실제 적용 계획 문서 | 우리 화면별 적용안, 필요한 패턴, 필요 없는 것, v1 우선순위 |

---

## 2. 이번 문서에서 확정하려는 것

| 질문 | 이번 문서에서 정리할 답 |
|------|------|
| 설정 row를 전부 따로 만들까 | 아니오 |
| 만능 row 하나로 다 처리할까 | 아니오 |
| 추천 구조는 무엇인가 | 하나의 native list system + 여러 row kind |
| 별도 분리가 필요한 것은 무엇인가 | interactive category, embedded content, selection screen pattern |
| 우리 앱에서 어디에 먼저 붙일 것인가 | 마이페이지, 설정 홈, 언어, 시작 요일, 타임존, 카테고리 관리, 날짜/시간 관련 설정 후보 |
| 테스트/프리뷰 허브 이름은 무엇인가 | `Native Settings Catalog` |
| todo/plain interactive list는 어떻게 할 것인가 | current settings v1과 public family는 분리하고, 내부 plain interactive engine만 공유 |

---

## 3. 핵심 결론

| 항목 | 결론 |
|------|------|
| 기본 방향 | `하나의 리스트 엔진 + 소수의 row family + 데이터 기반 row kind` |
| 피해야 할 것 1 | row마다 전용 native view를 무한히 늘리는 구조 |
| 피해야 할 것 2 | 하나의 만능 셀에 switch/menu/checkmark/date/reorder를 다 숨겨두는 구조 |
| v1 설계 기준 | `SettingsList`, `SelectionList`, `CategoryManager`, `PickerHost` 4 family 유지 |
| row 레벨 해석 | 기능은 row kind로 나누고, 렌더링 패밀리는 적게 유지 |

### 3.1 Settings / Category / Todo 분리 원칙

| public family | 외형 | 의미 |
|------|------|------|
| `NativeSettingsList` | grouped | 설정/마이페이지 메뉴 |
| `NativeCategoryManager` | plain interactive | 카테고리 관리 |
| future `NativeTodoList` | plain interactive | todo 메인, 카테고리 내부 일정, 즐겨찾기 |

핵심 원칙은 `SettingsList`를 todo/plain content list로 재사용하지 않는 것이다.
todo 계열은 같은 native plain interactive engine을 쓰더라도 public facade와 row contract를 별도로 둔다.

---

## 4. 추천 분해 방식

### 4.1 리스트 시스템 관점

| 층 | 추천 구조 |
|------|------|
| 리스트 컨테이너 | family별 native list renderer |
| 표준 row 패밀리 | `StandardSettingsRow` |
| 상호작용 전용 row 패밀리 | `InteractiveCategoryRow` |
| 펼침 콘텐츠 전용 row 패밀리 | `EmbeddedContentRow` |
| selection 화면 | row가 아니라 별도 `SelectionList` screen pattern |

### 4.2 왜 이렇게 나누는가

| 이유 | 설명 |
|------|------|
| 표준 row는 공통성이 큼 | navigation, toggle, menu, action, selectionNavigation은 accessory 조합으로 다룰 수 있음 |
| 카테고리 row는 예외가 큼 | reorder + swipe + long-press menu 조합이 강해서 별도 interaction policy 필요 |
| 펼침 콘텐츠는 성격이 다름 | 날짜/시간/calendar/custom editor는 일반 row와 분리해야 안정적 |
| 선택 화면은 row보다 screen 책임 | 언어/타임존처럼 checkmark + search가 붙는 건 selection screen이 맞음 |
| todo row는 의미가 다름 | 완료 체크, 정렬 모드, 즐겨찾기 액션 등으로 settings row와 계약이 달라짐 |

---

## 5. 현재 논의된 패턴 정규화

| 사용자 설명 | 내부 패턴 이름 | 속한 family | 비고 |
|------|------|------|------|
| 순서 변경 + 밀기 + 꾹 누르기 메뉴 | `interactiveCategoryRow` | `CategoryManager` | reorder + swipe + long-press context action |
| 오른쪽 값 + 화살표로 다음 페이지 이동 | `navigationValueRow` | `SettingsList` | 마이페이지/설정 홈 기본 패턴 |
| 오른쪽 스위치 | `toggleRow` | `SettingsList` | iOS 설정 스타일 토글 |
| 오른쪽 값 + 눌러서 드롭다운/짧은 옵션 메뉴 | `menuRow` | `SettingsList` | 짧은 옵션 집합에 적합 |
| 오른쪽 값/버튼 + 아래로 달력/기타 UI 펼침 | `expandableParentRow` + `embeddedContentRow` | `SettingsList` + `PickerHost` | inline editor host |
| 오른쪽 스위치 상태에 따라 아래 메뉴 추가 노출 | `toggleRow` + child visibility + `embeddedContentRow` | `SettingsList` | switch-dependent child rows |
| 오른쪽 값 + 화살표로 들어가면 체크마크 리스트 | `selectionNavigationRow` + `SelectionList` | `SettingsList` + `SelectionList` | 언어, 타임존, 지역, 정렬 |
| 파란/빨간 텍스트 버튼형 리스트 | `actionRow` / `destructiveActionRow` | `SettingsList` | 로그아웃, 탈퇴, 초기화 |
| 읽기 전용 값만 보여주는 행 | `staticValueRow` | `SettingsList` | 버전, 빌드, 계정 ID, 서버 환경 등 |

---

## 6. v1 row kind 최종 후보

### 6.1 v1에 넣어야 하는 row kind

| row kind | 필요 여부 | 이유 |
|------|------|------|
| `interactiveCategory` | 필수 | 카테고리 관리 핵심 |
| `navigationValue` | 필수 | 설정/마이페이지 기본 이동 패턴 |
| `staticValue` | 필수 | 버전/상태/읽기 전용 정보 표시 필요 |
| `toggle` | 필수 | 설정 화면 기본 토글 |
| `menu` | 필수 | 짧은 선택지/팝업형 옵션 |
| `selectionNavigation` | 필수 | 언어/타임존/정렬류 핵심 |
| `expandableParent` | 필수 | 인라인 editor reveal |
| `embeddedContent` | 필수 | 날짜/시간/custom inline content |
| `action` | 필수 | 일반 액션 텍스트 row |
| `destructiveAction` | 필수 | 파괴적 액션 row |

### 6.2 나중에 고려할 row kind

| row kind | 우선순위 | 이유 |
|------|------|------|
| `detailInfo` | 선택 | 정보 버튼(i) 성격이 분명할 때만 |
| `segmented` | 선택 | 2~5개 단순 상호배타 옵션일 때 |
| `numericControl` | 선택 | stepper/slider 요구가 생길 때 |
| `textInputInline` | 낮음 | 키보드/검증/레이아웃 복잡도 큼 |

---

## 7. screen pattern 최종 후보

| screen pattern | 필요 여부 | 설명 |
|------|------|------|
| `settingsListScreen` | 필수 | 일반 설정 홈/섹션 리스트 |
| `singleSelectionListScreen` | 필수 | 단일 선택 + 체크마크 |
| `searchableSelectionListScreen` | 필수 | 긴 옵션 목록 + 검색 |
| `categoryManagerScreen` | 필수 | 카테고리 reorder/swipe/menu |
| `pickerHostScreen` | 필수 | date/time/custom editor host |
| `multiSelectionListScreen` | 선택 | 여러 항목 선택 요구가 생길 때 |
| `textInputEditScreen` | 선택 | 직접 텍스트 입력 설정이 생길 때 |

---

## 8. 무엇을 각각 따로 만들고 무엇을 묶을 것인가

### 8.1 별도 분리가 필요한 것

| 항목 | 분리 여부 | 이유 |
|------|------|------|
| `interactiveCategoryRow` | 분리 | reorder/swipe/context menu 정책이 표준 row와 다름 |
| `embeddedContentRow` | 분리 | date picker/calendar/custom content는 일반 row와 구조가 다름 |
| `SelectionList` | 분리 | checkmark/search는 row가 아니라 목적지 화면 책임 |
| `PickerHost` | 분리 | date/time/custom editor는 heavy editor host 성격 |

### 8.2 같은 표준 row 패밀리로 묶는 것

| 항목 | 묶는 방식 |
|------|------|
| `navigationValueRow` | 표준 row accessory 조합 |
| `staticValueRow` | 표준 row value 표시 |
| `toggleRow` | 표준 row + trailing switch |
| `menuRow` | 표준 row + trailing menu/value |
| `selectionNavigationRow` | 표준 row + trailing value + disclosure |
| `actionRow` | 표준 row 텍스트 스타일 변경 |
| `destructiveActionRow` | 표준 row 텍스트 스타일 변경 |

### 8.3 결론

| 질문 | 답 |
|------|------|
| 6개를 각각 완전 별도 컴포넌트로 만들까 | 아니오 |
| 만능 1개로 전부 우겨넣을까 | 아니오 |
| 추천 구조 | `표준 row 패밀리 1개 + category 전용 + embedded content 전용 + selection/picker screen 분리` |

`interactiveCategoryRow`와 해당 상호작용 정책은 카테고리 관리 전용이다. 일반 settings/menu list에는 재사용하지 않는다.

---

## 9. CategoryManager 플랫폼별 상호작용 정책

### 9.1 iOS

| 상호작용 | 정책 |
|------|------|
| swipe | quick action 노출 |
| long press | 메뉴/context interaction 진입점 |
| reorder | default baseline은 system-first 경로로 두고, `System + Custom` / `Custom Experiment`는 compare/reference로만 사용 |
| fallback | reorder handle 항상 제공 가능하게 유지 |
| 카테고리 내 일정 수 표시 | 오른쪽 끝 trailing value 영역에 짧게 표시 |
| 우측 accessory | chevron/disclosure 중심 |

### 9.2 Android

| 상호작용 | 정책 |
|------|------|
| swipe | quick action 노출 |
| trailing `...` | action menu 또는 bottom sheet |
| long press | reorder 시작 |
| fallback | 필요 시 drag handle 검토 |
| 카테고리 내 일정 수 표시 | title 아래 subtitle/summary로 표시 |
| 우측 accessory | trailing `...` 버튼 |

### 9.3 결론

| 플랫폼 | 메뉴 진입 | reorder 진입 |
|------|------|------|
| iOS | long press/context menu | system-first baseline + fallback handle (`System + Custom`, `Custom Experiment`는 compare/reference only) |
| Android | trailing `...` | long press |

---

## 10. 현재 앱 화면별 적용 후보

### 10.1 우선 적용 대상

| 화면 | 현재 위치 | 목표 family | 필요한 row/pattern |
|------|------|------|------|
| 마이페이지 메인 | `client/src/screens/MyPageScreen.js` | `SettingsList` | `navigationValue`, `action`, `staticValue` |
| 설정 홈 | `client/src/screens/SettingsScreen.js` | `SettingsList` | `selectionNavigation`, `toggle`, `destructiveAction`, `navigationValue` |
| 언어 설정 | `client/src/screens/settings/LanguageSettingsScreen.js` | `SelectionList` | single-select + checkmark |
| 시작 요일 설정 | `client/src/screens/settings/StartDaySettingsScreen.js` | `SelectionList` | single-select + checkmark |
| 타임존 설정 | `client/src/screens/settings/TimeZoneSettingsScreen.js` | `SettingsList` | `toggle` + `selectionNavigation` + footer/help |
| 타임존 선택 | `client/src/screens/settings/TimeZoneSelectionScreen.js` | `SelectionList` | single-select + checkmark + search 예정 |
| 구글 캘린더 연동 | `client/src/screens/settings/GoogleCalendarSettingsScreen.js` | `SettingsList` | `toggle`, `action`, `staticValue`, loading state |
| 카테고리 관리 | `client/src/components/domain/category/CategoryGroupList.js` | `CategoryManager` | `interactiveCategory`, reorder, swipe, platform-specific contextual actions |

### 10.2 이후 적용 후보

| 화면/영역 | 목표 family | 필요한 row/pattern |
|------|------|------|
| 날짜/시간 관련 설정 | `SettingsList` + `PickerHost` | `expandableParent`, `embeddedContent`, date/time |
| 정렬/지역/표시 기준 선택 | `SelectionList` | single-select 또는 searchable list |
| 앱 정보/버전/동기화 정보 | `SettingsList` | `staticValue` |
| 데이터 초기화/캐시 삭제류 | `SettingsList` | `action` / `destructiveAction` + confirmation |
| todo 메인 화면 | future `NativeTodoList` | completion checkbox, swipe, long-press menu, sort mode, optional manual reorder |
| 카테고리 내부 일정 목록 | future `NativeTodoList` | plain interactive todo list |
| 즐겨찾기 일정 목록 | future `NativeTodoList` | same todo row contract + favorites source/filter |

---

## 11. 화면별 상세 적용안

### 11.1 마이페이지 메인

| 섹션 | 현재 내용 | 추천 패턴 |
|------|------|------|
| 콘텐츠 | 일정 관리, 구글 캘린더 연동 | `navigationValueRow` |
| 설정 및 기타 | 앱 설정, 디버그 | `navigationValueRow` |
| 정보 및 지원 | 공지사항, 리뷰 남기기, 이용약관, 개인정보 처리방침 | `navigationValueRow` 또는 `actionRow` |
| 하단 | 로그아웃, 버전 표시 | `actionRow`, `staticValueRow` |

### 11.2 설정 홈

| 항목 | 추천 패턴 | 메모 |
|------|------|------|
| 테마 | `selectionNavigationRow` | 현재 값 + disclosure |
| 언어 | `selectionNavigationRow` | 현재 값 + disclosure |
| 알림 | `navigationValueRow` 또는 추후 `toggleRow` | 실제 요구 확정 필요 |
| 시작 요일 | `selectionNavigationRow` | 현재 값 + disclosure |
| 완료 항목 숨기기 | `toggleRow` | 즉시 on/off |
| 타임존 | `navigationValueRow` 또는 `selectionNavigationRow` | 자동/수동 정책에 따라 표시 |
| 회원 탈퇴 | `destructiveActionRow` | confirmation 필수 |

### 11.3 타임존 설정

| 항목 | 추천 패턴 | 메모 |
|------|------|------|
| 자동으로 설정 | `toggleRow` | 핵심 |
| 타임존 선택 | `selectionNavigationRow` | auto off일 때 활성화 |
| 하단 설명문 | section footer/help text | auto on/off 설명 |

### 11.4 언어 / 시작 요일 / 타임존 선택

| 화면 | 추천 family | 패턴 |
|------|------|------|
| 언어 설정 | `SelectionList` | single-select + checkmark |
| 시작 요일 설정 | `SelectionList` | single-select + checkmark |
| 타임존 선택 | `SelectionList` | single-select + checkmark + search 예정 |

### 11.5 카테고리 관리

| 항목 | 추천 family | 패턴 |
|------|------|------|
| 카테고리 목록 | `CategoryManager` | `interactiveCategoryRow` |
| 카테고리 메타 정보 | `CategoryManager` | shared `subtitle` 기준. iOS는 trailing count/value, Android는 subtitle/summary |
| 순서 변경 | `CategoryManager` | reorder |
| 삭제/편집 | `CategoryManager` | iOS는 long-press context menu, Android는 trailing `...` action menu |
| 추가 버튼 | `actionRow` 또는 별도 footer action | `카테고리 추가` |

---

## 12. Native Settings Catalog 방향

### 12.1 역할

| 항목 | 내용 |
|------|------|
| 이름 | `Native Settings Catalog` |
| 목적 | row 패턴과 완성형 screen schema를 한 번에 보고 고를 수 있는 테스트/프리뷰 허브 |
| 주 사용처 | 구현 전 조합 확인, 이벤트 확인, 회귀 테스트, 화면 적용 기준점 |
| 핵심 원칙 | row만 나열하지 않고 실제 screen schema 단위도 같이 보여준다 |

### 12.2 들어가야 할 것

| 섹션 | 내용 |
|------|------|
| Row patterns | `navigationValue`, `toggle`, `menu`, `action`, `destructiveAction`, `staticValue` |
| Selection patterns | 언어, 시작 요일, 타임존 |
| Expansion patterns | date/time inline, switch-dependent child |
| Category patterns | iOS/Android 정책 차이를 반영한 `interactiveCategory` |
| Full screen examples | `my-page-main`, `settings-general`, `time-zone-settings` |
| Event log | emitted payload preview |

### 12.3 추천 route

| 경로 | 역할 |
|------|------|
| `client/app/(app)/test/native-settings-catalog.js` | catalog landing |
| `client/app/(app)/test/native-settings-selection.js` | selection preview |
| `client/app/(app)/test/native-settings-category-manager.js` | category manager preview |
| `client/app/(app)/test/native-settings-picker.js` | picker preview |

---

## 13. 날짜/시간 관련 정리

### 13.1 지원 여부

| 기능 | 지원 여부 | 방식 |
|------|------|------|
| 날짜 선택 | 필수 지원 | `UIDatePicker` / Android date picker |
| 시간 선택 | 필수 지원 | `UIDatePicker` / Android time picker |
| 날짜+시간 선택 | 필수 지원 | picker host |
| 카운트다운 타이머 | 필수 지원 | `TemporalConfig.mode = countDownTimer` |
| 달력형 인라인 표시 | 지원 | iOS inline, Android는 dialog/sheet 우선 |

### 13.2 패턴 적용 추천

| 요구 | 추천 패턴 |
|------|------|
| 날짜만 인라인 펼침 | `expandableParentRow` + `embeddedContentRow` |
| 시간만 선택 | `navigationValueRow` 또는 `expandableParentRow` + picker |
| 날짜+시간 함께 | `selectionNavigationRow` 또는 `PickerHost` screen |
| 더 무거운 편집기 | `PickerHost` |

---

## 14. 지금 꼭 넣어야 하는 추가 요소

이 부분은 row 종류를 늘리는 것보다 더 중요하다.

| 항목 | 필요 여부 | 이유 |
|------|------|------|
| `staticValueRow` | 필수 | 버전/상태/읽기 전용 값 표시 |
| section header/footer/help text | 필수 | 설명문과 안내문이 필요 |
| 공통 state layer | 필수 | `enabled`, `disabled`, `selected`, `expanded`, `loading`, `error` |
| destructive confirmation flow | 필수 | 탈퇴/초기화/삭제류 보호 |
| accessibility action/traits | 필수 | reorder, delete, selected, toggle 의미 전달 |

---

## 15. 있으면 좋지만 v1 핵심은 아닌 것

| 항목 | 우선순위 | 이유 |
|------|------|------|
| multi-selection list | 선택 | 지금 바로 필수는 아님 |
| detail info accessory | 선택 | 정보 버튼 수요가 생길 때 |
| segmented row | 선택 | 단순 2~5개 옵션에만 적합 |
| numeric control row | 선택 | 숫자 설정 요구가 생길 때 |
| text input edit screen | 선택 | 직접 문자열 입력 요구가 생길 때 |
| 고급 calendar decoration | 낮음 | v1 핵심이 아님 |

---

## 16. v1에서 굳이 넣지 않아도 되는 것

| 항목 | 이유 |
|------|------|
| 긴 옵션 목록을 `menuRow`로 처리 | 언어/타임존류는 selection screen이 더 맞음 |
| 모든 row에 custom gesture 부여 | 시스템스러움이 깨지고 유지보수 어려움 |
| platform 통일 디자인 강제 | native semantics 우선 |
| 모든 설정을 inline editor로 처리 | 화면 복잡도 증가 |
| 날짜/시간 row를 각각 별도 전용 컴포넌트로 무한 분리 | capability 기반이 더 낫다 |

---

## 17. 필요 / 선택 / 제외 요약

### 17.1 필요

| 분류 | 항목 |
|------|------|
| Family | `SettingsList`, `SelectionList`, `CategoryManager`, `PickerHost` |
| Row | `interactiveCategory`, `navigationValue`, `staticValue`, `toggle`, `menu`, `selectionNavigation`, `expandableParent`, `embeddedContent`, `action`, `destructiveAction` |
| Infra | stable ID, semantic event, section header/footer/help text, confirmation flow, accessibility, common state layer |

### 17.2 선택

| 분류 | 항목 |
|------|------|
| Row | `detailInfo`, `segmented`, `numericControl` |
| Screen | multi-select, text-input edit screen |
| UX | theme token override, additional info button, richer picker presentation options |

### 17.3 제외 또는 후순위

| 분류 | 항목 |
|------|------|
| Architecture | giant universal component, row-per-bridge, giant `Platform.OS` file |
| UX | Android를 iOS처럼 강제 복제 |
| Library | core category manager에 JS drag-and-drop 유지 |
| Scope | Expo Go 대응, `@expo/ui` 기반 core 구현 |

---

## 18. 이 문서를 기반으로 실제 화면에 붙이는 순서

| 순서 | 작업 | 이유 |
|------|------|------|
| 1 | `SettingsList`로 마이페이지 메인 / 설정 홈 패턴 정리 | 가장 공통 패턴이 많음 |
| 2 | `SelectionList`로 언어 / 시작 요일 / 타임존 선택 정리 | 체크마크 선택 리스트 표준화 |
| 3 | `TimeZoneSettings`에서 toggle + child navigation 조합 정리 | switch-dependent pattern 검증 |
| 4 | `CategoryManager`로 카테고리 관리 교체 | interaction-heavy 핵심 검증 |
| 5 | `PickerHost`로 날짜/시간 관련 설정 연결 | temporal editor 확장 |

---

## 19. v1 구현 기준으로 보는 최종 추천

| 질문 | 최종 추천 |
|------|------|
| row를 각각 전부 따로 만들까 | 아니오 |
| 표준 row는 어떻게 처리할까 | accessory/capability 조합으로 묶는다 |
| 카테고리 row는 어떻게 할까 | 별도 interaction row로 분리한다 |
| 언어/타임존 선택은 어떻게 할까 | `selectionNavigationRow` + `SelectionList` 목적지 화면 |
| 날짜/시간은 어떻게 할까 | `expandableParent` + `embeddedContent` 또는 `PickerHost` |
| 빨간/파란 텍스트 row는 어떻게 부를까 | `actionRow`, `destructiveActionRow` |

---

## 20. 다음 단계

| 순서 | 작업 |
|------|------|
| 1 | 이 문서에서 화면별 적용안과 우선순위를 수정 |
| 2 | 아키텍처 문서와 함께 비교해 중복/충돌 정리 |
| 3 | 두 문서를 기준으로 `.kiro/specs/native-settings-subsystem/` 분해 |
| 4 | `requirements`, `design`, `tasks`로 전환 |
