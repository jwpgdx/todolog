import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSettings, useUpdateSetting } from '../../hooks/queries/useSettings';
import i18n from '../../utils/i18n';
import * as Localization from 'expo-localization';

export default function LanguageSettingsScreen({ navigation }) {
    const { data: settings = {} } = useSettings();
    const { mutate: updateSetting } = useUpdateSetting();
    const currentLang = settings.language || 'system';

    const options = [
        { label: '시스템 설정 (System Default)', value: 'system' },
        { label: '한국어', value: 'ko' },
        { label: 'English', value: 'en' },
        { label: '日本語', value: 'ja' },
    ];

    const handleSelect = async (value) => {
        // 1. 상태 및 서버 업데이트
        updateSetting({ key: 'language', value });

        // 2. i18n 언어 변경 (즉시 반영)
        let targetLang = value;
        if (value === 'system') {
            const locales = Localization.getLocales();
            targetLang = locales[0]?.languageCode || 'en';
        }

        // 비동기로 i18n 언어 변경
        await i18n.changeLanguage(targetLang);
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">
                <View className="mt-4 border-t border-b border-gray-100 bg-white dark:bg-gray-800 dark:border-gray-700">
                    {options.map((option, index) => {
                        const isSelected = currentLang === option.value;
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
                    시스템 설정을 선택하면 기기의 언어 설정에 따라 언어가 자동으로 변경됩니다.
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}
