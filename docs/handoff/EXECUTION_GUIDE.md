# 실행 환경과 재개 가이드

기준일: 2026-09-21. 이번 세션은 문서 감사이며 아래 빌드/기기 절차를 새로 실행하지 않았다.

## 1. Git 기준점

- 저장소: https://github.com/jwpgdx/todolog
- 기능 코드 기준: `79cbc8d667019e99799bc4ade545c8085b8cba35`
- 기존 보존 브랜치: `codex/macbook-handoff-2026-07-12`
- 이번 문서 브랜치: `codex/web-gpt-handoff-2026-09-21`
- `main`을 최신 작업이라고 가정하지 않는다. 9월 감사 시작 당시 main과 인수인계 브랜치의 commit은 달랐다.
- 새 환경에서는 clone/checkout 뒤 `git branch --show-current`, `git rev-parse HEAD`, `git status --short`를 보고할 것.

```bash
git clone --branch codex/web-gpt-handoff-2026-09-21 https://github.com/jwpgdx/todolog.git
cd todolog
git status --short --branch
git rev-parse HEAD
```

이미 작업 중인 clone이 있다면 새 clone 명령을 무조건 실행하지 말고 변경/branch부터 확인한다. main merge, force push, reset은 인수인계에 필요하지 않다.

## 2. 재현 기준과 설치물

| 항목 | 보존된 기준 | 새 장비에서 해야 할 일 |
|---|---|---|
| Expo / RN / React | 55.0.24 / 0.83.6 / 19.2.0 | package-lock 재현. 최신 버전 자동 설치 금지 |
| Expo Router | 55.0.14 | 설치된 API/type 기준. 웹 최신 문서의 옵션명 그대로 이식 금지 |
| Node / npm | 이전 Mac 24.14.0 / 11.9.0 기록 | 실행 버전 기록 후 lockfile 재현 |
| macOS / Xcode | 이전 Mac 15.7.3 / Xcode 26.2 기록 | 새 Mac CPU/OS와 호환성 확인. OS downgrade나 과거 Xcode 강제 설치 금지 |
| iOS SDK / runtime | SDK 26.2 / simulator 26.3.1 기록 | SDK와 runtime은 별도. 설치된 실제 이름/UDID 확인 |
| CocoaPods | 이전 Mac 1.16.2 기록 | 새 Mac architecture에 맞춰 설치 |
| Android | 이전 Java 17 / compile SDK 36 계열 기록 | generated Gradle 요구 버전 확인, 새 SDK/NDK/AVD 설치 |
| Emulator | 이전 Intel x86_64 이미지 | Apple Silicon이면 적합한 ARM 이미지로 생성. 구 AVD 복사 금지 |
| API / DB | Express / MongoDB | 별도 비밀 설정 복원, 개발 DB와 계정 확인 |

SDK 55 요구사항은 당시 확인 기록이다. 미래 환경에서 과거 툴체인이 설치되지 않으면 공식 호환표로 원인을 확인한 뒤 별도 변경안을 만든다. 앱 소스를 수정해서 환경 오류를 가리지 않는다.

설치/재생성 대상: Git, Node/npm, iOS용 Xcode/Command Line Tools/CocoaPods, Android용 JDK/Android Studio/SDK, development client. UI 자동화 도구는 필요한 검증 범위에 맞춰 추가한다.

root, client, server 각각의 lockfile에 맞춰 `npm ci`를 실행한다. native 프로젝트가 없으면 Expo run/prebuild 흐름에서 생성한다. `prebuild --clean`을 기본 단계로 쓰지 않는다. 기존 generated native 변경이나 Pod lock이 있다면 먼저 비교한다.

`client/app.json`의 `ios.buildReactNativeFromSource: true`는 기존 header/symbol 불일치 대응이다. 초기 재현 과정에서 임의 제거하지 않는다.

## 3. 별도로 옮겨야 할 설정과 데이터

- `client/.env`, `client/.env.local`, `server/.env`는 Git으로 옮기지 않는다. 값은 공개 문서/웹 프롬프트에 붙이지 않는다.
- iOS 서명 관련 변수 이름은 `EXPO_IOS_APPLE_TEAM_ID`, `EXPO_IOS_BUNDLE_IDENTIFIER`다. `client/app.config.js`, `client/scripts/run-ios-device.js`를 먼저 읽는다.
- API URL은 새 Mac/휴대폰 네트워크에서 접근 가능한 주소로 설정한다. 예전 LAN IP를 복사하지 않는다.
- 기존 시뮬레이터 SQLite, guest 데이터, pending queue는 repo clone으로 옮겨지지 않는다. 보존이 필요하면 별도 export 계획을 세우고 초기화하지 않는다.
- `node_modules`, DerivedData, Gradle cache, CoreSimulator, AVD, generated `client/ios` / `client/android`를 장비 간 복사하지 않는다.
- root `dev:db`는 예전 Intel MongoDB 경로다. 새 환경의 표준 시작 명령으로 사용하지 않는다.

## 4. CoS와 실제 기기 연결 확인

아직 수행하지 않은 확인 항목이다. CoS에 필요한 도구가 없으면 없는 기능을 된다고 주장하지 않는다.

1. 웹 GPT에서 올바른 저장소/브랜치/commit을 읽을 수 있는가.
2. CoS가 어느 Mac의 어느 workspace에서 명령을 실행하는가. 현재 폴더와 CPU/OS를 확인한다.
3. 파일 수정과 diff 확인, Git commit/push가 가능한가. 첫 변경은 작은 문서 변경으로 확인한다.
4. iOS 실기기: 기기 신뢰/Developer Mode/서명 설정과 Xcode 기기 인식을 확인한다.
5. Android 실기기: USB debugging 승인과 `adb devices -l`의 authorized 상태를 확인한다.
6. 기기가 여러 대면 명령마다 UDID/serial을 지정한다. iOS와 Android를 동시에 실행하지 않는다.
7. Metro와 API에 기기가 접근 가능한가. 다른 프로젝트의 포트/Metro와 구분한다.
8. 빌드 -> 설치 -> 앱 실행 -> 화면 확인 -> 로그 수집까지 한 번 통과했는가.

휴대폰을 USB로 연결하는 것만으로 웹 GPT가 화면을 조작하거나 테스트 결과를 알 수 있는 것은 아니다. 실행 도구, screenshot/log 회수, 필요한 수동 조작의 범위를 각각 기록한다.

## 5. 명령 진입점

아래 명령은 해당 폴더에서 실행한다. 자세한 절차는 `CODEX_TESTING.md`와 `client/docs/IOS_SIMULATOR_RUNBOOK.md`를 읽는다.

| 위치 | 명령 | 목적 |
|---|---|---|
| `server` | `npm run dev` | API 시작 |
| `client` | `npm run dev:help` | launcher 옵션 확인 |
| `client` | `npm run dev:server` | Metro만 실행. API server와 혼동 금지 |
| `client` | `npm run dev:ios:sim` | iOS simulator 연결 |
| `client` | `npm run ios -- --device "iPhone 17" --no-bundler` | 해당 simulator가 실제 존재하고 Metro가 실행 중일 때 빌드 |
| `client` | `npm run ios:device` | 로컬 서명/기기 스크립트 확인 후 실기기 빌드 |
| `client` | `npm run dev:android:emu` | Android emulator 연결 |
| `client` | `npm run android` | Android development build |
| `client` | `npm run dev:device` | 물리 기기용 Metro 연결 흐름; native 앱 설치를 대체하지 않음 |

권한/실행 환경 때문에 CLI만 실패하는지 확인하고, 실패했다는 이유만으로 Xcode·runtime·device data를 지우지 않는다. sandbox 사용 여부는 도구의 실제 설정을 따른다.

## 6. 다음 단계와 종료 조건

| 단계 | 범위 | 종료 조건 |
|---|---|---|
| H0: 이번 인수인계 | 정적 감사, 문서 정리, GitHub 보존, 시작 프롬프트 | 문서 diff/경로 검사, 코드 변경 없음, remote commit 일치 |
| H1: 웹 GPT 문서 검토 | D02-D06 정책 freeze, `requirements/design/tasks` formalization | 사용자 검토와 결정 기록. 다음 Gate 자동 시작 안 함 |
| H2: 환경/기기 확인 | CoS workspace + 휴대폰 + dev build + 로그 | 플랫폼별 실제 결과 기록. 먼저 한 플랫폼만 |
| H3: iOS calendar-free 선택/bulk 이동 안정화 | AllTodos/Favorites/Category detail의 selection lifecycle, F27 summary, A01-A06/A08-A10/A12-A13 중 해당 결함 및 bulk move 검증 | 아래 최소 검증 통과 |
| H4: 후속 bulk 액션 | offline-first delete/complete/favorite, occurrence snapshot과 화면 override | transaction/rollback/pending/recurrence별 검증 |
| H5: 후속 범위 선정 | TodoScreen selection, Android todo/favorite native parity 등의 순서 재확인 | 승인된 단일 작업으로 분해 |

F28에 따라 H3는 첫 production milestone로 freeze했다. H2 환경/기기 확인과 formal spec 사용자 검토가 끝나기 전 기능 구현을 시작하지 않는다. H4/H5는 별도 후속 Gate다.

최소 선택/이동 검증:

- 두 row를 화면과 반대 순서로 선택해도 이동 결과는 화면 순서 유지.
- 대상 category 기존 선택 항목은 order/category 변경 없음.
- custom/favorite/date/time 보존, SQLite와 pending payload 일치.
- bulk local 실패는 전체 rollback, 누락 ID를 조용히 부분 성공시키지 않음.
- modal cancel은 원래 선택 유지, 성공은 선택 종료와 tab 복원.
- Back, 화면 재진입, filter/sync 변경, 빈 목록, 마지막 항목 이동.
- iOS header collapse, 전체 목록 높이, action bar inset, 원래 reorder/favorite 회귀.
- Android는 native/fallback 실제 경로별로 따로 결과 기록.

## 7. 검증 기록 형식

각 결과에 날짜, commit, 플랫폼/OS/기기, build 종류, 진입 route, 준비 데이터, 실행 행동, 예상/실제, DB/pending 확인 여부, 로그 위치를 기록한다. 수동 확인과 자동 확인을 구분한다. 화면이 열리는 것과 저장되는 것, 로컬 저장과 서버 sync는 별도 항목이다.

`npm test` 스크립트는 root/client/server package에 현재 없다. 자동 테스트 전부 통과라는 표현을 쓰지 않는다. 이미 은퇴한 Playwright/web 테스트를 새 기기 검증의 필수 조건으로 복원하지 않는다.
