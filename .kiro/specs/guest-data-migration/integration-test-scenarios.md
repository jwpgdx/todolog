# Guest Data Migration - Integration Test Scenarios

## Overview

이 문서는 게스트 데이터 마이그레이션 기능의 통합 테스트 시나리오를 정의합니다.

## Test Environment Setup

### Prerequisites
1. MongoDB 서버 실행 중
2. Express 서버 실행 중 (localhost:5001)
3. React Native 앱 실행 중 (Expo)
4. 테스트용 정회원 계정 생성 완료

### Test Data
- 테스트 정회원: `test@example.com` / `password123`
- 게스트 데이터: 5개 일정, 2개 카테고리, 3개 완료 정보

---

## Scenario 1: 게스트 데이터 마이그레이션 성공

### 목적
게스트 사용자가 기존 정회원 계정으로 로그인할 때 게스트 데이터를 성공적으로 마이그레이션하는지 검증

### 전제 조건
1. 게스트 모드로 앱 사용 중
2. SQLite에 게스트 데이터 존재 (5개 일정, 2개 카테고리)
3. 서버에 정회원 계정 존재 (`test@example.com`)

### 테스트 단계

#### 1. 게스트 데이터 생성
```javascript
// 게스트로 로그인
await loginAsGuest();

// 카테고리 생성
await createCategory({ name: 'Work', color: '#FF5733' });
await createCategory({ name: 'Personal', color: '#33FF57' });

// 일정 생성
await createTodo({ title: 'Buy groceries', date: '2025-02-10', categoryId: 'work-id' });
await createTodo({ title: 'Team meeting', date: '2025-02-11', categoryId: 'work-id' });
await createTodo({ title: 'Gym', date: '2025-02-12', categoryId: 'personal-id' });
await createTodo({ title: 'Read book', date: '2025-02-13', categoryId: 'personal-id' });
await createTodo({ title: 'Call mom', date: '2025-02-14', categoryId: 'personal-id' });

// 완료 정보 생성
await toggleCompletion('todo-1-id', '2025-02-10');
await toggleCompletion('todo-2-id', '2025-02-11');
await toggleCompletion('todo-3-id', '2025-02-12');
```

#### 2. 로그인 시도
```javascript
// LoginScreen에서 정회원 계정으로 로그인 시도
await enterEmail('test@example.com');
await enterPassword('password123');
await pressLoginButton();
```

#### 3. ActionSheet 확인
```javascript
// ActionSheet 표시 확인
expect(screen.getByText('게스트 데이터 발견')).toBeVisible();
expect(screen.getByText('5개의 일정과 2개의 카테고리를 가져오시겠습니까?')).toBeVisible();

// 옵션 확인
expect(screen.getByText('가져오기')).toBeVisible();
expect(screen.getByText('버리기')).toBeVisible();
expect(screen.getByText('취소')).toBeVisible();
```

#### 4. 마이그레이션 실행
```javascript
// "가져오기" 선택
await pressButton('가져오기');

// 로딩 인디케이터 확인
expect(screen.getByText('데이터를 가져오는 중...')).toBeVisible();

// 성공 Toast 확인
await waitFor(() => {
  expect(screen.getByText('마이그레이션 완료')).toBeVisible();
});
```

#### 5. 데이터 검증

**클라이언트 SQLite 검증**
```javascript
// SQLite가 비어있는지 확인
const todos = await getAllTodos();
const categories = await getAllCategories();
const completions = await getAllCompletionsArray();

expect(todos.length).toBe(0);
expect(categories.length).toBe(0);
expect(completions.length).toBe(0);
```

**서버 MongoDB 검증**
```javascript
// 서버에서 데이터 조회
const user = await User.findOne({ email: 'test@example.com' });
const todos = await Todo.find({ userId: user._id });
const categories = await Category.find({ userId: user._id });
const completions = await Completion.find({ userId: user._id });

// 데이터 개수 확인
expect(todos.length).toBe(5);
expect(categories.length).toBeGreaterThanOrEqual(3); // Inbox + 마이그레이션된 카테고리 + 기존 카테고리
expect(completions.length).toBe(3);

// 마이그레이션된 카테고리 확인
const migratedCategory = categories.find(c => c.name === '마이그레이션된 카테고리');
expect(migratedCategory).toBeDefined();

// 모든 일정이 마이그레이션된 카테고리에 속하는지 확인
todos.forEach(todo => {
  expect(todo.categoryId).toBe(migratedCategory._id);
  expect(todo.userId).toBe(user._id);
});

// 모든 완료 정보가 올바른 userId를 가지는지 확인
completions.forEach(comp => {
  expect(comp.userId).toBe(user._id);
});
```

**클라이언트 상태 검증**
```javascript
// 정회원으로 로그인되었는지 확인
const authState = useAuthStore.getState();
expect(authState.user.email).toBe('test@example.com');
expect(authState.user.accountType).toBe('local');
expect(authState.token).toBeDefined();
```

### 예상 결과
- ✅ ActionSheet 표시
- ✅ 마이그레이션 성공 Toast
- ✅ 클라이언트 SQLite 비어있음
- ✅ 서버에 모든 데이터 삽입됨
- ✅ 정회원으로 로그인됨
- ✅ 홈 화면으로 이동

---

## Scenario 2: 게스트 데이터 버리기

### 목적
게스트 사용자가 게스트 데이터를 버리고 정회원으로 로그인하는지 검증

### 전제 조건
- Scenario 1과 동일

### 테스트 단계

#### 1-3. Scenario 1과 동일

#### 4. 데이터 버리기 실행
```javascript
// "버리기" 선택
await pressButton('버리기');

// 로딩 인디케이터 확인
expect(screen.getByText('데이터를 가져오는 중...')).toBeVisible();

// 성공 Toast 확인
await waitFor(() => {
  expect(screen.getByText('로그인 성공')).toBeVisible();
});
```

#### 5. 데이터 검증

**클라이언트 SQLite 검증**
```javascript
// SQLite가 비어있는지 확인
const todos = await getAllTodos();
const categories = await getAllCategories();
const completions = await getAllCompletionsArray();

expect(todos.length).toBe(0);
expect(categories.length).toBe(0);
expect(completions.length).toBe(0);
```

**서버 MongoDB 검증**
```javascript
// 서버에서 데이터 조회
const user = await User.findOne({ email: 'test@example.com' });
const todos = await Todo.find({ userId: user._id });

// 게스트 데이터가 서버에 없는지 확인
expect(todos.length).toBe(0); // 기존 데이터만 있음
```

### 예상 결과
- ✅ ActionSheet 표시
- ✅ 로그인 성공 Toast
- ✅ 클라이언트 SQLite 비어있음
- ✅ 서버에 게스트 데이터 없음
- ✅ 정회원으로 로그인됨

---

## Scenario 3: 빈 게스트 데이터 - 정상 로그인

### 목적
게스트 데이터가 없을 때 ActionSheet 없이 정상 로그인되는지 검증

### 전제 조건
1. 게스트 모드로 앱 사용 중
2. SQLite에 게스트 데이터 없음 (0개 일정, 0개 카테고리)

### 테스트 단계

#### 1. 로그인 시도
```javascript
await enterEmail('test@example.com');
await enterPassword('password123');
await pressLoginButton();
```

#### 2. ActionSheet 표시 안됨 확인
```javascript
// ActionSheet가 표시되지 않음
expect(screen.queryByText('게스트 데이터 발견')).toBeNull();

// 바로 로그인 성공
await waitFor(() => {
  expect(screen.getByText('로그인 성공')).toBeVisible();
});
```

### 예상 결과
- ✅ ActionSheet 표시 안됨
- ✅ 정상 로그인
- ✅ 홈 화면으로 이동

---

## Scenario 4: 네트워크 오류 - 게스트 세션 유지

### 목적
마이그레이션 중 네트워크 오류 발생 시 게스트 세션이 유지되는지 검증

### 전제 조건
- Scenario 1과 동일

### 테스트 단계

#### 1-3. Scenario 1과 동일

#### 4. 네트워크 오류 시뮬레이션
```javascript
// 서버 중단 또는 네트워크 차단
await stopServer();

// "가져오기" 선택
await pressButton('가져오기');

// 에러 Toast 확인
await waitFor(() => {
  expect(screen.getByText('네트워크 오류')).toBeVisible();
});
```

#### 5. 게스트 세션 유지 확인
```javascript
// 게스트 세션이 유지되는지 확인
const authState = useAuthStore.getState();
expect(authState.user.accountType).toBe('anonymous');
expect(authState.token).toBeDefined();

// SQLite 데이터가 유지되는지 확인
const todos = await getAllTodos();
expect(todos.length).toBe(5);
```

### 예상 결과
- ✅ 네트워크 오류 Toast
- ✅ 게스트 세션 유지
- ✅ SQLite 데이터 유지
- ✅ 재시도 가능

---

## Scenario 5: 인증 실패 - 비밀번호 불일치

### 목적
잘못된 비밀번호로 마이그레이션 시도 시 에러 처리 검증

### 전제 조건
- Scenario 1과 동일

### 테스트 단계

#### 1. 게스트 데이터 생성 (Scenario 1과 동일)

#### 2. 잘못된 비밀번호로 로그인 시도
```javascript
await enterEmail('test@example.com');
await enterPassword('wrongpassword');
await pressLoginButton();
```

#### 3. ActionSheet 표시 및 마이그레이션 시도
```javascript
await pressButton('가져오기');

// 에러 Toast 확인
await waitFor(() => {
  expect(screen.getByText('마이그레이션 실패')).toBeVisible();
  expect(screen.getByText('비밀번호가 일치하지 않습니다')).toBeVisible();
});
```

#### 4. 게스트 세션 유지 확인
```javascript
const authState = useAuthStore.getState();
expect(authState.user.accountType).toBe('anonymous');

const todos = await getAllTodos();
expect(todos.length).toBe(5);
```

### 예상 결과
- ✅ 인증 실패 Toast
- ✅ 게스트 세션 유지
- ✅ SQLite 데이터 유지

---

## Scenario 6: 대용량 데이터 마이그레이션

### 목적
대용량 게스트 데이터(100개 일정)를 마이그레이션할 수 있는지 검증

### 전제 조건
1. 게스트 모드로 앱 사용 중
2. SQLite에 대용량 게스트 데이터 존재 (100개 일정, 10개 카테고리, 50개 완료)

### 테스트 단계

#### 1. 대용량 게스트 데이터 생성
```javascript
// 10개 카테고리 생성
for (let i = 0; i < 10; i++) {
  await createCategory({ name: `Category ${i}`, color: `#${Math.random().toString(16).slice(2, 8)}` });
}

// 100개 일정 생성
for (let i = 0; i < 100; i++) {
  await createTodo({
    title: `Todo ${i}`,
    date: `2025-02-${String(i % 28 + 1).padStart(2, '0')}`,
    categoryId: `category-${i % 10}-id`,
  });
}

// 50개 완료 정보 생성
for (let i = 0; i < 50; i++) {
  await toggleCompletion(`todo-${i}-id`, `2025-02-${String(i % 28 + 1).padStart(2, '0')}`);
}
```

#### 2-4. Scenario 1과 동일

#### 5. 데이터 검증
```javascript
// 서버에서 데이터 조회
const todos = await Todo.find({ userId: user._id });
const categories = await Category.find({ userId: user._id });
const completions = await Completion.find({ userId: user._id });

expect(todos.length).toBe(100);
expect(categories.length).toBeGreaterThanOrEqual(11); // Inbox + 마이그레이션된 카테고리 + 기존 카테고리
expect(completions.length).toBe(50);
```

### 예상 결과
- ✅ 대용량 데이터 마이그레이션 성공
- ✅ 모든 데이터 무결성 유지
- ✅ 성능: < 10초

---

## Manual Testing Checklist

### 기본 플로우
- [x] 게스트 데이터 생성
- [ ] 로그인 시 ActionSheet 표시
- [ ] "가져오기" 선택 → 마이그레이션 성공
- [ ] "버리기" 선택 → 데이터 삭제 후 로그인
- [ ] "취소" 선택 → 로그인 취소

### 에러 케이스
- [ ] 네트워크 오류 → 게스트 세션 유지
- [ ] 비밀번호 불일치 → 인증 실패 Toast
- [ ] 서버 오류 → 에러 Toast

### UI/UX
- [ ] 로딩 인디케이터 표시
- [ ] Toast 메시지 정확성
- [ ] ActionSheet 디자인 (iOS/Android)
- [ ] 버튼 비활성화 (로딩 중)

### 데이터 무결성
- [ ] SQLite 데이터 삭제 확인
- [ ] 서버 데이터 삽입 확인
- [ ] userId 일치 확인
- [ ] categoryId 일치 확인

---

## Performance Benchmarks

### 목표
- 일반 케이스 (50개 일정): < 4초
- 대용량 케이스 (500개 일정): < 18초

### 측정 항목
1. 클라이언트 데이터 수집 시간
2. 네트워크 전송 시간
3. 서버 트랜잭션 처리 시간
4. 클라이언트 동기화 시간

---

## Cleanup

### 테스트 후 정리
```javascript
// MongoDB 초기화
await Todo.deleteMany({ userId: testUser._id });
await Category.deleteMany({ userId: testUser._id });
await Completion.deleteMany({ userId: testUser._id });

// SQLite 초기화
await clearAllData();

// AsyncStorage 초기화
await AsyncStorage.clear();
```
