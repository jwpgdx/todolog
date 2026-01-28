import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, SafeAreaView } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

export default function VerifyPasswordScreen({ navigation }) {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { verifyPassword } = useAuthStore();

    const handleVerify = async () => {
        if (!password) {
            Toast.show({ type: 'error', text1: '비밀번호를 입력해주세요' });
            return;
        }

        try {
            setIsLoading(true);
            await verifyPassword(password);
            // 인증 성공 시 프로필 수정 화면으로 이동 (replace를 사용하여 뒤로가기 시 다시 비밀번호 화면으로 오지 않게 함)
            navigation.replace('EditProfile');
        } catch (error) {
            const message = error.response?.data?.message || '비밀번호가 일치하지 않습니다.';
            Toast.show({ type: 'error', text1: '인증 실패', text2: message });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-white">
            <View className="flex-1 px-6 pt-10">
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    className="mb-8"
                >
                    <Ionicons name="arrow-back" size={24} color="black" />
                </TouchableOpacity>

                <Text className="text-2xl font-bold mb-2">비밀번호 확인</Text>
                <Text className="text-gray-500 mb-8">
                    개인정보 보호를 위해 비밀번호를 입력해주세요.
                </Text>

                <TextInput
                    className="border border-gray-300 rounded-xl px-4 py-4 mb-6 text-lg bg-gray-50"
                    placeholder="비밀번호"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoFocus
                />

                <TouchableOpacity
                    className={`py-4 rounded-xl ${isLoading ? 'bg-gray-400' : 'bg-blue-500 active:bg-blue-600'}`}
                    onPress={handleVerify}
                    disabled={isLoading}
                >
                    <Text className="text-white text-center font-bold text-lg">
                        {isLoading ? '확인 중...' : '확인'}
                    </Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}
