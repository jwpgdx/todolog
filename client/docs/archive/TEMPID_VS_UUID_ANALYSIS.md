# TempID vs UUID 분석 - 현재 프로젝트 상황

## 📊 현재 프로젝트 ID 전략 분석

### 1. **현재 구현 상태**

#### Todo 생성 (useCreateTodo.js)
```javascript
// 오프라인 시 tempId 생성
const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
const tempTodo = {
  _id: tempId,
  ...data,
  syncStatus: 'pending',
};

// SQLite에 저장
await upsertTodo(tempTodo);

// Pending queue에 추가
await addPendingChange({
  type: 'create',
  tempId,
  data,
});
```

#### 동기화 시 처리 (useSyncTodos.js)
```javascript
case 'create':
  const data = JSON.parse(change.data);
  const createRes = await todoAPI.createTodo(data);
  
  // ⚠️ 핵심: tempId 삭제하고 서버 데이터로 교체
  await sqliteDeleteTodo(change.todoId);  // tempId 삭제
  await sqliteUpsertTodo(createRes.data);  // 서버 ID로 새로 저장
  break;
```

#### Category 생성 (useCreateCategory.js)
```javascript
// ⚠️ 주목: 카테고리는 tempId 없음!
mutationFn: createCategory,  // 직접 서버 호출
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['categories'] });
}
```

### 2. **현재 방식의 장단점**

#### ✅ 장점
1. **MongoDB ObjectId 활용**: 서버에서 자동 생성되는 고유 ID 사용
2. **단순한 Todo 생성**: 관계가 없을 때는 잘 작동함
3. **기존 MongoDB 스키마 유지**: 마이그레이션 불필요

#### ❌ 단점 (치명적)
1. **카테고리는 오프라인 생성 불가능**
   - 현재 코드에서 카테고리는 무조건 온라인에서만 생성 가능
   - 오프라인에서 "운동" 카테고리 만들고 "스쿼트" 할 일 추가 → **불가능**

2. **관계형 데이터 동기화 복잡도 폭발**
   ```javascript
   // 만약 카테고리도 tempId를 쓴다면...
   
   // 오프라인 생성
   Category: _id: "temp_cat_1"
   Todo: _id: "temp_todo_1", category_id: "temp_cat_1"
   
   // 동기화 시 (헬게이트 🔥)
   // 1. 카테고리 동기화
   await createCategory(temp_cat_1) → 서버 응답: real_cat_99
   
   // 2. SQLite에서 temp_cat_1 → real_cat_99로 교체
   await sqliteDeleteCategory("temp_cat_1");
   await sqliteUpsertCategory({ _id: "real_cat_99", ... });
   
   // 3. ⚠️ 문제: 모든 Todo의 category_id 업데이트 필요!
   await db.runAsync(`
     UPDATE todos 
     SET category_id = ? 
     WHERE category_id = ?
   `, ["real_cat_99", "temp_cat_1"]);
   
   // 4. Pending queue의 Todo도 수정 필요
   await db.runAsync(`
     UPDATE pending_changes 
     SET data = json_set(data, '$.categoryId', ?)
     WHERE json_extract(data, '$.categoryId') = ?
   `, ["real_cat_99", "temp_cat_1"]);
   
   // 5. 이제 Todo 동기화 (category_id는 이미 real_cat_99)
   await createTodo({ ...data, categoryId: "real_cat_99" });
   ```

3. **버그 발생 확률 높음**
   - 참조 업데이트 누락 시 데이터 불일치
   - 동기화 중 앱 종료 시 일부만 업데이트된 상태
   - 트랜잭션 관리 복잡도 증가

---

## 🆚 UUID 방식과 비교

### UUID 방식 (추천)

#### 구현 예시
```javascript
// expo-crypto 사용
import * as Crypto from 'expo-crypto';

// 오프라인 생성 (온/오프라인 구분 없음)
const categoryId = Crypto.randomUUID();  // "550e8400-e29b-41d4-a716-446655440000"
const todoId = Crypto.randomUUID();

const category = {
  _id: categoryId,
  name: "운동",
  color: "#FF5733",
};

const todo = {
  _id: todoId,
  title: "스쿼트",
  category_id: categoryId,  // 이미 확정된 ID
};

// SQLite 저장
await upsertCategory(category);
await upsertTodo(todo);

// 동기화 시 (간단!)
await api.post('/categories', category);  // 서버: "ㅇㅇ 저장함"
await api.post('/todos', todo);           // 서버: "ㅇㅇ 저장함"

// ✨ 매핑? 참조 수정? 없음!
```

#### 장점
1. **완전한 오프라인 퍼스트**: 모든 데이터를 오프라인에서 생성 가능
2. **관계형 데이터 동기화 단순화**: ID 매핑 불필요
3. **동기화 로직 단순화**: 그냥 보내면 끝
4. **데이터 일관성 보장**: 참조 업데이트 누락 불가능

#### 단점
1. **서버 스키마 변경 필요**
   ```javascript
   // MongoDB 스키마 변경
   const todoSchema = new mongoose.Schema({
     _id: { type: String, required: true },  // ObjectId → String
     // ...
   });
   ```

2. **기존 데이터 마이그레이션 필요**
   - 이미 생성된 ObjectId 데이터는 그대로 유지 가능
   - 새로운 데이터만 UUID 사용

---

## 🎯 프로젝트 상황별 권장 사항

### Case 1: "카테고리는 온라인에서만 생성하게 막겠다"
```javascript
// CategoryFormScreen.js
const handleSubmit = async () => {
  const netInfo = await NetInfo.fetch();
  
  if (!netInfo.isConnected) {
    Toast.show({
      type: 'error',
      text1: '오프라인 상태',
      text2: '카테고리는 온라인에서만 생성할 수 있습니다',
    });
    return;
  }
  
  // 온라인일 때만 생성
  await createCategory(data);
};
```

**장점**: 코드 변경 최소화  
**단점**: 사용자 경험 저하 (오프라인에서 카테고리 생성 불가)

---

### Case 2: "진짜 오프라인 퍼스트 앱을 만들겠다" (추천 ⭐)

#### Step 1: 패키지 설치
```bash
npx expo install expo-crypto
```

#### Step 2: ID 생성 유틸리티
```javascript
// client/src/utils/idGenerator.js
import * as Crypto from 'expo-crypto';

export function generateId() {
  return Crypto.randomUUID();
}
```

#### Step 3: Todo 생성 로직 변경
```javascript
// useCreateTodo.js
import { generateId } from '../../utils/idGenerator';

mutationFn: async (data) => {
  const newId = generateId();  // 온/오프라인 상관없이 생성
  
  const newTodo = {
    _id: newId,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // SQLite 저장
  await upsertTodo(newTodo);
  
  // 네트워크 확인
  const netInfo = await NetInfo.fetch();
  
  if (netInfo.isConnected) {
    try {
      // 온라인: 서버로 전송
      await todoAPI.createTodo(newTodo);
    } catch (error) {
      // 실패 시 pending queue에 추가
      await addPendingChange({ type: 'create', data: newTodo });
    }
  } else {
    // 오프라인: pending queue에 추가
    await addPendingChange({ type: 'create', data: newTodo });
  }
  
  return newTodo;
}
```

#### Step 4: 동기화 로직 단순화
```javascript
// useSyncTodos.js
case 'create':
  const data = JSON.parse(change.data);
  await todoAPI.createTodo(data);  // 그냥 보내면 끝!
  // ✨ tempId 삭제/교체 로직 불필요
  break;
```

#### Step 5: 서버 스키마 변경
```javascript
// server/src/models/Todo.js
const todoSchema = new mongoose.Schema({
  _id: { 
    type: String,  // ObjectId → String
    required: true 
  },
  // ... 나머지 필드
}, { _id: false });  // 자동 ObjectId 생성 비활성화

// server/src/models/Category.js
const categorySchema = new mongoose.Schema({
  _id: { 
    type: String,
    required: true 
  },
  // ...
}, { _id: false });
```

#### Step 6: 서버 컨트롤러 변경
```javascript
// server/src/controllers/todoController.js
exports.createTodo = async (req, res) => {
  const { _id, title, memo, categoryId, ... } = req.body;
  
  // ⚠️ 클라이언트가 _id를 보내면 그대로 사용
  const todo = new Todo({
    _id: _id || new mongoose.Types.ObjectId().toString(),  // fallback
    userId: req.userId,
    title,
    memo,
    categoryId,
    // ...
  });
  
  await todo.save();
  res.status(201).json(todo);
};
```

---

## 📈 마이그레이션 전략

### 점진적 마이그레이션 (추천)
```javascript
// 기존 ObjectId 데이터는 그대로 유지
// 새로운 데이터만 UUID 사용

// 서버 스키마
const todoSchema = new mongoose.Schema({
  _id: { 
    type: String,  // ObjectId 문자열 또는 UUID 모두 허용
    required: true 
  },
  // ...
});

// 클라이언트 ID 생성
function generateId() {
  // UUID 생성
  return Crypto.randomUUID();
}

// 서버는 두 형식 모두 처리 가능
// - 기존: "507f1f77bcf86cd799439011" (ObjectId 문자열)
// - 신규: "550e8400-e29b-41d4-a716-446655440000" (UUID)
```

---

## 🎬 최종 결론

### 현재 프로젝트 상황
- **Todo**: tempId 방식 사용 중 (오프라인 생성 가능)
- **Category**: 온라인에서만 생성 가능 (tempId 없음)
- **Completion**: 서버 의존적 (todoId 참조)
- **문제**: 카테고리-할일 관계 때문에 오프라인 경험 제한됨

### 권장 사항
~~1. **단기 (현재 코드 유지)**~~
~~   - 카테고리는 온라인에서만 생성하도록 UI에서 막기~~
~~   - 사용자에게 명확한 안내 메시지 표시~~

**✅ UUID 마이그레이션 (강력 추천) ⭐**
- **일정(Todo), 카테고리(Category), 일정완료(Completion) 모두 클라이언트에서 ID 생성**
- 진정한 오프라인 퍼스트 앱 구현
- 점진적 마이그레이션으로 기존 데이터 유지
- 동기화 로직 단순화로 버그 감소
- 관계형 데이터 동기화 복잡도 제거

### 구현 우선순위
```
Phase 1: 클라이언트 ID 생성 인프라
1. expo-crypto 설치
2. ID 생성 유틸리티 작성 (generateId)

Phase 2: 클라이언트 로직 변경
3. Category 생성 로직에 UUID 적용
4. Todo 생성 로직에 UUID 적용
5. Completion 생성 로직에 UUID 적용
6. 동기화 로직 단순화 (tempId 매핑 제거)

Phase 3: 서버 변경
7. 서버 스키마 변경 (String _id 허용)
8. 서버 컨트롤러 변경 (클라이언트 _id 수용)

Phase 4: 동기화 통합
9. useSyncTodos → useSyncData로 리팩토링
10. Category 동기화 추가
```

### 예상 작업 시간
- **UUID 마이그레이션 + 동기화 통합**: 6-8시간
  - Phase 1 (인프라): 30분
  - Phase 2 (클라이언트): 3-4시간
  - Phase 3 (서버): 1-2시간
  - Phase 4 (동기화 통합): 1-2시간
  - 테스트: 1시간

---

## 💡 추가 고려사항

### 1. Completion (완료 기록)
현재 Completion은 `todoId`를 참조하므로, Todo가 UUID를 쓰면 자동으로 해결됨.

### 2. Google Calendar 연동
`googleCalendarEventId`는 이미 String이므로 영향 없음.

### 3. 기존 사용자 데이터
- 기존 ObjectId 데이터는 그대로 유지
- 서버는 String _id로 두 형식 모두 처리
- 클라이언트는 UUID만 생성

### 4. 성능
- UUID는 ObjectId보다 약간 길지만 (36 vs 24 chars)
- 인덱싱 성능 차이는 미미함
- SQLite에서는 String _id가 더 자연스러움

---

**결론**: 현재 tempId 방식은 "단일 데이터"에서는 작동하지만, 카테고리-할일 같은 관계형 데이터에서는 복잡도가 폭발합니다. **UUID 전환을 강력히 추천**합니다. 🚀
