import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/ko';

/**
 * TodoListItem
 * 개별 할일 아이템 컴포넌트 (FlashList 최적화)
 * 
 * @param {object} props
 * @param {object} props.item - Todo 데이터
 * @param {function} props.onToggleComplete - 완료 토글 핸들러
 * @param {function} props.onEdit - 수정 핸들러
 * @param {function} props.onDelete - 삭제 핸들러
 */
const TodoListItem = memo(({ item, onToggleComplete, onEdit, onDelete }) => {
    const isCompleted = item.completed;

    return (
        <View style={styles.itemContainer}>
            {/* 체크박스 + 내용 영역 (터치 가능) */}
            <TouchableOpacity
                style={styles.mainContent}
                onPress={() => onToggleComplete && onToggleComplete(item._id)}
                activeOpacity={0.7}
            >
                {/* 체크박스 영역 */}
                <View style={[styles.checkbox, isCompleted && styles.checkboxChecked]}>
                    {isCompleted && <Text style={styles.checkmark}>✓</Text>}
                </View>

                {/* 내용 영역 */}
                <View style={styles.contentContainer}>
                    <Text style={[styles.title, isCompleted && styles.titleCompleted]} numberOfLines={1}>
                        {item.title}
                    </Text>

                    <View style={styles.metaContainer}>
                        {/* 시간 표시 */}
                        {!item.isAllDay && item.startDateTime && (
                            <Text style={styles.timeText}>
                                {dayjs(item.startDateTime).locale('ko').format('A h:mm')}
                            </Text>
                        )}
                        {item.isAllDay && (
                            <Text style={styles.timeText}>하루 종일</Text>
                        )}
                    </View>

                    {/* 🔍 디버깅 정보 */}
                    <View style={styles.debugContainer}>
                        <Text style={styles.debugText}>ID: {item._id?.slice(0, 8)}...</Text>
                        <Text style={styles.debugText}>완료: {item.completed ? '✅' : '❌'}</Text>
                        <Text style={styles.debugText}>날짜: {item.startDate || item.date || 'N/A'}</Text>
                        {item.categoryId && (
                            <Text style={styles.debugText}>카테고리: {item.categoryId.slice(0, 8)}...</Text>
                        )}
                    </View>
                </View>
            </TouchableOpacity>

            {/* 수정/삭제 버튼 영역 */}
            <View style={styles.actionButtons}>
                {/* 수정 버튼 */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onEdit && onEdit(item)}
                    activeOpacity={0.6}
                >
                    <Text style={styles.editIcon}>✏️</Text>
                </TouchableOpacity>

                {/* 삭제 버튼 */}
                <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => onDelete && onDelete(item)}
                    activeOpacity={0.6}
                >
                    <Text style={styles.deleteIcon}>🗑️</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}, (prevProps, nextProps) => {
    // 성능 최적화: 변경된 항목만 리렌더링
    return (
        prevProps.item._id === nextProps.item._id &&
        prevProps.item.completed === nextProps.item.completed &&
        prevProps.item.title === nextProps.item.title &&
        prevProps.item.startDateTime === nextProps.item.startDateTime &&
        prevProps.item.isAllDay === nextProps.item.isAllDay
    );
});

TodoListItem.displayName = 'TodoListItem';

const styles = StyleSheet.create({
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        marginHorizontal: 16,
        // 그림자 효과
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    checkmark: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    contentContainer: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        color: '#1F2937',
        fontWeight: '500',
        marginBottom: 4,
    },
    titleCompleted: {
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    timeText: {
        fontSize: 12,
        color: '#6B7280',
    },
    debugContainer: {
        marginTop: 8,
        padding: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FCD34D',
    },
    debugText: {
        fontSize: 10,
        color: '#92400E',
        fontFamily: 'monospace',
        marginBottom: 2,
    },
    actionButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    actionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    editIcon: {
        fontSize: 18,
    },
    deleteIcon: {
        fontSize: 18,
    },
});

export default TodoListItem;
