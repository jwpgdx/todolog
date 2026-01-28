import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Localization from 'expo-localization';
import { useSettings, useUpdateSetting } from '../../hooks/queries/useSettings';
import { useTimeZone, getTimeZoneDisplayName } from '../../hooks/useTimeZone';

export default function TimeZoneSettingsScreen({ navigation }) {
    const { data: settings = {} } = useSettings();
    const { mutate: updateSetting } = useUpdateSetting();
    const { updateTimeZone } = useTimeZone();

    const currentTimeZone = settings.timeZone || 'Asia/Seoul';
    const isAuto = settings.timeZoneAuto ?? true;

    const toggleAuto = async (value) => {
        // 1. UI 선반영 (Optimistic)
        updateSetting({ key: 'timeZoneAuto', value });

        if (value) {
            // Auto ON -> 현재 기기 타임존으로 즉시 변경
            const deviceTimeZone = Localization.getCalendars()[0]?.timeZone || 'Asia/Seoul';
            if (deviceTimeZone !== currentTimeZone) {
                await updateTimeZone(deviceTimeZone);
            }
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">
                <View className="mb-6">
                    {/* 섹션 1: 자동 설정 스위치 */}
                    <View className="px-4 pt-6 pb-2">
                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400">설정 방식</Text>
                    </View>
                    <View className="bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700">
                        <View className="flex-row items-center justify-between px-4 py-4">
                            <Text className="text-base text-gray-900 dark:text-gray-100">자동으로 설정</Text>
                            <Switch
                                value={isAuto}
                                onValueChange={toggleAuto}
                                trackColor={{ false: "#767577", true: "#3b82f6" }}
                                thumbColor={Platform.OS === 'ios' ? '#fff' : isAuto ? "#f4f3f4" : "#f4f3f4"}
                                ios_backgroundColor="#3e3e3e"
                            />
                        </View>
                    </View>

                    {/* 섹션 2: 타임존 선택 (Nav Row) */}
                    <View className="px-4 pt-6 pb-2">
                        <Text className="text-sm font-bold text-gray-500 dark:text-gray-400">시간대</Text>
                    </View>
                    <View className="bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700">
                        <TouchableOpacity
                            onPress={() => navigation.navigate('TimeZoneSelection')}
                            disabled={isAuto}
                            className={`flex-row items-center justify-between py-4 px-4 ${isAuto ? 'opacity-50' : 'active:bg-gray-50 dark:active:bg-gray-700'}`}
                        >
                            <Text className="text-base text-gray-900 dark:text-gray-100">타임존</Text>

                            <View className="flex-row items-center">
                                <Text className="text-gray-500 text-sm mr-2 dark:text-gray-400">
                                    {currentTimeZone}
                                </Text>
                                {!isAuto && (
                                    <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                                )}
                            </View>
                        </TouchableOpacity>
                    </View>
                    <View className="px-4 py-2">
                        <Text className="text-xs text-gray-400">
                            {isAuto
                                ? "현재 위치에 따라 시간대가 자동으로 업데이트됩니다."
                                : "선택한 시간대가 고정되어 유지됩니다."}
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}
