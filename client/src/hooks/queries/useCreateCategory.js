import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { getNextUserCategoryOrder, upsertCategory } from '../../services/db/categoryService';
import { addPendingChangeOnConnection } from '../../services/db/pendingService';
import { withWriteTransaction } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [useCreateCategory] 카테고리 생성 요청:', data);

      const category = await withWriteTransaction(async (transaction) => {
        const categoryId = generateId();
        const now = new Date().toISOString();
        const order = await getNextUserCategoryOrder(transaction);
        const nextCategory = {
          _id: categoryId,
          ...data,
          order,
          createdAt: now,
          updatedAt: now,
        };

        await upsertCategory(nextCategory, transaction);
        await addPendingChangeOnConnection(transaction, {
          type: 'createCategory',
          entityId: categoryId,
          data: { _id: categoryId, ...data, order },
        });

        return nextCategory;
      });
      console.log('✅ [useCreateCategory] SQLite 저장 완료:', category._id);

      try {
        const netInfo = await NetInfo.fetch();
        if (netInfo.isConnected) {
          Promise.resolve(syncAll?.()).catch(() => { });
        }
      } catch { }

      return category;
    },
    onSuccess: () => {
      invalidateAllScreenCaches({
        queryClient,
        reason: 'category:create',
      });
    },
  });
};
