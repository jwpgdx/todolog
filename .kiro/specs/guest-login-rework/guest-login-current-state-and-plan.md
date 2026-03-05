# Guest Login Rework — Current State & Plan

작성일: 2026-03-04  
상태: Option 2(로컬 게스트)로 방향 확정 — 구현/정리 진행 중

## 0) TL;DR

우리는 **로컬 게스트(서버 비의존)** 로 갑니다. 즉 “게스트 시작하기”는 서버 호출 없이 **바로 앱을 사용**할 수 있어야 하고(Offline-first), 서버/계정은 **로그인/가입 시점**에만 연결됩니다.

현재 “게스트 시작하기”가 `POST /api/auth/guest` 500으로 깨지는 이슈가 있지만, 로컬 게스트로 전환하면 **해당 엔드포인트 자체를 더 이상 호출하지 않게** 되어 제품 흐름에서 제거됩니다. (서버 측 500은 별도 청소/호환성 차원에서 처리 가능)

이번 문서의 목표는:
1) **지금 구현이 정확히 어떻게 동작하는지**를 정리하고  
2) **왜 깨졌는지(근본 원인)**를 기록하고  
3) 로컬 게스트로 갔을 때의 **동작 방식 / 결정사항 / 체크리스트 / 실행 계획**을 명확히 하는 것입니다.

### 이번 문서에서 확정한 결정

- ✅ 게스트 시작: **로컬 세션만 생성**(서버 호출 없음)
- ✅ 로컬 게스트 `_id`: **고정값** 사용 (예: `guest_local`)
- ✅ 게스트 sync: **불가** (`isLoggedIn=false` 정책 유지)
- ✅ 게스트 데이터: **살린다** (로그인/가입 시 사용자가 “가져오기”를 선택하면 서버로 이관)
- ✅ 게스트→정회원(기존 계정): 기본은 `.kiro/specs/guest-data-migration/*` 플로우를 **재사용**하되, 필요하면 새로 설계해도 됨
- ✅ 사용자 식별자: 내부/클라 모델의 표준 키는 `_id` (서버 Auth 응답도 `_id`를 포함하도록 정리)

### 현재까지 반영된 정리(중요)

- 서버 Auth 응답의 `user`에 `_id`를 추가해 **`id` vs `_id` shape 불일치 리스크를 제거**했습니다.
- 클라 `authStore`는 저장/로드 시 `id → _id` normalize를 수행해서, 기존 저장 데이터가 `id`만 있어도 안전합니다.

---

## 1) 현재 구현 (AS-IS)

### 1.1 게스트 시작(Welcome → Guest)

- 진입: `client/src/screens/WelcomeScreen.js`의 “시작하기” 버튼
- 호출: `useAuthStore().loginAsGuest()` (`client/src/store/authStore.js`)
- 동작:
  1) `Crypto.randomUUID()`로 `userId` 생성
  2) `POST /auth/guest` 호출 (`client/src/api/auth.js`)
  3) 응답의 `accessToken`, `refreshToken`, `user`를 AsyncStorage에 저장
  4) Zustand state 업데이트 (`token`, `user`, `isLoggedIn=false`)

### 1.2 서버 게스트 생성 API

- 라우트: `POST /api/auth/guest` (`server/src/routes/auth.js`)
- 컨트롤러: `exports.createGuest` (`server/src/controllers/authController.js`)
- 동작:
  - 클라가 보낸 UUID(`userId`) 유효성 검증 후 MongoDB `User` 생성
  - Inbox 카테고리 생성
  - JWT Access/Refresh 발급 및 refreshToken 저장

### 1.3 동기화 서비스(Sync)

- `client/src/services/sync/index.js`
- `isLoggedIn === false`면 동기화 전체 스킵:
  - 로그 예: `⏭️ [useSyncService] 로그인 안됨 - 스킵`
- **중요:** 현재 `authStore.loginAsGuest()`는 게스트를 `isLoggedIn=false`로 두기 때문에, “서버 게스트”를 만들더라도 **게스트 상태에서는 sync가 돌지 않음**.

### 1.4 게스트 → 정회원 전환(ConvertGuest)

- 화면: `client/src/screens/ConvertGuestScreen.js`
- 호출: `POST /auth/convert-guest` (`server/src/controllers/authController.js`의 `exports.convertGuest`)
- 특이점:
  - 서버 라우트는 auth middleware를 타므로 “토큰이 있는 상태”를 전제로 함.
  - 전환 API는 **유저 계정만 local로 바꾸고(email/password 저장)**, 로컬 SQLite 데이터를 서버로 올리는 로직은 별도로 없음.
  - 기존 설계에서 “게스트도 sync를 수행한다”는 가정이 있었으면 맞지만, 현재는 `isLoggedIn=false`라서 데이터가 서버로 안 올라갈 수 있음.

### 1.5 게스트 데이터 마이그레이션(Guest → Existing Regular Account)

이미 별도 스펙/구현이 존재:
- 스펙: `.kiro/specs/guest-data-migration/*`
- 서버: `POST /auth/migrate-guest-data` (`server/src/controllers/authController.js: exports.migrateGuestData`)
- 클라: `authStore.migrateGuestData()` (`client/src/store/authStore.js`)

이 플로우는 “SQLite에 있는 게스트 데이터를 기존 계정으로 insert”하는 방향이라, **로컬 게스트 모델과도 호환**될 수 있음.

---

## 2) 현재 발생한 장애(Observed)

### 2.1 게스트 시작하기가 500으로 실패

클라이언트:
- `POST http://localhost:5001/api/auth/guest 500 (Internal Server Error)`

서버:
- `MongoServerError: E11000 duplicate key error ... users index: email_1 dup key: { email: null }`

### 2.2 원인(Direct root cause)

`User.email`은 `unique: true` + `sparse: true`로 선언되어 있음 (`server/src/models/User.js`).

그런데 `createGuest`는 게스트 생성 시 `email: null`을 “명시 저장”함 (`server/src/controllers/authController.js`의 `createGuest`).

MongoDB의 unique sparse index 동작 특성상:
- **필드가 “아예 없는” 문서**는 sparse index에서 제외됨 → 여러 개 가능
- **필드가 존재하면서 값이 null인 문서**는 index에 포함됨 → unique 조건 때문에 **null은 1개만 허용**

즉, 첫 번째 게스트가 `email: null`로 저장된 이후부터는 다음 게스트 생성이 모두 `dup key { email: null }`로 실패할 수 있음.

---

## 3) “설계 레벨”로 이미 깨져있는 부분 (구조적 문제)

### 3.1 게스트가 서버 계정인지/로컬 세션인지가 혼재

현재 구현은:
- 게스트 시작 시 서버에 유저를 만들고 토큰을 받음(서버 게스트)
- 그런데 sync는 `isLoggedIn=false`면 스킵(게스트는 동기화 안 함) → 로컬 게스트처럼 동작

결과적으로:
- ConvertGuest(서버에서 게스트→정회원 전환)만으로는 로컬 데이터가 보장되지 않을 수 있음
- “오프라인-퍼스트” 관점에서 첫 진입이 서버 의존적이어서 UX가 취약함

### 3.2 사용자 객체 shape 불일치 가능성

서버 응답 user는 `id` 필드를 내려주는데(예: `{ id: user._id, ... }`),
클라 `authStore`의 일부 로직은 `user._id`를 기준으로 게스트 여부를 판정함.

이런 “user.id vs user._id” 혼재는:
- 로그인 상태 판정(`isLoggedIn`) 오판
- sync 트리거 오작동
- 게스트/정회원 전환 후 상태 꼬임

---

## 4) 목표(TO-BE) — 이번에 “게스트 로그인 방식을 조금 바꾼다”의 의미

우리는 아래를 명확히 합니다:

1) **오프라인에서도 앱을 바로 쓸 수 있어야 한다** → ✅ Yes (로컬 게스트)  
2) 게스트 상태에서 서버 동기화를 할지 말지 → ✅ No (게스트는 동기화 안 함)  
3) “게스트 → 정회원 전환”에서 로컬 데이터 보존/이관 보장 → ✅ 기존 `guest-data-migration`로 보장  

---

## 5) TO-BE 상세 — 로컬 게스트는 어떻게 동작해야 하나?

### 5.1 게스트 시작(Welcome → Local Guest)

목표: 서버/네트워크/DB 상태와 무관하게 “시작하기”가 성공해야 함.

- 입력: 없음(또는 기기 timezone)
- 동작(클라):
  - `loginAsGuest()`는 **서버 호출을 하지 않는다**
  - 로컬 게스트 user를 생성하고 AsyncStorage에 저장한다
  - `token/refreshToken`은 비워둔다(또는 제거)
  - `isLoggedIn=false` 유지 → sync는 안 돈다

권장 user shape(로컬 게스트):
- `_id`: `guest_local` (고정값)
- `accountType`: `'anonymous'`
- `provider`: `'local'`
- `name`: `'Guest User'` (UI 표시용)
- `email`: `null`
- `settings`: 최소 기본값 + device timezone 주입

이렇게 하면:
- `ProfileScreen`의 게스트 배너(`accountType === 'anonymous'`)가 정상 노출
- settings 업데이트도 `authStore.updateSettings()`로 로컬에서 즉시 반영 가능

### 5.2 로그인/가입(Regular User)과 게스트 데이터 처리

핵심 목표: **게스트로 만든 SQLite 데이터가 “사라지지 않고” 안전하게 이관되거나, 사용자가 의도적으로 버릴 수 있어야 함.**

우리는 이미 존재하는 스펙/구현을 재사용합니다:
- `.kiro/specs/guest-data-migration/*`
- `authStore.checkGuestData() / migrateGuestData() / discardGuestData()` (`client/src/store/authStore.js`)
- 서버 `POST /auth/migrate-guest-data` (`server/src/controllers/authController.js`)

단, 재사용이 “강제”는 아닙니다.
- 현재 구현을 그대로 쓰면 빠르고 안전하지만,
- UX/엔드포인트를 더 단순화(예: 가입+마이그레이션 1-step)해야 하면 새로 설계해도 됩니다.

#### (중요) 로그인 시 UX 타이밍
`guest-data-migration/requirements.md`의 Acceptance Criteria에 따르면:
- 게스트 데이터가 있으면 **로그인 시도 시점에 ActionSheet를 먼저 띄우고**
- 사용자가 “취소”를 누르면 **로그인 자체를 취소**하고 로그인 화면으로 돌아가야 함

즉, 구현은 “로그인 성공 후에 묻기”가 아니라 **로그인 요청 전에 묻기**가 표준입니다.

#### 옵션(로그인 시도 시)
- 가져오기: 마이그레이션 실행 → 성공 시 SQLite 정리 + 서버 데이터로 전환
- 버리기: SQLite 삭제 후 로그인 진행
- 취소: 로그인 중단(아무 것도 변경하지 않음)

#### 가입(ConvertGuest) 방향
로컬 게스트는 서버에 계정이 없으므로 `/auth/convert-guest`의 의미가 약해집니다.
따라서 ConvertGuestScreen은 아래 중 하나로 재설계합니다:

1) **(빠른 경로)** 가입 성공(`/auth/register`) → 바로 `migrateGuestData(email,password)` 호출  
2) **(정석/추후)** `register-with-guest-data` 같은 신규 endpoint로 “가입 + 마이그레이션”을 한 트랜잭션으로 처리

### 5.3 서버 측 `/auth/guest` 500은 어떻게 할까?

로컬 게스트로 전환하면 제품 플로우에서 `/auth/guest` 호출이 사라져서 사용자 영향은 없어집니다.
다만 아래 중 하나는 선택해야 합니다:
- (A) **호환성 유지**: `/auth/guest`는 남겨두되, 500 원인(`email: null` 저장)만 제거
- (B) **정리**: `/auth/guest`와 `/auth/convert-guest`를 deprecated 처리(문서/코드상 더 이상 사용하지 않음)

---

## 6) 결정해야 하는 것(남은 결정)

- [x] 로컬 게스트 `_id` 규칙: `guest_local` (고정값)
- [ ] ConvertGuestScreen UX: “가입 + 마이그레이션”을 (1) 2-step으로 갈지, (2) 신규 endpoint로 1-step으로 갈지
- [ ] `/auth/guest`, `/auth/convert-guest` 처리: 유지(호환) vs deprecated(정리)
- [ ] 로그인 시 ActionSheet 타이밍: 스펙대로 “로그인 요청 전”으로 맞추는 것으로 확정할지

---

## 7) 실행 계획(Plan) — 로컬 게스트 기준

### Phase 0: 로컬 게스트 전환 준비(완료/진행중)
- [x] user shape `_id` 정합성 확보(서버 Auth 응답 + 클라 normalize)
- [ ] 문서/코드에서 “게스트=서버 계정” 가정 제거

### Phase 1: 게스트 시작을 로컬로 전환(1일)
- [ ] `authStore.loginAsGuest()`에서 `POST /auth/guest` 제거
- [ ] AsyncStorage에 로컬 게스트 user/settings 저장(토큰 없음)
- [ ] 앱 재시작/복귀 시 `loadAuth()`로 동일 guest 세션 복원

### Phase 2: 로그인 시 guest-data-migration UX 연결(1~2일)
- [ ] “기존 회원 로그인” 플로우에서 SQLite guest 데이터 유무 감지
- [ ] ActionSheet(가져오기/버리기/취소) 표시 + 스펙(`.kiro/specs/guest-data-migration/requirements.md`)에 맞춰 동작
- [ ] migrate 성공/실패/취소 시 상태 전이(로그인 진행/중단) 정리

### Phase 3: ConvertGuestScreen 재설계(1~2일)
- [ ] `/auth/convert-guest` 의존 제거
- [ ] 가입 성공 후 guest 데이터가 있으면 마이그레이션(2-step 또는 1-step 중 결정된 방식)

### Phase 4: 서버 정리(선택, 0.5~1일)
- [ ] `/auth/guest` 500 원인 제거 또는 deprecated 처리
- [ ] `/auth/convert-guest`의 의미 재정의/정리(로컬 게스트 기준)

---

## 8) QA 체크리스트(최소)

- [ ] **서버 없이도 “게스트 시작” 성공**(완전 오프라인/서버 다운 포함)
- [ ] 게스트로 일정/카테고리 생성 → 앱 재시작 → 데이터 유지
- [ ] 게스트 상태에서 설정 변경(테마/요일 시작/타임존) → 즉시 반영 + 앱 재시작 후 유지
- [ ] 게스트 데이터가 있는 상태에서 기존 계정 로그인 시:
  - [ ] ActionSheet: 가져오기/버리기/취소
  - [ ] 취소 시 로그인 중단(스펙 준수)
  - [ ] 버리기 선택 시 SQLite 정리 후 로그인 진행
  - [ ] 가져오기 선택 시 마이그레이션 성공 → SQLite 정리 → 로그인/동기화 정상
- [ ] ConvertGuest(새 계정)에서도 동일하게 데이터 보존/이관이 가능
- [ ] sync 서비스가 guest 정책과 일치(게스트는 sync 안 돌아야 함)

---

## 9) 관련 파일(Reference)

Client:
- `client/src/screens/WelcomeScreen.js`
- `client/src/store/authStore.js`
- `client/src/api/auth.js`
- `client/src/services/sync/index.js`
- `client/src/screens/ConvertGuestScreen.js`

Server:
- `server/src/routes/auth.js`
- `server/src/controllers/authController.js` (`createGuest`, `convertGuest`, `migrateGuestData`)
- `server/src/models/User.js` (email unique+sparse)

Existing Spec:
- `.kiro/specs/guest-data-migration/requirements.md`
- `.kiro/specs/guest-data-migration/design.md`
- `.kiro/specs/guest-data-migration/tasks.md`
