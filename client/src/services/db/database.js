/**
 * SQLite Database Manager
 * 
 * Phase 0: 기반 작업
 * - DB 초기화 및 스키마 생성
 * - 마이그레이션 관리
 * - 메타데이터 관리
 * 
 * ⚡ 모듈 로드 시 자동으로 초기화 시작 (대기 시간 최소화)
 */

import * as SQLite from 'expo-sqlite';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 싱글톤 DB 인스턴스
let db = null;

// 현재 마이그레이션 버전
const MIGRATION_VERSION = 5;

// ============================================================
// 스키마 정의
// ============================================================
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS metadata (
  key TEXT PRIMARY KEY,
  value TEXT
);

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

CREATE TABLE IF NOT EXISTS todos (
  _id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT,
  start_date TEXT,
  end_date TEXT,
  recurrence TEXT,
  recurrence_end_date TEXT,
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

CREATE INDEX IF NOT EXISTS idx_todos_date ON todos(date);
CREATE INDEX IF NOT EXISTS idx_todos_range ON todos(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_todos_recurrence_window ON todos(start_date, recurrence_end_date);
CREATE INDEX IF NOT EXISTS idx_todos_category ON todos(category_id);
CREATE INDEX IF NOT EXISTS idx_todos_updated ON todos(updated_at);

CREATE TABLE IF NOT EXISTS completions (
  _id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  todo_id TEXT NOT NULL,
  date TEXT,
  completed_at TEXT NOT NULL,
  FOREIGN KEY (todo_id) REFERENCES todos(_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
CREATE INDEX IF NOT EXISTS idx_completions_todo ON completions(todo_id);

CREATE TABLE IF NOT EXISTS pending_changes (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  entity_id TEXT,
  data TEXT,
  date TEXT,
  created_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_pending_created ON pending_changes(created_at);
`;

// ============================================================
// DB 초기화
// ============================================================
// 초기화 Promise 캐시 (동시 호출 방지)
let initPromise = null;

/**
 * DB 초기화 (앱 시작 시 호출)
 * 동시에 여러 번 호출되어도 안전 (Promise 재사용)
 * @returns {Promise<SQLiteDatabase>}
 */
export async function initDatabase() {
    // 이미 초기화됨
    if (db) {
        console.log('📦 [DB] Already initialized');
        return db;
    }

    // 초기화 진행 중 - Promise 재사용
    if (initPromise) {
        console.log('⏳ [DB] Initialization in progress, waiting...');
        return initPromise;
    }

    console.log('🚀 [DB] Initializing database...');

    // Promise 락 설정
    initPromise = (async () => {
        try {
            // DB 열기
            db = await SQLite.openDatabaseAsync('todos.db');
            console.log('✅ [DB] Database opened');

            // WAL 모드 활성화
            await db.execAsync('PRAGMA journal_mode = WAL');
            console.log('✅ [DB] WAL mode enabled');

            // 동기화 완화
            await db.execAsync('PRAGMA synchronous = NORMAL');

            // 외래키 제약 활성화
            await db.execAsync('PRAGMA foreign_keys = ON');
            console.log('✅ [DB] PRAGMA settings applied');

            // 스키마 생성
            await db.execAsync(SCHEMA_SQL);
            console.log('✅ [DB] Schema created');

            // 마이그레이션 체크
            const version = await getMetadata('migration_version');
            console.log(`📋 [DB] Current migration version: ${version || 'none'}`);

            if (!version || parseInt(version) < MIGRATION_VERSION) {
                console.log(`🔄 [DB] Migration needed: v${version || 0} → v${MIGRATION_VERSION}`);

                // 버전별 마이그레이션
                const currentVersion = parseInt(version || '0');

                // v1: AsyncStorage → SQLite 마이그레이션
                if (currentVersion < 1) {
                    await migrateFromAsyncStorage();
                }

                // v2: pending_changes에 entity_id 컬럼 추가 (UUID 마이그레이션)
                if (currentVersion < 2) {
                    await migrateV2AddEntityId();
                }

                // v3: completions 테이블에 _id 컬럼 추가 (UUID 전환)
                if (currentVersion < 3) {
                    await migrateV3AddCompletionId();
                }

                // v4: todos에 recurrence_end_date 컬럼 추가 + 반복 종료일 백필
                if (currentVersion < 4) {
                    await migrateV4AddRecurrenceEndDate();
                }

                // v5: pending_changes에 retry/backoff 상태 컬럼 추가
                if (currentVersion < 5) {
                    await migrateV5AddPendingRetryColumns();
                }

                await setMetadata('migration_version', String(MIGRATION_VERSION));
            } else {
                console.log('✅ [DB] No migration needed');
            }

            console.log('✅ [DB] Database initialized successfully');

            // ⚡ 테이블 워밍업 (WASM 콜드 스타트 방지)
            // 실제 데이터 페이지를 메모리에 로드하여 첫 쿼리 성능 개선
            try {
                const warmupStart = performance.now();
                console.log('🔥 [DB] 테이블 워밍업 시작...');
                
                // PRAGMA 최적화
                await db.execAsync('PRAGMA cache_size = -20000'); // 20MB 캐시
                await db.execAsync('PRAGMA mmap_size = 268435456'); // 256MB (지원 시)
                console.log('  ⚙️ [Warmup] PRAGMA 최적화 완료');
                
                // 실제 사용 순서대로 워밍업 (실제 데이터 페이지 로드)
                const todosStart = performance.now();
                await db.getAllAsync('SELECT * FROM todos LIMIT 1');
                const todosEnd = performance.now();
                console.log(`  ✅ [Warmup] todos: ${(todosEnd - todosStart).toFixed(2)}ms`);
                
                const categoriesStart = performance.now();
                await db.getAllAsync('SELECT * FROM categories LIMIT 1');
                const categoriesEnd = performance.now();
                console.log(`  ✅ [Warmup] categories: ${(categoriesEnd - categoriesStart).toFixed(2)}ms`);
                
                const completionsStart = performance.now();
                await db.getAllAsync('SELECT * FROM completions ORDER BY date DESC LIMIT 1');
                const completionsEnd = performance.now();
                console.log(`  ✅ [Warmup] completions: ${(completionsEnd - completionsStart).toFixed(2)}ms`);
                
                const warmupEnd = performance.now();
                console.log(`🔥 [DB] 테이블 워밍업 완료 (${(warmupEnd - warmupStart).toFixed(2)}ms)`);
            } catch (warmupError) {
                console.warn('⚠️ [DB] 워밍업 실패 (무시 가능):', warmupError.message);
            }

            return db;

        } catch (error) {
            console.error('❌ [DB] Initialization failed:', error);
            db = null;
            initPromise = null; // 실패 시 재시도 가능하도록
            throw error;
        }
    })();

    return initPromise;
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

/**
 * DB 초기화를 보장하고 인스턴스 반환
 * 여러 번 호출해도 안전 (초기화 Promise 재사용)
 */
export async function ensureDatabase() {
    return initDatabase();
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
                const { generateId } = require('../../utils/idGenerator');
                const completions = JSON.parse(oldCompletions);
                for (const [key, comp] of Object.entries(completions)) {
                    const completionId = comp._id || generateId();
                    await db.runAsync(`
            INSERT OR REPLACE INTO completions 
            (_id, key, todo_id, date, completed_at)
            VALUES (?, ?, ?, ?, ?)
          `, [
                        completionId,
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
                const { generateId } = require('../../utils/idGenerator');
                const pending = JSON.parse(oldPending);
                for (const p of pending) {
                    const pendingId = p.id || generateId();
                    const entityId = p.entityId || p.todoId || p.tempId || null;
                    await db.runAsync(`
            INSERT OR REPLACE INTO pending_changes 
            (id, type, entity_id, data, date, created_at, retry_count, last_error, next_retry_at, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
                        pendingId,
                        p.type,
                        entityId,
                        p.data ? JSON.stringify(p.data) : null,
                        p.date,
                        p.createdAt || new Date().toISOString(),
                        p.retryCount || 0,
                        p.lastError || null,
                        p.nextRetryAt || null,
                        p.status || 'pending',
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
 * v3 마이그레이션: completions 테이블 재생성 (_id 컬럼 추가)
 */
async function migrateV3AddCompletionId() {
    console.log('🔄 [Migration v3] Recreating completions table with _id column...');

    try {
        // 1. 기존 데이터 백업
        const existingData = await db.getAllAsync('SELECT * FROM completions');
        console.log(`📦 [Migration v3] Backing up ${existingData.length} completions`);

        // 2. 기존 테이블 삭제
        await db.runAsync('DROP TABLE IF EXISTS completions');
        console.log('🗑️ [Migration v3] Dropped old completions table');

        // 3. 새 스키마로 테이블 생성
        await db.execAsync(`
            CREATE TABLE IF NOT EXISTS completions (
              _id TEXT PRIMARY KEY,
              key TEXT NOT NULL UNIQUE,
              todo_id TEXT NOT NULL,
              date TEXT,
              completed_at TEXT NOT NULL,
              FOREIGN KEY (todo_id) REFERENCES todos(_id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date);
            CREATE INDEX IF NOT EXISTS idx_completions_todo ON completions(todo_id);
        `);
        console.log('✅ [Migration v3] Created new completions table with _id column');

        // 4. 데이터 복원 (UUID 생성)
        if (existingData.length > 0) {
            const { generateId } = require('../../utils/idGenerator');
            
            for (const row of existingData) {
                const newId = generateId();
                await db.runAsync(
                    'INSERT INTO completions (_id, key, todo_id, date, completed_at) VALUES (?, ?, ?, ?, ?)',
                    [newId, row.key, row.todo_id, row.date, row.completed_at]
                );
            }
            console.log(`✅ [Migration v3] Restored ${existingData.length} completions with UUIDs`);
        }

        console.log('✅ [Migration v3] Completed successfully');
    } catch (error) {
        console.error('❌ [Migration v3] Failed:', error);
        throw error;
    }
}

function normalizeDateOnlyString(input) {
    if (typeof input !== 'string') return null;
    const value = input.trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const yyyymmdd = value.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (yyyymmdd) {
        return `${yyyymmdd[1]}-${yyyymmdd[2]}-${yyyymmdd[3]}`;
    }

    const yyyymmddTime = value.match(/^(\d{4})(\d{2})(\d{2})T\d{6}Z?$/i);
    if (yyyymmddTime) {
        return `${yyyymmddTime[1]}-${yyyymmddTime[2]}-${yyyymmddTime[3]}`;
    }

    return null;
}

function extractUntilFromRRule(rruleString) {
    if (typeof rruleString !== 'string') return null;
    const match = rruleString.match(/(?:^|;)UNTIL=([^;]+)/i);
    if (!match) return null;
    return normalizeDateOnlyString(match[1]);
}

function extractRecurrenceEndDateFromValue(value) {
    if (!value) return null;

    if (Array.isArray(value)) {
        for (const item of value) {
            const extracted = extractRecurrenceEndDateFromValue(item);
            if (extracted) return extracted;
        }
        return null;
    }

    if (typeof value === 'string') {
        return extractUntilFromRRule(value) || normalizeDateOnlyString(value);
    }

    if (typeof value === 'object') {
        const directCandidates = [
            value.until,
            value.endDate,
            value.recurrenceEndDate,
            value.end_date,
        ];

        for (const candidate of directCandidates) {
            const extracted = extractRecurrenceEndDateFromValue(candidate);
            if (extracted) return extracted;
        }

        if (value.rrule) {
            const extracted = extractRecurrenceEndDateFromValue(value.rrule);
            if (extracted) return extracted;
        }

        if (value.rules) {
            const extracted = extractRecurrenceEndDateFromValue(value.rules);
            if (extracted) return extracted;
        }
    }

    return null;
}

function extractRecurrenceEndDateFromSerialized(recurrence) {
    if (!recurrence || typeof recurrence !== 'string') return null;

    try {
        const parsed = JSON.parse(recurrence);
        return extractRecurrenceEndDateFromValue(parsed);
    } catch {
        return extractRecurrenceEndDateFromValue(recurrence);
    }
}

/**
 * v4 마이그레이션: todos에 recurrence_end_date 컬럼 추가 + 반복 종료일 백필
 */
async function migrateV4AddRecurrenceEndDate() {
    console.log('🔄 [Migration v4] Adding recurrence_end_date column to todos...');

    try {
        const tableInfo = await db.getAllAsync("PRAGMA table_info(todos)");
        const hasRecurrenceEndDate = tableInfo.some(col => col.name === 'recurrence_end_date');

        if (!hasRecurrenceEndDate) {
            await db.runAsync('ALTER TABLE todos ADD COLUMN recurrence_end_date TEXT');
            console.log('✅ [Migration v4] Added recurrence_end_date column');
        } else {
            console.log('✅ [Migration v4] recurrence_end_date column already exists');
        }

        await db.runAsync(
            'CREATE INDEX IF NOT EXISTS idx_todos_recurrence_window ON todos(start_date, recurrence_end_date)'
        );
        console.log('✅ [Migration v4] Created idx_todos_recurrence_window index');

        const targets = await db.getAllAsync(`
            SELECT _id, recurrence
            FROM todos
            WHERE recurrence IS NOT NULL
              AND TRIM(recurrence) != ''
              AND recurrence_end_date IS NULL
        `);

        if (!targets.length) {
            console.log('✅ [Migration v4] No rows to backfill');
            return;
        }

        let updated = 0;
        let skipped = 0;

        await db.withTransactionAsync(async () => {
            for (const row of targets) {
                const recurrenceEndDate = extractRecurrenceEndDateFromSerialized(row.recurrence);
                if (!recurrenceEndDate) {
                    skipped++;
                    continue;
                }

                await db.runAsync(
                    'UPDATE todos SET recurrence_end_date = ? WHERE _id = ?',
                    [recurrenceEndDate, row._id]
                );
                updated++;
            }
        });

        console.log(`✅ [Migration v4] Backfill completed: updated=${updated}, skipped=${skipped}`);
    } catch (error) {
        console.error('❌ [Migration v4] Failed:', error);
        throw error;
    }
}

/**
 * v5 마이그레이션: pending_changes에 retry/backoff 상태 컬럼 추가
 */
async function migrateV5AddPendingRetryColumns() {
    console.log('🔄 [Migration v5] Adding retry/backoff columns to pending_changes...');

    try {
        const tableInfo = await db.getAllAsync("PRAGMA table_info(pending_changes)");
        const hasRetryCount = tableInfo.some(col => col.name === 'retry_count');
        const hasLastError = tableInfo.some(col => col.name === 'last_error');
        const hasNextRetryAt = tableInfo.some(col => col.name === 'next_retry_at');
        const hasStatus = tableInfo.some(col => col.name === 'status');

        if (!hasRetryCount) {
            await db.runAsync('ALTER TABLE pending_changes ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0');
            console.log('✅ [Migration v5] Added retry_count column');
        }

        if (!hasLastError) {
            await db.runAsync('ALTER TABLE pending_changes ADD COLUMN last_error TEXT');
            console.log('✅ [Migration v5] Added last_error column');
        }

        if (!hasNextRetryAt) {
            await db.runAsync('ALTER TABLE pending_changes ADD COLUMN next_retry_at TEXT');
            console.log('✅ [Migration v5] Added next_retry_at column');
        }

        if (!hasStatus) {
            await db.runAsync("ALTER TABLE pending_changes ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
            console.log('✅ [Migration v5] Added status column');
        }

        // 기존 행 보정: null/empty status 및 retry_count 보정
        await db.runAsync("UPDATE pending_changes SET retry_count = 0 WHERE retry_count IS NULL");
        await db.runAsync("UPDATE pending_changes SET status = 'pending' WHERE status IS NULL OR TRIM(status) = ''");

        await db.runAsync('CREATE INDEX IF NOT EXISTS idx_pending_status_retry ON pending_changes(status, next_retry_at)');
        console.log('✅ [Migration v5] Created idx_pending_status_retry index');

        console.log('✅ [Migration v5] Completed successfully');
    } catch (error) {
        console.error('❌ [Migration v5] Failed:', error);
        throw error;
    }
}

/**
 * v2 마이그레이션: pending_changes에 entity_id 컬럼 추가
 * (UUID 마이그레이션 지원)
 */
async function migrateV2AddEntityId() {
    console.log('🔄 [Migration v2] Adding entity_id column to pending_changes...');

    try {
        // 컬럼 존재 여부 확인
        const tableInfo = await db.getAllAsync("PRAGMA table_info(pending_changes)");
        const hasEntityId = tableInfo.some(col => col.name === 'entity_id');

        if (hasEntityId) {
            console.log('✅ [Migration v2] entity_id column already exists');
            return;
        }

        // 컬럼 추가
        await db.runAsync('ALTER TABLE pending_changes ADD COLUMN entity_id TEXT');
        console.log('✅ [Migration v2] Added entity_id column');

        // 기존 todo_id 데이터를 entity_id로 복사 (레거시 데이터 처리)
        const existingCount = await db.getFirstAsync('SELECT COUNT(*) as count FROM pending_changes WHERE todo_id IS NOT NULL');
        if (existingCount?.count > 0) {
            await db.runAsync('UPDATE pending_changes SET entity_id = todo_id WHERE entity_id IS NULL AND todo_id IS NOT NULL');
            console.log(`✅ [Migration v2] Copied ${existingCount.count} todo_id values to entity_id`);
        }

        console.log('✅ [Migration v2] Completed successfully');
    } catch (error) {
        console.error('❌ [Migration v2] Failed:', error);
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

/**
 * 모든 사용자 데이터 삭제 (로그아웃 시 사용)
 * metadata는 유지 (마이그레이션 버전 등)
 */
export async function clearAllData() {
    console.log('🗑️ [DB] Clearing all user data...');

    try {
        await ensureDatabase();
        
        await db.execAsync('DELETE FROM pending_changes');
        await db.execAsync('DELETE FROM completions');
        await db.execAsync('DELETE FROM todos');
        await db.execAsync('DELETE FROM categories');

        console.log('✅ [DB] All user data cleared');
    } catch (error) {
        console.error('❌ [DB] Failed to clear data:', error);
        throw error;
    }
}

// ============================================================
// ⚡ 모듈 로드 시 자동 초기화 시작 (대기 시간 최소화)
// ============================================================
// 첫 import 시점에 초기화를 시작하여 Hook이 호출될 때 이미 준비되도록 함
initDatabase().catch(err => {
    console.warn('⚠️ [DB] Auto-init failed, will retry on first use:', err.message);
});
