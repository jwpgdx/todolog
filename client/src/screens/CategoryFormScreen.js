import React, { useState, useLayoutEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, Switch, Alert } from 'react-native';
import { useCreateCategory, useUpdateCategory } from '../hooks/queries/useCategories';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';
import CategoryForm from '../components/domain/category/CategoryForm';
import { DEFAULT_COLOR } from '../constants/categoryColors';



export default function CategoryFormScreen({ navigation, route }) {
    const { category } = route.params || {};
    const isEditMode = !!category;

    const [name, setName] = useState(category?.name || '');
    const [selectedColor, setSelectedColor] = useState(category?.color || DEFAULT_COLOR); // Default Peacock
    const [isDefault, setIsDefault] = useState(category?.isDefault || false);
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
    }, [navigation, name, selectedColor, isDefault, isLoading]);

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
                        isDefault: isDefault ? true : undefined
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

            {isEditMode && (
                <View className="flex-row items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
                    <View className="flex-1 mr-4">
                        <Text className="text-base font-semibold text-gray-900">기본 카테고리로 설정</Text>
                        <Text className="text-xs text-gray-500 mt-1">
                            {category?.isDefault
                                ? '현재 기본 카테고리입니다 (해제 불가)'
                                : '새 할일이 추가될 때 기본으로 선택됩니다'}
                        </Text>
                    </View>
                    <Switch
                        value={isDefault}
                        onValueChange={(val) => {
                            if (category?.isDefault && !val) {
                                return;
                            }
                            setIsDefault(val);
                        }}
                        trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                        thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (isDefault ? "#FFFFFF" : "#F3F4F6")}
                        disabled={category?.isDefault}
                    />
                </View>
            )}
        </ScrollView>
    );
}
