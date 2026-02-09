import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import * as categoryApi from '../../api/categories';
import {
  getAllCategories,
  upsertCategory,
  upsertCategories,
  deleteCategory as deleteCategoryFromDB,
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
        }
        return serverCategories || [];
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  return query;
};

/**
 * 카테고리 생성
 */
export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoryApi.createCategory,
    onSuccess: async (newCategory) => {
      await ensureDatabase();
      await upsertCategory(newCategory);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

/**
 * 카테고리 수정
 */
export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoryApi.updateCategory,
    onSuccess: async (updatedCategory) => {
      await ensureDatabase();
      await upsertCategory(updatedCategory);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });
};

/**
 * 카테고리 삭제
 */
export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: categoryApi.deleteCategory,
    onSuccess: async (_, deletedId) => {
      await ensureDatabase();
      await deleteCategoryFromDB(deletedId);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
};
