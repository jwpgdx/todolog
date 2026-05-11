import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { updateCategoryOrders } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { useSyncContext } from '../../providers/SyncProvider';

export const useReorderCategory = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async (variables) => {
      const orders = Array.isArray(variables?.orders)
        ? variables.orders
        : [{ _id: variables.id, order: variables.order }];

      await ensureDatabase();
      await updateCategoryOrders(orders);

      for (const { _id, order } of orders) {
        await addPendingChange({
          type: 'updateCategory',
          entityId: _id,
          data: { order },
        });
      }

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => { });
        }
      } catch { }

      return { orders };
    },
    onMutate: async (variables) => {
      const orders = Array.isArray(variables?.orders)
        ? variables.orders
        : [{ _id: variables.id, order: variables.order }];
      const orderMap = new Map(orders.map(({ _id, order }) => [_id, order]));

      await queryClient.cancelQueries({ queryKey: ['categories'] });

      const previousCategories = queryClient.getQueryData(['categories']);

      queryClient.setQueryData(['categories'], (old) => {
        if (!old) return [];
        return old
          .map((cat) =>
            orderMap.has(cat._id)
              ? { ...cat, order: orderMap.get(cat._id) }
              : cat
          )
          .sort((a, b) => {
          const aInbox = a?.systemKey === 'inbox';
          const bInbox = b?.systemKey === 'inbox';
          if (aInbox && !bInbox) return -1;
          if (!aInbox && bInbox) return 1;
          return (a.order || 0) - (b.order || 0);
        });
      });

      return { previousCategories };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCategories) {
        queryClient.setQueryData(['categories'], context.previousCategories);
      }
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onSuccess: async () => {
      invalidateAllScreenCaches({
        queryClient,
        reason: 'category:reorder',
      });
    },
  });
};
