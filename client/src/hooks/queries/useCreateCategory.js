import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { upsertCategory } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { generateId } from '../../utils/idGenerator';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

export const useCreateCategory = () => {
  const queryClient = useQueryClient();
  const { syncAll } = useSyncContext();

  return useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [useCreateCategory] 카테고리 생성 요청:', data);

      await ensureDatabase();

      const categoryId = generateId();
      const now = new Date().toISOString();
      const category = {
        _id: categoryId,
        ...data,
        createdAt: now,
        updatedAt: now,
      };

      await upsertCategory(category);
      console.log('✅ [useCreateCategory] SQLite 저장 완료:', categoryId);

      await addPendingChange({
        type: 'createCategory',
        entityId: categoryId,
        data: { _id: categoryId, ...data },
      });

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
