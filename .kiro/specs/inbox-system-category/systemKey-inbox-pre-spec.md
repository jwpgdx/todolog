# Inbox(System Category) = `systemKey: 'inbox'` (Pre‑Spec / 적용 검증 메모)

작성일: 2026-03-05  
상태: Draft (스펙 문서 작성 전 “사실/제약/변경점” 검증용)

---

## 0) 결정(Decision)

- Inbox는 **카테고리로 취급한다.**
- Inbox 식별은 **`Category.systemKey === 'inbox'`** 로 한다.
- Todo는 계속 **`categoryId`(string) 필수**를 유지한다. (Inbox도 categoryId를 가진다)
- Inbox seed 전략:
  - 온라인 계정(회원가입/로그인/소셜): **서버가 Inbox를 생성/보정**
  - 게스트(향후 local-only): **클라(SQLite)가 Inbox를 생성** (서버 미의존)
- UI에서는 Inbox를 별도 섹션(상단 고정 메뉴)로 노출하는 UX를 목표로 하되,
  **현 단계에서는 CategoryManagementScreen에서 일반 카테고리 목록 안에 같이 둔다.**
  (단, Inbox row는 잠금 정책을 적용한다)
- 데이터는 **카테고리 1 row**로 유지한다.

이 문서는 위 결정을 우리 코드베이스에서 **깨지지 않게 적용할 수 있는지**를 검증하고,
추후 `.kiro/specs/inbox-system-category/{requirements,design,tasks}.md`로 발전시키기 위한 메모다.

---

## 1) 우리 프로젝트에서 확인된 사실(근거/제약)

### 1.1 Offline-first / Local SOT / Sync order

- SQLite가 로컬 SOT: todos/completions/categories/pending changes는 SQLite가 권위. (`PROJECT_CONTEXT.md`)
- Sync order는 **Category → Todo → Completion** 고정. (`PROJECT_CONTEXT.md`)

### 1.2 Client SQLite 스키마(현재)

파일: `client/src/services/db/database.js`

- `categories` 테이블 컬럼에 `system_key` 없음.
- `todos.category_id TEXT` + FK `REFERENCES categories(_id)` 존재.
- `PRAGMA foreign_keys = ON`을 켠다. (`client/src/services/db/database.js`)
- 중요한 점:
  - 우리는 카테고리 삭제를 “하드 삭제(DELETE)”가 아니라 **소프트 삭제(`deleted_at`)**로 구현하고 있다.
  - 따라서 SQLite의 `ON DELETE SET NULL` 같은 자동화는 기본적으로 기대하면 안 된다(DELETE가 안 일어남).

### 1.3 Server Mongo 모델/정책(현재)

- `server/src/models/Category.js`
  - `systemKey` 필드 없음.
  - `deletedAt`으로 소프트 삭제.
- `server/src/controllers/authController.js`
  - register/createGuest/login/googleLogin/googleLoginWeb 등에서 `name: 'Inbox'` 카테고리를 생성/보정한다.
  - 현재는 “활성 카테고리 1개 이상 존재” 수준의 보정이다.
- `server/src/controllers/categoryController.js`
  - 마지막 활성 카테고리 1개 삭제를 막는다.
  - 카테고리 삭제 시 해당 카테고리의 Todo/Completion을 tombstone cascade(삭제 처리) 한다.
- `server/src/models/Todo.js`
  - `categoryId`는 `required: true` (string).

### 1.4 Client UI/로직(현재)

- `client/src/features/todo/form/useTodoFormLogic.js`
  - 새 Todo 기본 선택: `lastUsedCategoryId`가 유효하면 우선, 아니면 `categories[0]`.
  - 제출 시 `categoryId` 없으면 에러(카테고리 선택 필수).
- `client/src/services/sync/deltaPull.js`
  - Category는 full snapshot으로 pull → SQLite upsert.
  - Todo/Completion은 delta pull.
- `client/src/services/sync/categorySync.js`
  - 서버 categories를 그대로 `upsertCategories(serverCategories)`로 저장.

---

## 2) 목표(TO‑BE) — systemKey 방식에서 “반드시” 만족해야 하는 것

1) 유저마다 **Inbox는 정확히 1개** 존재(활성 기준)  
2) Inbox는 오프라인/재실행/동기화에서도 **항상 동일하게 식별** 가능 (`systemKey='inbox'`)  
3) Todo는 항상 `categoryId`가 존재(= FK/조인/집계가 깨지지 않음)  
4) 카테고리 관리 화면/서버 API에서 Inbox는 **삭제/이름변경/순서변경 등 정책을 일관되게 적용**  

---

## 3) 설계(안) — 우리 코드베이스 기준 적용 포인트

### 3.1 데이터 모델(서버/클라 계약)

#### Category

- 필드 추가: `systemKey: string | null`
- Inbox는 `systemKey === 'inbox'`
- 일반 카테고리는 `systemKey === null`

정합성:
- 유저별 “활성 Inbox”는 1개만 허용해야 함.
  - Mongo: partial unique index 권장(예: `{ userId, systemKey }` unique where `deletedAt=null AND systemKey!=null`)
  - SQLite: `categories.system_key`에 partial unique index 권장(활성 + not null)

#### Todo

- `categoryId`는 계속 string required.
- “Inbox에 들어간 Todo”는 `categoryId === inboxCategoryId`로 표현한다.

### 3.2 서버 변경 포인트(정확한 touch points)

1) `server/src/models/Category.js`
   - `systemKey` 필드 추가 (nullable string)
   - 인덱스 추가:
     - 조회용: `{ userId: 1, systemKey: 1 }`
     - 정합성용: partial unique (활성 + systemKey not null)

2) `server/src/controllers/authController.js`
   - 현재는 register/createGuest/login/googleLogin/googleLoginWeb 등에서 `name:'Inbox'` 카테고리를 seed/보정한다.
   - TO‑BE(결정):
     - 온라인 계정(회원가입/로그인/소셜)은 **서버가 Inbox를 seed로 생성/보정**한다.
     - 게스트가 **local-only**로 전환되면 서버 호출이 없으므로, **클라(SQLite)가 Inbox를 seed**로 생성한다.

3) `server/src/controllers/categoryController.js`
   - Inbox(systemKey='inbox')는:
     - 삭제 금지
     - 이름 변경 금지
     - 순서 변경 금지 (또는 항상 0 고정)
   - `systemKey` 방어(서버 관리 필드):
     - updateCategory에서 `systemKey` 변경 금지
     - createCategory에서 `systemKey`를 받는다면 `inbox`만 허용(유저당 1개)하고 그 외는 거부/무시

4) 레거시 데이터 보정/백필: **스코프 제외**
   - 테스트 버전 전제: 서버/클라 데이터는 초기화 후 재가입/재생성 가능.

### 3.3 클라(SQLite) 변경 포인트(정확한 touch points)

1) `client/src/services/db/database.js`
   - `categories`에 `system_key TEXT` 컬럼 추가 (migration 필요)
   - `MIGRATION_VERSION` bump + migration 함수 추가
   - 인덱스 권장:
     - `CREATE UNIQUE INDEX ... ON categories(system_key) WHERE deleted_at IS NULL AND system_key IS NOT NULL;`

2) `client/src/services/db/categoryService.js`
   - upsert 시 `system_key` 저장/업데이트
   - deserializeCategory에서 `systemKey` 매핑

3) UI / 메뉴 구조
   - Inbox는 “카테고리 섹션 밖”으로 보여주되, 실제로는 `system_key='inbox'` 카테고리를 가리킨다.
   - CategoryManagementScreen에서는 Inbox를 “잠금 row”로 표시하고 액션을 제거한다.

4) 새 Todo 기본 선택 정책
   - 현재 정책(`lastUsedCategoryId` → first category)을 유지할지, Inbox를 default로 할지 결정 필요.
   - UX 목표가 “capture 우선”이면 기본값을 Inbox로 두는 것이 자연스럽다.

### 3.4 동기화(Delta Pull / Pending Push) 영향

- Category는 delta pull에서 full snapshot으로 내려오므로, 서버가 `systemKey`를 내려주기만 하면 클라 저장은 단순 upsert로 가능.
- 중요한 검증 포인트:
  - “첫 실행” 시점에 Inbox 카테고리가 클라 SQLite에 **항상 존재**해야 한다.
    - 온라인 계정: 서버 seed + 로그인 직후 category full pull을 먼저 실행해 SQLite에 반영
    - 게스트(local-only): 클라(SQLite) seed로 즉시 보장(서버/동기화 없음)

---

## 4) 반드시 결정해야 하는 정책(Must‑Decide)

### 4.1 카테고리 삭제 시 Todo 처리

결정: **현행 유지**

- 카테고리 삭제 시 해당 카테고리의 Todo/Completion은 **tombstone cascade(삭제 처리)** 한다.
- (메모) 추후 “휴지통” 기능에서 복구/보관 UX를 제공할 예정.

### 4.2 Inbox 표시/편집 정책(서버/클라 일치 필요)

결정:

- Inbox는 **이름/색상/아이콘 변경 불가**
- Inbox는 **순서 고정**(항상 고정 위치)
- 현 단계에서는 **CategoryManagementScreen의 일반 카테고리 목록 안에 같이 노출**
  - 단, 삭제/수정/정렬(드래그) 등의 액션은 불가(잠금)

### 4.3 초기 상태(카테고리 0개) 처리

결정: **카테고리 0개 상태는 만들지 않는다.**

- 온라인 계정(회원가입/로그인/소셜):
  - 서버에서 Inbox를 seed로 생성/보정한다.
  - 클라는 로그인 직후 category full pull을 선행해서 SQLite에 즉시 반영한다. (카테고리 0개 노출 방지)
- 게스트(향후 local-only):
  - 서버 호출이 없으므로 클라(SQLite)가 Inbox를 seed로 생성한다.
  - 이 모드에서는 서버 동기화가 없다(로컬 전용).
- 참고(현재 상태):
  - `loginAsGuest`는 현재 서버 `createGuest`를 호출하므로, 지금은 서버에서도 Inbox가 생성된다.
  - 게스트 local-only 전환 시점에 클라 seed로 바꾼다.

---

## 5) 검증 체크리스트(스펙 작성 전 / 구현 전)

서버:
- [ ] `Category.systemKey` 추가 시 기존 API 응답/저장에 문제가 없는지(serialize/deserialize)
- [ ] authController의 Inbox seed/보정이 `systemKey='inbox'` 기준으로 멱등하게 동작하는지(유저당 1개)
- [ ] Inbox 삭제/수정 방어가 server side에서 확실한지(클라 우회 방지)
- [ ] createCategory에서 `systemKey='inbox'` 생성이 가능한지(오프라인 seed → sync push 경로)

클라:
- [ ] SQLite migration이 안전한지(기존 데이터 유지 + 인덱스 추가)
- [ ] category upsert가 systemKey를 잃지 않는지(full pull/delta pull)
- [ ] CategoryManagementScreen에서 Inbox가 실수로 삭제/수정/정렬되지 않는지

동기화:
- [ ] “첫 실행/게스트 로그인 직후”에 Inbox가 로컬에 없어서 Todo 생성/조회가 깨지는 타이밍이 없는지
- [ ] 테스트 환경에서 클라/서버 버전이 서로 달라 systemKey가 누락되지 않도록(같은 브랜치로 맞춰 테스트)

---

## 6) 다음 작업(스펙 문서로 발전)

이 문서를 바탕으로 아래 3종 스펙을 새로 작성한다:

1) `requirements.md`: Inbox(systemKey) 정책/UX 확정 + must-decide 결론 반영  
2) `design.md`: 서버/클라/SQLite/sync 설계 + 마이그레이션 설계  
3) `tasks.md`: 안전한 순서로 작업 분해(서버 → 클라 스키마 → 동기화 → UI)  
