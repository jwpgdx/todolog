import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { deleteCategoryCascade } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();
    const { syncAll } = useSyncContext();

    return useMutation({
        mutationFn: async (id) => {
            console.log('🚀 [useDeleteCategory] 카테고리 삭제:', id);

            await ensureDatabase();

            await deleteCategoryCascade(id);
            console.log('✅ [useDeleteCategory] SQLite cascade 삭제 완료:', id);

            await addPendingChange({
                type: 'deleteCategory',
                entityId: id,
            });

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
