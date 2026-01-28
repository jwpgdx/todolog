import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CATEGORY_PALETTE } from '../../../constants/categoryColors';

export default function CategoryColorList({ selectedColor, onSelectColor }) {
    return (
        <ScrollView className="flex-1 bg-white">
            <View className="px-4 py-2">
                {CATEGORY_PALETTE.map(({ id, value: colorValue, name }) => (
                    <TouchableOpacity
                        key={id}
                        onPress={() => onSelectColor(colorValue)}
                        className="flex-row items-center justify-between py-4 border-b border-gray-100"
                    >
                        <View className="flex-row items-center">
                            <View
                                style={{ backgroundColor: colorValue }}
                                className="w-6 h-6 rounded-full mr-3 border border-gray-200"
                            />
                            <Text className="text-base text-gray-900">{name}</Text>
                        </View>
                        {selectedColor === colorValue && (
                            <Ionicons name="checkmark" size={20} color="#3B82F6" />
                        )}
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
}
