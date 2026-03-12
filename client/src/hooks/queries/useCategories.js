import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import * as categoryApi from '../../api/categories';
import {
  getAllCategories,
  upsertCategories,
} from '../../services/db/categoryService';
import { ensureDatabase } from '../../services/db/database';

/**
 * 카테고리 목록 조회 (SQLite 기반)
 * 
 * SQLite만 조회 (Read Only):
 * - SQLite에서 직접 조회 (Source of Truth)
 * - 서버 동기화는 useSyncService가 담당
 */
export const useCategories = () => {
  const { user } = useAuthStore();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        await ensureDatabase();

        const startTime = performance.now();
        const categories = await getAllCategories();
        const endTime = performance.now();

        console.log(`⚡ [useCategories] SQLite 조회: ${categories.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

        return categories;
      } catch (error) {
        console.log('⚠️ [useCategories] SQLite 실패 - 서버 폴백');
        const serverCategories = await categoryApi.getCategories();
        // 서버 데이터를 SQLite에 저장 (이미 response.data 반환됨)
        if (serverCategories && serverCategories.length > 0) {
          await upsertCategories(serverCategories);
          return await getAllCategories();
        }
        return serverCategories || [];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  return query;
};
