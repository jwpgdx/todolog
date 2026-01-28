import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_PALETTE } from '../../../constants/categoryColors';
import Input from '../../ui/Input';

export default function CategoryForm({
    name,
    onNameChange,
    selectedColor,
    onColorSelectPress,
    autoFocus = false
}) {
    const currentColor = CATEGORY_PALETTE.find(c => c.value === selectedColor);
    const displayColor = currentColor?.value || selectedColor;

    return (
        <View>
            <View className="mb-6">
                <Text className="text-gray-900 font-semibold mb-2">이름</Text>
                <Input
                    placeholder="카테고리 이름을 입력하세요"
                    value={name}
                    onChangeText={onNameChange}
                    autoFocus={autoFocus}
                    returnKeyType="done"
                />
            </View>

            <View className="mb-6">
                <Text className="text-gray-900 font-semibold mb-3">색상</Text>
                <TouchableOpacity
                    onPress={onColorSelectPress}
                    className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                >
                    <View className="flex-row items-center">
                        <View
                            style={{ backgroundColor: displayColor }}
                            className="w-6 h-6 rounded-full mr-3 border border-gray-200"
                        />
                        <Text className="text-base text-gray-900">
                            {currentColor?.name || '색상 선택'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const getCategoryColor = (colorValue) => {
    return CATEGORY_PALETTE.find(c => c.value === colorValue) || { value: colorValue, name: '사용자 지정' };
};
