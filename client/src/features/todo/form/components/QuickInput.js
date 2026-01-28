import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * QuickInput Component
 * Quick Mode 입력창 (채팅 스타일)
 * 
 * 로컬 상태를 사용하여 매 글자마다 상위 컴포넌트 리렌더를 방지합니다.
 */
export default function QuickInput({
    title,
    onChangeTitle,
    onSubmit,
    categoryName = '카테고리',
    onCategoryPress,
    dateLabel = '오늘',
    onDatePress,
    repeatLabel = '안 함',
    onRepeatPress,
}) {
    // 로컬 상태로 입력값 관리 (리렌더 최소화)
    const [localTitle, setLocalTitle] = useState(title || '');
    const inputRef = useRef(null);

    // 외부에서 title이 변경되면 동기화 (예: 폼 리셋)
    useEffect(() => {
        if (title !== localTitle) {
            setLocalTitle(title || '');
        }
    }, [title]);

    const canSubmit = localTitle?.trim().length > 0;

    const handleSubmit = () => {
        console.log('handleSubmit 호출됨!', localTitle);
        onChangeTitle(localTitle);
        onSubmit();
    };

    const handleBlur = () => {
        onChangeTitle(localTitle);
    };

    return (
        <View style={styles.container}>
            {/* Row 1: Input + 저장 버튼 */}
            <View style={styles.row1}>
                <View style={styles.inputContainer}>
                    <TextInput
                        ref={inputRef}
                        value={localTitle}
                        onChangeText={setLocalTitle}
                        onBlur={handleBlur}
                        placeholder="제목"
                        placeholderTextColor="#9CA3AF"
                        style={styles.input}
                        onSubmitEditing={handleSubmit}
                        returnKeyType="done"
                        autoFocus={true}
                    />
                </View>

                {/* 저장 버튼 */}
                <TouchableOpacity
                    onPress={handleSubmit}
                    disabled={!canSubmit}
                    style={[
                        styles.submitButton,
                        { backgroundColor: canSubmit ? '#3B82F6' : '#D1D5DB' }
                    ]}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-up" size={20} color="white" />
                </TouchableOpacity>
            </View>

            {/* Row 2: 카테고리/날짜/반복 버튼들 */}
            <View style={styles.row2}>
                {/* 카테고리 버튼 */}
                <TouchableOpacity
                    onPress={() => {
                        console.log('카테고리 클릭!');
                        onChangeTitle(localTitle);
                        onCategoryPress && onCategoryPress();
                    }}
                    style={styles.optionButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="folder-outline" size={14} color="#6B7280" />
                    <Text style={styles.optionText} numberOfLines={1}>
                        {categoryName}
                    </Text>
                </TouchableOpacity>

                {/* 날짜 버튼 */}
                <TouchableOpacity
                    onPress={() => {
                        console.log('날짜 클릭!');
                        onChangeTitle(localTitle);
                        onDatePress && onDatePress();
                    }}
                    style={styles.optionButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                    <Text style={styles.optionText}>
                        {dateLabel}
                    </Text>
                </TouchableOpacity>

                {/* 반복 버튼 */}
                <TouchableOpacity
                    onPress={() => {
                        console.log('반복 클릭!');
                        onChangeTitle(localTitle);
                        onRepeatPress && onRepeatPress();
                    }}
                    style={styles.optionButton}
                    activeOpacity={0.7}
                >
                    <Ionicons name="repeat-outline" size={14} color="#6B7280" />
                    <Text style={styles.optionText}>
                        {repeatLabel}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    row1: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    inputContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 16,
        height: 44,
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    submitButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 12,
    },
    row2: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingBottom: 12,
        gap: 12,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 12,
        height: 32,
        borderRadius: 8,
    },
    optionText: {
        fontSize: 14,
        color: '#4B5563',
        marginLeft: 6,
    },
});