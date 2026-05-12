import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

import { useDeleteCategory } from '../../../hooks/queries/useDeleteCategory';

export function useManagedCategoryHeaderActions({ categories = [] } = {}) {
  const router = useRouter();
  const deleteCategoryMutation = useDeleteCategory();

  const handleCategoryHeaderAction = useCallback((category, event) => {
    if (!category?._id) {
      return;
    }

    if (category.systemKey === 'inbox') {
      Toast.show({ type: 'info', text1: 'Inbox 카테고리는 변경할 수 없습니다.' });
      return;
    }

    if (event?.actionId === 'rename') {
      router.push({
        pathname: '/(app)/category/form',
        params: { categoryId: category._id },
      });
      return;
    }

    if (event?.actionId !== 'delete') {
      return;
    }

    if (categories.length <= 1) {
      Alert.alert('알림', '마지막 카테고리는 삭제할 수 없습니다.');
      return;
    }

    Alert.alert(
      '카테고리 삭제',
      `"${category.name || '카테고리'}" 카테고리를 삭제할까요?\n해당 카테고리의 모든 일정도 함께 삭제됩니다.`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCategoryMutation.mutateAsync(category._id);
              Toast.show({ type: 'success', text1: '카테고리가 삭제되었습니다.' });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: '삭제 실패',
                text2: error?.response?.data?.message || error?.message || '다시 시도해주세요',
              });
            }
          },
        },
      ]
    );
  }, [categories.length, deleteCategoryMutation, router]);

  return {
    handleCategoryHeaderAction,
  };
}
