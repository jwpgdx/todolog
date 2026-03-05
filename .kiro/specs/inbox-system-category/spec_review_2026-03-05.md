# Spec Review: Inbox System Category (`systemKey='inbox'`)

**Reviewer:** Antigravity (Senior Principal Engineer)
**Date:** 2026-03-05
**Model:** Antigravity
**Documents reviewed:**
1. `requirements.md`
2. `design.md`
3. `tasks.md`
4. `systemKey-inbox-pre-spec.md` (reference)
5. `AI_COMMON_RULES.md` (reference)
6. `PROJECT_CONTEXT.md` (reference)

**Codebase cross-referenced:**
- `server/src/models/Category.js`
- `server/src/controllers/authController.js`
- `server/src/controllers/categoryController.js`
- `client/src/services/db/database.js`
- `client/src/services/db/categoryService.js`
- `client/src/services/sync/categorySync.js`

---

## 1) Findings (severity order)

---

### [High] H1. `convertGuest` 경로가 Inbox ensure 대상에서 누락됨

**증거:**
- `design.md` L82: "회원가입/로그인/소셜 로그인/게스트 생성(현재 서버 기반)에서 **ensureInbox(userId)**를 멱등 호출한다."
- `tasks.md` L26: "register/createGuest/login/googleLogin/googleLoginWeb 경로 멱등 ensure"
- `authController.js` L222–283: `convertGuest` (게스트→정회원 전환) 함수가 존재하지만, design/tasks 어디에서도 `convertGuest`의 ensure 대상 여부를 언급하지 않음.

**리스크:** 게스트→정회원 전환 시 Inbox가 이미 존재할 수 있지만, `convertGuest`에서 기존 `name:'Inbox'` 카테고리에 `systemKey` 보정이 안 되면 전환 후 Inbox가 `systemKey=null`인 채로 남게 된다. design에 명시된 "ensure = 없으면 생성 + 정책 보정"이 이 경로에서 빠짐.

**최소 수정:** design.md와 tasks.md에 `convertGuest`를 ensureInbox 호출 대상 경로에 명시적으로 추가. (또는 "기존 게스트 카테고리에도 systemKey를 보정해야 한다"를 ensureInbox 로직 스펙에 기술.)

---

### [High] H2. `getCategories` API가 `deletedAt: null` 조건만으로 조회 — full snapshot pull이 soft-deleted 카테고리를 누락함

**증거:**
- `categoryController.js` L9: `Category.find({ userId: req.userId, deletedAt: null })`
- `design.md` L19: "deltaPull은 Category를 **full snapshot pull**로 내려받아 SQLite upsert한다."
- `categorySync.js` L16–22: `getCategories()` → `upsertCategories(serverCategories)` — deleted 카테고리를 받지 못함.

**리스크:** 서버에서 소프트삭제된 카테고리가 클라에 전파되지 않아, 클라에 "삭제 안 된" stale 카테고리가 남을 수 있다. 이 문제는 inbox 스펙 고유 문제가 아니라 기존 동기화 결함이지만, design.md L161에서 "클라 저장은 `upsertCategories()`만으로 충분하다"고 단언하고 있어 정확하지 않다.

**최소 수정:** design.md Sync Integration 섹션에 "현행 getCategories는 active only 반환이며, soft-deleted 전파는 별도 패스(향후) → 본 스펙에서는 직접 다루지 않는다"는 전제를 명시. 또는 이 스펙에서 함께 수정할지 결정.

---

### [High] H3. SQLite partial unique index에 `userId` 조건이 없음 — 복수 유저 시나리오에서 유일성 미보장

**증거:**
- `design.md` L64: `UNIQUE(system_key) WHERE deleted_at IS NULL AND system_key IS NOT NULL`
- `design.md` L65: "로컬 DB는 '현재 로그인된 유저 1명 데이터만 보관' 전제를 따른다."
- 반면 `design.md` L75–76 (서버 Mongo): `{ userId: 1, systemKey: 1 }` partial unique — userId 포함.

**리스크:** 현재 전제(로컬 1유저)가 유지되면 문제없지만, 향후 멀티유저/로그아웃-재로그인 시 이전 유저 데이터가 남아 있으면 unique 제약 충돌이 발생할 수 있다. design.md가 이 전제를 명시했으므로 당장은 동작하지만, categories 테이블에 `userId` 컬럼이 아예 없는 현재 스키마에서 이 전제가 깨질 때의 fallback이 정의되지 않음.

**최소 수정:** design.md에 "로그아웃 시 로컬 데이터 삭제/교체 전략이 있어야 partial unique가 안전하다"는 전제 조건을 경고(WARNING)로 추가. 현 스펙 스코프에서 수정할 사항은 아니지만, 리스크 인지를 문서화해야 함.

---

### [Medium] M1. `icon` 필드가 잠금 정책에서 일관되지 않음

**증거:**
- `requirements.md` L22: "이름/색상/**아이콘** 변경 불가"
- `design.md` L104: "대상 category가 inbox면 `name/color/order` 변경 거부" — **icon 누락**

**리스크:** design의 서버 방어 로직 명세에 `icon`이 빠져 있어, 구현 시 icon 변경이 허용될 수 있음.

**최소 수정:** design.md L104를 `name/color/icon/order 변경 거부`로 수정.

---

### [Medium] M2. 서버 Category 모델에 `icon` 필드가 현재 존재하지 않음

**증거:**
- `server/src/models/Category.js` (전체 조회): 필드는 `_id, userId, name, color, order, deletedAt` — `icon` 없음.
- `requirements.md` L22: "아이콘 변경 불가"
- `design.md` L38–48 DTO: `color: string | null` 으로 나열하지만 `icon`은 명시 없음(requirements에서만 언급).

**리스크:** 서버에 `icon` 필드가 없으므로 "icon 변경 거부" 정책이 무의미거나, 향후 icon 필드를 추가할 때 별도 migration이 필요. 현 스펙이 icon을 요구사항에 포함한 것과 실제 모델 사이에 괴리.

**최소 수정:** requirements.md에 "icon은 현재 서버 모델에 미구현이므로, 잠금 정책 적용은 icon 필드 도입 후"라는 조건부 주석 추가. 또는 requirements에서 icon을 현 스펙 스코프에서 제외.

---

### [Medium] M3. 서버 `getCategories`의 응답 직렬화에 `systemKey` 포함 여부가 명시적이지 않음

**증거:**
- `design.md` L161: "서버가 `systemKey`를 내려주기만 하면 클라 저장은 단순 upsert로 가능"
- `categoryController.js` L9: `Category.find(...)` 결과를 `res.json(categories)`로 직접 반환 — Mongoose `toJSON`에 의존.

**리스크:** Mongoose 스키마에 `systemKey`가 추가되면 `toJSON`에 자동 포함되므로 현 구조에서는 문제없을 가능성이 높으나, `select()` 또는 `transform`이 걸려 있으면 누락될 수 있음. design에 "직렬화 검증" 스텝이 tasks에 암시적(Task 2 "기존 API 응답 직렬화 영향 점검")이긴 하나, 구체적 검증 시나리오가 없음.

**최소 수정:** tasks.md Task 2에 "getCategories 응답에 `systemKey` 필드가 포함됨을 직접 확인 (curl/Postman 등으로 확인)" 검증 스텝 추가.

---

### [Medium] M4. `upsertCategory` / `upsertCategories`가 `INSERT OR REPLACE`로 동작 — `system_key`가 upsert에서 누락되면 null로 덮어쓰기됨

**증거:**
- `categoryService.js` L77–91: `INSERT OR REPLACE INTO categories (_id, name, color, icon, order_index, ...)` — `system_key` 미포함.
- `categorySync.js` L22: `await upsertCategories(serverCategories)` — 서버 응답을 그대로 전달.
- `design.md` L128: "upsert/deserialize에 `system_key` 저장/복원 추가"로 변경 요구.

**리스크:** `INSERT OR REPLACE`는 full-row replacement. 만약 upsert SQL에 `system_key`를 빠트리면, 기존 system_key가 null로 사라짐. design이 이를 인지하고 변경을 요구하고 있으므로 설계 자체에 결함은 없으나, **`INSERT OR REPLACE`의 특성상 한 컬럼이라도 빠지면 데이터 loss**라는 위험을 design에 경고로 명시하면 구현 실수를 줄일 수 있음.

**최소 수정:** design.md Client Design §2에 `INSERT OR REPLACE`의 full-row 특성 주의 사항을 WARNING으로 추가. (예: "system_key를 upsert column list에 반드시 포함할 것 — 누락 시 기존 값이 null로 덮어쓰임.")

---

### [Medium] M5. Traceability Matrix에서 R6(정렬/고정) → Task 4 매핑이 불완전

**증거:**
- `tasks.md` L90: "R6(정렬/고정): Tasks 4, 6, 7"
- `tasks.md` L29–32 (Task 4): categoryController 잠금 정책 — deleteCategory/updateCategory 방어. order 고정은 ensureInbox(Task 3)에서 `order: 0` 보정으로 구현.
- Task 4는 "order 변경 거부"를 다루므로 부분적으로 맞지만, 서버측 "order 고정 보정"은 Task 3(ensure)의 책임.

**리스크:** 추적이 약간 모호. Task 3이 R6에도 매핑되어야 함.

**최소 수정:** tasks.md Traceability Matrix R6 → `Tasks 3, 4, 6, 7`로 수정.

---

### [Low] L1. `googleLoginWeb`에서 새 유저 생성 시 `_id`가 `generateId()`로 생성되지 않음

**증거:**
- `authController.js` L434–440: `User.create({ email, name, googleId, provider: 'google' })` — `_id` 미지정.
- 반면 `register` L72–84: `_id: userId` (generateId 사용), `googleLogin` L363: `_id: userId`

**리스크:** 이는 기존 버그이며 inbox 스펙 고유 문제가 아니지만, `googleLoginWeb` 경로에서 Inbox ensure 시 `userId`가 Mongo 자동생성 ObjectId가 되어 UUID v4 정책 위반. inbox ensure가 이 경로에서도 호출되면 정합성 문제.

**최소 수정:** out-of-scope 문서화 또는, 이 경로도 inbox ensure 대상이므로 tasks.md에 "googleLoginWeb userId 생성 정합성 확인" 체크 항목 추가.

---

### [Low] L2. design.md에 `order: 0`이 "항상 최상단" 의미인지, 기존 카테고리가 order=0일 때 충돌 처리가 불명확

**증거:**
- `design.md` L92–94: "order가 0이 아니면 0으로 보정"
- `categoryController.js` L46–64 (updateCategory): 사용자가 `order` 변경 시 제약 없음 — 일반 카테고리도 order=0이 가능.

**리스크:** 일반 카테고리가 order=0인 상태에서 Inbox도 order=0이면, 정렬 키가 동일하여 순서 보장은 SQL 정렬의 추가 조건(system_key 우선)에 의존. design.md L135에 SQL 정렬 규칙이 "system_key='inbox' 우선"으로 정의되어 있으므로 동작은 올바를 수 있지만, 서버측 정렬이 누락되면 서버 API 응답 순서가 보장 안 됨.

**최소 수정:** design.md에 "서버 getCategories의 정렬에도 Inbox 우선 규칙 적용 여부"를 결정/기술. (현재 서버는 `sort({ order: 1, createdAt: 1 })` — inbox 우선 없음.)

---

### [Low] L3. Validation Plan에 "중복 Inbox 방어" 시나리오가 없음

**증거:**
- `design.md` L167–173 (Validation Plan): 5개 시나리오 — 중복 생성 시나리오 없음.
- `requirements.md` L56: "활성 Inbox는 유저당 정확히 1개"

**리스크:** partial unique index가 제대로 걸리면 자동 방어되지만, index 누락 시 중복이 조용히 생긴다. 검증에 "동시 ensure 호출 / 직접 API 호출로 Inbox 중복 생성 시도 → 거부 확인" 시나리오가 있으면 더 안전.

**최소 수정:** design.md / tasks.md Validation Scenarios에 "6. 직접 createCategory API로 systemKey='inbox' 생성 시도 → 거부/무시 확인" 추가.

---

## 2) Open Questions (must-decide)

### OQ-1. `convertGuest` 경로에 ensureInbox를 적용할 것인가?

게스트→정회원 전환 시, 기존 게스트 계정에 이미 `name:'Inbox'` 카테고리가 있으면 이 row에 `systemKey='inbox'`를 보정해야 한다. 이를 Task 3에 포함해야 하는지, 별도 Task로 할지 결정 필요.

### OQ-2. 서버 `getCategories` 정렬에 inbox 우선 규칙을 넣을 것인가?

현재 서버는 `sort({ order: 1, createdAt: 1 })`. 클라이언트에서만 inbox-first 정렬하면 충분한가, 아니면 서버도 맞추는가? (서버 응답 순서가 UI에 직접 영향을 주지 않는다면 클라만으로 충분.)

---

## 3) Patch Proposal (copy-pastable)

---

### Patch 1: `design.md` — `icon` 잠금 정책 추가 + `INSERT OR REPLACE` 경고

```diff
 ### 3) Category CRUD 방어
 
 - updateCategory:
-  - 대상 category가 inbox면 `name/color/order` 변경 거부
+  - 대상 category가 inbox면 `name/color/icon/order` 변경 거부
```

```diff
 ### 2) Category Service 변경
 
 - `client/src/services/db/categoryService.js`
   - upsert/deserialize에 `system_key` 저장/복원 추가
+
+> [!WARNING]
+> `INSERT OR REPLACE`는 full-row replacement로 동작한다.
+> upsert SQL column list에 `system_key`를 반드시 포함할 것.
+> 누락 시 기존 system_key 값이 null로 덮어쓰인다.
```

---

### Patch 2: `design.md` — Sync Integration에 기존 제약 명시 + 서버 정렬 결정

```diff
 ## Sync Integration
 
 - Category full snapshot pull이 우선 실행되므로, 서버가 `systemKey`를 내려주기만 하면 클라 저장은 `upsertCategories()`만으로 충분하다.
+- 현행 `getCategories`는 `deletedAt: null` 조건(active only). soft-deleted 카테고리 전파는 본 스펙 스코프 밖.
+- 서버 `getCategories` 정렬은 현행(`order, createdAt`) 유지한다. Inbox-first 정렬은 클라에서만 수행한다.
```

---

### Patch 3: `design.md` — Rollout / Risk Notes에 partial unique 전제 조건 추가

```diff
 ## Rollout / Risk Notes
 
 1. 레거시 데이터 보정은 스코프 제외(테스트 버전). 필요 시 서버 DB 초기화 후 재가입으로 정합성 확보.
 2. 서버/클라 버전 불일치 시 `systemKey` 누락이 발생할 수 있으므로, 테스트는 동일 브랜치/동일 버전으로 수행한다.
+3. SQLite partial unique index(`system_key`)는 "로컬 DB는 현재 로그인된 유저 1명 데이터만 보관" 전제를 전제로 한다. 로그아웃 시 기존 데이터를 삭제/교체하지 않으면 유저 간 unique 충돌이 발생할 수 있다.
```

---

### Patch 4: `tasks.md` — `convertGuest` 경로 추가 + Traceability 보정 + 검증 시나리오 추가

```diff
 - [ ] 3. Server: authController Inbox seed를 `systemKey='inbox'` 기반 ensure로 변경
-  - register/createGuest/login/googleLogin/googleLoginWeb 경로 멱등 ensure
+  - register/createGuest/login/googleLogin/googleLoginWeb/convertGuest 경로 멱등 ensure
   - `name:'Inbox'`만 기준으로 삼던 로직 제거/대체
```

```diff
 - R6(정렬/고정): Tasks 4, 6, 7
+- R6(정렬/고정): Tasks 3, 4, 6, 7
```

```diff
 5. 일반 카테고리 삭제 → tombstone cascade 유지, Inbox는 영향 없음
+6. createCategory API로 `systemKey='inbox'` 직접 생성 시도 → 거부/무시 확인
+7. convertGuest(게스트→정회원 전환) 후 기존 Inbox에 `systemKey='inbox'` 보정 확인
```

---

### Patch 5: `tasks.md` — Task 2 검증 스텝 구체화

```diff
 - [ ] 2. Server: Category 모델에 `systemKey` 추가 + 인덱스
   - `server/src/models/Category.js` 필드 추가 (nullable)
   - partial unique index 추가 (active + systemKey not null)
   - 기존 API 응답 직렬화 영향 점검
+  - 검증: getCategories API 호출 → 응답 JSON에 `systemKey` 필드 포함 확인 (curl/Postman)
```

---

### Patch 6: `requirements.md` — icon 필드 전제 조건 명시

```diff
 5. Inbox 잠금 정책:
    - 이름/색상/아이콘 변경 불가
+     (참고: `icon` 필드는 현재 서버 Category 모델에 미구현. 서버 방어는 icon 필드 도입 이후 적용.)
    - 삭제 불가
    - 순서(order) 변경 불가 (항상 고정 위치)
```

---

## 4) Final Verdict

### **Conditionally Ready**

Must-fix 목록:

| # | Severity | Summary | 영향 문서 |
|---|----------|---------|-----------|
| H1 | High | `convertGuest` 경로 ensureInbox 누락 | design.md, tasks.md |
| M1 | Medium | `icon` 잠금 정책 design 누락 | design.md |
| M4 | Medium | `INSERT OR REPLACE` system_key 손실 경고 부재 | design.md |
| M5 | Medium | Traceability R6 → Task 3 누락 | tasks.md |
| L3 | Low | 중복 Inbox 방어 검증 시나리오 부재 | tasks.md |

Must-decide:

- **OQ-1** (`convertGuest` ensure 포함 여부): must-fix H1 해소를 위해 결정 필요.
- **OQ-2** (서버 getCategories 정렬): 영향 낮음 — 클라 정렬만으로 충분하면 "서버 미변경"으로 확정.

위 must-fix와 OQ가 해소되면 구현 진행 가능.

H2(soft-deleted 카테고리 미전파)는 기존 동기화 결함이므로 본 스펙에서 "전제 조건 명시"만 하고 별도 스펙으로 분리를 권장. H3(멀티유저 partial unique)도 경고 문서화로 충분.

---

## 5) Triage (must-fix / optional / reject)

아래 분류는 “구현 착수 전 must-fix 해소”를 위한 내부 triage다.

### must-fix (스펙 반영 완료)

- H1: `convertGuest` ensure 대상 누락 → `design.md`, `tasks.md`에 경로 추가
- M1: inbox update 방어에 `icon` 누락 → `design.md`, `tasks.md`에 반영
- M4: `INSERT OR REPLACE`로 인한 `system_key` 덮어쓰기 위험 경고 → `design.md`에 WARNING 추가
- M5: R6 traceability 매핑 누락 → `tasks.md` 매핑 수정
- L3: 중복/주입 방어 검증 시나리오 누락 → `design.md`, `tasks.md` validation 시나리오 추가

### optional (문서에 전제/리스크로만 반영)

- H2: `getCategories` active-only 전제 → `design.md` Sync Integration에 “active only + diff로 삭제 전파(현행 유지)” 명시
- H3: SQLite unique index의 단일 유저 전제 → `design.md` Risk Notes에 경고 추가
- M2: 서버 Category에 `icon` 필드 없음 → `requirements.md`, `design.md`에 “UI 잠금 우선/서버 미지원” 명시
- M3: `systemKey` 직렬화 포함 여부 → `tasks.md` Task 2에 “API 응답 확인” 검증 스텝 추가
- L2: 서버 정렬(inbox-first) → `design.md`에서 “서버 정렬 현행 유지, 클라에서 inbox-first”로 결정/명시

### reject / deferred

- L1: `googleLoginWeb` user `_id` UUID 정책 위반 가능성  
  - Inbox 스펙 범위와 직접 연동되지는 않지만, UUID 가드레일 위반 위험이 있어 별도 이슈로 추적 권장(본 스펙에서는 수정 범위에서 제외).
