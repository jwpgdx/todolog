import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import * as categoryApi from '../../api/categories';
import {
  getAllCategories,
  upsertCategory,
  deleteCategory as deleteCategoryFromDB,
} from '../../db/categoryService';
import { ensureDatabase } from '../../db/database';

/**
 * 카테고리 목록 조회 (SQLite 기반)
 */
export const useCategories = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      try {
        await ensureDatabase();
        
        const startTime = performance.now();
        const categories = await getAllCategories();
        const endTime = performance.now();

        console.log(`⚡ [useCategories] SQLite 조회: ${categories.length}개 (${(endTime - startTime).toFixed(2)}ms)`);

        // 백그라운드 서버 동기화
        categoryApi.getCategories()
          .then(serverCategories => {
            if (serverCategories.length !== categories.length) {
              console.log('🔄 [useCategories] 서버 데이터 차이 감지');
            }
          })
          .catch(() => {});

        return categories;
      } catch (error) {
        console.log('⚠️ [useCategories] SQLite 실패 - 서버 폴백');
        const serverCategories = await categoryApi.getCategories();
        return serverCategories;
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
