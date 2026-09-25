import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { upsertCategory, getCategoryById } from '../../services/db/categoryService';
import { addPendingChangeOnConnection } from '../../services/db/pendingService';
import { withWriteTransaction } from '../../services/db/database';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

export const useUpdateCategory = () => {
    const queryClient = useQueryClient();
    const { syncAll } = useSyncContext();

    return useMutation({
        mutationFn: async ({ id, data }) => {
            console.log('🚀 [useUpdateCategory] 카테고리 수정:', id, data);

            const updated = await withWriteTransaction(async (transaction) => {
                const existing = await getCategoryById(id, transaction);
            if (!existing) {
                throw new Error(`Category not found: ${id}`);
            }

                const nextCategory = {
                    ...existing,
                    ...data,
                    updatedAt: new Date().toISOString(),
                };
                await upsertCategory(nextCategory, transaction);
                await addPendingChangeOnConnection(transaction, {
                    type: 'updateCategory',
                    entityId: id,
                    data,
                });
                return nextCategory;
            });
            console.log('✅ [useUpdateCategory] SQLite 업데이트 완료:', id);

            try {
                const netInfo = await NetInfo.fetch();
                if (netInfo.isConnected) {
                    Promise.resolve(syncAll?.()).catch(() => { });
                }
            } catch { }

            return updated;
        },
        onSuccess: () => {
            invalidateAllScreenCaches({
                queryClient,
                reason: 'category:update',
            });
        },
    });
};
