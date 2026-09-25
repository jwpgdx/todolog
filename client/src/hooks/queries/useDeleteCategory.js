import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { deleteCategoryCascadeOnConnection } from '../../services/db/categoryService';
import { addPendingChangeOnConnection } from '../../services/db/pendingService';
import { withWriteTransaction } from '../../services/db/database';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();
    const { syncAll } = useSyncContext();

    return useMutation({
        mutationFn: async (id) => {
            console.log('🚀 [useDeleteCategory] 카테고리 삭제:', id);

            await withWriteTransaction(async (transaction) => {
                await deleteCategoryCascadeOnConnection(transaction, id);
                await addPendingChangeOnConnection(transaction, {
                    type: 'deleteCategory',
                    entityId: id,
                });
            });
            console.log('✅ [useDeleteCategory] SQLite cascade 삭제 완료:', id);

            try {
                const netInfo = await NetInfo.fetch();
                if (netInfo.isConnected) {
                    Promise.resolve(syncAll?.()).catch(() => { });
                }
            } catch { }

            return { success: true, id };
        },
        onSuccess: () => {
            invalidateAllScreenCaches({
                queryClient,
                reason: 'category:delete',
            });
        },
    });
};
