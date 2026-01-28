import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, useUpdateSetting } from '../../hooks/queries/useSettings';
import { useTranslation } from 'react-i18next';

export default function StartDaySettingsScreen({ navigation }) {
    const { data: settings = {} } = useSettings();
    const { mutate: updateSetting } = useUpdateSetting();
    const { t } = useTranslation();
    const currentStartDay = settings.startDayOfWeek || 'sunday';

    const options = [
        { label: t('day_sunday'), value: 'sunday' },
        { label: t('day_monday'), value: 'monday' },
    ];

    const handleSelect = (value) => {
        updateSetting({ key: 'startDayOfWeek', value });
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">
                <View className="mt-4 border-t border-b border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700">
                    {options.map((option, index) => {
                        const isSelected = currentStartDay === option.value;
                        const isLast = index === options.length - 1;

                        return (
                            <TouchableOpacity
                                key={option.value}
                                onPress={() => handleSelect(option.value)}
                                className={`flex-row items-center justify-between py-4 px-4 bg-white dark:bg-gray-800 active:bg-gray-50 dark:active:bg-gray-700 ${!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''
                                    }`}
                            >
                                <Text className="text-base text-gray-900 dark:text-gray-100">{option.label}</Text>
                                {isSelected && (
                                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
                <Text className="px-4 mt-2 text-sm text-gray-400 dark:text-gray-500">
                    캘린더와 주간 보기에서 한 주의 시작을 설정합니다.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
