import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCategories, useCreateCategory, useUpdateCategory } from '../hooks/queries/useCategories';
import Toast from 'react-native-toast-message';
import CategoryForm from '../components/domain/category/CategoryForm';
import { DEFAULT_COLOR } from '../constants/categoryColors';
import { useCategoryFormDraftStore } from '../store/categoryFormDraftStore';

export default function CategoryFormScreen() {
  const router = useRouter();
  const { categoryId: rawCategoryId } = useLocalSearchParams();
  const categoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;
  const isEditMode = !!categoryId;

  const { data: categories, isLoading: isCategoriesLoading } = useCategories();
  const category = useMemo(
    () => categories?.find((cat) => cat?._id === categoryId) || null,
    [categories, categoryId]
  );

  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { selectedColor, setSelectedColor, reset: resetDraft } = useCategoryFormDraftStore();
  const hasInitializedDraftRef = useRef(false);
  const hasWarnedMissingCategoryRef = useRef(false);

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  useEffect(() => {
    resetDraft();
    hasInitializedDraftRef.current = false;
    hasWarnedMissingCategoryRef.current = false;
    return () => {
      resetDraft();
    };
  }, [resetDraft]);

  useEffect(() => {
    if (!isEditMode) {
      if (!hasInitializedDraftRef.current) {
        setName('');
        setSelectedColor(DEFAULT_COLOR);
        hasInitializedDraftRef.current = true;
      }
      return;
    }

    if (!category || hasInitializedDraftRef.current) {
      return;
    }

    setName(category?.name || '');
    setSelectedColor(category?.color || DEFAULT_COLOR);
    hasInitializedDraftRef.current = true;
  }, [isEditMode, category, setSelectedColor]);

  useEffect(() => {
    if (!isEditMode || isCategoriesLoading || category || hasWarnedMissingCategoryRef.current) {
      return;
    }

    hasWarnedMissingCategoryRef.current = true;
    Toast.show({ type: 'error', text1: '카테고리를 찾을 수 없습니다.' });
    router.back();
  }, [isEditMode, isCategoriesLoading, category, router]);

  const handleSubmit = () => {
    if (!name.trim()) return;

    setIsLoading(true);

    if (isEditMode) {
      updateCategory.mutate(
        {
          id: categoryId,
          data: {
            name: name.trim(),
            color: selectedColor,
          },
        },
        {
          onSuccess: () => {
            setIsLoading(false);
            Toast.show({ type: 'success', text1: '카테고리가 수정되었습니다.' });
            router.back();
          },
          onError: (error) => {
            setIsLoading(false);
            const message = error.response?.data?.message || '카테고리 수정에 실패했습니다.';
            Toast.show({ type: 'error', text1: message });
          },
        }
      );
      return;
    }

    createCategory.mutate(
      { name: name.trim(), color: selectedColor },
      {
        onSuccess: () => {
          setIsLoading(false);
          Toast.show({ type: 'success', text1: '카테고리가 생성되었습니다.' });
          router.back();
        },
        onError: (error) => {
          setIsLoading(false);
          const message = error.response?.data?.message || '카테고리 생성에 실패했습니다.';
          Toast.show({ type: 'error', text1: message });
        },
      }
    );
  };

  if (isEditMode && (isCategoriesLoading || !category)) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color={DEFAULT_COLOR} />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: isEditMode ? '카테고리 수정' : '새 카테고리',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!name.trim() || isLoading}
              className="mr-2"
            >
              <Text
                className={`text-base font-semibold ${!name.trim() || isLoading ? 'text-gray-400' : 'text-blue-600'}`}
              >
                {isLoading ? '저장 중' : '완료'}
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView className="flex-1 bg-white px-6 pt-6">
        <CategoryForm
          name={name}
          onNameChange={setName}
          selectedColor={selectedColor}
          onColorSelectPress={() => router.push('/(app)/category/color')}
          autoFocus={!isEditMode}
        />
      </ScrollView>
    </>
  );
}
