import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { upsertCategory, getCategoryById } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';
import { useSyncContext } from '../../providers/SyncProvider';

export const useUpdateCategory = () => {
    const queryClient = useQueryClient();
    const { syncAll } = useSyncContext();

    return useMutation({
        mutationFn: async ({ id, data }) => {
            console.log('🚀 [useUpdateCategory] 카테고리 수정:', id, data);

            await ensureDatabase();

            // SQLite 즉시 업데이트
            const existing = await getCategoryById(id);
            if (!existing) {
                throw new Error(`Category not found: ${id}`);
            }

            const updated = {
                ...existing,
                ...data,
                updatedAt: new Date().toISOString(),
            };
            await upsertCategory(updated);
            console.log('✅ [useUpdateCategory] SQLite 업데이트 완료:', id);

            await addPendingChange({
                type: 'updateCategory',
                entityId: id,
                data,
            });

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
