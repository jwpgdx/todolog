import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import * as categoryApi from '../../api/categories';
import {
  loadCategories,
  saveCategories,
  upsertCategory,
  removeCategory,
} from '../../storage/categoryStorage';

/**
 * 카테고리 목록 조회 (로컬 우선 + 서버 동기화)
 */
export const useCategories = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // 서버에서 가져온 후 로컬에 저장
      const categories = await categoryApi.getCategories();
      await saveCategories(categories);
      return categories;
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
  });

  // 초기 로드: 로컬 데이터 먼저 표시
  useEffect(() => {
    const loadLocalFirst = async () => {
      const cached = queryClient.getQueryData(['categories']);
      if (!cached) {
        const local = await loadCategories();
        if (local.length > 0) {
          console.log('📱 [useCategories] 로컬 카테고리 로드:', local.length);
          queryClient.setQueryData(['categories'], local);
        }
      }
    };
    if (user) {
      loadLocalFirst();
    }
  }, [user, queryClient]);

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
      // 로컬 저장소에 추가
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
      // 로컬 저장소 업데이트
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
      // 로컬 저장소에서 삭제
      await removeCategory(deletedId);
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['todos'] });
    },
  });
};
