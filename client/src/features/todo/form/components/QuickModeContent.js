import React, { useState } from 'react';
import { View, StyleSheet, Text, Button, TouchableOpacity, Pressable } from 'react-native';
import { TouchableOpacity as GHTouchableOpacity } from 'react-native-gesture-handler';
import FormHeader from './FormHeader';
import QuickInput from './QuickInput';

/**
 * QuickModeContent
 * 
 * Quick Mode의 공통 콘텐츠 (FormHeader + QuickInput)
 * 컨테이너(KeyboardStickyView, BottomSheet 등)는 각 플랫폼 레이아웃에서 제공합니다.
 * 
 * @param {object} formState - 폼 상태 (title, categoryId 등)
 * @param {function} handleChange - 폼 상태 변경 핸들러
 * @param {function} handleSubmit - 폼 제출 핸들러
 * @param {object} quickModeLabels - Quick Mode 표시 라벨 (categoryName, dateLabel, repeatLabel)
 * @param {function} onClose - 닫기 핸들러
 * @param {function} onExpandToDetail - Detail Mode 전환 핸들러 (target 지정 가능)
 */
export default function QuickModeContent({
    formState,
    handleChange,
    handleSubmit,
    quickModeLabels,
    onClose,
    onExpandToDetail,
}) {

    const [testLog, setTestLog] = useState('👇 버튼들을 눌러보세요 (터치 대기중)');

    return (
        <View style={styles.container}>
            <FormHeader
                mode="quick"
                onClose={onClose}
                onExpand={() => onExpandToDetail()}
            />

            {/* ================================================= */}
            {/* [DEBUG] 터치 테스트 영역 (여기만 className 사용)     */}
            {/* ================================================= */}
            <View className="bg-gray-100 p-4 border-b border-gray-300 items-center">
                <Text className="text-lg font-bold text-red-600 mb-3 text-center">
                    {testLog}
                </Text>

                {/* 1. 기본 RN Button */}
                <View className="w-full my-1">
                    <Button
                        title="1. 기본 RN Button"
                        onPress={() => setTestLog('✅ 1번 기본 Button 터치됨!')}
                    />
                </View>

                {/* 2. 기본 RN TouchableOpacity */}
                <TouchableOpacity
                    className="w-full bg-blue-500 py-3 rounded-lg my-1 items-center active:bg-blue-600"
                    onPress={() => setTestLog('✅ 2번 RN Touchable 터치됨!')}
                    activeOpacity={0.7}
                >
                    <Text className="text-white font-bold text-base">2. RN TouchableOpacity</Text>
                </TouchableOpacity>

                {/* 3. 기본 RN Pressable */}
                <Pressable
                    className="w-full bg-teal-500 py-3 rounded-lg my-1 items-center active:bg-teal-600"
                    onPress={() => setTestLog('✅ 3번 RN Pressable 터치됨!')}
                >
                    <Text className="text-white font-bold text-base">3. RN Pressable</Text>
                </Pressable>

                {/* 4. Gesture Handler TouchableOpacity (주황색) */}
                <GHTouchableOpacity
                    className="w-full bg-orange-500 py-3 rounded-lg my-1 items-center"
                    onPress={() => setTestLog('✅ 4번 GH Touchable 터치됨! (성공)')}
                >
                    <Text className="text-white font-bold text-base">4. GH Touchable (제스처 핸들러)</Text>
                </GHTouchableOpacity>
            </View>
            {/* ================================================= */}


            <QuickInput
                title={formState.title}
                onChangeTitle={(t) => handleChange('title', t)}
                onSubmit={() => handleSubmit({ quickMode: true })}
                categoryName={quickModeLabels.categoryName}
                onCategoryPress={() => onExpandToDetail('CATEGORY')}
                dateLabel={quickModeLabels.dateLabel}
                onDatePress={() => onExpandToDetail('DATE')}
                repeatLabel={quickModeLabels.repeatLabel}
                onRepeatPress={() => onExpandToDetail('REPEAT')}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
    },
});
