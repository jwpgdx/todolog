import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { useTimeZone, COMMON_TIMEZONES } from '../../hooks/useTimeZone';

export default function TimeZoneSelectionScreen({ navigation }) {
    const { user } = useAuthStore();
    const { updateTimeZone } = useTimeZone();

    // settings.timeZone이 우선, 없으면 root level timeZone, 없으면 기본값
    const currentTimeZone = user?.settings?.timeZone || user?.timeZone || 'Asia/Seoul';

    const handleSelect = async (timeZone) => {
        // iOS 스타일: 토스트 없이 업데이트하고 화면 유지 (체크 표시만 바뀜)
        await updateTimeZone(timeZone, { silent: true });
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">
                <View className="bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700 mt-4">
                    {COMMON_TIMEZONES.map((timeZone, index) => {
                        const isSelected = timeZone === currentTimeZone;
                        const isLast = index === COMMON_TIMEZONES.length - 1;

                        return (
                            <TouchableOpacity
                                key={timeZone}
                                onPress={() => handleSelect(timeZone)}
                                className={`flex-row items-center justify-between py-4 px-4 active:bg-gray-50 dark:active:bg-gray-700 ${!isLast ? 'border-b border-gray-100 dark:border-gray-700' : ''
                                    }`}
                            >
                                <Text className={`text-base ${isSelected ? 'font-bold text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}>
                                    {timeZone}
                                </Text>

                                {isSelected && (
                                    <Ionicons name="checkmark" size={20} color="#3b82f6" />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
