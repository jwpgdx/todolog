import React, { useState, useLayoutEffect } from 'react';
import { Text, TouchableOpacity, ScrollView } from 'react-native';
import { useCreateCategory, useUpdateCategory } from '../hooks/queries/useCategories';
import Toast from 'react-native-toast-message';
import CategoryForm from '../components/domain/category/CategoryForm';
import { DEFAULT_COLOR } from '../constants/categoryColors';



export default function CategoryFormScreen({ navigation, route }) {
    const { category } = route.params || {};
    const isEditMode = !!category;

    const [name, setName] = useState(category?.name || '');
    const [selectedColor, setSelectedColor] = useState(category?.color || DEFAULT_COLOR); // Default Peacock
    const [isLoading, setIsLoading] = useState(false);

    const createCategory = useCreateCategory();
    const updateCategory = useUpdateCategory();

    useLayoutEffect(() => {
        navigation.setOptions({
            title: isEditMode ? '카테고리 수정' : '새 카테고리',
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!name.trim() || isLoading}
                    className="mr-2"
                >
                    <Text className={`text-base font-semibold ${!name.trim() || isLoading ? 'text-gray-400' : 'text-blue-600'}`}>
                        {isLoading ? '저장 중' : '완료'}
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, name, selectedColor, isLoading]);

    const handleSubmit = () => {
        if (!name.trim()) return;

        setIsLoading(true);

        if (isEditMode) {
            updateCategory.mutate(
                {
                    id: category._id,
                    data: {
                        name: name.trim(),
                        color: selectedColor,
                    }
                },
                {
                    onSuccess: () => {
                        setIsLoading(false);
                        Toast.show({ type: 'success', text1: '카테고리가 수정되었습니다.' });
                        navigation.goBack();
                    },
                    onError: (error) => {
                        setIsLoading(false);
                        const message = error.response?.data?.message || '카테고리 수정에 실패했습니다.';
                        Toast.show({ type: 'error', text1: message });
                    }
                }
            );
        } else {
            createCategory.mutate(
                { name: name.trim(), color: selectedColor },
                {
                    onSuccess: () => {
                        setIsLoading(false);
                        Toast.show({ type: 'success', text1: '카테고리가 생성되었습니다.' });
                        navigation.goBack();
                    },
                    onError: (error) => {
                        setIsLoading(false);
                        const message = error.response?.data?.message || '카테고리 생성에 실패했습니다.';
                        Toast.show({ type: 'error', text1: message });
                    }
                }
            );
        }
    };

    return (
        <ScrollView className="flex-1 bg-white px-6 pt-6">
            <CategoryForm
                name={name}
                onNameChange={setName}
                selectedColor={selectedColor}
                onColorSelectPress={() => navigation.navigate('CategoryColor', {
                    selectedColor,
                    onSelect: (color) => setSelectedColor(color)
                })}
                autoFocus={!isEditMode}
            />
        </ScrollView>
    );
}
