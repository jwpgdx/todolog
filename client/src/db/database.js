/**
 * SQLite Database Manager
 * 
 * Phase 0: 기반 작업
 * - DB 초기화 및 스키마 생성
 * - 마이그레이션 관리
 * - 메타데이터 관리
 */

import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 싱글톤 DB 인스턴스
let db = null;

// 현재 마이그레이션 버전
const MIGRATION_VERSION = 1;

// ============================================================
// 스키마 정의
// ============================================================
const SCHEMA_SQL = `
-- Metadata (마이그레이션 & 동기화 상태)
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Categories (Todo의 FK이므로 먼저)
CREATE TABLE IF NOT EXISTS categories (
  _id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  deleted_at TEXT
);

-- Todos
CREATE TABLE IF NOT EXISTS todos (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,
  start_date TEXT,
  end_date TEXT,
  recurrence TEXT,
  category_id TEXT,
  is_all_day INTEGER DEFAULT 0,
  start_time TEXT,
  end_time TEXT,
  color TEXT,
  memo TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  FOREIGN KEY (category_id) REFERENCES categories(_id)
);

-- Todos 인덱스
CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date);
CREATE INDEX IF NOT EXISTS idx_todos_range ON todos(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id);
CREATE INDEX IF NOT EXISTS idx_todos_updated ON todos(updated_at);

-- Completions
CREATE TABLE IF NOT EXISTS completions (
  key TEXT PRIMARY KEY,
  todo_id TEXT NOT NULL,
  date TEXT,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (todo_id) REFERENCES todos(_id) ON DELETE CASCADE
);

-- Completions 인덱스
CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
CREATE INDEX IF NOT EXISTS idx_completions_todo ON completions(todo_id);

-- Pending Changes (오프라인 큐)
CREATE TABLE IF NOT EXISTS pending_changes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  todo_id TEXT,
  data TEXT,
  date TEXT,
  temp_id TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_changes(created_at);
`;

// ============================================================
// DB 초기화
// ============================================================

/**
 * DB 초기화 (앱 시작 시 호출)
 * @returns {Promise<SQLiteDatabase>}
 */
export async function initDatabase() {
    if (db) {
        console.log('📦 [DB] Already initialized');
        return db;
    }

    console.log('🚀 [DB] Initializing database...');

    try {
        // DB 열기
        db = await SQLite.openDatabaseAsync('todos.db');

        // WAL 모드 활성화 (동시 읽기/쓰기 성능 향상)
        await db.execAsync('PRAGMA journal_mode = WAL');
        console.log('✅ [DB] WAL mode enabled');

        // 동기화 완화 (배터리 절약)
        await db.execAsync('PRAGMA synchronous = NORMAL');

        // 외래키 제약 활성화
        await db.execAsync('PRAGMA foreign_keys = ON');

        // 스키마 생성
        await db.execAsync(SCHEMA_SQL);
        console.log('✅ [DB] Schema created');

        // 마이그레이션 체크
        const version = await getMetadata('migration_version');
        console.log(`📋 [DB] Current migration version: ${version || 'none'}`);

        if (!version || parseInt(version) < MIGRATION_VERSION) {
            console.log('🔄 [DB] Migration needed...');
            await migrateFromAsyncStorage();
            await setMetadata('migration_version', String(MIGRATION_VERSION));
        } else {
            console.log('✅ [DB] No migration needed');
        }

        console.log('✅ [DB] Database initialized successfully');
        return db;

    } catch (error) {
        console.error('❌ [DB] Initialization failed:', error);
        throw error;
    }
}

/**
 * DB 인스턴스 반환 (초기화 후 사용)
 */
export function getDatabase() {
    if (!db) {
        throw new Error('Database not initialized. Call initDatabase() first.');
    }
    return db;
}

// ============================================================
// 메타데이터 관리
// ============================================================

export async function getMetadata(key) {
    const result = await db.getFirstAsync(
        'SELECT value FROM metadata WHERE key = ?',
        [key]
    );
    return result?.value || null;
}

export async function setMetadata(key, value) {
    await db.runAsync(
        'INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)',
        [key, value]
    );
}

export async function getAllMetadata() {
    const result = await db.getAllAsync('SELECT * FROM metadata');
    const metadata = {};
    result.forEach(row => {
        metadata[row.key] = row.value;
    });
    return metadata;
}

// ============================================================
// AsyncStorage → SQLite 마이그레이션
// ============================================================

/**
 * AsyncStorage에서 SQLite로 데이터 마이그레이션
 */
export async function migrateFromAsyncStorage() {
    console.log('🚀 [Migration] Starting migration from AsyncStorage...');

    try {
        // 1. AsyncStorage에서 데이터 로드
        const [oldTodos, oldCompletions, oldCategories, oldPending] = await Promise.all([
            AsyncStorage.getItem('@todos'),
            AsyncStorage.getItem('@completions'),
            AsyncStorage.getItem('@categories'),
            AsyncStorage.getItem('@pending_changes'),
        ]);

        const hasData = oldTodos || oldCompletions || oldCategories;

        if (!hasData) {
            console.log('✅ [Migration] No data to migrate');
            return { migrated: false, reason: 'no_data' };
        }

        // 통계
        const stats = {
            categories: 0,
            todos: 0,
            completions: 0,
            pending: 0,
        };

        // 2. 트랜잭션으로 삽입
        await db.withTransactionAsync(async () => {
            // Categories 먼저 (FK 관계)
            if (oldCategories) {
                const categories = JSON.parse(oldCategories);
                for (const cat of categories) {
                    await db.runAsync(`
            INSERT OR REPLACE INTO categories 
            (_id, name, color, icon, order_index, created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `, [
                        cat._id,
                        cat.name,
                        cat.color,
                        cat.icon,
                        cat.order || 0,
                        cat.createdAt,
                        cat.updatedAt,
                        cat.deletedAt,
                    ]);
                    stats.categories++;
                }
                console.log(`✅ [Migration] Migrated ${stats.categories} categories`);
            }

            // Todos
            if (oldTodos) {
                const todos = JSON.parse(oldTodos);
                for (const todo of todos) {
                    await db.runAsync(`
            INSERT OR REPLACE INTO todos 
            (_id, title, date, start_date, end_date, recurrence, 
             category_id, is_all_day, start_time, end_time, color, memo,
             created_at, updated_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
                        todo._id,
                        todo.title,
                        todo.date,
                        todo.startDate,
                        todo.endDate,
                        todo.recurrence ? JSON.stringify(todo.recurrence) : null,
                        // categoryId가 객체일 수 있음 (이전 버그)
                        typeof todo.categoryId === 'object' ? todo.categoryId?._id : todo.categoryId,
                        todo.isAllDay ? 1 : 0,
                        todo.startTime,
                        todo.endTime,
                        todo.color,
                        todo.memo,
                        todo.createdAt || new Date().toISOString(),
                        todo.updatedAt || new Date().toISOString(),
                        todo.deletedAt,
                    ]);
                    stats.todos++;
                }
                console.log(`✅ [Migration] Migrated ${stats.todos} todos`);
            }

            // Completions
            if (oldCompletions) {
                const completions = JSON.parse(oldCompletions);
                for (const [key, comp] of Object.entries(completions)) {
                    await db.runAsync(`
            INSERT OR REPLACE INTO completions 
            (key, todo_id, date, completed_at)
            VALUES (?, ?, ?, ?)
          `, [
                        key,
                        comp.todoId,
                        comp.date,
                        comp.completedAt,
                    ]);
                    stats.completions++;
                }
                console.log(`✅ [Migration] Migrated ${stats.completions} completions`);
            }

            // Pending Changes
            if (oldPending) {
                const pending = JSON.parse(oldPending);
                for (const p of pending) {
                    await db.runAsync(`
            INSERT OR REPLACE INTO pending_changes 
            (id, type, todo_id, data, date, temp_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `, [
                        p.id,
                        p.type,
                        p.todoId,
                        p.data ? JSON.stringify(p.data) : null,
                        p.date,
                        p.tempId,
                        p.createdAt || new Date().toISOString(),
                    ]);
                    stats.pending++;
                }
                console.log(`✅ [Migration] Migrated ${stats.pending} pending changes`);
            }
        });

        // 3. 백업 생성
        console.log('💾 [Migration] Creating backup...');
        if (oldTodos) await AsyncStorage.setItem('@todos_backup', oldTodos);
        if (oldCompletions) await AsyncStorage.setItem('@completions_backup', oldCompletions);
        if (oldCategories) await AsyncStorage.setItem('@categories_backup', oldCategories);

        // 4. 원본 삭제
        console.log('🗑️ [Migration] Removing original AsyncStorage data...');
        await AsyncStorage.multiRemove([
            '@todos',
            '@completions',
            '@categories',
            '@pending_changes',
        ]);

        console.log('✅ [Migration] Migration completed successfully!');
        console.log(`📊 [Migration] Stats: ${JSON.stringify(stats)}`);

        return { migrated: true, stats };

    } catch (error) {
        console.error('❌ [Migration] Migration failed:', error);
        throw error;
    }
}

/**
 * 마이그레이션 롤백 (백업에서 복원)
 */
export async function rollbackMigration() {
    console.log('🔄 [Rollback] Starting rollback...');

    try {
        // 백업에서 복원
        const [todosBackup, completionsBackup, categoriesBackup] = await Promise.all([
            AsyncStorage.getItem('@todos_backup'),
            AsyncStorage.getItem('@completions_backup'),
            AsyncStorage.getItem('@categories_backup'),
        ]);

        if (!todosBackup && !completionsBackup && !categoriesBackup) {
            console.log('⚠️ [Rollback] No backup found');
            return { success: false, reason: 'no_backup' };
        }

        // AsyncStorage 복원
        if (todosBackup) await AsyncStorage.setItem('@todos', todosBackup);
        if (completionsBackup) await AsyncStorage.setItem('@completions', completionsBackup);
        if (categoriesBackup) await AsyncStorage.setItem('@categories', categoriesBackup);

        // SQLite 데이터 삭제
        await db.execAsync('DELETE FROM pending_changes');
        await db.execAsync('DELETE FROM completions');
        await db.execAsync('DELETE FROM todos');
        await db.execAsync('DELETE FROM categories');

        // 마이그레이션 버전 리셋
        await setMetadata('migration_version', '0');

        console.log('✅ [Rollback] Rollback completed');
        return { success: true };

    } catch (error) {
        console.error('❌ [Rollback] Rollback failed:', error);
        throw error;
    }
}

/**
 * 마이그레이션 시뮬레이션 (데이터 삭제하지 않음)
 */
export async function simulateMigration() {
    console.log('🧪 [Simulate] Simulating migration...');

    try {
        const [oldTodos, oldCompletions, oldCategories, oldPending] = await Promise.all([
            AsyncStorage.getItem('@todos'),
            AsyncStorage.getItem('@completions'),
            AsyncStorage.getItem('@categories'),
            AsyncStorage.getItem('@pending_changes'),
        ]);

        const result = {
            hasData: !!(oldTodos || oldCompletions || oldCategories),
            counts: {
                todos: oldTodos ? JSON.parse(oldTodos).length : 0,
                completions: oldCompletions ? Object.keys(JSON.parse(oldCompletions)).length : 0,
                categories: oldCategories ? JSON.parse(oldCategories).length : 0,
                pending: oldPending ? JSON.parse(oldPending).length : 0,
            },
            estimatedSize: {
                todos: oldTodos?.length || 0,
                completions: oldCompletions?.length || 0,
                categories: oldCategories?.length || 0,
            },
        };

        console.log('📊 [Simulate] Result:', result);
        return result;

    } catch (error) {
        console.error('❌ [Simulate] Simulation failed:', error);
        throw error;
    }
}

// ============================================================
// 디버그 유틸리티
// ============================================================

/**
 * 현재 DB 상태 조회
 */
export async function getDbStats() {
    const [todosCount, completionsCount, categoriesCount, pendingCount] = await Promise.all([
        db.getFirstAsync('SELECT COUNT(*) as count FROM todos WHERE deleted_at IS NULL'),
        db.getFirstAsync('SELECT COUNT(*) as count FROM completions'),
        db.getFirstAsync('SELECT COUNT(*) as count FROM categories WHERE deleted_at IS NULL'),
        db.getFirstAsync('SELECT COUNT(*) as count FROM pending_changes'),
    ]);

    const metadata = await getAllMetadata();

    return {
        todos: todosCount?.count || 0,
        completions: completionsCount?.count || 0,
        categories: categoriesCount?.count || 0,
        pending: pendingCount?.count || 0,
        metadata,
    };
}

/**
 * DB 전체 초기화 (주의: 모든 데이터 삭제)
 */
export async function resetDatabase() {
    console.log('⚠️ [DB] Resetting database...');

    await db.execAsync('DELETE FROM pending_changes');
    await db.execAsync('DELETE FROM completions');
    await db.execAsync('DELETE FROM todos');
    await db.execAsync('DELETE FROM categories');
    await db.execAsync('DELETE FROM metadata');

    console.log('✅ [DB] Database reset completed');
}
