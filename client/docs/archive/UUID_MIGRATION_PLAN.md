# UUID 마이그레이션 완전 전환 계획서 (v2.0)

> **Updated**: 2026-02-03  
> **Based on**: 실제 코드베이스 분석 결과 반영

## 📋 Executive Summary

**목표**: 전체 시스템 UUID 기반 ID 생성으로 완전 전환

**핵심 변경사항**:
1. **User, Todo, Category, Completion 모두 UUID 사용**
2. **tempId 매핑 로직 완전 제거**
3. **useSyncTodos → useSyncData로 확장 (Category 동기화 포함)**
4. **서버 스키마 String _id로 완전 전환**
5. **게스트 로그인 준비 (UUID 기반 익명 사용자)**

**데이터 정책**: 기존 데이터 보존 불필요 (개발 단계) - 전체 DB 초기화

**예상 작업 시간**: 6-8시간

---

## 🔍 현재 코드베이스 분석 결과

### 현재 상태 요약

| 파일 | 현재 상태 | 변경 필요 |
|------|-----------|-----------|
| `useCreateTodo.js` | `temp_${Date.now()}` 사용 | UUID 전환 |
| `useCreateCategory.js` | **오프라인 미지원**, 서버 직접 호출 | 전체 리팩토링 |
| `pendingService.js` | `create/update/delete` 타입만 지원 | Category 타입 추가 |
| `useSyncTodos.js` | tempId 스킵 로직 존재 (L114, L126) | tempId 로직 제거 |
| 서버 Models | `mongoose.Schema.Types.ObjectId` 사용 | String `_id` 전환 |
| 서버 Controllers | `_id` 클라이언트 수용 안함 | `_id` 수용 로직 추가 |

### tempId 참조 위치 (제거 대상)

```
client/src/hooks/queries/useCreateTodo.js:22    → tempId 생성
client/src/hooks/queries/useCreateTodo.js:40    → tempId pending 추가
client/src/hooks/useSyncTodos.js:107-127        → tempId 스킵 로직
client/src/db/pendingService.js:111,128,157,298 → tempId 컬럼
client/src/db/database.js:351                   → tempId 컬럼
```

---

## 🚨 Phase -1: Git 브랜치 전략 (필수)

> [!CAUTION]
> **반드시 새 브랜치에서 작업하세요. 롤백이 필요할 수 있습니다.**

```bash
# 현재 작업 저장
git add -A
git commit -m "chore: pre-uuid-migration checkpoint"

# 마이그레이션 브랜치 생성
git checkout -b feature/uuid-migration

# 작업 완료 후 메인 병합
# git checkout main
# git merge feature/uuid-migration
```

---

## 🗑️ Phase 0: 데이터 초기화 (10분)

### 0.1 서버 DB 초기화

```bash
# MongoDB 접속
mongosh

# 데이터베이스 선택
use your_database_name

# 전체 컬렉션 삭제
db.users.drop()
db.todos.drop()
db.categories.drop()
db.completions.drop()

# 확인
show collections
```

### 0.2 클라이언트 SQLite 초기화

**파일**: `client/src/db/database.js` (함수 추가)

```javascript
/**
 * 데이터베이스 완전 초기화 (UUID 마이그레이션용)
 * ⚠️ 모든 데이터가 삭제됩니다
 */
export async function resetDatabase() {
  const db = getDatabase();
  
  await db.execAsync(`
    DROP TABLE IF EXISTS todos;
    DROP TABLE IF EXISTS categories;
    DROP TABLE IF EXISTS completions;
    DROP TABLE IF EXISTS pending_changes;
    DROP TABLE IF EXISTS metadata;
  `);
  
  console.log('✅ Database reset complete');
  
  // 테이블 재생성
  await initDatabase();
}
```

### 0.3 앱 초기화

```javascript
// TestDashboard.js 또는 개발 모드에서
import { resetDatabase } from '../db/database';

// 버튼 클릭 시
const handleReset = async () => {
  await resetDatabase();
  // AsyncStorage 인증 정보 삭제
  await AsyncStorage.removeItem('token');
  await AsyncStorage.removeItem('user');
};
```

---

## 🎯 Phase 1: 인프라 구축 (30분)

### 1.1 패키지 설치

```bash
cd client
npx expo install expo-crypto
```

### 1.2 클라이언트 ID 생성 유틸리티

**파일**: `client/src/utils/idGenerator.js` (신규)

```javascript
import * as Crypto from 'expo-crypto';

/**
 * UUID v4 생성 (expo-crypto 기반)
 * @returns {string} UUID v4 (36자, 하이픈 포함)
 */
export function generateId() {
  return Crypto.randomUUID();
}

/**
 * Completion ID 생성
 * 형식: todoId_YYYY-MM-DD
 * @param {string} todoId 
 * @param {string} date - YYYY-MM-DD
 * @returns {string}
 */
export function generateCompletionId(todoId, date) {
  return `${todoId}_${date}`;
}

/**
 * 게스트 ID 생성
 * @returns {string} guest_UUID
 */
export function generateGuestId() {
  return `guest_${Crypto.randomUUID()}`;
}

/**
 * 게스트 ID 여부 확인
 * @param {string} id 
 * @returns {boolean}
 */
export function isGuestId(id) {
  return id && id.startsWith('guest_');
}

/**
 * UUID 유효성 검사
 * @param {string} id 
 * @returns {boolean}
 */
export function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
```

### 1.3 서버 ID 생성 유틸리티

**파일**: `server/src/utils/idGenerator.js` (신규)

```javascript
const crypto = require('crypto');

/**
 * UUID v4 생성
 * @returns {string}
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * 게스트 ID 생성
 * @returns {string}
 */
function generateGuestId() {
  return `guest_${crypto.randomUUID()}`;
}

/**
 * 게스트 ID 여부 확인
 * @param {string} id 
 * @returns {boolean}
 */
function isGuestId(id) {
  return id && id.startsWith('guest_');
}

/**
 * UUID 유효성 검사 (클라이언트에서 온 ID 검증용)
 * @param {string} id 
 * @returns {boolean}
 */
function isValidUUID(id) {
  if (!id || typeof id !== 'string') return false;
  // guest_ 접두사 허용
  const cleanId = id.startsWith('guest_') ? id.slice(6) : id;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(cleanId);
}

module.exports = {
  generateId,
  generateGuestId,
  isGuestId,
  isValidUUID,
};
```

---

## 🔧 Phase 2: 클라이언트 로직 변경 (3-4시간)

### 2.1 pendingService 타입 확장 (30분)

**파일**: `client/src/db/pendingService.js`

**변경 전** (현재):
```javascript
// 타입: 'create', 'update', 'delete', 'createCompletion', 'deleteCompletion'
```

**변경 후**:
```javascript
/**
 * Pending Change 타입 정의
 * 
 * Category:
 * - 'createCategory', 'updateCategory', 'deleteCategory'
 * 
 * Todo:
 * - 'createTodo', 'updateTodo', 'deleteTodo'
 * 
 * Completion:
 * - 'createCompletion', 'deleteCompletion'
 */
```

**수정 내용**:
1. `addPendingChange` 함수에 `categoryId` 파라미터 추가
2. 테이블 스키마에 `category_id` 컬럼 추가 (또는 `entity_id`로 통합)
3. `temp_id` 컬럼 제거 (더 이상 사용 안 함)

```javascript
// database.js - pending_changes 테이블 스키마 수정
CREATE TABLE IF NOT EXISTS pending_changes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_id TEXT,          -- todoId 또는 categoryId (통합)
  data TEXT,
  date TEXT,
  created_at TEXT NOT NULL
);
-- temp_id 컬럼 제거
```

**pending 조회 함수 추가**:

```javascript
/**
 * Category 관련 Pending Changes만 가져오기
 */
export async function getCategoryPendingChanges() {
  const db = getDatabase();

  const result = await db.getAllAsync(`
    SELECT * FROM pending_changes 
    WHERE type IN ('createCategory', 'updateCategory', 'deleteCategory')
    ORDER BY created_at ASC
  `);

  return result.map(deserializePendingChange);
}
```

### 2.2 Category CRUD 리팩토링 (1시간)

#### useCreateCategory.js (전체 재작성)

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { createCategory as apiCreateCategory } from '../../api/categories';
import { upsertCategory } from '../../db/categoryService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';
import { generateId } from '../../utils/idGenerator';

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [useCreateCategory] 카테고리 생성 요청:', data);

      await ensureDatabase();
      
      // UUID 생성 (클라이언트에서)
      const categoryId = generateId();
      const category = {
        _id: categoryId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // SQLite에 즉시 저장
      await upsertCategory(category);
      console.log('✅ [useCreateCategory] SQLite 저장 완료:', categoryId);

      // 네트워크 확인
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        console.log('📵 [useCreateCategory] 오프라인 - Pending 추가');
        await addPendingChange({
          type: 'createCategory',
          entityId: categoryId,
          data: { _id: categoryId, ...data },
        });
        return category;
      }

      // 온라인: 서버 전송
      try {
        const res = await apiCreateCategory({ _id: categoryId, ...data });
        console.log('✅ [useCreateCategory] 서버 저장 성공:', res.data._id);
        
        // 서버 응답으로 SQLite 업데이트 (updatedAt 동기화)
        await upsertCategory(res.data);
        return res.data;
      } catch (error) {
        console.error('⚠️ [useCreateCategory] 서버 실패 → Pending 추가:', error.message);
        await addPendingChange({
          type: 'createCategory',
          entityId: categoryId,
          data: { _id: categoryId, ...data },
        });
        return category;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
```

#### useUpdateCategory.js (신규)

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { updateCategory as apiUpdateCategory } from '../../api/categories';
import { upsertCategory, getCategory } from '../../db/categoryService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }) => {
      console.log('🚀 [useUpdateCategory] 카테고리 수정:', id, data);

      await ensureDatabase();

      // SQLite 즉시 업데이트
      const existing = await getCategory(id);
      const updated = {
        ...existing,
        ...data,
        updatedAt: new Date().toISOString(),
      };
      await upsertCategory(updated);

      // 네트워크 확인
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        await addPendingChange({
          type: 'updateCategory',
          entityId: id,
          data,
        });
        return updated;
      }

      // 온라인: 서버 전송
      try {
        const res = await apiUpdateCategory(id, data);
        await upsertCategory(res.data);
        return res.data;
      } catch (error) {
        console.error('⚠️ [useUpdateCategory] 서버 실패:', error.message);
        await addPendingChange({
          type: 'updateCategory',
          entityId: id,
          data,
        });
        return updated;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
```

#### useDeleteCategory.js (신규)

```javascript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { deleteCategory as apiDeleteCategory } from '../../api/categories';
import { deleteCategory as sqliteDeleteCategory } from '../../db/categoryService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      console.log('🚀 [useDeleteCategory] 카테고리 삭제:', id);

      await ensureDatabase();

      // SQLite 즉시 삭제
      await sqliteDeleteCategory(id);

      // 네트워크 확인
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        await addPendingChange({
          type: 'deleteCategory',
          entityId: id,
        });
        return { success: true };
      }

      // 온라인: 서버 전송
      try {
        await apiDeleteCategory(id);
        return { success: true };
      } catch (error) {
        console.error('⚠️ [useDeleteCategory] 서버 실패:', error.message);
        await addPendingChange({
          type: 'deleteCategory',
          entityId: id,
        });
        return { success: true };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
};
```

### 2.3 Todo CRUD 수정 (1시간)

#### useCreateTodo.js 수정

**핵심 변경**: `temp_${Date.now()}` → `generateId()` (UUID)

```javascript
import { generateId } from '../../utils/idGenerator';

// 기존 코드 (삭제)
// const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// 새 코드
const todoId = generateId();
const todo = {
  _id: todoId,
  ...data,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  syncStatus: 'pending',
};

// Pending 추가 시 tempId 제거
await addPendingChange({
  type: 'createTodo',       // 'create' → 'createTodo'
  entityId: todoId,         // tempId 대신 실제 UUID
  data: { _id: todoId, ...data },
});
```

#### useUpdateTodo.js 수정

**변경 사항**: 타입 'update' → 'updateTodo'

```javascript
await addPendingChange({
  type: 'updateTodo',  // 'update' → 'updateTodo'
  entityId: id,
  data: updateData,
});
```

#### useDeleteTodo.js 수정

**변경 사항**: 타입 'delete' → 'deleteTodo'

```javascript
await addPendingChange({
  type: 'deleteTodo',  // 'delete' → 'deleteTodo'
  entityId: id,
});
```

### 2.4 Completion 수정 (30분)

#### useToggleCompletion.js

```javascript
import { generateCompletionId } from '../../utils/idGenerator';

// Completion ID를 일관되게 생성
const completionId = generateCompletionId(todoId, date);

// createCompletion 호출 시 ID 전달
await createCompletion(todoId, date, completionId);
```

---

## 🔄 Phase 3: 동기화 통합 (1-2시간)

### 3.1 useSyncTodos → useSyncData 리팩토링

**파일**: `client/src/hooks/useSyncData.js` (이름 변경)

**핵심 변경사항**:
1. **Category 동기화 추가**
2. **tempId 로직 완전 제거**
3. **Pending 타입별 정렬 (Category → Todo → Completion)**

```javascript
/**
 * Pending Changes 처리 (SQLite 기반)
 * 
 * 🔧 변경사항:
 * - 타입별 정렬: Category → Todo → Completion 순서
 * - tempId 스킵 로직 제거
 * - Category 타입 추가
 */
const processPendingChanges = useCallback(async () => {
  await ensureDatabase();
  const pending = await sqliteGetPendingChanges();
  if (pending.length === 0) return { success: 0, failed: 0 };

  // 🔧 타입별 정렬 (Category 먼저, Completion 마지막)
  const typeOrder = {
    createCategory: 1, updateCategory: 2, deleteCategory: 3,
    createTodo: 4, updateTodo: 5, deleteTodo: 6,
    createCompletion: 7, deleteCompletion: 8,
  };
  
  const sorted = [...pending].sort((a, b) => {
    return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
  });

  console.log('🔄 [useSyncData] Pending 처리 시작 (정렬됨):', sorted.length);

  let success = 0;
  let failed = 0;

  for (const change of sorted) {
    try {
      const data = change.data ? JSON.parse(change.data) : null;

      switch (change.type) {
        // === Category ===
        case 'createCategory':
          await categoryAPI.createCategory(data);
          break;
        case 'updateCategory':
          await categoryAPI.updateCategory(change.entityId, data);
          break;
        case 'deleteCategory':
          await categoryAPI.deleteCategory(change.entityId);
          break;

        // === Todo ===
        case 'createTodo':
          await todoAPI.createTodo(data);
          break;
        case 'updateTodo':
          await todoAPI.updateTodo(change.entityId, data);
          break;
        case 'deleteTodo':
          await todoAPI.deleteTodo(change.entityId);
          break;

        // === Completion ===
        case 'createCompletion':
        case 'deleteCompletion':
          await api.post('/completions/toggle', {
            todoId: change.entityId,
            date: change.date,
          });
          break;

        // === 레거시 타입 호환 (마이그레이션 기간용) ===
        case 'create':
          await todoAPI.createTodo(data);
          break;
        case 'update':
          await todoAPI.updateTodo(change.todoId, data);
          break;
        case 'delete':
          await todoAPI.deleteTodo(change.todoId);
          break;
      }

      await sqliteRemovePendingChange(change.id);
      success++;
    } catch (err) {
      console.error('❌ [useSyncData] Pending 실패:', change.type, err.message);
      failed++;
    }
  }

  console.log('✅ [useSyncData] Pending 처리 완료:', { success, failed });
  return { success, failed };
}, []);
```

### 3.2 Category 동기화 추가

```javascript
const syncData = useCallback(async (options = {}) => {
  // ... 기존 코드 ...

  try {
    // ... 설정 동기화 ...

    // 3. Pending changes 처리 (순서 보장)
    await processPendingChanges();

    // 4. Category 동기화 (신규)
    console.log('🔄 [useSyncData] Category 동기화 시작');
    try {
      const categoryResponse = await categoryAPI.getCategories();
      await bulkUpsertCategories(categoryResponse);
      queryClient.setQueryData(['categories'], categoryResponse);
      console.log('✅ [useSyncData] Category 동기화 완료:', categoryResponse.length);
    } catch (error) {
      console.error('❌ [useSyncData] Category 동기화 실패:', error.message);
    }

    // 5. Todo 델타 동기화 (기존)
    // ...

    // 6. Completion 델타 동기화 (기존)
    // ...

  } catch (err) {
    // ...
  }
}, [processPendingChanges, queryClient]);
```

### 3.3 categoryService 함수 추가

**파일**: `client/src/db/categoryService.js`

```javascript
/**
 * 다중 Category Upsert (동기화용)
 */
export async function bulkUpsertCategories(categories) {
  const db = getDatabase();

  await db.withTransactionAsync(async () => {
    for (const category of categories) {
      await db.runAsync(`
        INSERT OR REPLACE INTO categories 
        (_id, user_id, name, color, icon, is_default, "order", created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        category._id,
        category.userId || null,
        category.name,
        category.color || '#CCCCCC',
        category.icon || null,
        category.isDefault ? 1 : 0,
        category.order || 0,
        category.createdAt || new Date().toISOString(),
        category.updatedAt || new Date().toISOString(),
      ]);
    }
  });
}

/**
 * 단일 Category 조회
 */
export async function getCategory(id) {
  const db = getDatabase();
  const row = await db.getFirstAsync(
    'SELECT * FROM categories WHERE _id = ?',
    [id]
  );
  return row ? deserializeCategory(row) : null;
}
```

---

## 🖥️ Phase 4: 서버 변경 (1-2시간)

### 4.1 스키마 변경 (30분)

> [!IMPORTANT]
> `_id: false` 옵션만으로는 부족합니다. `_id` 필드를 명시적으로 정의해야 합니다.

#### User.js

```javascript
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { 
    type: String,
    required: true 
  },
  email: {
    type: String,
    sparse: true,  // 게스트는 이메일 없음
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
  },
  name: {
    type: String,
    required: true,
  },
  isGuest: {
    type: Boolean,
    default: false,
  },
  // ... 나머지 필드 동일
}, { 
  _id: false,  // 자동 ObjectId 생성 비활성화
  timestamps: true 
});

module.exports = mongoose.model('User', userSchema);
```

#### Todo.js

```javascript
const todoSchema = new mongoose.Schema({
  _id: { 
    type: String,
    required: true 
  },
  userId: {
    type: String,  // ObjectId → String
    ref: 'User',
    required: true,
  },
  categoryId: {
    type: String,  // ObjectId → String
    ref: 'Category',
    required: true,
  },
  // ... 나머지 필드 동일
}, { 
  _id: false,
  timestamps: true 
});
```

#### Category.js

```javascript
const categorySchema = new mongoose.Schema({
  _id: { 
    type: String,
    required: true 
  },
  userId: {
    type: String,  // ObjectId → String
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  color: {
    type: String,
    default: '#CCCCCC'
  },
  isDefault: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  }
}, { 
  _id: false,
  timestamps: true 
});
```

#### Completion.js

```javascript
const completionSchema = new mongoose.Schema({
  _id: { 
    type: String,
    required: true 
  },
  userId: {
    type: String,  // ObjectId → String
    required: true,
  },
  todoId: {
    type: String,  // ObjectId → String
    required: true,
  },
  date: {
    type: String,
  },
  // ... 나머지 필드 동일
}, { 
  _id: false,
  timestamps: true 
});

// 인덱스 유지
completionSchema.index(
  { todoId: 1, date: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null, isRange: false } }
);
```

### 4.2 컨트롤러 변경 (1시간)

#### authController.js 변경

```javascript
const { generateId } = require('../utils/idGenerator');

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: '이미 존재하는 이메일입니다' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // UUID 생성
    const userId = generateId();

    const user = new User({
      _id: userId,
      email,
      password: hashedPassword,
      name,
      isGuest: false,
    });

    await user.save();

    // 기본 카테고리 생성
    const defaultCategory = new Category({
      _id: generateId(),
      userId: user._id,
      name: '기본',
      color: '#808080',
      isDefault: true,
      order: 0,
    });
    await defaultCategory.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        name: user.name,
        isGuest: false,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 게스트 로그인
exports.guestLogin = async (req, res) => {
  try {
    const { generateGuestId, generateId } = require('../utils/idGenerator');
    const guestId = generateGuestId();

    const user = new User({
      _id: guestId,
      name: '게스트',
      isGuest: true,
    });

    await user.save();

    // 기본 카테고리 생성
    const defaultCategory = new Category({
      _id: generateId(),
      userId: user._id,
      name: '기본',
      color: '#808080',
      isDefault: true,
      order: 0,
    });
    await defaultCategory.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        isGuest: true,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
```

#### googleAuth / appleAuth (향후 계정 통합 시 별도 설계)

> [!NOTE]
> 소셜 로그인은 **계정 통합** 구조로 별도 설계 예정
> - 게스트/기존 계정에 Google/Apple 연결 가능
> - 하나의 UUID로 여러 소셜 계정 연동
> - 현재 마이그레이션에서는 **스킵**

#### todoController.js 변경

```javascript
const { isValidUUID } = require('../utils/idGenerator');

exports.createTodo = async (req, res) => {
  try {
    const { _id, title, memo, categoryId, ...rest } = req.body;
    
    // 클라이언트에서 전송한 _id 검증 및 사용
    if (_id && !isValidUUID(_id)) {
      return res.status(400).json({ message: '잘못된 ID 형식입니다' });
    }

    const todo = new Todo({
      _id: _id || require('../utils/idGenerator').generateId(),
      userId: req.userId,
      title,
      memo,
      categoryId,
      ...rest,
    });
    
    await todo.save();
    res.status(201).json(todo);
  } catch (error) {
    // 중복 ID 에러 처리
    if (error.code === 11000) {
      return res.status(409).json({ message: '이미 존재하는 ID입니다', code: 'DUPLICATE_ID' });
    }
    res.status(400).json({ message: error.message });
  }
};
```

#### categoryController.js 변경

```javascript
exports.createCategory = async (req, res) => {
  try {
    const { _id, name, color } = req.body;
    
    const category = new Category({
      _id: _id || require('../utils/idGenerator').generateId(),
      userId: req.userId,
      name,
      color,
      isDefault: false
    });
    
    const newCategory = await category.save();
    res.status(201).json(newCategory);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: '이미 존재하는 ID입니다', code: 'DUPLICATE_ID' });
    }
    res.status(400).json({ message: error.message });
  }
};
```

#### completionController.js 변경

```javascript
exports.toggleCompletion = async (req, res) => {
  try {
    const { todoId, date } = req.body;
    const userId = req.userId;

    const existing = await Completion.findOne({ userId, todoId, date, deletedAt: null });

    if (existing) {
      // Soft delete
      existing.deletedAt = new Date();
      await existing.save();
      return res.json({ message: 'Completion removed', completed: false });
    } else {
      // 새로 생성 (복합 ID 사용)
      const completion = new Completion({
        _id: `${todoId}_${date}`,
        userId,
        todoId,
        date,
      });
      await completion.save();
      return res.json({ message: 'Completion added', completed: true });
    }
  } catch (error) {
    // 중복 ID 처리 (동시 요청 시)
    if (error.code === 11000) {
      // 이미 존재하면 삭제로 처리
      const existing = await Completion.findOne({ todoId: req.body.todoId, date: req.body.date });
      if (existing) {
        existing.deletedAt = new Date();
        await existing.save();
        return res.json({ message: 'Completion removed', completed: false });
      }
    }
    res.status(500).json({ message: error.message });
  }
};
```

### 4.3 라우트 추가

**파일**: `server/src/routes/auth.js`

```javascript
// 게스트 로그인 라우트 추가
router.post('/guest', authController.guestLogin);
```

---

## ✅ Phase 5: 테스트 & 검증 (1시간)

### 5.1 테스트 시나리오

#### 시나리오 1: 신규 회원가입 → 데이터 생성

```
1. 회원가입 (서버에서 UUID 생성 확인)
2. 기본 카테고리 자동 생성 확인 (UUID)
3. 카테고리 생성: "운동" (클라이언트 UUID)
4. 할 일 생성: "스쿼트" (클라이언트 UUID, categoryId: UUID)
5. 완료 토글 (completionId: todoId_date)
6. MongoDB 확인: 모든 _id가 UUID 형식
```

#### 시나리오 2: 오프라인 → 온라인

```
1. 비행기 모드 ON
2. 카테고리 생성: "공부" (UUID 생성, SQLite 저장)
3. 할 일 생성: "영어 단어" (UUID 생성, SQLite 저장)
4. 완료 토글
5. Pending queue 확인: 3개 (createCategory, createTodo, createCompletion)
6. 비행기 모드 OFF
7. 자동 동기화 → 서버 전송 확인
8. Pending queue 비어있음 확인
9. 서버 DB: 클라이언트와 동일한 UUID 확인
```

#### 시나리오 3: 게스트 로그인

```
1. 게스트 로그인 API 호출
2. 응답 확인: _id가 guest_UUID 형식
3. 기본 카테고리 생성 확인
4. 할 일 생성/조회 정상 작동 확인
```

### 5.2 검증 포인트

- [ ] User `_id`가 UUID
- [ ] Category `_id`가 UUID  
- [ ] Todo `_id`가 UUID
- [ ] Completion `_id`가 `todoId_date` 형식
- [ ] **tempId 관련 코드 완전 제거**
- [ ] Pending queue 타입 정리 완료 (Category 타입 추가)
- [ ] **Pending 처리 순서: Category → Todo → Completion**
- [ ] Category 동기화 정상 작동
- [ ] 오프라인 생성 → 온라인 동기화 성공
- [ ] **UUID 중복 시 409 에러 반환**
- [ ] 게스트 로그인 준비 완료

### 5.3 수동 테스트 방법

```javascript
// TestDashboard.js에 추가
<Button title="UUID 테스트" onPress={async () => {
  const { generateId } = await import('../utils/idGenerator');
  const uuid = generateId();
  console.log('Generated UUID:', uuid);
  Alert.alert('UUID', uuid);
}} />

<Button title="Pending Queue 확인" onPress={async () => {
  const pending = await getPendingChanges();
  console.log('Pending Queue:', pending);
  Alert.alert('Pending', JSON.stringify(pending, null, 2));
}} />
```

---

## 📊 마이그레이션 체크리스트

### Phase -1: Git 전략 ✅
- [ ] 현재 작업 커밋
- [ ] `feature/uuid-migration` 브랜치 생성
- [ ] 브랜치에서 작업 시작

### Phase 0: 데이터 초기화 ✅
- [ ] MongoDB 전체 컬렉션 삭제
- [ ] SQLite 초기화 함수 작성 (`resetDatabase`)
- [ ] 앱 재설치 또는 수동 초기화

### Phase 1: 인프라 ✅
- [ ] `expo-crypto` 설치
- [ ] `client/src/utils/idGenerator.js` 작성
- [ ] `server/src/utils/idGenerator.js` 작성

### Phase 2: 클라이언트 ✅
- [ ] `pendingService.js` 타입 확장 (Category 타입 추가)
- [ ] `pending_changes` 테이블 스키마 수정 (`temp_id` 제거)
- [ ] `useCreateCategory.js` 오프라인 지원 + UUID
- [ ] `useUpdateCategory.js` 신규 작성
- [ ] `useDeleteCategory.js` 신규 작성
- [ ] `useCreateTodo.js` UUID 적용 + 타입 변경
- [ ] `useUpdateTodo.js` 타입 변경
- [ ] `useDeleteTodo.js` 타입 변경
- [ ] `useToggleCompletion.js` Completion ID 적용

### Phase 3: 동기화 ✅
- [ ] `useSyncTodos.js` → `useSyncData.js` 리팩토링
- [ ] **tempId 스킵 로직 제거 (L114, L126)**
- [ ] Pending 타입별 정렬 로직 추가
- [ ] Category 동기화 추가
- [ ] `bulkUpsertCategories` 함수 추가
- [ ] `SyncProvider` 업데이트 (import 변경)

### Phase 4: 서버 ✅
- [ ] `User.js` 스키마 String `_id`
- [ ] `Todo.js` 스키마 String `_id`, `userId`, `categoryId`
- [ ] `Category.js` 스키마 String `_id`, `userId`
- [ ] `Completion.js` 스키마 String `_id`, `userId`, `todoId`
- [ ] `authController.js` UUID 생성 (register, guestLogin) - *googleAuth는 계정통합 설계 후*
- [ ] `todoController.js` 클라이언트 `_id` 수용 + 검증
- [ ] `categoryController.js` 클라이언트 `_id` 수용
- [ ] `completionController.js` 복합 `_id` 생성
- [ ] `/auth/guest` 라우트 추가

### Phase 5: 테스트 ✅
- [ ] 회원가입 테스트
- [ ] 오프라인 생성 테스트
- [ ] 온라인 동기화 테스트
- [ ] UUID 중복 409 에러 테스트
- [ ] 게스트 로그인 테스트

---

## 🚨 주의사항

1. **완전 초기화**: 기존 데이터 전부 삭제 (개발 단계)
2. **UUID 형식**: 36자 (하이픈 포함) - `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`
3. **Completion ID**: `${todoId}_${date}` 형식 (클라이언트/서버 동일)
4. **게스트 ID**: `guest_` 접두사 + UUID
5. **동기화 순서**: **Category → Todo → Completion** (의존성 순서)
6. **롤백**: 문제 발생 시 `git checkout main`으로 즉시 복귀

---

## 🔄 롤백 절차

문제 발생 시:

```bash
# 1. 브랜치 전환
git checkout main

# 2. 마이그레이션 브랜치 삭제 (선택)
git branch -D feature/uuid-migration

# 3. MongoDB 복구 (백업이 있다면)
mongorestore --db your_database_name /path/to/backup

# 4. 앱 재설치 (SQLite 초기화)
```

---

## 🎉 완료 후 이점

1. **완전한 오프라인 지원**: 모든 데이터를 오프라인에서 생성 가능
2. **동기화 로직 단순화**: tempId 매핑 완전 제거
3. **중앙 집중식 동기화**: useSyncData에서 모든 데이터 관리
4. **관계형 데이터 안정성**: Category-Todo 참조 무결성 보장
5. **게스트 로그인 준비**: UUID 기반 익명 사용자 지원
6. **코드 가독성 향상**: 일관된 ID 생성 패턴
7. **충돌 방지**: UUID 중복 시 명확한 에러 반환

---

## 📝 다음 단계

1. **Phase -1부터 순차적으로 진행** (Git 브랜치 먼저!)
2. 각 Phase 완료 후 수동 테스트
3. 문제 발생 시 즉시 롤백 가능

**시작하시겠습니까?**
