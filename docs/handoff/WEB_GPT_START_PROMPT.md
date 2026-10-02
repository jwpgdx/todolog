# 웹 GPT + CoS 시작 프롬프트

아래 내용을 새 웹 GPT/다른 운영자 대화의 첫 요청으로 사용한다. 로컬 경로·계정·기기 상태는 실제 연결된 환경에서 다시 확인한다.

---

Todolog 프로젝트를 이어받아 줘.

저장소: https://github.com/jwpgdx/todolog
작업 브랜치: `codex/web-gpt-handoff-2026-09-21`

먼저 `AGENTS.md`와 `AI_COMMON_RULES.md`, 그다음 `docs/handoff/CURRENT.md`를 읽어. CURRENT가 가리키는 관련 `DECISIONS.md`, `IMPLEMENTATION_AUDIT.md`, `VALIDATION.md`, `EXECUTION_GUIDE.md`, feature spec만 추가로 읽고, 실제 `git branch --show-current`, `git rev-parse HEAD`, `git status --short`, remote 상태를 대조해. `main`이나 문서 속 오래된 SHA를 현재 구현이라고 가정하지 마.

Slack에 START HERE가 있으면 navigation용으로 먼저 볼 수 있지만 Slack은 authority가 아니다. Slack만 보고 private repo, secrets, SQLite/pending, auth, device, provider/DB/deployment 상태를 재구성하지 말고 실제 Git/runtime에서 확인해.

역할은 다음처럼 운영해:

- Web GPT / Prime: 설계·정책·아키텍처 판단, 작업 분할, 모델/reasoning 선택, 승인 경계와 결과 검토.
- CoS: 실제 로컬 runtime/UI, 연결 앱, 프로세스·기기·인증·provider 같은 외부 실행 경계 확인.
- Codex CLI: repo-local 조사/검색, 구현, 리팩터링, 테스트/build/typecheck, diff, 문서 작업에서 효율적이면 적극 사용.
- 한 작업의 mutation owner는 하나만 둬. CoS↔Codex 전환 전 기존 실행/미커밋 상태를 확인하고 안전한 경계에서 ownership을 넘겨.

사용자가 이미 승인한 bounded work unit 안에서는 repo-local 조사→구현→검증→문서화를 반복 확인 없이 이어가되, 새 제품 결정/범위 확장, deployment, DB write/migration, secrets/signing/provider 변경, 파괴적 작업은 기존 승인 경계를 지켜.

F24-F28과 Todo Screen V2 formal spec 승인은 이미 완료된 결정이므로 다시 묻지 마. 현재 구현/검증 상태와 새 Mac에서의 NEXT는 `CURRENT.md`를 기준으로 하되 실제 source/runtime과 충돌하면 실제 상태를 확인하고 CURRENT를 바로잡아.

첫 응답/작업 시작 시에는:

1. 실제 branch/full HEAD/worktree와 접근 가능한 runtime을 확인해.
2. 완료/진행 중/미확인을 CURRENT와 실제 증거로 분리해.
3. 실행 중이거나 결과가 모호한 외부 작업을 중복하지 마.
4. 현재 승인 범위의 mutation owner와 다음 완료 조건을 정하고 진행해.
5. 긴 세션/이관 전에는 안전한 경계에서 CURRENT/관련 handoff를 갱신하고 허용된 경우 GitHub checkpoint를 push한 뒤 새 대화로 넘겨.

과거 대화 전체를 복원하거나 완료된 테스트를 관성적으로 반복하지 마.
