import React from 'react';
import { View, StyleSheet } from 'react-native';
import QuickInput from './QuickInput';

/**
 * QuickModeContent
 * 
 * Quick Mode의 공통 콘텐츠 (QuickInput)
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
    onExpandToDetail,
}) {
    return (
        <View style={styles.container}>
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
        overflow: 'hidden',
    },
});
