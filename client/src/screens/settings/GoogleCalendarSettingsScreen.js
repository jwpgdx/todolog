import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Switch, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import Toast from 'react-native-toast-message';

import { useAuthStore } from '../../store/authStore';
import api from '../../api/axios';

// Google Client ID (가이드 문서에서 발급받은 값)
const GOOGLE_CLIENT_ID = '399488138188-e5ee5mj2jpedtc1ojv3p1paus11sg1mn.apps.googleusercontent.com';

/**
 * GoogleCalendarSettingsScreen
 * 구글 캘린더 연동 설정 화면
 * 
 * 기능:
 * - Google 계정 연결/해제
 * - 캘린더 동기화 ON/OFF 토글
 */
export default function GoogleCalendarSettingsScreen({ navigation }) {
    // 웹에서만 GoogleOAuthProvider 사용
    if (Platform.OS === 'web') {
        return (
            <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
                <GoogleCalendarSettingsContent navigation={navigation} />
            </GoogleOAuthProvider>
        );
    }

    // 모바일은 Provider 없이 렌더링
    return <GoogleCalendarSettingsContent navigation={navigation} />;
}

// 실제 화면 컨텐츠 컴포넌트
function GoogleCalendarSettingsContent({ navigation }) {
    const { user, setAuth } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);

    const hasCalendarAccess = user?.hasCalendarAccess || false;
    const calendarSyncEnabled = user?.settings?.calendarSyncEnabled || false;

    // 섹션 헤더 컴포넌트
    const SectionHeader = ({ title }) => (
        <View className="px-4 pt-6 pb-2">
            <Text className="text-sm font-bold text-gray-500 dark:text-gray-400">{title}</Text>
        </View>
    );

    // 도움말 텍스트 컴포넌트
    const HelpText = ({ text }) => (
        <View className="px-4 py-2">
            <Text className="text-xs text-gray-400">{text}</Text>
        </View>
    );

    // Google 계정 연결 핸들러
    const handleConnect = async () => {
        if (Platform.OS === 'web') {
            // 웹: GoogleLoginButton 컴포넌트 사용
            // useGoogleLogin hook은 Provider 내부에서만 동작하므로 별도 버튼 컴포넌트 필요
            Toast.show({
                type: 'info',
                text1: 'Google 연결 버튼을 클릭하세요',
            });
        } else {
            // TODO: 모바일용 구현 (react-native-google-signin)
            Toast.show({
                type: 'info',
                text1: '모바일 연동은 준비 중입니다',
            });
        }
    };

    // 연결 해제 핸들러
    const handleDisconnect = async () => {
        try {
            setIsLoading(true);
            await api.post('/auth/google/calendar/disconnect');

            // 로컬 상태 업데이트
            const updatedUser = {
                ...user,
                hasCalendarAccess: false,
                settings: { ...user?.settings, calendarSyncEnabled: false },
            };
            const token = await useAuthStore.getState().token;
            await setAuth(token, updatedUser);

            Toast.show({
                type: 'success',
                text1: '캘린더 연동 해제됨',
            });
        } catch (error) {
            console.error('❌ [GoogleCalendar] 연결 해제 실패:', error);
            Toast.show({
                type: 'error',
                text1: '연결 해제 실패',
            });
        } finally {
            setIsLoading(false);
        }
    };

    // 동기화 토글 핸들러
    const handleToggleSync = async (value) => {
        try {
            setIsLoading(true);
            await api.post('/auth/google/calendar/toggle', { enabled: value });

            // 로컬 상태 업데이트
            const updatedUser = {
                ...user,
                settings: { ...user?.settings, calendarSyncEnabled: value },
            };
            const token = await useAuthStore.getState().token;
            await setAuth(token, updatedUser);

            Toast.show({
                type: 'success',
                text1: value ? '캘린더 동기화 켜짐' : '캘린더 동기화 꺼짐',
            });
        } catch (error) {
            console.error('❌ [GoogleCalendar] 토글 실패:', error);
            Toast.show({
                type: 'error',
                text1: '설정 변경 실패',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
            <ScrollView className="flex-1">
                {/* 섹션 1: 연동 상태 */}
                <SectionHeader title="연동 상태" />
                <View className="bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700">
                    <View className="px-4 py-4">
                        {hasCalendarAccess ? (
                            // 연결됨 상태
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                                    <View className="ml-3">
                                        <Text className="text-base text-gray-900 dark:text-gray-100">연결됨</Text>
                                        <Text className="text-sm text-gray-500">{user?.email}</Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={handleDisconnect}
                                    disabled={isLoading}
                                    className="px-4 py-2 rounded-lg bg-red-50 dark:bg-red-900/20"
                                >
                                    {isLoading ? (
                                        <ActivityIndicator size="small" color="#EF4444" />
                                    ) : (
                                        <Text className="text-red-500 font-medium">연결 해제</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            // 연결 안 됨 상태 - 웹에서는 Google 로그인 버튼 표시
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <Ionicons name="close-circle" size={24} color="#9CA3AF" />
                                    <Text className="ml-3 text-base text-gray-500">연결되지 않음</Text>
                                </View>
                                {Platform.OS === 'web' ? (
                                    <GoogleConnectButton
                                        isLoading={isLoading}
                                        setIsLoading={setIsLoading}
                                        user={user}
                                        setAuth={setAuth}
                                    />
                                ) : (
                                    <TouchableOpacity
                                        onPress={handleConnect}
                                        disabled={isLoading}
                                        className="px-4 py-2 rounded-lg bg-blue-500"
                                    >
                                        <Text className="text-white font-medium">Google 계정 연결</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </View>
                </View>
                <HelpText text="Google 로그인 후 캘린더 권한을 승인하면 할일이 자동으로 동기화됩니다." />

                {/* 섹션 2: 캘린더 동기화 (연결 후에만 표시) */}
                {hasCalendarAccess && (
                    <>
                        <SectionHeader title="캘린더 동기화" />
                        <View className="bg-white dark:bg-gray-800 border-t border-b border-gray-100 dark:border-gray-700">
                            <View className="flex-row items-center justify-between px-4 py-4">
                                <Text className="text-base text-gray-900 dark:text-gray-100">자동 동기화</Text>
                                <Switch
                                    value={calendarSyncEnabled}
                                    onValueChange={handleToggleSync}
                                    disabled={isLoading}
                                    trackColor={{ false: "#767577", true: "#3b82f6" }}
                                    thumbColor={Platform.OS === 'ios' ? '#fff' : calendarSyncEnabled ? "#f4f3f4" : "#f4f3f4"}
                                    ios_backgroundColor="#3e3e3e"
                                />
                            </View>
                        </View>
                        <HelpText text="켜면 할일 생성/수정/삭제 시 구글 캘린더에 자동 반영됩니다." />
                    </>
                )}

            </ScrollView>
        </SafeAreaView>
    );
}

// 웹 전용 Google 연결 버튼 (useGoogleLogin은 Provider 내부에서만 사용 가능)
function GoogleConnectButton({ isLoading, setIsLoading, user, setAuth }) {
    const googleLogin = useGoogleLogin({
        onSuccess: async (codeResponse) => {
            try {
                setIsLoading(true);
                console.log('🔑 [GoogleCalendar] OAuth 인증 코드 받음');

                // 서버에 인증 코드 전송
                const response = await api.post('/auth/google/calendar/code', {
                    code: codeResponse.code,
                });

                console.log('✅ [GoogleCalendar] 캘린더 연동 성공:', response.data);

                // 로컬 상태 업데이트
                if (response.data.user) {
                    const token = await useAuthStore.getState().token;
                    await setAuth(token, response.data.user);
                }

                Toast.show({
                    type: 'success',
                    text1: '구글 캘린더 연동 완료',
                });
            } catch (error) {
                console.error('❌ [GoogleCalendar] 연동 실패:', error);
                Toast.show({
                    type: 'error',
                    text1: '캘린더 연동 실패',
                    text2: error.response?.data?.message || '다시 시도해주세요',
                });
            } finally {
                setIsLoading(false);
            }
        },
        onError: (error) => {
            console.error('❌ [GoogleCalendar] OAuth 에러:', error);
            Toast.show({
                type: 'error',
                text1: '구글 로그인 실패',
            });
        },
        flow: 'auth-code',
        scope: 'https://www.googleapis.com/auth/calendar',
    });

    return (
        <TouchableOpacity
            onPress={() => googleLogin()}
            disabled={isLoading}
            className="px-4 py-2 rounded-lg bg-blue-500"
        >
            {isLoading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
                <Text className="text-white font-medium">Google 계정 연결</Text>
            )}
        </TouchableOpacity>
    );
}
