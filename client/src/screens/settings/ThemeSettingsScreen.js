import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, useUpdateSetting } from '../../hooks/queries/useSettings';

export default function ThemeSettingsScreen({ navigation }) {
    const { data: settings = {} } = useSettings();
    const { mutate: updateSetting } = useUpdateSetting();
    const currentTheme = settings.theme || 'system';

    const options = [
        { label: '시스템 설정', value: 'system' },
        { label: '라이트 모드', value: 'light' },
        { label: '다크 모드', value: 'dark' },
    ];

    const handleSelect = (value) => {
        updateSetting({ key: 'theme', value });
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">
                <View className="mt-4 border-t border-b border-gray-100 bg-white">
                    {options.map((option, index) => {
                        const isSelected = currentTheme === option.value;
                        const isLast = index === options.length - 1;

                        return (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => handleSelect(option.value)}
                                className={`flex-row items-center justify-between py-4 px-4 bg-white active:bg-gray-50 ${!isLast ? 'border-b border-gray-100' : ''
                                    }`}
                            >
                                <Text className="text-base text-gray-900">{option.label}</Text>
                                {isSelected && (
                                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text className="px-4 mt-2 text-sm text-gray-400">
                    시스템 설정을 선택하면 기기의 디스플레이 설정에 따라 다크 모드가 자동으로 적용됩니다.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
