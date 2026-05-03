import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { ensureDatabase } from '../../services/db/database';
import { getTodoById, upsertTodo } from '../../services/db/todoService';
import { addPendingChange } from '../../services/db/pendingService';
import { useSyncContext } from '../../providers/SyncProvider';

export const updateTodoOrder = async ({ id, order, categoryId }) => {
  await ensureDatabase();

  const existingTodo = await getTodoById(id);
  if (!existingTodo) {
    throw new Error('SQLite에서 할일을 찾을 수 없습니다');
  }

  const updatedTodo = {
    ...existingTodo,
    categoryId: categoryId || existingTodo.categoryId,
    order: {
      custom: existingTodo.order?.custom ?? existingTodo.customOrder ?? 0,
      category: existingTodo.order?.category ?? existingTodo.categoryOrder ?? 0,
      favorite: existingTodo.order?.favorite ?? existingTodo.favoriteOrder ?? null,
      ...(order || {}),
    },
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

export const useReorderTodo = (date) => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async (variables) => {
      const result = await updateTodoOrder(variables);

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => {});
        }
      } catch {}

      return result;
    },
    onMutate: async ({ id, order, categoryId }) => {
      await queryClient.cancelQueries({ queryKey: ['todos', date] });

      const previousTodos = queryClient.getQueryData(['todos', date]);

      queryClient.setQueryData(['todos', date], (old) => {
        if (!old) return [];

        return old.map((todo) => {
          if (todo._id !== id) return todo;

          return {
            ...todo,
            categoryId: categoryId || todo.categoryId,
            order: {
              custom: todo.order?.custom ?? todo.customOrder ?? 0,
              category: todo.order?.category ?? todo.categoryOrder ?? 0,
              favorite: todo.order?.favorite ?? todo.favoriteOrder ?? null,
              ...(order || {}),
            },
          };
        });
      });

      return { previousTodos };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousTodos) {
        queryClient.setQueryData(['todos', date], context.previousTodos);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', date] });
    },
  });
};
