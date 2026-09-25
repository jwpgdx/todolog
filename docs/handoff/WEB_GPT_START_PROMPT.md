# 웹 GPT + CoS 시작 프롬프트

아래 내용을 새 웹 GPT 대화의 첫 요청으로 사용한다. 로컬 경로가 다른 경우 실제 연결된 workspace를 사용한다.

---

Todolog 프로젝트를 이어받아 줘. 기능 개발은 아직 멈춘 상태다. D02-D06은 이미 F24-F28로 freeze됐고 Todo Screen V2의 `requirements.md` / `design.md` / `tasks.md` formal draft까지 작성됐다. 지금은 이 formal spec을 검토·승인하는 문서 Gate이며, 승인 뒤에도 먼저 CoS/Mac/iOS 환경을 확인한 후에만 첫 production milestone을 시작한다.

저장소: https://github.com/jwpgdx/todolog
브랜치: `codex/web-gpt-handoff-2026-09-21`
기능 코드 기준 commit: `79cbc8d667019e99799bc4ade545c8085b8cba35`
브랜치 HEAD에는 이 기준 코드 위에 인수인계 문서 정리가 들어 있다. main을 대신 읽지 말아 줘.

먼저 `AGENTS.md`, `AI_COMMON_RULES.md`, `WEB_GPT_HANDOFF.md`를 읽고, 연결된 `docs/handoff/IMPLEMENTATION_AUDIT.md`, `DECISIONS.md`, `EXECUTION_GUIDE.md`를 확인해 줘. 이후 PROJECT_CONTEXT/메뉴 구조/triage 등 필요한 근거만 읽어 줘. 저장소에 접근할 수 없거나 지정 branch를 읽을 수 없으면 그 사실을 먼저 말하고 추측으로 현황을 만들지 말아 줘.

핵심 상황:

- Expo SDK 55 / RN 0.83.6 / iOS와 Android 앱이다. 웹 개발은 종료했다.
- SQLite offline-first, 기존 pending sync와 recurrence 계약을 유지한다.
- iOS native list 핵심 상호작용은 구현 및 과거 수동 검증 이력이 있다.
- Android category native는 일부 완료지만 todo/favorite native parity는 미완성이다.
- 마지막 작업은 Favorites / AllTodos / Category detail의 선택모드 및 bulk 이동이다. action bar는 이동만 연결되어 있다.
- 최신 bulk 실제 저장 E2E는 남아 있고, target-category no-op, 화면 순서, stale selection atomicity, success selection 종료 등의 정책은 F24/F28로 확정됐지만 코드는 아직 미반영이다.
- D04는 platform-native 우선으로 freeze됐다: iOS는 system context menu + native collection drag 경로를 먼저 bounded spike하고, Android todo/favorite는 long-press selection + explicit native drag affordance가 후속 계약이다.
- D05는 summary를 native list 내부 non-interactive item으로 두고 selection 중 숨기기로 freeze됐다.
- TodoScreen은 native header / RN title+calendar / native list scroll 및 selection 시 calendar chrome hide/state restore까지 freeze됐지만 첫 production milestone에서는 제외한다.
- Settings 전체 native migration / Account Hub / Material 테마 rollout / Todo form redesign은 후순위다.

진행 원칙:

- freeze된 요구와 구현 완료를 구분한다. 코드 존재와 테스트 통과도 구분한다.
- 내가 확정한 결정을 임의로 바꾸거나 과거 외부 AI 의견으로 대체하지 않는다.
- D02-D06은 이미 freeze됐으므로 다시 선택하게 하지 않는다. 새 미결정이 구현 중 드러나면 그때만 STOP하고 별도 논의한다.
- formal spec 검토 결과만 저장소에 반영하고, 자동으로 다음 구현 Gate를 시작하지 않는다.
- 첫 단계에서 앱 코드 수정, dependency upgrade, Xcode/runtime 재설치, DB 초기화를 하지 않는다.
- 로컬 비밀값, 인증서, 실제 데이터는 공개 문서나 프롬프트에 넣지 않는다.
- CoS가 repo를 읽는 것과 Mac/휴대폰에서 실행·조작할 수 있는 것은 따로 확인한다.

첫 응답은 다음만 부탁한다:

1. 실제로 읽은 branch와 commit, 접근 가능 범위.
2. `.kiro/specs/todo-screen-v2/requirements.md`, `design.md`, `tasks.md`가 F24-F28 및 구현 감사표와 모순되는지 검토한 결과.
3. formal spec에서 사용자 결정을 새로 요구할 실제 미결정이 있는지. 없다면 "추가 freeze 불필요"라고 명확히 말해 줘.
4. 구현은 시작하지 말고, formal spec 승인 뒤 H2 환경/기기 확인에서 첫 번째로 확인할 항목만 추천해 줘.

D02-D06을 다시 토론하거나 코드 구현을 자동 시작하지 말아 줘.
