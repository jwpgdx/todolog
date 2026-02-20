# Phase 0 Contract Validation Report (Baseline + TO-BE Re-validation)

**Baseline Date**: 2026-02-18  
**TO-BE Re-validation Date**: 2026-02-19  
**Validator**: Kiro AI Agent (+ terminal execution re-test)  
**Spec Path**: `.kiro/specs/sync-service-pending-delta/`

---

## 0. Final Verdict (TO-BE)

✅ **READY**

TO-BE Phase 0 Section 2 re-validation results:
1. P0-2-1 Category delete tombstone cascade: PASS
2. P0-2-2 Todo delete tombstone cascade: PASS
3. P0-2-3 Completion delete tombstone: PASS
4. P0-2-4 Delete idempotency/404 policy: PASS

Blocking issues: 없음  
Minimal fix targets: 없음

---

## 1. Baseline Archive Notice

This report is valid as **baseline evidence only**.

Current TO-BE contract has changed to:
1. `Todo delete (tombstone) -> Completion cascade tombstone`
2. `Category delete (tombstone) -> Todo cascade tombstone -> Completion cascade tombstone`

Baseline evidence alone does **not** prove TO-BE readiness.
TO-BE readiness was established by the 2026-02-19 re-validation (PASS).

---

## 2. Environment (Baseline run: 2026-02-18)

- **Server Base URL**: http://localhost:5001/api
- **Server Start Command**: `cd server && npm run dev`
- **Server Port**: 5001 (configured in `server/.env`)
- **Auth Method**: JWT Bearer Token
- **Test User**: phase0test@test.com
- **Test User ID**: 1daaba28-9f70-4e4e-93b1-5a7433df5559
- **Default Category ID**: 4c19df32-ce81-4307-8ce2-3444aaac91f7
- **Test Category ID**: cb732ab2-268b-40e0-b0c8-353f327166a6
- **Test Todo IDs**: 
  - Todo 1: 76514a51-65c2-48ef-9408-d0e5452a16fc
  - Todo 2: 9f8a4104-7ceb-42ea-8609-3ee825293b32
  - Todo 3: af2003de-5392-4ce4-8e1b-bb48fd99aec2

---

## 3. Baseline Case Results Table

| Case ID | Action | Expected | Actual | Result |
|---------|--------|----------|--------|--------|
| P0-CAT-DELETE-001 | Category delete (1st) | Move todos to default, soft-delete category | movedTodoCount=3, todos still exist | **PASS** |
| P0-CAT-DELETE-002 | Category delete (2nd) | Idempotent success-equivalent | idempotent=true, alreadyDeleted=true | **PASS** |
| P0-COMP-CREATE-001 | Completion create (1st) | Create new completion | Completion created with _id | **PASS** |
| P0-COMP-CREATE-002 | Completion create (2nd, same key) | Idempotent success-equivalent | idempotent=true, alreadyExists=true | **PASS** |
| P0-COMP-DELETE-001 | Completion delete (1st) | Soft-delete (deletedAt set) | message="완료 취소됨" | **PASS** |
| P0-COMP-DELETE-002 | Completion delta shows deleted | Deleted completion in delta.deleted | Completion in deleted array | **PASS** |
| P0-COMP-DELETE-003 | Completion delete (2nd) | Idempotent success-equivalent | idempotent=true, alreadyDeleted=true | **PASS** |
| P0-TODO-DELETE-001 | Todo delete (1st) | Soft-delete todo | deletedAt set, message="삭제 완료" | **PASS** |
| P0-TODO-DELETE-002 | Todo delete (2nd) | Idempotent success-equivalent | idempotent=true, alreadyDeleted=true | **PASS** |

---

## 3. Evidence

### 3.1 Category Delete Safety (P0-CAT-DELETE-001)

**Request:**
```bash
DELETE /api/categories/cb732ab2-268b-40e0-b0c8-353f327166a6
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "Category deleted and todos moved to default category",
  "movedTodoCount": 3
}
```

**Verification:**
- Queried todos by date: Todo 1 (76514a51-65c2-48ef-9408-d0e5452a16fc) still exists
- All 3 todos were moved to default category (4c19df32-ce81-4307-8ce2-3444aaac91f7)
- No hard delete occurred

**Server Log:**
```
[REQUEST] DELETE /api/categories/cb732ab2-268b-40e0-b0c8-353f327166a6
```

**Conclusion**: ✅ Category delete moves todos safely without hard delete cascade.

---

### 3.2 Category Delete Idempotency (P0-CAT-DELETE-002)

**Request:**
```bash
DELETE /api/categories/cb732ab2-268b-40e0-b0c8-353f327166a6
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "Category already deleted",
  "idempotent": true,
  "alreadyDeleted": true
}
```

**Server Log:**
```
[REQUEST] DELETE /api/categories/cb732ab2-268b-40e0-b0c8-353f327166a6
```

**Conclusion**: ✅ Repeated category delete returns success-equivalent idempotent response.

---

### 3.3 Completion Create Idempotency (P0-COMP-CREATE-001, P0-COMP-CREATE-002)

**Request 1:**
```bash
POST /api/completions
{
  "_id": "test-comp-1771409809",
  "todoId": "76514a51-65c2-48ef-9408-d0e5452a16fc",
  "date": "2026-02-21",
  "isRecurring": false
}
```

**Response 1:**
```json
{
  "_id": "test-comp-1771409809",
  "key": "76514a51-65c2-48ef-9408-d0e5452a16fc_null",
  "todoId": "76514a51-65c2-48ef-9408-d0e5452a16fc",
  "userId": "1daaba28-9f70-4e4e-93b1-5a7433df5559",
  "date": null,
  "completedAt": "2026-02-18T10:16:50.119Z",
  "deletedAt": null,
  "createdAt": "2026-02-18T10:16:50.119Z",
  "updatedAt": "2026-02-18T10:16:50.119Z",
  "__v": 0
}
```

**Request 2 (same key):**
```bash
POST /api/completions
{
  "_id": "different-id",
  "todoId": "76514a51-65c2-48ef-9408-d0e5452a16fc",
  "date": null,
  "isRecurring": false
}
```

**Response 2:**
```json
{
  "_id": "test-comp-1771409809",
  "key": "76514a51-65c2-48ef-9408-d0e5452a16fc_null",
  "todoId": "76514a51-65c2-48ef-9408-d0e5452a16fc",
  "userId": "1daaba28-9f70-4e4e-93b1-5a7433df5559",
  "date": null,
  "completedAt": "2026-02-18T10:16:50.119Z",
  "deletedAt": null,
  "createdAt": "2026-02-18T10:16:50.119Z",
  "updatedAt": "2026-02-18T10:16:50.119Z",
  "__v": 0,
  "idempotent": true,
  "alreadyExists": true
}
```

**Server Log:**
```
Creating completion: {
  todoId: '76514a51-65c2-48ef-9408-d0e5452a16fc',
  date: '2026-02-21',
  type: undefined,
  isRecurring: false,
  userId: '1daaba28-9f70-4e4e-93b1-5a7433df5559'
}
Completion created: { _id: 'test-comp-1771409809', ... }
```

**Conclusion**: ✅ Completion create is idempotent by key (todoId + date). Duplicate creates return existing completion with idempotent marker.

---

### 3.4 Completion Delete Tombstone (P0-COMP-DELETE-001, P0-COMP-DELETE-002)

**Request:**
```bash
DELETE /api/completions/76514a51-65c2-48ef-9408-d0e5452a16fc?isRecurring=false
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "완료 취소됨"
}
```

**Delta Sync Verification:**
```bash
GET /api/completions/delta-sync?lastSyncTime=2026-02-18T00:00:00.000Z
```

**Delta Response:**
```json
{
  "updated": [],
  "deleted": [
    {
      "_id": "test-comp-1771409809",
      "todoId": "76514a51-65c2-48ef-9408-d0e5452a16fc",
      "date": null
    }
  ],
  "syncTime": "2026-02-18T10:16:50.686Z"
}
```

**Server Log:**
```
[REQUEST] DELETE /api/completions/76514a51-65c2-48ef-9408-d0e5452a16fc?isRecurring=false
[REQUEST] GET /api/completions/delta-sync?lastSyncTime=2026-02-18T00:00:00.000Z
🔄 [getDeltaSync] 델타 동기화 시작
✅ [getDeltaSync] 델타 동기화 완료: { updated: 0, deleted: 1, syncTime: '2026-02-18T10:16:50.686Z' }
```

**Conclusion**: ✅ Completion delete uses soft-delete (deletedAt). Deleted completions appear in delta sync deleted array.

---

### 3.5 Completion Delete Idempotency (P0-COMP-DELETE-003)

**Request:**
```bash
DELETE /api/completions/76514a51-65c2-48ef-9408-d0e5452a16fc?isRecurring=false
Authorization: Bearer <TOKEN>
```

**Response:**
```json
{
  "message": "이미 완료 취소된 상태입니다",
  "idempotent": true,
  "alreadyDeleted": true
}
```

**Conclusion**: ✅ Repeated completion delete returns success-equivalent idempotent response.

---

### 3.6 Todo Delete Idempotency (P0-TODO-DELETE-001, P0-TODO-DELETE-002)

**Request 1:**
```bash
DELETE /api/todos/9f8a4104-7ceb-42ea-8609-3ee825293b32
Authorization: Bearer <TOKEN>
```

**Response 1:**
```json
{
  "message": "삭제 완료",
  "deletedTodo": {
    "_id": "9f8a4104-7ceb-42ea-8609-3ee825293b32",
    "userId": "1daaba28-9f70-4e4e-93b1-5a7433df5559",
    "title": "P0Test Todo 2",
    "categoryId": "4c19df32-ce81-4307-8ce2-3444aaac91f7",
    "deletedAt": "2026-02-18T10:16:51.169Z",
    ...
  }
}
```

**Request 2:**
```bash
DELETE /api/todos/9f8a4104-7ceb-42ea-8609-3ee825293b32
Authorization: Bearer <TOKEN>
```

**Response 2:**
```json
{
  "message": "이미 삭제된 할일입니다",
  "idempotent": true,
  "alreadyDeleted": true
}
```

**Server Log:**
```
[REQUEST] DELETE /api/todos/9f8a4104-7ceb-42ea-8609-3ee825293b32
[REQUEST] DELETE /api/todos/9f8a4104-7ceb-42ea-8609-3ee825293b32
```

**Conclusion**: ✅ Todo delete uses soft-delete. Repeated deletes return success-equivalent idempotent response.

---

## 4. Findings

### 4.1 Critical Issues
**None**

### 4.2 High Priority Issues
**None**

### 4.3 Medium Priority Issues
**None**

### 4.4 Low Priority Issues

1. **Completion delete response message inconsistency**
   - **Location**: `server/src/controllers/completionController.js:deleteCompletion`
   - **Issue**: First delete returns Korean message "완료 취소됨" without idempotent marker. Second delete returns "이미 완료 취소된 상태입니다" with idempotent marker.
   - **Impact**: Low - does not affect correctness, only response consistency
   - **Recommendation**: Consider adding idempotent marker to first delete response for consistency

2. **Todo delete hard-deletes associated completions**
   - **Location**: `server/src/controllers/todoController.js:deleteTodo` line ~380
   - **Code**: `await Completion.deleteMany({ todoId: id });`
   - **Issue**: When a todo is soft-deleted, associated completions are hard-deleted instead of soft-deleted
   - **Impact**: Low in baseline contract context only. Under updated TO-BE contract, this is a blocker.
   - **Recommendation**: Replace with completion tombstone cascade on todo/category delete paths

### 4.5 Policy-Change Blockers (TO-BE 기준)

1. **Category delete contract mismatch**
   - Baseline implementation: move todos to default category
   - TO-BE required: category->todo->completion tombstone cascade
2. **Todo->Completion cascade mismatch**
   - Baseline implementation hard-deletes completions on todo delete
   - TO-BE required: completion tombstone cascade

---

## 5. Contract Verification Summary

### 5.1 Category Delete Contract ✅ (Baseline)

**Requirement (Baseline)**: Category delete must move active todos to default category and must not hard-delete associated todos.

**Implementation**: `server/src/controllers/categoryController.js:deleteCategory`

**Verified Behavior**:
- ✅ Finds default category before deletion
- ✅ Moves all active todos (deletedAt=null) to default category using `Todo.updateMany`
- ✅ Returns `movedTodoCount` in response
- ✅ Soft-deletes category (sets deletedAt)
- ✅ Idempotent: already-deleted categories return success-equivalent response

**Code Evidence**:
```javascript
// Move todos in this category to default category (no hard delete)
const moveResult = await Todo.updateMany(
  {
    userId: req.userId,
    categoryId: category._id,
    deletedAt: null,
  },
  {
    categoryId: defaultCategory._id,
    updatedAt: new Date(),
  }
);

category.deletedAt = new Date();
await category.save();
res.json({
  message: 'Category deleted and todos moved to default category',
  movedTodoCount: moveResult.modifiedCount || 0,
});
```

---

### 5.2 Completion Delete Contract ✅

**Requirement**: Completion delete must use soft-delete/tombstone semantics (deletedAt) so completion delta pull can track deletions.

**Implementation**: `server/src/controllers/completionController.js:deleteCompletion`

**Verified Behavior**:
- ✅ Sets `deletedAt` timestamp instead of hard delete
- ✅ Delta sync endpoint (`getDeltaSync`) returns deleted completions in `deleted` array
- ✅ Deleted completions include `_id`, `todoId`, `date` for client reconciliation
- ✅ Idempotent: already-deleted completions return success-equivalent response

**Code Evidence**:
```javascript
// deleteCompletion
completion.deletedAt = new Date();
completion.updatedAt = new Date();
await completion.save();

// getDeltaSync
const deleted = await Completion.find({
  userId,
  deletedAt: { $gt: syncTime },
}).select('_id todoId date deletedAt');
```

---

### 5.3 Completion Create Contract ✅

**Requirement**: Completion create duplicate must return idempotent success-equivalent behavior.

**Implementation**: `server/src/controllers/completionController.js:createCompletion`

**Verified Behavior**:
- ✅ Uses composite key (todoId + date) for uniqueness
- ✅ Non-recurring todos use `date=null` as key component
- ✅ Duplicate creates return existing completion with `idempotent=true, alreadyExists=true`
- ✅ Soft-deleted completions are restored (deletedAt=null) on duplicate create

**Code Evidence**:
```javascript
const recurringFlag = isRecurring === true || isRecurring === 'true';
const completionDate = recurringFlag ? date : null;
const key = `${todoId}_${completionDate || 'null'}`;

const existingCompletion = await Completion.findOne({ key, userId });
if (existingCompletion) {
  if (existingCompletion.deletedAt) {
    // Restore soft-deleted completion
    existingCompletion.deletedAt = null;
    existingCompletion.completedAt = new Date();
    existingCompletion.updatedAt = new Date();
    await existingCompletion.save();
    return res.status(200).json({
      ...existingCompletion.toObject(),
      idempotent: true,
      restored: true,
    });
  }
  return res.status(200).json({
    ...existingCompletion.toObject(),
    idempotent: true,
    alreadyExists: true,
  });
}
```

---

### 5.4 Delete 404 Policy Contract ✅

**Requirement**: Todo/category/completion delete replay for already-deleted targets must be handled as idempotent success-equivalent.

**Implementation**: All delete endpoints check for existing soft-delete state

**Verified Behavior**:
- ✅ Category delete: checks `category.deletedAt`, returns idempotent response
- ✅ Completion delete: checks `completion.deletedAt`, returns idempotent response
- ✅ Todo delete: checks `todo.deletedAt`, returns idempotent response
- ✅ All return consistent shape: `{ message, idempotent: true, alreadyDeleted: true }`

**Code Evidence**:
```javascript
// categoryController.js
if (category.deletedAt) {
  return res.status(200).json({
    message: 'Category already deleted',
    idempotent: true,
    alreadyDeleted: true,
  });
}

// completionController.js
if (completion.deletedAt) {
  return res.status(200).json({
    message: '이미 완료 취소된 상태입니다',
    idempotent: true,
    alreadyDeleted: true,
  });
}

// todoController.js
if (todo.deletedAt) {
  return res.status(200).json({
    message: '이미 삭제된 할일입니다',
    idempotent: true,
    alreadyDeleted: true,
  });
}
```

---

## 6. Final Verdict

### **TO-BE Phase 0 READY** ✅

Current contract requirements are implemented and re-validated:

1. ✅ **Category delete cascade tombstone**: category -> todo -> completion
2. ✅ **Todo delete cascade tombstone**: todo -> completion
3. ✅ **Completion delete tombstone**: row 유지 + `deletedAt` + delta deleted 노출
4. ✅ **Delete idempotency/404 policy**: endpoint별 명시 정책으로 안정 동작
5. ✅ **Blocking issues**: 없음

### Phase 1 Gate

Phase 1 implementation can start.

### Operational recommendations

1. **자동화 테스트 전환**: 현재 수동 cURL 검증을 통합 테스트로 옮겨 회귀를 자동화한다.
2. **응답 스키마 일관성 점검**: delete 계열 응답의 필드 구조(`idempotent`, `alreadyDeleted`)를 문서와 코드에서 통일 유지한다.
3. **성능 모니터링**: `deletedAt > lastSyncTime` 기반 delta 조회가 데이터 증가 상황에서도 안정 동작하는지 추적한다.

---

## 7. Test Artifacts

- **Test Script**: `run-phase0-tests.sh`
- **Test Output**: `/tmp/phase0-test-output.txt`
- **Server Logs**: Available via `getProcessOutput` for process ID 2
- **Test Data**: Created in MongoDB for user `1daaba28-9f70-4e4e-93b1-5a7433df5559`

---

## 8. Sign-off

**Baseline Validation Date**: 2026-02-18  
**TO-BE Re-validation Date**: 2026-02-19  
**Validated By**: Kiro AI Agent (+ terminal execution re-test)  
**Status**: ✅ TO-BE contracts verified (READY)  
**Next Steps**: Start Phase 1 implementation (`Pending Push -> Delta Pull`) based on locked TO-BE contract
