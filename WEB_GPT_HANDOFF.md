# Todolog 웹 GPT / CoS 인수인계

기준일: 2026-09-21
코드 기준 커밋: `79cbc8d667019e99799bc4ade545c8085b8cba35`
인수인계 브랜치: `codex/web-gpt-handoff-2026-09-21`
저장소: https://github.com/jwpgdx/todolog

## 지금 어디에서 멈췄는가

사용자는 기능 개발을 잠시 멈추고, 웹 GPT + CoS에서 문서를 검토하고 미결정을 freeze한 뒤 휴대폰을 연결하여 코딩을 재개하려 한다. 이번 인수인계는 문서 작업이다. 기능 수정, 의존성 업데이트, DB 변경, 새 기기 설치를 포함하지 않는다.

마지막 기능 작업은 **캘린더 없는 화면의 선택모드와 다중 카테고리 이동**이다. Favorites / All Todos / Category detail에 선택 UI가 부분 구현되어 있다. 하단 네 액션 중 **이동만 연결**되어 있고, 삭제 / 완료 / 즐겨찾기는 미연결이다. 최신 다중 선택부터 SQLite 저장까지의 실제 기기 검증은 남아 있다.

이전 Mac 이전 문서 `NEW_MAC_HANDOFF_2026-07-12.md`는 당시 복원 기록이다. 현재 인수인계는 이 문서에서 시작한다. 기존 대화를 전부 읽거나 과거 실험을 처음부터 반복할 필요는 없다.

## 읽는 순서

1. `AGENTS.md`, `AI_COMMON_RULES.md`: 작업 규칙과 변경 금지 조건.
2. 이 문서: 중단 지점과 인수인계 범위.
3. [구현 감사표](docs/handoff/IMPLEMENTATION_AUDIT.md): 코드 근거, 구현 누락, 검증 수준.
4. [결정 목록](docs/handoff/DECISIONS.md): freeze / 미결정 / 보류와 문서 충돌.
5. [실행 가이드](docs/handoff/EXECUTION_GUIDE.md): 환경 복원, 기기 연결, 검증, 후속 작업 순서.
6. `PROJECT_CONTEXT.md`, `README.md`, `ROADMAP.md`, `IMPLEMENTATION_ORDER.md`: 전체 구조와 이력.
7. 선택한 작업에 해당하는 `.kiro/specs/<feature>/`와 원본 정책 문서만 추가로 읽는다.

웹 GPT 첫 메시지는 [시작 프롬프트](docs/handoff/WEB_GPT_START_PROMPT.md)를 사용한다.
이번 세션에서 실제로 확인한 범위와 하지 않은 테스트는 [검증 기록](docs/handoff/VALIDATION.md)에 남겼다.

## 문서를 해석하는 규칙

- **제품 의도**는 사용자의 명시 결정과 freeze 문서로 판단한다. 구현이 다르다고 제품 정책을 자동 변경하지 않는다.
- **현재 구현**은 코드로 판단한다. 문서에 완료라고 적혀 있어도 코드나 검증 근거가 없으면 완료로 취급하지 않는다.
- **현재 동작 보장**은 해당 커밋, 플랫폼, 기기, 날짜의 테스트 결과로만 판단한다.
- 이번 감사는 정적 코드 및 저장소 문서 확인이다. 이번 세션에서 iOS / Android 앱, DB, 서버 동기화를 재실행한 것은 아니다.
- 과거 성공 기록은 보존하되 현재 커밋의 전체 회귀 통과로 확대 해석하지 않는다.
- raw memo, 외부 AI 의견, 이전 prototype, 예전 체크박스는 그 자체로 최신 freeze가 아니다.
- 이번 정리는 새 제품 정책을 결정하지 않았다. 충돌은 결정 목록에 남겼다.

## 전체 상태 요약

| 영역 | 구현 상태 | 검증 해석 |
|---|---|---|
| SQLite / pending sync / recurrence / aggregation | 기반 구현 존재 | 과거 검증 기록 있음. 이번 재실행 없음 |
| iOS NativeManagedList / 정렬 / 즐겨찾기 / 드래그 | 핵심 구현 존재 | 수동 검증 이력 있음. 최신 선택모드 변경과의 회귀 필요 |
| Android 카테고리 관리 | native RecyclerView 연결 | 과거 빌드·메뉴·reorder·swipe 검증 기록 있음 |
| Android 일정·즐겨찾기 | fallback / 일부 별도 RN 화면 | native parity 미완성 |
| 선택모드 / bulk 이동 | 부분 구현 | 아래 감사표의 구현 차이 및 E2E 검증 미해결 |
| NativeSelectionList | 색상 / 이동 picker에 적용 | 색상 헤더·단일 이동 과거 검증. 최신 bulk 미검증 |
| TodoScreen v2 native header / 선택 chrome | 설계 결정, 미적용 부분 존재 | 기존 RN calendar + inline 정렬 버튼 유지 중 |
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

첫 작업은 **결정 목록과 구현 감사표를 읽고 인수인계 이해를 검증하는 것**이다. 이후 미결정 항목을 하나씩 논의하고 확정된 내용만 저장소 문서에 반영한다. 기능 구현은 별도 재개 지시와 실행 환경 확인 뒤 진행한다.

권장 모델은 이번 전체 감사에는 Astra High, 이후 상세 문서·정책 검토에는 Sol High다. 반복적인 문서 반영은 Terra Medium으로 낮출 수 있다. 이는 프로젝트 작업 특성에 따른 추천이며 필수 조건은 아니다. [공식 모델 안내](https://learn.chatgpt.com/docs/models)를 2026-09-21에 확인했다.

CoS는 사용자가 연결할 실행 도구다. 이 인수인계만으로 웹 대화에 파일·로컬 Mac·연결 휴대폰 접근 권한이 생기지 않는다. 아직 지정된 웹 대화로 이 문서를 전송하거나 CoS 로컬 실행을 검증하지 않았다.
