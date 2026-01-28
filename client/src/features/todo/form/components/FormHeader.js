import React from 'react';
import { View, Text, Platform, TouchableOpacity as RNTouchableOpacity } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import { Ionicons } from '@expo/vector-icons';

// 웹에서는 react-native의 TouchableOpacity, 네이티브에서는 gesture-handler 사용
const TouchableOpacity = Platform.OS === 'web' ? RNTouchableOpacity : GHTouchableOpacity;

/**
 * FormHeader Component
 * Quick/Detail 모드 공용 헤더
 */
export default function FormHeader({
    mode = 'detail',
    title,
    onClose,
    onBack,
    onExpand,
    onSave,
    saveDisabled = false,
    saveLabel = '저장',
}) {
    const defaultTitles = {
        'quick': '',
        'detail': '이벤트 추가',
        'category-add': '카테고리 추가',
        'category-color': '색상 선택',
        'recurrence-add': '반복 설정',
    };

    const displayTitle = title || defaultTitles[mode] || '';

    const isSubFlow = mode === 'category-add' || mode === 'category-color' || mode === 'recurrence-add';
    const showBackButton = isSubFlow && onBack;
    const showCloseButton = !isSubFlow && onClose;

    const showExpandButton = mode === 'quick' && onExpand;
    const showSaveButton = mode !== 'quick' && onSave;

    return (
        <View className="flex-row items-center justify-between h-14 px-4 bg-white border-b border-gray-100">
            {/* Left Button */}
            <View className="w-16 items-start">
                {showCloseButton && (
                    <TouchableOpacity
                        onPress={onClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-2 -ml-2"
                    >
                        <Ionicons name="close" size={24} color="#000" />
                    </TouchableOpacity>
                )}
                {showBackButton && (
                    <TouchableOpacity
                        onPress={onBack}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="flex-row items-center p-2 -ml-2"
                    >
                        <Ionicons name="chevron-back" size={24} color="#007AFF" />
                        <Text className="text-primary text-base">뒤로</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Center Title */}
            <View className="flex-1 items-center">
                {displayTitle ? (
                    <Text className="text-base font-semibold text-gray-900">
                        {displayTitle}
                    </Text>
                ) : null}
            </View>

            {/* Right Button */}
            <View className="w-16 items-end">
                {showExpandButton && (
                    <TouchableOpacity
                        onPress={() => {
                            console.log('[FormHeader] Expand button pressed');
                            onExpand && onExpand();
                        }}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-2 -mr-2"
                    >
                        <Ionicons name="chevron-up" size={24} color="#007AFF" />
                    </TouchableOpacity>
                )}
                {showSaveButton && (
                    <TouchableOpacity
                        onPress={onSave}
                        disabled={saveDisabled}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        className="p-2 -mr-2"
                    >
                        <Text className={`text-base font-semibold ${saveDisabled ? 'text-gray-300' : 'text-primary'}`}>
                            {saveLabel}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}
