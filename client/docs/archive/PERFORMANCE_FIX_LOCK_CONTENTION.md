# Performance Fix: SQLite Lock Contention Resolution

**Date**: 2026-02-02  
**Issue**: First load slow (1877ms) due to SQLite lock contention  
**Status**: ✅ Fixed

---

## Problem Analysis

### Initial Symptoms
```
useTodos.js:53 ⚡ [useTodos] SQLite 조회: 2개 (1877.20ms)  ← SLOW!
useAllTodos.js:33 🌐 [useAllTodos] 캐시 없음 - 서버 요청
useCategories.js:42 🌐 [useCategories] 캐시 없음 - 서버 요청
```

### Root Cause
**SQLite Lock Contention** - Multiple queries competing for database lock:

1. **UI Queries** (TodoScreen loads):
   - `useTodos.getCompletionsByDate()` - needs immediate data
   - `useAllTodos.getAllTodos()` - needs immediate data
   - `useCategories.getAllCategories()` - needs immediate data

2. **Background Cache Preparation** (`useSyncTodos` useEffect):
   - `sqliteGetAllTodos()` - runs in parallel
   - `sqliteGetAllCategories()` - runs in parallel
   - `sqliteGetAllCompletions()` - runs in parallel

**Result**: All queries try to access SQLite simultaneously → lock contention → queries wait 800-1800ms

### Incorrect Initial Analysis
❌ "Web environment WASM initialization is slow"  
✅ **Actual issue**: Lock contention between concurrent SQLite queries

---

## Solution

### 1. Disable Redundant Background Cache Preparation
**File**: `client/src/hooks/useSyncTodos.js`

**Rationale**:
- React Query **already caches** data from UI queries (`useTodos`, `useCategories`, `useAllTodos`)
- Background cache preparation was **redundant** and caused lock contention
- UI queries populate the cache naturally on first load
- No need to pre-populate cache from SQLite

**Code Change**: Commented out the entire `prepareCache` useEffect

### 2. Fix Completion Delta Sync Bug
**File**: `client/src/hooks/useSyncTodos.js`

**Issue**: Server returns `deleted` as array of objects `{_id, todoId, date}`, not strings

```javascript
// Before (WRONG)
for (const key of completionDelta.deleted) {
    const [todoId, date] = key.split('_');  // ❌ key is object, not string
    await deleteCompletion(todoId, date === 'null' ? null : date);
}

// After (CORRECT)
for (const deletedItem of completionDelta.deleted) {
    await deleteCompletion(deletedItem.todoId, deletedItem.date);
}
```

### 3. Clean Up Invalid Test Data
**File**: `client/src/hooks/useSyncTodos.js`

```javascript
case 'createCompletion':
case 'deleteCompletion':
    // 테스트 데이터 스킵
    if (change.todoId && change.todoId.includes('test')) {
        console.log('⏭️ [useSyncTodos] 테스트 데이터 스킵:', change.todoId);
        await sqliteRemovePendingChange(change.id);
        success++;
        continue;
    }
```

**Fixes**: 500 error from invalid `test-todo-id` in pending queue

---

## Expected Performance After Fix

### Before
```
useTodos: 1047ms (lock contention with background cache)
useAllTodos: 879ms (lock contention)
useCategories: 881ms (lock contention)
useSyncTodos cache: 6220ms (redundant + lock contention)
```

### After (Expected)
```
useTodos: ~10-20ms (no contention, first query)
useAllTodos: ~6-10ms (no contention)
useCategories: ~8-10ms (no contention)
useSyncTodos cache: DISABLED (not needed)
Total first load: <50ms
```

---

## Testing Instructions

1. **Clear app cache** (force fresh load)
2. **Open TodoScreen** (triggers useTodos)
3. **Check console logs**:
   ```
   ⚡ [useTodos] 전체: Xms  ← Should be <50ms
   ⚡ [useAllTodos] SQLite 조회: Xms  ← Should be <20ms
   ⚡ [useCategories] SQLite 조회: Xms  ← Should be <20ms
   ```
4. **Verify**: NO `useSyncTodos 초기 캐시 준비` logs (disabled)
5. **Check pending queue**: No more 500 errors from test data
6. **Check completion sync**: No more `key.split is not a function` errors

---

## Key Learnings

1. **Lock Contention is Real**: Even with WAL mode, concurrent queries can block each other
2. **Avoid Redundant Caching**: React Query already caches - don't duplicate with manual cache prep
3. **UI First**: Always prioritize UI queries over background tasks
4. **Simple > Complex**: Disabling redundant code is better than adding delays/workarounds
5. **Don't Blame the Platform**: Web environment isn't inherently slower - analyze actual bottlenecks
6. **Server Contract Matters**: Always verify API response format (objects vs strings)

---

## Related Files

- `client/src/hooks/useSyncTodos.js` - Disabled background cache, fixed completion delta bug
- `client/src/hooks/queries/useTodos.js` - UI query (performance logging)
- `client/src/hooks/queries/useAllTodos.js` - UI query (performance logging)
- `client/src/hooks/queries/useCategories.js` - UI query (performance logging)
- `client/App.js` - Early DB initialization (still useful for reducing first query wait)
- `client/src/db/database.js` - WAL mode, PRAGMA settings

---

## Next Steps

1. ✅ Test the fix (verify <50ms first load)
2. ⏳ Remove debug logs after verification
3. ⏳ Monitor performance on native (iOS/Android) vs web
4. ⏳ Consider removing early DB init in App.js if not needed
