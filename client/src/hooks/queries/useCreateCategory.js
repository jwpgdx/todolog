import { useMutation, useQueryClient } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';
import { createCategory as apiCreateCategory } from '../../api/categories';
import { upsertCategory } from '../../db/categoryService';
import { addPendingChange } from '../../db/pendingService';
import { ensureDatabase } from '../../db/database';
import { generateId } from '../../utils/idGenerator';

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => {
      console.log('🚀 [useCreateCategory] 카테고리 생성 요청:', data);

      await ensureDatabase();

      // UUID 생성 (클라이언트에서)
      const categoryId = generateId();
      const category = {
        _id: categoryId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // SQLite에 즉시 저장
      await upsertCategory(category);
      console.log('✅ [useCreateCategory] SQLite 저장 완료:', categoryId);

      // 네트워크 확인
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        console.log('📵 [useCreateCategory] 오프라인 - Pending 추가');
        await addPendingChange({
          type: 'createCategory',
          entityId: categoryId,
          data: { _id: categoryId, ...data },
        });
        return category;
      }

      // 온라인: 서버 전송
      try {
        const serverCategory = await apiCreateCategory({ _id: categoryId, ...data });
        console.log('✅ [useCreateCategory] 서버 저장 성공:', serverCategory._id);

        // 서버 응답으로 SQLite 업데이트 (updatedAt 동기화)
        await upsertCategory(serverCategory);
        return serverCategory;
      } catch (error) {
        console.error('⚠️ [useCreateCategory] 서버 실패 → Pending 추가:', error.message);
        await addPendingChange({
          type: 'createCategory',
          entityId: categoryId,
          data: { _id: categoryId, ...data },
        });
        return category;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};
