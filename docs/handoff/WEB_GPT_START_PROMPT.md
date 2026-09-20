# 웹 GPT + CoS 시작 프롬프트

아래 내용을 새 웹 GPT 대화의 첫 요청으로 사용한다. 로컬 경로가 다른 경우 실제 연결된 workspace를 사용한다.

---

Todolog 프로젝트를 이어받아 줘. 지금은 기능 개발을 멈추고 문서를 정리·검토하고 미결정을 하나씩 freeze하는 단계다. 문서 검토가 끝나고 내가 코딩을 재개하자고 할 때, CoS로 연결한 Mac/휴대폰에서 개발할 예정이다.

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
- 최신 bulk 실제 저장 E2E는 남아 있고, 코드 감사에서 target-category no-op, 화면 순서, 성공 후 selection 종료 등의 차이를 찾았다.
- TodoScreen은 native header / RN title+calendar / native list scroll 골격으로 freeze했으나 실제 v2 rollout은 미완료다.
- Settings 전체 native migration / Account Hub / Material 테마 rollout / Todo form redesign은 후순위다.

진행 원칙:

- freeze된 요구와 구현 완료를 구분한다. 코드 존재와 테스트 통과도 구분한다.
- 내가 확정한 결정을 임의로 바꾸거나 과거 외부 AI 의견으로 대체하지 않는다.
- 미결정은 한번에 하나씩 쉽게 설명하고 추천 이유를 말한 뒤 논의한다.
- 결정 결과는 대화뿐 아니라 저장소의 해당 spec에 반영한다. 자동으로 다음 구현 Gate를 시작하지 않는다.
- 첫 단계에서 앱 코드 수정, dependency upgrade, Xcode/runtime 재설치, DB 초기화를 하지 않는다.
- 로컬 비밀값, 인증서, 실제 데이터는 공개 문서나 프롬프트에 넣지 않는다.
- CoS가 repo를 읽는 것과 Mac/휴대폰에서 실행·조작할 수 있는 것은 따로 확인한다.

첫 응답은 다음만 부탁한다:

1. 실제로 읽은 branch와 commit, 접근 가능 범위.
2. 현재 완료/부분 구현/미구현 상태와 가장 중요한 문서·코드 차이.
3. 다음 단 하나의 추천 작업과 이유. 우선 결정 목록 D02의 선택 중 데이터 변경/누락 정책을 검토하되, 더 선행하는 근거가 있으면 설명. 이미 freeze된 삭제/이동 정책을 다시 선택하게 하지 말아 줘.
4. 그 작업에 적합한 Codex 모델/추론 수준과 바로 사용할 Codex 작업 프롬프트.

프로젝트 요약을 읽었다고 바로 코딩을 시작하지 말고, 나와 문서 및 결정을 먼저 정리하자.
