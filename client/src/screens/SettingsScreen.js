import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next'; // 번역 훅

import { useAuthStore } from '../store/authStore';
import { useSettings, useUpdateSetting } from '../hooks/queries/useSettings';

import api from '../api/axios'; // api import 추가

export default function SettingsScreen({ navigation }) {
    const { user, setAuth } = useAuthStore();
    const { data: settings = {}, isLoading } = useSettings();
    const { mutate: updateSetting } = useUpdateSetting();
    const { t } = useTranslation();

    const handleDeleteAccount = () => {
        const confirmMessage = '정말로 탈퇴하시겠습니까?\n모든 데이터가 영구적으로 삭제됩니다.';

        const executeDelete = async () => {
            try {
                await api.delete('/auth/delete');
                // 로그아웃 처리
                await setAuth(null, null);
                // 네비게이션은 AuthStack으로 자동 전환됨 (App.js의 조건부 렌더링에 따름)
            } catch (error) {
                console.error('Delete account error:', error);
                Alert.alert('오류', '회원 탈퇴 중 문제가 발생했습니다.');
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMessage)) {
                executeDelete();
            }
        } else {
            Alert.alert(
                '회원 탈퇴',
                confirmMessage,
                [
                    { text: '취소', style: 'cancel' },
                    {
                        text: '탈퇴',
                        style: 'destructive',
                        onPress: executeDelete
                    }
                ]
            );
        }
    };

    // Helper component for list rows
    const SettingsRow = ({ title, value, onPress, isDestructive, hasSwitch, switchValue, onSwitchChange }) => (
        <TouchableOpacity
            onPress={onPress}
            disabled={hasSwitch}
            className="flex-row items-center justify-between py-4 px-4 bg-white border-b border-gray-100 active:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:active:bg-gray-700"
        >
            <Text className={`text-base ${isDestructive ? 'text-red-500' : 'text-gray-900 dark:text-gray-100'}`}>
                {title}
            </Text>

            <View className="flex-row items-center">
                {value && (
                    <Text className="text-gray-500 text-sm mr-2 dark:text-gray-400">{value}</Text>
                )}

                {hasSwitch ? (
                    <Switch
                        value={switchValue}
                        onValueChange={onSwitchChange}
                        trackColor={{ false: "#767577", true: "#3b82f6" }}
                        thumbColor={Platform.OS === 'ios' ? '#fff' : switchValue ? "#f4f3f4" : "#f4f3f4"}
                        ios_backgroundColor="#3e3e3e"
                    />
                ) : (
                    <Ionicons name="chevron-forward" size={20} color="#d1d5db" />
                )}
            </View>
        </TouchableOpacity>
    );

    const SectionHeader = ({ title }) => (
        <View className="px-4 pt-6 pb-2">
            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400">{title}</Text>
        </View>
    );

    // Mappings for display
    const themeLabels = {
        system: t('theme_system'),
        light: t('theme_light'),
        dark: t('theme_dark')
    };
    const langLabels = {
        system: t('lang_system'),
        ko: t('lang_ko'),
        en: t('lang_en'),
        ja: t('lang_ja')
    };
    const dayLabels = {
        sunday: t('day_sunday'),
        monday: t('day_monday')
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">

                {/* 화면 및 스타일 */}
                <SectionHeader title={t('screen_style')} />
                <View className="bg-white dark:bg-gray-800">
                    <SettingsRow
                        title={t('theme')}
                        value={themeLabels[settings.theme] || settings.theme}
                        onPress={() => navigation.navigate('ThemeSettings')}
                    />
                    <SettingsRow
                        title={t('language')}
                        value={langLabels[settings.language] || settings.language}
                        // onPress={() => cycleOption('language', settings.language || 'system', ['system', 'ko', 'en'])}
                        onPress={() => navigation.navigate('LanguageSettings')}
                    />
                </View>

                {/* 할 일 및 캘린더 */}
                <SectionHeader title={t('todo_calendar')} />
                <View className="bg-white dark:bg-gray-800">
                    <SettingsRow
                        title={t('notification')}
                        onPress={() => console.log('알림 설정 클릭됨')}
                    />
                    <SettingsRow
                        title={t('start_day')}
                        value={dayLabels[settings.startDayOfWeek] || settings.startDayOfWeek}
                        onPress={() => navigation.navigate('StartDaySettings')}
                    />
                    <SettingsRow
                        title={t('hide_completed')}
                        hasSwitch
                        switchValue={!settings.showCompleted}
                        onSwitchChange={(val) => {
                            updateSetting({ key: 'showCompleted', value: !val });
                        }}
                    />
                </View>

                {/* 계정 및 데이터 */}
                <SectionHeader title={t('account_data')} />
                <View className="bg-white dark:bg-gray-800">
                    <SettingsRow
                        title={t('timezone')}
                        value={settings.timeZoneAuto ? '자동' : settings.timeZone}
                        onPress={() => navigation.navigate('TimeZoneSettings')}
                    />
                    <SettingsRow
                        title={t('delete_account')}
                        isDestructive
                        onPress={handleDeleteAccount}
                    />
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}
