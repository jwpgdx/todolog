const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');

const root = path.resolve(__dirname, '..');
const quiet = { log() {}, warn() {}, error() {} };

function sourceModule(relativePath, mocks) {
  const filename = path.join(root, relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, 'utf8'), {
    filename,
    babelrc: false,
    configFile: false,
    plugins: [require.resolve('@babel/plugin-transform-modules-commonjs')],
  });
  const module = { exports: {} };
  const mockedRequire = (name) => {
    if (Object.prototype.hasOwnProperty.call(mocks, name)) return mocks[name];
    throw new Error(`Unmocked import ${name} in ${relativePath}`);
  };
  new Function('require', 'module', 'exports', 'console', code)(mockedRequire, module, module.exports, quiet);
  return module.exports;
}

function pending(id, type = 'updateTodo', extra = {}) {
  return {
    id,
    type,
    entityId: extra.entityId || 'todo-a',
    data: extra.data || {},
    status: extra.status || 'pending',
    nextRetryAt: extra.nextRetryAt || null,
    createdAt: extra.createdAt || '2026-09-28T00:00:00.000Z',
  };
}

function makeDeltaHarness(options = {}) {
  const calls = [];
  let pendingReads = 0;
  const transaction = { tag: 'tx' };
  const categories = options.categories ?? [{ _id: 'category-a', name: 'Server', updatedAt: '2026-09-28T00:00:01.000Z' }];
  const todoPayload = options.todoPayload ?? {
    updated: [{ _id: 'todo-a', title: 'Server title', categoryId: 'category-a', startDate: '2026-09-28', endDate: '2026-09-28', isAllDay: true, updatedAt: '2026-09-28T00:00:01.000Z' }],
    deleted: [],
    syncTime: '2026-09-28T00:00:02.000Z',
  };
  const completionPayload = options.completionPayload ?? {
    updated: [], deleted: [], syncTime: '2026-09-28T00:00:03.000Z',
  };
  const pendingSnapshots = options.pendingSnapshots || [[]];

  const dbMocks = {
    '../db/database': {
      ensureDatabase: async () => calls.push('ensure'),
      withWriteTransaction: async (task) => {
        calls.push('tx:begin');
        try {
          const value = await task(transaction);
          calls.push('tx:commit');
          return value;
        } catch (error) {
          calls.push('tx:rollback');
          throw error;
        }
      },
    },
    '../db/pendingService': {
      getPendingChanges: async (connection) => {
        calls.push(`pending:${connection?.tag || 'root'}`);
        const value = pendingSnapshots[Math.min(pendingReads, pendingSnapshots.length - 1)] || [];
        pendingReads += 1;
        return value;
      },
    },
    '../db/categoryService': {
      getAllCategories: async (connection) => {
        calls.push(`category:read:${connection?.tag || 'root'}`);
        return options.localCategories || [{ _id: 'category-a', name: 'Local', updatedAt: '2026-09-27T00:00:00.000Z' }];
      },
      upsertCategories: async (items, connection) => calls.push(`category:upsert:${items.length}:${connection?.tag || 'root'}`),
      deleteCategory: async (id, connection) => calls.push(`category:delete:${id}:${connection?.tag || 'root'}`),
    },
    '../db/todoService': {
      upsertTodos: async (items, connection) => {
        calls.push(`todo:upsert:${items.length}:${connection?.tag || 'root'}`);
        if (options.failTodoApply) throw new Error('todo apply failed');
      },
      deleteTodos: async (items, connection) => calls.push(`todo:delete:${items.length}:${connection?.tag || 'root'}`),
    },
    '../db/completionService': {
      upsertCompletions: async (items, connection) => calls.push(`completion:upsert:${items.length}:${connection?.tag || 'root'}`),
      deleteCompletionsByKeys: async (items, connection) => calls.push(`completion:delete:${items.length}:${connection?.tag || 'root'}`),
    },
  };

  const mod = sourceModule('src/services/sync/deltaPull.js', {
    '../../api/todos': {
      todoAPI: { getDeltaSync: async () => {
        calls.push('network:todo');
        if (options.failTodoFetch) throw new Error('todo fetch failed');
        return { data: todoPayload };
      } },
      completionAPI: { getDeltaSync: async () => {
        calls.push('network:completion');
        if (options.failCompletionFetch) throw new Error('completion fetch failed');
        return { data: completionPayload };
      } },
    },
    '../../api/categories': { getCategories: async () => { calls.push('network:categories'); return categories; } },
    ...dbMocks,
  });
  return { run: () => mod.runDeltaPull({ cursor: '2026-09-27T00:00:00.000Z' }), calls };
}

test('active pending intent blocks delta pull before network work', async () => {
  const h = makeDeltaHarness({ pendingSnapshots: [[pending('p1')]] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.match(result.lastError || '', /pending/i);
  assert.equal(h.calls.some(c => c.startsWith('network:')), false);
  assert.equal(h.calls.some(c => c.includes(':upsert:') || c.includes(':delete:')), false);
});

test('future-backoff pending is still protected from destructive pull', async () => {
  const h = makeDeltaHarness({ pendingSnapshots: [[pending('p1', 'updateTodo', { status: 'failed', nextRetryAt: '2026-09-29T00:00:00.000Z' })]] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.equal(h.calls.some(c => c.startsWith('network:')), false);
});

test('dead-letter rows do not permanently block pull progress', async () => {
  const dead = pending('dead-1', 'updateTodo', { status: 'dead_letter' });
  const h = makeDeltaHarness({ pendingSnapshots: [[dead], [dead]] });
  const result = await h.run();
  assert.equal(result.ok, true);
  assert.ok(h.calls.includes('tx:commit'));
});

test('pending created while remote reads are in flight aborts atomic local apply', async () => {
  const h = makeDeltaHarness({ pendingSnapshots: [[], [pending('p2')]] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.ok(h.calls.includes('network:completion'));
  assert.ok(h.calls.includes('tx:rollback'));
  assert.equal(h.calls.some(c => c.includes(':upsert:') || c.includes(':delete:')), false);
});

test('remote fetch failure performs no local apply', async () => {
  const h = makeDeltaHarness({ failTodoFetch: true, pendingSnapshots: [[], []] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.equal(h.calls.some(c => c.includes(':upsert:') || c.includes(':delete:')), false);
});

test('malformed category snapshot is rejected instead of treated as authoritative empty', async () => {
  const h = makeDeltaHarness({ categories: { data: [] }, pendingSnapshots: [[], []] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.equal(h.calls.some(c => c.startsWith('category:delete:')), false);
});

test('malformed delta arrays are rejected before local apply', async () => {
  const h = makeDeltaHarness({ todoPayload: { updated: null, deleted: [], syncTime: '2026-09-28T00:00:02.000Z' }, pendingSnapshots: [[], []] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.equal(h.calls.some(c => c.includes(':upsert:') || c.includes(':delete:')), false);
});

test('local apply receives the same exclusive transaction connection', async () => {
  const h = makeDeltaHarness({ pendingSnapshots: [[], []] });
  const result = await h.run();
  assert.equal(result.ok, true);
  assert.ok(h.calls.includes('category:read:tx'));
  assert.ok(h.calls.some(c => c.startsWith('category:upsert:') && c.endsWith(':tx')));
  assert.ok(h.calls.some(c => c.startsWith('todo:upsert:') && c.endsWith(':tx')));
  assert.ok(h.calls.includes('tx:commit'));
});

test('local apply failure rolls back the shared transaction', async () => {
  const h = makeDeltaHarness({ failTodoApply: true, pendingSnapshots: [[], []] });
  const result = await h.run();
  assert.equal(result.ok, false);
  assert.ok(h.calls.includes('tx:rollback'));
  assert.equal(h.calls.includes('tx:commit'), false);
});

test('category upsert uses conflict-update instead of delete-and-reinsert REPLACE', async () => {
  const sql = [];
  const db = { runAsync: async statement => { sql.push(statement); }, withTransactionAsync: async task => task() };
  const mod = sourceModule('src/services/db/categoryService.js', {
    './database': { getDatabase: () => db, ensureDatabase: async () => db, withWriteTransaction: async task => task(db) },
    '../../utils/idGenerator': { generateId: () => 'generated' },
  });
  await mod.upsertCategory({ _id: 'category-a', name: 'A' }, db);
  assert.match(sql[0], /ON CONFLICT\(_id\) DO UPDATE/i);
  assert.doesNotMatch(sql[0], /INSERT\s+OR\s+REPLACE/i);
});
