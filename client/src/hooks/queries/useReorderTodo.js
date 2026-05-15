import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { ensureDatabase, getDatabase } from '../../services/db/database';
import { getTodoById, upsertTodo } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { useSyncContext } from '../../providers/SyncProvider';

export const updateTodoOrder = async ({ id, order, categoryId }) => {
  await ensureDatabase();

  const existingTodo = await getTodoById(id);
  if (!existingTodo) {
    throw new Error('SQLite에서 할일을 찾을 수 없습니다');
  }

  const nextOrder = {
    custom: existingTodo.order?.custom ?? existingTodo.customOrder ?? 0,
    category: existingTodo.order?.category ?? existingTodo.categoryOrder ?? 0,
    favorite: existingTodo.order?.favorite ?? existingTodo.favoriteOrder ?? null,
    ...(order || {}),
  };
  const updatedTodo = {
    ...existingTodo,
    categoryId: categoryId || existingTodo.categoryId,
    favoriteOrder: nextOrder.favorite,
    isFavorite: nextOrder.favorite != null,
    order: nextOrder,
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending',
  };

  await upsertTodo(updatedTodo);
  await addPendingChange({
    type: 'updateTodo',
    entityId: id,
    data: {
      ...(categoryId ? { categoryId } : {}),
      order: updatedTodo.order,
    },
  });

  return updatedTodo;
};

export const updateTodoOrdersBatch = async (updates = []) => {
  await ensureDatabase();

  const db = getDatabase();
  const updatedTodos = [];

  await db.withTransactionAsync(async () => {
    for (const update of updates) {
      if (!update?.id) {
        continue;
      }

      const existingTodo = await getTodoById(update.id);
      if (!existingTodo) {
        continue;
      }

      const nextOrder = {
        custom: existingTodo.order?.custom ?? existingTodo.customOrder ?? 0,
        category: existingTodo.order?.category ?? existingTodo.categoryOrder ?? 0,
        favorite: existingTodo.order?.favorite ?? existingTodo.favoriteOrder ?? null,
        ...(update.order || {}),
      };
      const updatedTodo = {
        ...existingTodo,
        categoryId: update.categoryId || existingTodo.categoryId,
        favoriteOrder: nextOrder.favorite,
        isFavorite: nextOrder.favorite != null,
        order: nextOrder,
        updatedAt: new Date().toISOString(),
        syncStatus: 'pending',
      };

      await upsertTodo(updatedTodo);
      await addPendingChange({
        type: 'updateTodo',
        entityId: update.id,
        data: {
          ...(update.categoryId ? { categoryId: update.categoryId } : {}),
          order: updatedTodo.order,
        },
      });

      updatedTodos.push(updatedTodo);
    }
  });

  return updatedTodos;
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
