# Todolog 웹 GPT / CoS 인수인계

> **현재 운영 진입점:** [docs/handoff/CURRENT.md](docs/handoff/CURRENT.md).
> 이 문서의 2026-09-25 본문은 제품 freeze와 당시 문맥을 보존하는 역사 자료다. 최신 branch/HEAD/worktree, owner, runtime 경계와 NEXT는 `CURRENT.md`와 실제 Git/runtime을 먼저 확인한다.

기준일: 2026-09-25
코드 기준 커밋: `79cbc8d667019e99799bc4ade545c8085b8cba35`
인수인계 브랜치: `codex/web-gpt-handoff-2026-09-21`
저장소: https://github.com/jwpgdx/todolog

## 지금 어디에서 멈췄는가

사용자는 기능 개발을 멈추고 웹 GPT에서 문서/정책을 먼저 정리했다. D02-D06은 F24-F28로 freeze되었고, `.kiro/specs/todo-screen-v2/requirements.md`, `design.md`, `tasks.md` formal spec은 2026-09-25 사용자 승인을 받았다. 다음 Gate는 H2 환경/workspace 확인이며, 기능 구현·의존성 업데이트·DB 변경은 H2 확인 전 시작하지 않는다.

마지막 기능 작업은 **캘린더 없는 화면의 선택모드와 다중 카테고리 이동**이다. Favorites / All Todos / Category detail에 선택 UI가 부분 구현되어 있다. 하단 네 액션 중 **이동만 연결**되어 있고, 삭제 / 완료 / 즐겨찾기는 미연결이다. 최신 다중 선택부터 SQLite 저장까지의 실제 기기 검증은 남아 있다.

이전 Mac 이전 문서 `NEW_MAC_HANDOFF_2026-07-12.md`는 당시 복원 기록이다. 현재 인수인계는 `docs/handoff/CURRENT.md`에서 시작한다. 기존 대화를 전부 읽거나 과거 실험을 처음부터 반복할 필요는 없다.

## 읽는 순서

1. `AGENTS.md`, `AI_COMMON_RULES.md`: 작업 규칙과 변경 금지 조건.
2. [CURRENT](docs/handoff/CURRENT.md): 현재 중단점, 실제 기준점, owner, runtime 경계와 NEXT.
3. 이 문서: 2026-09-25 freeze와 인수인계 역사 문맥.
4. [구현 감사표](docs/handoff/IMPLEMENTATION_AUDIT.md): 코드 근거, 구현 누락, 검증 수준.
5. [결정 목록](docs/handoff/DECISIONS.md): 최신 freeze(F24-F28)와 보류 범위.
6. `.kiro/specs/todo-screen-v2/requirements.md`, `design.md`, `tasks.md`: 승인된 첫 production milestone 계약.
7. [실행 가이드](docs/handoff/EXECUTION_GUIDE.md): 환경 복원, 기기 연결, 검증, 후속 작업 순서.
8. 필요한 경우 `PROJECT_CONTEXT.md`, native interaction audit와 원본 정책 문서를 추가로 읽는다.

웹 GPT 첫 메시지는 [시작 프롬프트](docs/handoff/WEB_GPT_START_PROMPT.md)를 사용한다.
이번 세션에서 실제로 확인한 범위와 하지 않은 테스트는 [검증 기록](docs/handoff/VALIDATION.md)에 남겼다.

## 문서를 해석하는 규칙

- **제품 의도**는 사용자의 명시 결정과 freeze 문서로 판단한다. 구현이 다르다고 제품 정책을 자동 변경하지 않는다.
- **현재 구현**은 코드로 판단한다. 문서에 완료라고 적혀 있어도 코드나 검증 근거가 없으면 완료로 취급하지 않는다.
- **현재 동작 보장**은 해당 커밋, 플랫폼, 기기, 날짜의 테스트 결과로만 판단한다.
- 이번 감사는 정적 코드 및 저장소 문서 확인이다. 이번 세션에서 iOS / Android 앱, DB, 서버 동기화를 재실행한 것은 아니다.
- 과거 성공 기록은 보존하되 현재 커밋의 전체 회귀 통과로 확대 해석하지 않는다.
- raw memo, 외부 AI 의견, 이전 prototype, 예전 체크박스는 그 자체로 최신 freeze가 아니다.
- 2026-09-24~25 웹 GPT 검토에서 D02-D06은 사용자가 명시적으로 확정했고 F24-F28로 저장했다. 이후 구현자는 이 결정을 다시 발명하거나 과거 문구로 되돌리지 않는다.

## 전체 상태 요약

| 영역 | 구현 상태 | 검증 해석 |
|---|---|---|
| SQLite / pending sync / recurrence / aggregation | 기반 구현 존재 | 과거 검증 기록 있음. 이번 재실행 없음 |
| iOS NativeManagedList / 정렬 / 즐겨찾기 / 드래그 | 핵심 구현 존재 | 수동 검증 이력 있음. 최신 선택모드 변경과의 회귀 필요 |
| Android 카테고리 관리 | native RecyclerView 연결 | 과거 빌드·메뉴·reorder·swipe 검증 기록 있음 |
| Android 일정·즐겨찾기 | fallback / 일부 별도 RN 화면 | native parity 미완성 |
| 선택모드 / bulk 이동 | 정적 안정화 부분 구현 | F24-F28 및 formal spec 승인 완료. `d2d39ac` 이후 transaction/stale/no-op/selection-result 보강이 구현됐고, 실제 iOS/SQLite acceptance는 아직 필요 |
| NativeSelectionList | 색상 / 이동 picker에 적용 | 색상 헤더·단일 이동 과거 검증. 최신 bulk 미검증 |
| TodoScreen v2 native header / 선택 chrome | F25까지 설계 freeze, 구현은 후속 | 첫 milestone에서는 TodoScreen을 제외하고 calendar-free iOS selection/bulk move만 진행 |
| Settings 전체 native 전환 / Account Hub / 테마 preset | 계획 / 부분 기반 | 전체 rollout 미완료, 후순위 |
| My Page 완료 / 예정 / Inbox 전용 route | placeholder | route 존재를 기능 완료로 해석하지 않는다 |
| Todo form redesign | 기존 form과 native session 기반 존재 | 미완성 재설계는 보류 |

## 유지해야 할 핵심 조건

- SQLite local-first. UI 저장 성공은 로컬 transaction 기준. 서버 sync는 pending queue가 처리한다.
- ID는 client UUID, sync 의존 순서는 Category -> Todo -> Completion.
- 날짜는 `YYYY-MM-DD`, 시간은 `HH:mm`, nullable 계약 유지. 사용자 timezone 설정이 기준이다.
- iOS / Android 제품만 개발한다. 웹 개발·Playwright 경로는 이미 은퇴했다.
- RN calendar와 native list를 보존한다. TodoScreen 전체 스크롤 전환은 현재 1차 freeze에 포함되지 않는다.
- `client/modules`는 소스이므로 Git에 포함한다. `client/ios`, `client/android`는 생성물이다.
- Expo Go 대신 development build를 사용한다. Native 코드 변경은 앱 rebuild가 필요하다.
- `.env`, 인증서, 개인 DB, 기기 데이터는 공개 저장소에 올리지 않는다.

## 웹 GPT에서 바로 할 일

formal spec 3종은 2026-09-25 사용자 승인 완료다. 최신 운영 NEXT는 `docs/handoff/CURRENT.md`를 따른다. 새 Mac에서 실제 H2 환경/runtime을 재현한 뒤 **이미 구현된 F28 범위를 먼저 검증**하고, 과거 TODO를 관성적으로 재구현하지 않는다. D02-D06은 다시 토론하지 않는다.

CoS는 사용자가 연결할 실행 도구다. 이 인수인계만으로 웹 대화에 파일·로컬 Mac·연결 휴대폰 접근 권한이 생기지 않는다. 아직 지정된 웹 대화로 이 문서를 전송하거나 CoS 로컬 실행을 검증하지 않았다.
