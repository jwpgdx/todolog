import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Toast from 'react-native-toast-message';

const BaseToastContent = ({ type, text1, text2 }) => {
    const isSuccess = type === 'success';

    // 아이콘 색상 및 배경 설정
    const iconName = isSuccess ? 'checkmark' : 'alert';
    const iconColor = isSuccess ? '#10B981' : '#EF4444';
    const iconBg = isSuccess ? 'bg-green-100' : 'bg-red-100';

    return (
        <View
            // 크기, 여백, 배경색, 둥글기는 NativeWind로 깔끔하게
            className="w-[90%] mt-2.5 bg-white rounded-[24px]"

            style={{
                boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
                elevation: 5
            }}
        >
            <TouchableOpacity
                onPress={() => Toast.hide()}
                activeOpacity={0.8}
                // bg-white: 완전 불투명 흰색 배경
                // border-gray-100: 아주 연한 테두리로 깔끔함 추가
                className="flex-row items-center p-4 bg-white rounded-[24px] border border-gray-100"
            >
                {/* 아이콘 */}
                <View className={`${iconBg} p-2 rounded-full mr-3`}>
                    <Ionicons name={iconName} size={20} color={iconColor} />
                </View>

                {/* 텍스트 */}
                <View className="flex-1 justify-center">
                    <Text className="text-[15px] font-bold text-gray-800 leading-5">
                        {text1}
                    </Text>
                    {text2 && (
                        <Text className="text-[13px] text-gray-600 mt-0.5 leading-4">
                            {text2}
                        </Text>
                    )}
                </View>
            </TouchableOpacity>
        </View>
    );
};

export const toastConfig = {
    success: (props) => <BaseToastContent type="success" {...props} />,
    error: (props) => <BaseToastContent type="error" {...props} />
};