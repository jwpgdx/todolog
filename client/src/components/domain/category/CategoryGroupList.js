import React, { useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Toast from 'react-native-toast-message';

import { useCategories } from '../../../hooks/queries/useCategories';
import { useDeleteCategory } from '../../../hooks/queries/useDeleteCategory';
import { useReorderCategory } from '../../../hooks/queries/useReorderCategory';
import NativeCategoryManager from '../../../features/category/native/NativeCategoryManager';

export default function CategoryGroupList() {
  const router = useRouter();
  const { data: categories, isLoading } = useCategories();
  const deleteMutation = useDeleteCategory();
  const reorderMutation = useReorderCategory();
  const [localCategories, setLocalCategories] = useState([]);

  useEffect(() => {
    if (categories) {
      setLocalCategories(categories);
    }
  }, [categories]);

  const handlePressCategory = (category) => {
    if (!category?._id) return;
    router.push(`/(app)/(tabs)/my-page/category/${category._id}`);
  };

  const handleEdit = (category) => {
    if (category?.systemKey === 'inbox') {
      Toast.show({ type: 'info', text1: 'Inbox 카테고리는 편집할 수 없습니다.' });
      return;
    }

    if (!category?._id) return;
    router.push({
      pathname: '/(app)/(tabs)/my-page/category/form',
      params: { categoryId: category._id },
    });
  };

  const handleCreate = () => {
    router.push('/(app)/(tabs)/my-page/category/form');
  };

  const handleDelete = async (id) => {
    const target = localCategories.find((category) => category?._id === id) || null;
    if (target?.systemKey === 'inbox') {
      Alert.alert('알림', 'Inbox 카테고리는 삭제할 수 없습니다.');
      return;
    }

    if (localCategories.length <= 1) {
      Alert.alert('알림', '마지막 카테고리는 삭제할 수 없습니다.');
      return;
    }

    Alert.alert(
      '카테고리 삭제',
      '정말 삭제하시겠습니까?\n해당 카테고리의 모든 할일도 함께 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMutation.mutateAsync(id);
              setLocalCategories((prev) =>
                prev.filter((category) => category?._id !== id)
              );
              Toast.show({ type: 'success', text1: '카테고리가 삭제되었습니다.' });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: '삭제 실패',
                text2:
                  error?.response?.data?.message ||
                  error?.message ||
                  '다시 시도해주세요',
              });
            }
          },
        },
      ]
    );
  };

  const normalizeCategoryOrder = (orderedCategories) => {
    let nextOrder = 100;

    const nextAll = orderedCategories.map((category) => {
      if (category?.systemKey === 'inbox') {
        return {
          ...category,
          order: 0,
        };
      }

      const nextCategory = {
        ...category,
        order: nextOrder,
      };
      nextOrder += 100;
      return nextCategory;
    });

    const orders = nextAll
      .filter((category) => category?._id && category?.systemKey !== 'inbox')
      .map((category) => ({
        _id: category._id,
        order: category.order,
      }));

    return {
      nextAll,
      orders,
    };
  };

  const commitCategoryOrder = (orderedCategories) => {
    const { nextAll, orders } = normalizeCategoryOrder(orderedCategories);
    setLocalCategories(nextAll);

    if (orders.length > 0) {
      reorderMutation.mutate({ orders });
    }
  };

  const handleManagedReorderCommit = (event) => {
    const categorySection = event?.sections?.find(
      (section) => section.sectionId === 'categories'
    );

    if (!categorySection) {
      return;
    }

    const categoryMap = new Map(
      localCategories.map((category) => [category._id, category])
    );
    const nextAll = categorySection.orderedItemIds
      .map((itemId) => categoryMap.get(itemId))
      .filter(Boolean);

    if (nextAll.length !== localCategories.length) {
      return;
    }

    commitCategoryOrder(nextAll);
  };

  if (isLoading) {
    return (
      <View className="px-4 mt-6">
        <Text className="text-xs text-gray-400 mb-2">카테고리</Text>
        <View className="bg-white rounded-2xl border border-gray-100 p-4">
          <Text className="text-gray-500">로딩 중...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className={Platform.OS === 'ios' ? 'mt-6' : 'px-4 mt-6'}>
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-xs font-semibold text-gray-500">카테고리</Text>
      </View>

      <NativeCategoryManager
        categories={localCategories}
        onPressAddCategory={handleCreate}
        onPressCategory={handlePressCategory}
        onRenameCategory={handleEdit}
        onDeleteCategory={handleDelete}
        onReorderCommit={handleManagedReorderCommit}
        onError={(event) => {
          console.warn('[NativeCategoryManager]', event?.message || event);
        }}
      />
    </View>
  );
}
