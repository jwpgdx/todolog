/**
 * Guest Data Helper - Integration Test Utilities
 * 
 * 통합 테스트를 위한 게스트 데이터 생성 헬퍼 함수
 */

import * as Crypto from 'expo-crypto';
import { upsertTodo } from '../services/db/todoService';
import { upsertCategory } from '../services/db/categoryService';
import { createCompletion } from '../services/db/completionService';
import { clearAllData, initDatabase } from '../services/db/database';

// ============================================================
// 카테고리 생성
// ============================================================

/**
 * 단일 카테고리 생성
 * 
 * @param {Object} options
 * @param {string} options.name - 카테고리 이름
 * @param {string} options.color - 카테고리 색상 (hex)
 * @param {string} [options.icon] - 카테고리 아이콘
 * @param {number} [options.order] - 정렬 순서
 * @returns {Promise<Object>} - 생성된 카테고리
 */
export async function createCategory({ name, color, icon = null, order = 0 }) {
  // 데이터베이스 초기화 확인
  await initDatabase();

  const category = {
    _id: Crypto.randomUUID(),
    name,
    color,
    icon,
    order,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await upsertCategory(category);
  console.log(`✅ [Test] Category created: ${name} (${category._id})`);

  return category;
}

/**
 * 여러 카테고리 생성
 * 
 * @param {number} count - 생성할 카테고리 개수
 * @returns {Promise<Array>} - 생성된 카테고리 배열
 */
export async function createCategories(count = 2) {
  const categories = [];
  const colors = ['#FF5733', '#33FF57', '#3357FF', '#FF33F5', '#F5FF33'];

  for (let i = 0; i < count; i++) {
    const category = await createCategory({
      name: `Category ${i + 1}`,
      color: colors[i % colors.length],
      order: i,
    });
    categories.push(category);
  }

  console.log(`✅ [Test] ${count} categories created`);
  return categories;
}

// ============================================================
// 일정 생성
// ============================================================

/**
 * 단일 일정 생성
 * 
 * @param {Object} options
 * @param {string} options.title - 일정 제목
 * @param {string} options.date - 일정 날짜 (YYYY-MM-DD)
 * @param {string} options.categoryId - 카테고리 ID
 * @param {boolean} [options.isAllDay] - 종일 일정 여부
 * @param {string} [options.startTime] - 시작 시간 (HH:mm)
 * @param {string} [options.endTime] - 종료 시간 (HH:mm)
 * @param {string} [options.memo] - 메모
 * @returns {Promise<Object>} - 생성된 일정
 */
export async function createTodo({
  title,
  date,
  categoryId,
  isAllDay = true,
  startTime = null,
  endTime = null,
  memo = null,
}) {
  const todo = {
    _id: Crypto.randomUUID(),
    title,
    date,
    startDate: date,
    endDate: null,
    recurrence: null,
    categoryId,
    isAllDay,
    startTime,
    endTime,
    color: null,
    memo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await upsertTodo(todo);
  console.log(`✅ [Test] Todo created: ${title} (${todo._id})`);

  return todo;
}

/**
 * 여러 일정 생성
 * 
 * @param {number} count - 생성할 일정 개수
 * @param {string} categoryId - 카테고리 ID
 * @param {string} [startDate] - 시작 날짜 (YYYY-MM-DD)
 * @returns {Promise<Array>} - 생성된 일정 배열
 */
export async function createTodos(count = 5, categoryId, startDate = '2025-02-10') {
  const todos = [];
  const baseDate = new Date(startDate);

  for (let i = 0; i < count; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const todo = await createTodo({
      title: `Todo ${i + 1}`,
      date: dateStr,
      categoryId,
      memo: `Test memo for todo ${i + 1}`,
    });
    todos.push(todo);
  }

  console.log(`✅ [Test] ${count} todos created`);
  return todos;
}

// ============================================================
// 완료 정보 생성
// ============================================================

/**
 * 단일 완료 정보 생성
 * 
 * @param {string} todoId - 일정 ID
 * @param {string} date - 완료 날짜 (YYYY-MM-DD)
 * @returns {Promise<void>}
 */
export async function toggleCompletion(todoId, date) {
  await createCompletion(todoId, date);
  console.log(`✅ [Test] Completion created: ${todoId} on ${date}`);
}

/**
 * 여러 완료 정보 생성
 * 
 * @param {Array} todos - 일정 배열
 * @param {number} [count] - 완료 처리할 일정 개수 (기본: 전체의 절반)
 * @returns {Promise<void>}
 */
export async function createCompletions(todos, count = null) {
  const completionCount = count || Math.floor(todos.length / 2);

  for (let i = 0; i < completionCount && i < todos.length; i++) {
    await createCompletion(todos[i]._id, todos[i].date);
  }

  console.log(`✅ [Test] ${completionCount} completions created`);
}

// ============================================================
// 통합 시나리오 헬퍼
// ============================================================

/**
 * Scenario 1: 기본 게스트 데이터 생성
 * - 2개 카테고리
 * - 5개 일정
 * - 3개 완료 정보
 * 
 * @returns {Promise<Object>} - { categories, todos, completions }
 */
export async function createScenario1Data() {
  console.log('📦 [Test] Creating Scenario 1 data...');

  // 1. 카테고리 생성
  const workCategory = await createCategory({
    name: 'Work',
    color: '#FF5733',
    order: 0,
  });

  const personalCategory = await createCategory({
    name: 'Personal',
    color: '#33FF57',
    order: 1,
  });

  // 2. 일정 생성
  const todos = [];

  todos.push(await createTodo({
    title: 'Buy groceries',
    date: '2025-02-10',
    categoryId: workCategory._id,
    memo: 'Milk, eggs, bread',
  }));

  todos.push(await createTodo({
    title: 'Team meeting',
    date: '2025-02-11',
    categoryId: workCategory._id,
    memo: 'Discuss Q1 goals',
  }));

  todos.push(await createTodo({
    title: 'Gym',
    date: '2025-02-12',
    categoryId: personalCategory._id,
  }));

  todos.push(await createTodo({
    title: 'Read book',
    date: '2025-02-13',
    categoryId: personalCategory._id,
    memo: 'Finish chapter 5',
  }));

  todos.push(await createTodo({
    title: 'Call mom',
    date: '2025-02-14',
    categoryId: personalCategory._id,
  }));

  // 3. 완료 정보 생성
  await createCompletion(todos[0]._id, todos[0].date);
  await createCompletion(todos[1]._id, todos[1].date);
  await createCompletion(todos[2]._id, todos[2].date);

  console.log('✅ [Test] Scenario 1 data created successfully');

  return {
    categories: [workCategory, personalCategory],
    todos,
    completionCount: 3,
  };
}

/**
 * Scenario 6: 대용량 게스트 데이터 생성
 * - 10개 카테고리
 * - 100개 일정
 * - 50개 완료 정보
 * 
 * @returns {Promise<Object>} - { categories, todos, completions }
 */
export async function createScenario6Data() {
  console.log('📦 [Test] Creating Scenario 6 data (large dataset)...');

  // 1. 10개 카테고리 생성
  const categories = await createCategories(10);

  // 2. 100개 일정 생성
  const todos = [];
  const baseDate = new Date('2025-02-01');

  for (let i = 0; i < 100; i++) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() + (i % 28)); // 28일 주기로 반복
    const dateStr = date.toISOString().split('T')[0];

    const categoryIndex = i % categories.length;

    const todo = await createTodo({
      title: `Todo ${i + 1}`,
      date: dateStr,
      categoryId: categories[categoryIndex]._id,
      memo: `Test memo for todo ${i + 1}`,
    });
    todos.push(todo);
  }

  // 3. 50개 완료 정보 생성
  for (let i = 0; i < 50; i++) {
    await createCompletion(todos[i]._id, todos[i].date);
  }

  console.log('✅ [Test] Scenario 6 data created successfully');

  return {
    categories,
    todos,
    completionCount: 50,
  };
}

/**
 * Scenario 7: Todo Calendar V2 line-monthly validation data
 * - current anchor month centered data (2026-03)
 * - includes:
 *   - adjacent-month cross-month span
 *   - row-segmented cross-week span
 *   - timed multi-day span
 *   - recurring single-day occurrence
 *   - overflow on one day (`...`)
 *
 * @returns {Promise<Object>} - { categories, todos, completionCount }
 */
export async function createTodoCalendarV2ScenarioData() {
  console.log('📦 [Test] Creating Scenario 7 data (todo-calendar-v2)...');

  await clearAllData();
  await initDatabase();

  const workCategory = await createCategory({
    name: 'Work',
    color: '#EF4444',
    order: 0,
  });

  const travelCategory = await createCategory({
    name: 'Travel',
    color: '#2563EB',
    order: 1,
  });

  const personalCategory = await createCategory({
    name: 'Personal',
    color: '#16A34A',
    order: 2,
  });

  const now = new Date().toISOString();
  const todos = [
    {
      _id: Crypto.randomUUID(),
      title: 'Month Bridge',
      startDate: '2026-02-27',
      endDate: '2026-03-02',
      date: null,
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: travelCategory._id,
      isAllDay: true,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Quarter Sprint',
      startDate: '2026-03-10',
      endDate: '2026-03-12',
      date: null,
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: workCategory._id,
      isAllDay: true,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Client Workshop',
      startDate: '2026-03-11',
      endDate: '2026-03-13',
      date: null,
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: travelCategory._id,
      isAllDay: false,
      startTime: '09:00',
      endTime: '17:00',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Read Briefing',
      startDate: '2026-03-11',
      endDate: '2026-03-11',
      date: '2026-03-11',
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: workCategory._id,
      isAllDay: true,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Doctor Visit',
      startDate: '2026-03-11',
      endDate: '2026-03-11',
      date: '2026-03-11',
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: personalCategory._id,
      isAllDay: false,
      startTime: '08:30',
      endTime: '09:00',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Lunch with Sam',
      startDate: '2026-03-11',
      endDate: '2026-03-11',
      date: '2026-03-11',
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: personalCategory._id,
      isAllDay: false,
      startTime: '12:30',
      endTime: '13:30',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Daily Stretch',
      startDate: '2026-03-10',
      endDate: null,
      date: null,
      recurrence: 'RRULE:FREQ=DAILY;UNTIL=20260314',
      recurrenceEndDate: '2026-03-14',
      categoryId: personalCategory._id,
      isAllDay: true,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: Crypto.randomUUID(),
      title: 'Release Freeze',
      startDate: '2026-03-27',
      endDate: '2026-04-02',
      date: null,
      recurrence: null,
      recurrenceEndDate: null,
      categoryId: workCategory._id,
      isAllDay: true,
      startTime: null,
      endTime: null,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const todo of todos) {
    await upsertTodo(todo);
    console.log(`✅ [Test] TC2 Scenario Todo created: ${todo.title} (${todo._id})`);
  }

  console.log('✅ [Test] Scenario 7 data created successfully');

  return {
    categories: [workCategory, travelCategory, personalCategory],
    todos,
    completionCount: 0,
  };
}

/**
 * 빈 게스트 데이터 생성 (Scenario 3용)
 * - 모든 데이터 삭제
 * 
 * @returns {Promise<void>}
 */
export async function createScenario3Data() {
  console.log('📦 [Test] Creating Scenario 3 data (empty)...');
  await clearAllData();
  console.log('✅ [Test] All data cleared');
}

// ============================================================
// 데이터 검증 헬퍼
// ============================================================

/**
 * 게스트 데이터 통계 조회
 * 
 * @returns {Promise<Object>} - { todoCount, categoryCount, completionCount }
 */
export async function getGuestDataStats() {
  // 데이터베이스 초기화 확인
  await initDatabase();

  const { getTodoCount } = await import('../services/db/todoService');
  const { getCategoryCount } = await import('../services/db/categoryService');
  const { getCompletionCount } = await import('../services/db/completionService');

  const todoCount = await getTodoCount();
  const categoryCount = await getCategoryCount();
  const completionCount = await getCompletionCount();

  return { todoCount, categoryCount, completionCount };
}

/**
 * 게스트 데이터 통계 출력
 * 
 * @returns {Promise<void>}
 */
export async function printGuestDataStats() {
  const stats = await getGuestDataStats();
  console.log('📊 [Test] Guest Data Stats:');
  console.log(`  - Todos: ${stats.todoCount}`);
  console.log(`  - Categories: ${stats.categoryCount}`);
  console.log(`  - Completions: ${stats.completionCount}`);
}

// ============================================================
// 테스트 계정 생성
// ============================================================

/**
 * 테스트용 회원 계정 생성
 * 
 * @returns {Promise<Object>} - { email, password, user }
 */
export async function createTestAccount() {
  const email = `test_${Date.now()}@example.com`;
  const password = 'test1234';

  console.log('📦 [Test] Creating test account...');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);

  try {
    const { authAPI } = await import('../api/auth');

    // 회원가입 시도
    const response = await authAPI.register({
      email,
      password,
      name: 'Test User',
    });

    console.log('✅ [Test] Test account created successfully');

    return {
      email,
      password,
      user: response.data.user,
    };
  } catch (error) {
    console.error('❌ [Test] Failed to create test account:', error);
    throw error;
  }
}

// ============================================================
// 정리 헬퍼
// ============================================================

/**
 * 모든 게스트 데이터 삭제
 * 
 * @returns {Promise<void>}
 */
export async function cleanupGuestData() {
  console.log('🧹 [Test] Cleaning up guest data...');
  await clearAllData();
  console.log('✅ [Test] Guest data cleaned up');
}
