# TODOLOG Current — 운영 상태와 인수인계 진입점

마지막 확인: **2026-10-02 KST**. Git 상태는 이 문서 패키지 시작 시 확인했고, 환경/runtime 항목은 같은 날짜의 제공된 실제 감사 근거다. 이 문서 작업에서 빌드·테스트·runtime 검증을 재실행하지 않았다.

## 저장소와 기준점

- 저장소: https://github.com/jwpgdx/todolog.git
- 활성 브랜치: `codex/web-gpt-handoff-2026-09-21`
- Slack coordination: `#todolog-dev` (`C0C6ANYF4RJ`) in workspace `T0C5V0AB94N`. Slack은 navigation/checkpoint 전용이며 GitHub/runtime authority를 대체하지 않는다.
- 확인된 구현 체크포인트: `b8d334a694b49060b838c41531ebc9a11e5fd359`. 감사 당시 HEAD와 origin의 해당 브랜치가 같았고, 문서 패키지 시작 전 worktree는 clean이었다.
- 감사 당시 `origin/main`: `3105d38e51cbefa22a1ca8ebd3053f611aa65dae`. 작업 브랜치는 **35 ahead / 0 behind**였다. `main`을 현재 구현 기준으로 대신 읽지 않는다.
- 위 SHA는 구현 체크포인트다. 문서 전용 커밋 이후에도 **실제 `git rev-parse HEAD` + worktree가 모든 문서 내 SHA보다 우선**한다. branch, HEAD, status, remote 차이를 인수 시 다시 확인한다. GitHub의 지정 저장소/브랜치가 세션을 넘어 보존하는 기준이며, 미커밋 변경은 로컬 상태로 별도 보고한다.

## 권위와 도구 역할

판단할 때 다음 순서를 사용하되, 제품 의도·현재 구현·외부 상태를 혼동하지 않는다.

1. 사용자의 명시 결정과 승인된 frozen spec: 제품 정책/범위.
2. 실제 Git/source + 해당 커밋의 테스트 근거: 구현 사실. 소스 존재만으로 runtime 합격을 주장하지 않는다.
3. 이 `CURRENT.md`: 현재 운영 스냅샷, 중단점, 다음 작업.
4. [PROJECT_CONTEXT.md](../../PROJECT_CONTEXT.md): 아키텍처·데이터 계약·구현 설명.
5. [DECISIONS.md](DECISIONS.md), 관련 `.kiro/specs/`: 결정 색인과 요구/설계/태스크. 승인된 freeze의 정책 권위는 1번을 따른다.
6. [VALIDATION.md](VALIDATION.md), incident/continuation/handoff: 날짜·커밋·플랫폼별 근거와 이력.
7. 실제 CoS runtime: 프로세스, 인증, 기기, provider 등 일시적 외부 상태는 실제 연결된 환경에서 확인한다. 문서보다 최신인 관측을 기록한다.
8. Slack: 조율과 문서/GitHub 탐색 링크만 제공한다. source of truth가 아니다.

공통 규칙은 [AI_COMMON_RULES.md](../../AI_COMMON_RULES.md)를 따른다.

| 도구 | 역할 |
|---|---|
| Web GPT / Prime | 설계·정책·리뷰·모델 선택/검토 조율, 사용자 승인 확인과 기록. 사용자 승인을 대신하지 않는다. |
| CoS | 실제 로컬 runtime/UI, 연결 앱, 인증·기기·provider 등 외부 경계 확인/실행. 접근 가능 여부부터 확인한다. |
| Codex CLI | 효율적인 repo-local 검색·구현·테스트·빌드·diff·문서 작업. 현재 작업 단위의 허용 범위만 실행한다. |

작업 단위마다 **mutation owner는 한 명/도구만** 둔다. CoS↔Codex 이전 전 실행 중인 명령·빌드·Metro/API·UI 조작과 미커밋 diff를 확인하고, 기존 owner가 안전한 경계에서 멈춘 뒤 새 owner를 기록한다. 동일 worktree/기기에서 동시에 변경하지 않는다.

사용자가 경계가 명확한 작업 단위를 승인하면 그 범위의 repo-local 조사·구현·검증·문서는 매번 재승인 없이 이어간다. 새 제품 결정/정책, 범위 확장, deployment, DB write/migration, secrets/signing/provider 변경, 파괴적 작업은 기존 명시 승인 경계를 따른다. 이 운영 문서 자체는 다음 기능 작업을 승인하지 않는다.

## COMPLETE — 완료 근거가 있는 범위

- F24-F28 freeze와 Todo Screen V2 `requirements.md` / `design.md` / `tasks.md` 사용자 승인은 **2026-09-25 완료**다. 같은 정책이나 formal spec 승인을 다시 요구하지 않는다.
- **2026-09-26 정적 안정화:** `d2d39ac`의 selection membership/화면 순서 분리, target-category no-op, commit-time target/order/exact-set 검증과 atomic bulk move, stale-selection 결과, success exit/tab owner 처리가 구현됐다. `871b338`은 action-bar inset을 보정했다. AllTodos `styles.screen` 누락도 수정됐다. [구현 감사표](IMPLEMENTATION_AUDIT.md)를 참조한다.
- **b8d 구현 체크포인트:** settings/timezone/form, sync local-intent fence/atomic pull, cursor watermark/read-window, recurrence 호환성 hardening이 커밋됐다. source-executing regression과 Android JS/Hermes export의 과거 결과는 [CONTINUATION_2026-09-28.md](CONTINUATION_2026-09-28.md), [VALIDATION.md](VALIDATION.md)에 있다. 이 결과는 live Mongo/device 또는 iOS native 합격 근거가 아니다.
- 과거 iOS/Android native baseline 성공 기록은 해당 날짜/기기 범위에서 보존한다. 현재 HEAD의 전체 회귀 통과로 확대하지 않는다.

## IN PROGRESS — 현재 목표와 미완료 범위

- 사용자는 새 Mac으로 이전할 예정이다. 즉시 목표는 **지정 브랜치/lockfile 복원 → H2 실제 환경/runtime 재현 → 기존 F28 구현 검증**이다. 구현을 처음부터 다시 쓰지 않는다.
- F28 첫 milestone은 **iOS calendar-free AllTodos / Favorites / Category detail의 선택모드 + bulk move 안정화**뿐이다. F27 native summary, selection lifecycle/chrome, SQLite/pending acceptance 및 native interaction 근거까지 포함한다.
- 정적 안정화는 부분 구현이다. native summary/header/menu 잔여 항목, UIKit bounded spike, 실제 list 높이/inset·Back/reentry·SQLite rollback/pending 증거와 milestone closeout은 [tasks.md](../../.kiro/specs/todo-screen-v2/tasks.md) Gates 2/4/7/8/9에 남아 있다. 과거 미수정 목록을 그대로 재실행하지 말고 현재 소스를 확인한다.
- TodoScreen selection, bulk delete/complete/favorite 및 recurrence occurrence snapshot, Android todo/favorite native parity, broader redesign은 후속 범위다. Account Hub/settings/theme rollout, Todo form 전체 재설계, broad dependency upgrade도 자동 시작하지 않는다.

## UNVERIFIED — 현재 환경과 외부 상태

- Windows clone은 문서 패키지 시작 전 b8d에서 clean이었다. 현재 문서 변경은 `git status`로 확인한다.
- 감사 당시 root `.env`, `client/.env`, `client/.env.local`, `server/.env`, `server/.env.local`이 없었다. 실제 값은 추정하거나 문서에 만들지 않는다.
- 감사 당시 활성 TODOLOG runtime 프로세스 및 `5000/5001/8081/8082` listener가 없었다. 이후 상태는 실제 runtime에서 다시 확인한다.
- 실패/중단된 Android compile 뒤 Windows 생성물/cache가 정리됐다. `client/android`, `C:\Users\park\.gradle`은 없고 APK/기기 smoke 성공은 없다. Android Studio/SDK는 D:에서 확인됐다. 자동 compile 재개 금지; 필요 시 [VALIDATION.md](VALIDATION.md)와 continuation의 cleanup 경계를 먼저 읽는다.
- 새 Mac의 OS/CPU/Xcode/SDK/simulator/device/signing/API 상태, 현재 iOS native/SQLite acceptance, live Mongo/device sync는 아직 검증되지 않았다. July native/doctor 기록은 역사다.
- 감사에서 `.github` workflow/deploy config는 발견되지 않았다. deployment/provider production DB 상태는 **미확인**이며 운영 기준으로 사용할 수 없다.

## 상태의 위치와 retry

| 상태 | 보존/확인 위치 |
|---|---|
| 소스·lockfile·승인 spec·운영/검증 기록 | GitHub의 지정 저장소/브랜치. 실제 checkout/HEAD/diff로 확인 |
| SQLite todos/completions/categories, `pending_changes`, guest 데이터 | 해당 simulator/device 로컬. clone·새 chat·Slack으로 복원되지 않음 |
| auth/settings, 인증·서명·secrets, 실행 프로세스 | 실제 계정/로컬 저장소·안전한 비밀 설정 경로/runtime. Git에 없음 |
| MongoDB·Google/provider 연결과 실행 결과·배포 | 실제 연결 환경에서 계정·대상·결과 확인. Slack 메시지로 재구성하지 않음 |

앱의 sync retry/backoff/dead-letter 및 coalescing 예외는 [PROJECT_CONTEXT.md §3.4/§6.2.1](../../PROJECT_CONTEXT.md)와 [sync spec](../../.kiro/specs/sync-service-pending-delta/design.md)을 따른다. 세션 복구를 이유로 pending을 지우거나 전체 재전송/수동 replay하지 않는다. 실제 provider/Google/DB 작업이 timeout·연결 손실로 결과가 모호하면 **자동 재시도하지 않고 실제 runtime/원격 결과를 먼저 조회**한다. 앱의 승인된 retry 계약과 운영자의 외부 작업 재실행은 별개다.

## NEXT — 새 Mac에서의 재개와 완료 조건

1. 기존 clone이 있으면 먼저 변경을 보존하고 branch/HEAD/status/remote를 확인한다. 없으면 지정 브랜치를 복원한다. 실제 Git 상태를 보고하며 `main`/embedded SHA를 현재 HEAD로 대체하지 않는다.
2. [EXECUTION_GUIDE.md](EXECUTION_GUIDE.md)의 H2와 현재 lockfile을 기준으로 환경을 재현한다. 실제 Mac/CPU/OS, Node/npm, Xcode/SDK/runtime, 대상 simulator UDID 또는 device, signing 필요 여부와 도구 접근 범위를 기록한다. 과거 버전 강제 설치나 dependency 자동 upgrade로 시작하지 않는다.
3. owner와 실행 중 상태를 확인하고, 필요한 안전한 설정을 별도 복원한다. 실제 operator/GitHub·앱·provider 계정/권한, 개발 DB 대상, 기기 SQLite/pending 보존 필요를 확인한다. 값은 문서/Slack에 넣지 않는다.
4. 승인된 환경 작업에서 dev build → install → launch → Metro/API 연결(해당 검증에 필요할 때) → UI/log 회수를 재현해 H2 근거를 기록한다. 접근할 수 없는 영역은 미확인으로 남긴다.
5. 기존 F28 구현과 tasks/A01-A13을 대조하고 Gate 8 검증을 수행한다. 새 결함만 승인 범위 안에서 보정하며, production interaction 변경 전 F26 bounded native spike 근거를 확보하고 custom baseline을 보존한다.

**새 기능 확장 전 완료 조건:** H2 대상/연결/빌드·실행·로그 근거, F26 spike/유지 경계, F27 summary와 정상/선택 header/list/inset, 세 화면의 cancel/success/Back/reentry/tab 복원, 역순 tap의 화면순 이동·target no-op·최신 target append·다른 order/date/time 보존, stale/invalid target/실패의 SQLite 전체 rollback 및 pending 0건, 성공한 moved-row pending 일치, 정상 reorder/favorite 회귀를 해당 커밋·기기에서 기록한다. tasks Gate 9와 구현 감사/검증 기록을 갱신하고 사용자 milestone 리뷰 후 다음 단일 범위를 승인받는다. 실제 부족한 근거는 완료로 체크하지 않는다.

## 금지/승인 경계와 인수 절차

- 기존 freeze, offline-first/UUID/Category→Todo→Completion/string date-time 계약을 임의 변경하지 않는다. 미관련 diff를 reset/stash/revert하거나 기기 SQLite/pending을 초기화하지 않는다.
- deployment, DB write/migration, secrets/signing/provider 변경, 파괴적 cleanup은 각각의 명시 승인 없이 실행하지 않는다. 불확실한 production 대상에 검증 데이터를 쓰지 않는다.
- **2026-10-02 운영 세팅 패키지는 문서/coordination만 허용:** 코드·테스트·manifest/lockfile·native 생성물·secrets·DB·배포 상태 변경이나 빌드/테스트는 금지다. 이 운영 문서 세팅을 durable하게 만드는 GitHub checkpoint commit/push와 Slack START HERE 게시만 사용자 요청 범위의 마감 작업으로 허용된다.

인수 순서: **Slack START HERE 링크(있다면) → repo entry/AI_COMMON_RULES → CURRENT → 관련 handoff/decision/incident/spec → 실제 HEAD/worktree → 실제 runtime/auth/device/provider 상태 → 승인된 범위 계속**. Slack 접근이나 이전 대화 전문이 없어도 저장소에서 시작한다. `START.md`는 오래된 helper/history이며 현재 운영 기준이 아니다.

세션 이전은 안전한 작업 경계에서 진행한다. CURRENT와 관련 handoff/validation에 owner, 실제 branch/HEAD/diff, 완료 근거, blocker, 다음 단계를 기록하고, **허용된 세션에서는 GitHub checkpoint를 commit+push한 뒤 새 chat으로 이전**한다. commit/push 금지라면 실행하지 않고 미보존 로컬 상태를 명확히 보고한다. 새 세션은 기록된 완료 작업/검증을 반복하지 않으며, 새 환경이나 변경된 소스로 필요한 재검증만 한다.

Slack 조율 표기는 `START`(START HERE 저장소/진입 링크), `CHECKPOINT`(branch/commit + 근거 링크), `BLOCKER`(관측·필요 조건), `DECISION`(승인 결정의 repo 링크), `RESOLVED`(해결 근거), `NEXT`(다음 승인 범위), `OWNERSHIP`(현재 owner/이전 경계)을 사용한다. Slack의 결정·체크포인트 요약은 repo에 보존되어야 효력이 있으며 secrets/private runtime을 저장하거나 복원하는 수단으로 쓰지 않는다.
