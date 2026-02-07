import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { updateCategory as apiUpdateCategory } from '../../api/categories';
import { upsertCategory, getCategoryById } from '../../services/db/categoryService';
import { addPendingChange } from '../../services/db/pendingService';
import { ensureDatabase } from '../../services/db/database';

export const useUpdateCategory = () => {
    const queryClient = useQueryClient();

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

            // 네트워크 확인
            const netInfo = await NetInfo.fetch();

            if (!netInfo.isConnected) {
                console.log('📵 [useUpdateCategory] 오프라인 - Pending 추가');
                await addPendingChange({
                    type: 'updateCategory',
                    entityId: id,
                    data,
                });
                return updated;
            }

            // 온라인: 서버 전송
            try {
                const serverCategory = await apiUpdateCategory({ id, data });
                console.log('✅ [useUpdateCategory] 서버 업데이트 성공:', serverCategory._id);
                await upsertCategory(serverCategory);
                return serverCategory;
            } catch (error) {
                console.error('⚠️ [useUpdateCategory] 서버 실패 → Pending 추가:', error.message);
                await addPendingChange({
                    type: 'updateCategory',
                    entityId: id,
                    data,
                });
                return updated;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
        },
    });
};
