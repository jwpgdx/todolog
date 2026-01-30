import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import * as categoryApi from '../../api/categories';
import {
  loadCategories,
  saveCategories,
  upsertCategory,
  removeCategory,
} from '../../storage/categoryStorage';

/**
 * 카테고리 목록 조회 (Cache-First 전략)
 */
export const useCategories = () => {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      // ⚡ Cache-First: 캐시 먼저 확인
      const cachedCategories = queryClient.getQueryData(['categories']);
      if (cachedCategories) {
        // 백그라운드에서 서버 요청 (비동기)
        categoryApi.getCategories()
          .then(categories => {
            saveCategories(categories);
            queryClient.setQueryData(['categories'], categories);
            console.log('🔄 [useCategories] 백그라운드 업데이트 완료');
          })
          .catch(() => {
            // 백그라운드 업데이트 실패는 무시 (캐시 데이터 사용 중)
          });
        
        // 즉시 반환
        console.log('⚡ [useCategories] 캐시 즉시 반환:', cachedCategories.length, '개');
        return cachedCategories;
      }
      
      // 캐시 없으면 서버 요청
      try {
        console.log('🌐 [useCategories] 캐시 없음 - 서버 요청');
        const categories = await categoryApi.getCategories();
        await saveCategories(categories);
        return categories;
      } catch (error) {
        console.log('⚠️ [useCategories] 서버 요청 실패 - AsyncStorage 확인');
        
        // 서버 실패하면 AsyncStorage
        const storedCategories = await loadCategories();
        queryClient.setQueryData(['categories'], storedCategories);
        
        console.log('✅ [useCategories] AsyncStorage에서 로드:', storedCategories.length, '개');
        return storedCategories;
      }
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5분간 캐시 유지
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
