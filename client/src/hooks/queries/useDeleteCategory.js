import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { deleteCategory as apiDeleteCategory } from '../../api/categories';
import { deleteCategory as sqliteDeleteCategory } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';
import { invalidateAllScreenCaches } from '../../services/query-aggregation/cache';

export const useDeleteCategory = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id) => {
            console.log('🚀 [useDeleteCategory] 카테고리 삭제:', id);

            await ensureDatabase();

            // SQLite 즉시 소프트 삭제
            await sqliteDeleteCategory(id);
            console.log('✅ [useDeleteCategory] SQLite 삭제 완료:', id);

            // 네트워크 확인
            const netInfo = await NetInfo.fetch();

            if (!netInfo.isConnected) {
                console.log('📵 [useDeleteCategory] 오프라인 - Pending 추가');
                await addPendingChange({
                    type: 'deleteCategory',
                    entityId: id,
                });
                return { success: true, id };
            }

            // 온라인: 서버 전송
            try {
                await apiDeleteCategory(id);
                console.log('✅ [useDeleteCategory] 서버 삭제 성공:', id);
                return { success: true, id };
            } catch (error) {
                console.error('⚠️ [useDeleteCategory] 서버 실패 → Pending 추가:', error.message);
                await addPendingChange({
                    type: 'deleteCategory',
                    entityId: id,
                });
                return { success: true, id };
            }
        },
        onSuccess: () => {
            invalidateAllScreenCaches({
                queryClient,
                reason: 'category:delete',
            });
        },
    });
};
