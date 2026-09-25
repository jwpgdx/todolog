import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { withWriteTransaction } from '../../services/db/database';
import { getTodoById, upsertTodo } from '../../services/db/todoService';
import { addPendingChangeOnConnection } from '../../services/db/pendingService';
import { useSyncContext } from '../../providers/SyncProvider';

async function applyTodoOrderUpdateOnConnection(connection, update) {
  const id = update?.id;
  if (!id) {
    throw new Error('Todo reorder entry is missing id');
  }

  const existingTodo = await getTodoById(id, connection);
  if (!existingTodo) {
    throw new Error('SQLite에서 할일을 찾을 수 없습니다');
  }
  if (existingTodo.deletedAt != null) {
    throw new Error('삭제된 일정은 재정렬할 수 없습니다');
  }

  const categoryIdProvided = Object.prototype.hasOwnProperty.call(update, 'categoryId');
  const categoryId = categoryIdProvided ? update.categoryId : existingTodo.categoryId;
  if (categoryIdProvided) {
    if (!categoryId) {
      throw new Error('Todo reorder target category is missing');
    }
    const activeCategory = await connection.getFirstAsync(
      'SELECT _id FROM categories WHERE _id = ? AND deleted_at IS NULL LIMIT 1',
      [categoryId]
    );
    if (!activeCategory) {
      throw new Error('Todo reorder target category is not active');
    }
  }

  const providedOrder = update?.order || {};
  for (const lane of ['custom', 'category']) {
    if (
      Object.prototype.hasOwnProperty.call(providedOrder, lane) &&
      (providedOrder[lane] == null || !Number.isFinite(Number(providedOrder[lane])))
    ) {
      throw new Error('Invalid todo reorder value for ' + lane);
    }
  }
  if (
    Object.prototype.hasOwnProperty.call(providedOrder, 'favorite') &&
    providedOrder.favorite != null &&
    !Number.isFinite(Number(providedOrder.favorite))
  ) {
    throw new Error('Invalid todo reorder value for favorite');
  }

  const nextOrder = {
    custom: existingTodo.order?.custom ?? existingTodo.customOrder ?? 0,
    category: existingTodo.order?.category ?? existingTodo.categoryOrder ?? 0,
    favorite: existingTodo.order?.favorite ?? existingTodo.favoriteOrder ?? null,
    ...providedOrder,
  };
  const updatedTodo = {
    ...existingTodo,
    categoryId,
    favoriteOrder: nextOrder.favorite,
    isFavorite: nextOrder.favorite != null,
    order: nextOrder,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  await upsertTodo(updatedTodo, connection);
  await addPendingChangeOnConnection(connection, {
    type: 'updateTodo',
    entityId: id,
    data: {
      ...(categoryIdProvided ? { categoryId } : {}),
      order: updatedTodo.order,
    },
  });

  return updatedTodo;
}

export const updateTodoOrder = async (update) => {
  return withWriteTransaction((transaction) =>
    applyTodoOrderUpdateOnConnection(transaction, update)
  );
};

export const updateTodoOrdersBatch = async (updates = []) => {
  if (!Array.isArray(updates) || updates.length === 0) {
    return [];
  }

  return withWriteTransaction(async (transaction) => {
    const seenIds = new Set();
    const updatedTodos = [];
    for (const update of updates) {
      if (!update?.id) {
        throw new Error('Todo reorder batch contains an entry without id');
      }
      if (seenIds.has(update.id)) {
        throw new Error('Todo reorder batch contains duplicate id: ' + update.id);
      }
      seenIds.add(update.id);
      const updatedTodo = await applyTodoOrderUpdateOnConnection(transaction, update);
      updatedTodos.push(updatedTodo);
    }
    return updatedTodos;
  });
};

function buildOptimisticTodo(todo, update) {
  const nextOrder = {
    custom: todo.order?.custom ?? todo.customOrder ?? 0,
    category: todo.order?.category ?? todo.categoryOrder ?? 0,
    favorite: todo.order?.favorite ?? todo.favoriteOrder ?? null,
    ...(update.order || {}),
  };

  return {
    ...todo,
    categoryId: update.categoryId || todo.categoryId,
    favoriteOrder: nextOrder.favorite,
    isFavorite: nextOrder.favorite != null,
    order: nextOrder,
  };
}

function getCategoryQueryId(queryKey) {
  if (Array.isArray(queryKey) && queryKey[0] === 'todos' && queryKey[1] === 'category') {
    return queryKey[2] || null;
  }

  return null;
}

function applyTodoOrderUpdates(oldTodos, updates, queryKey) {
  if (!Array.isArray(oldTodos) || !Array.isArray(updates) || updates.length === 0) {
    return oldTodos;
  }

  const updatesById = new Map(
    updates
      .filter((update) => update?.id)
      .map((update) => [update.id, update])
  );

  if (updatesById.size === 0) {
    return oldTodos;
  }

  const categoryQueryId = getCategoryQueryId(queryKey);
  let didChange = false;
  const nextTodos = oldTodos
    .map((todo) => {
      const update = updatesById.get(todo?._id);
      if (!update) {
        return todo;
      }

      didChange = true;
      return buildOptimisticTodo(todo, update);
    })
    .filter((todo) => {
      if (!categoryQueryId) {
        return true;
      }

      return todo?.categoryId === categoryQueryId;
    });

  if (categoryQueryId && nextTodos.length !== oldTodos.length) {
    didChange = true;
  }

  return didChange ? nextTodos : oldTodos;
}

export const useReorderTodo = (date) => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async (variables) => {
      const isBatch = Array.isArray(variables?.updates);
      const result = isBatch
        ? await updateTodoOrdersBatch(variables.updates)
        : await updateTodoOrder(variables);

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => {});
        }
      } catch {}

      return result;
    },
    onMutate: async (variables) => {
      if (Array.isArray(variables?.updates)) {
        await queryClient.cancelQueries({ queryKey: ['todos'] });

        const previousTodoQueries = queryClient.getQueriesData({ queryKey: ['todos'] });
        previousTodoQueries.forEach(([queryKey]) => {
          queryClient.setQueryData(queryKey, (oldTodos) =>
            applyTodoOrderUpdates(oldTodos, variables.updates, queryKey)
          );
        });

        return { previousTodoQueries };
      }

      const { id, order, categoryId } = variables;
      await queryClient.cancelQueries({ queryKey: ['todos', date] });

      const previousTodos = queryClient.getQueryData(['todos', date]);

      queryClient.setQueryData(['todos', date], (old) => {
        if (!old) return [];

        return old.map((todo) => {
          if (todo._id !== id) return todo;

          return {
            ...buildOptimisticTodo(todo, { categoryId, order }),
          };
        });
      });

      return { previousTodos };
    },
    onError: (_error, _variables, context) => {
      if (Array.isArray(context?.previousTodoQueries)) {
        context.previousTodoQueries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
        return;
      }

      if (context?.previousTodos) {
        queryClient.setQueryData(['todos', date], context.previousTodos);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', date] });
      queryClient.invalidateQueries({ queryKey: ['todos', 'category'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
