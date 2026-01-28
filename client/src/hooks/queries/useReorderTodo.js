import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../api/axios';

export const updateTodoOrder = async ({ id, order, categoryId }) => {
  const data = { order };
  if (categoryId) data.categoryId = categoryId;
  const response = await api.put(`/todos/${id}`, data);
  return response.data;
};

export const useReorderTodo = (date) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateTodoOrder,
    onMutate: async ({ id, order, categoryId }) => {
      // Cancel refetches
      await queryClient.cancelQueries({ queryKey: ['todos', date] });

      // Snapshot previous value
      const previousTodos = queryClient.getQueryData(['todos', date]);

      // Optimistically update
      queryClient.setQueryData(['todos', date], (old) => {
        if (!old) return [];
        return old.map((todo) => {
          if (todo._id === id) {
            // Ensure order object structure exists
            const currentOrder = todo.order || { keep: 0, category: 0 };
             // Handle numeric legacy order if necessary (though getTodos handles it)
            const safeCurrentOrder = typeof currentOrder === 'number' ? { category: currentOrder } : currentOrder;
            
            return {
              ...todo,
              order: { ...safeCurrentOrder, category: order.category },
              categoryId: categoryId || todo.categoryId,
            };
          }
          return todo;
        });
      });

      return { previousTodos };
    },
    onError: (err, newTodo, context) => {
      queryClient.setQueryData(['todos', date], context.previousTodos);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos', date] });
    },
  });
};
