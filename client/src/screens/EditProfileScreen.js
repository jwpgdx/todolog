import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function EditProfileScreen({ navigation }) {
    const { user, updateProfile } = useAuthStore();
    const [nickname, setNickname] = useState(user?.name || '');
    // 비밀번호 변경 상태
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);

    React.useLayoutEffect(() => {
        navigation.setOptions({
            headerRight: () => (
                <TouchableOpacity
                    onPress={handleSave}
                    disabled={isLoading}
                    className="mr-4"
                >
                    <Text className={`text-base font-semibold ${isLoading ? 'text-gray-400' : 'text-blue-600'}`}>
                        {isLoading ? '저장 중' : '완료'}
                    </Text>
                </TouchableOpacity>
            ),
        });
    }, [navigation, nickname, newPassword, confirmPassword, isLoading]);

    const handleSave = async () => {
        if (!nickname.trim()) {
            Toast.show({ type: 'error', text1: '닉네임을 입력해주세요.' });
            return;
        }

        // 비밀번호 변경 유효성 검사
        if (newPassword) {
            if (newPassword.length < 6) {
                Toast.show({ type: 'error', text1: '비밀번호는 6자 이상이어야 합니다.' });
                return;
            }
            if (newPassword !== confirmPassword) {
                Toast.show({ type: 'error', text1: '비밀번호가 일치하지 않습니다.' });
                return;
            }
        }

        try {
            setIsLoading(true);
            const updateData = { name: nickname };
            if (newPassword) {
                updateData.password = newPassword;
            }

            await updateProfile(updateData);

            Toast.show({ type: 'success', text1: '프로필이 수정되었습니다.' });
            setTimeout(() => {
                navigation.goBack();
            }, 500);

        } catch (error) {
            const message = error.response?.data?.message || '프로필 수정에 실패했습니다.';
            Toast.show({ type: 'error', text1: message });
        } finally {
            setIsLoading(false);
        }
    };

    const handlePhotoChange = () => {
        Toast.show({ type: 'info', text1: '사진 변경 기능은 추후 지원 예정입니다.' });
    };

    return (
        <SafeAreaView className="flex-1 bg-white" edges={['bottom']}>
            <ScrollView className="flex-1 px-6 pt-4">

                {/* 1. Photo Change */}
                <View className="items-center mb-8">
                    <TouchableOpacity onPress={handlePhotoChange} className="relative">
                        <View className="w-28 h-28 bg-gray-200 rounded-full items-center justify-center overflow-hidden">
                            <Ionicons name="person" size={60} color="#9ca3af" />
                        </View>
                        <View className="absolute bottom-0 right-0 bg-white rounded-full p-1 border border-gray-200">
                            <View className="bg-gray-800 rounded-full p-2">
                                <Ionicons name="camera" size={16} color="white" />
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 2. Nickname */}
                <View className="mb-6">
                    <Text className="text-gray-900 font-semibold mb-2">닉네임</Text>
                    <TextInput
                        value={nickname}
                        onChangeText={setNickname}
                        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                        placeholder="닉네임을 입력하세요"
                    />
                </View>

                {/* 3. Email (Read Only) */}
                <View className="mb-6">
                    <Text className="text-gray-900 font-semibold mb-2">이메일</Text>
                    <View className="flex-row items-center border-b border-gray-200 pb-2">
                        <Text className="text-gray-500 text-base flex-1">{user?.email}</Text>
                        {user?.provider === 'google' && (
                            <Ionicons name="logo-google" size={20} color="#757575" />
                        )}
                        {user?.provider === 'apple' && (
                            <Ionicons name="logo-apple" size={20} color="#000" />
                        )}
                    </View>
                    <Text className="text-xs text-gray-400 mt-1">이메일 계정은 수정할 수 없습니다.</Text>
                </View>

                {/* 4. Password Change (Email user only) */}
                {(!user?.provider || user?.provider === 'local') && (
                    <View className="mb-6 border-t border-gray-100 pt-6">
                        <Text className="text-lg font-bold mb-4">비밀번호 변경</Text>

                        <View className="mb-4">
                            <Text className="text-gray-900 font-semibold mb-2">새 비밀번호</Text>
                            <TextInput
                                value={newPassword}
                                onChangeText={setNewPassword}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                                placeholder="변경할 비밀번호 (6자 이상)"
                                secureTextEntry
                            />
                        </View>

                        <View className="mb-4">
                            <Text className="text-gray-900 font-semibold mb-2">새 비밀번호 확인</Text>
                            <TextInput
                                value={confirmPassword}
                                onChangeText={setConfirmPassword}
                                className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3"
                                placeholder="비밀번호 재입력"
                                secureTextEntry
                            />
                        </View>
                        {newPassword !== confirmPassword && confirmPassword.length > 0 && (
                            <Text className="text-red-500 text-xs mt-1">비밀번호가 일치하지 않습니다.</Text>
                        )}
                        <Text className="text-xs text-gray-400 mt-2">
                            비밀번호를 변경하지 않으려면 비워두세요.
                        </Text>
                    </View>
                )}

            </ScrollView>

            {/* Plan Info Mock */}
            <View className="p-6 border-t border-gray-100 bg-gray-50">
                <TouchableOpacity className="flex-row justify-between items-center">
                    <View>
                        <Text className="text-xs text-gray-500 mb-1">현재 이용 중인 플랜</Text>
                        <Text className="text-lg font-bold text-blue-600">Free Plan</Text>
                    </View>
                    <View className="bg-blue-100 px-3 py-1 rounded-full">
                        <Text className="text-blue-700 text-xs font-medium">업그레이드</Text>
                    </View>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
