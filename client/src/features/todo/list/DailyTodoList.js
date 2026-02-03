import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import TodoListItem from './TodoListItem';

/**
 * DailyTodoList
 * 선택된 날짜의 할일 목록을 보여주는 컴포넌트 (FlashList 최적화)
 * 
 * @param {object} props
 * @param {string} props.date - 선택된 날짜 (YYYY-MM-DD)
 * @param {Array} props.todos - 할일 목록 데이터
 * @param {boolean} props.isLoading - 로딩 상태
 * @param {function} props.onToggleComplete - 완료 토글 핸들러 (todoId) => void
 * @param {function} props.onEdit - 수정 핸들러 (todo) => void
 * @param {function} props.onDelete - 삭제 핸들러 (todo) => void
 */
export default function DailyTodoList({ date, todos = [], isLoading, onToggleComplete, onEdit, onDelete }) {
    const [sortOption, setSortOption] = useState('DEADLINE'); // 'DEADLINE', 'NEWEST', 'OLDEST'

    // 정렬 로직
    const sortedTodos = useMemo(() => {
        if (!todos) return [];

        const sorted = [...todos];

        switch (sortOption) {
            case 'DEADLINE': // 마감순 (시간순)
                return sorted.sort((a, b) => {
                    // 1. 완료된 항목은 맨 아래로? (옵션 - 일단은 시간순 유지)

                    // 2. 시간비교
                    const timeA = a.startDateTime ? new Date(a.startDateTime).getTime() :
                        a.isAllDay ? new Date(a.startDate).getTime() : 0;
                    const timeB = b.startDateTime ? new Date(b.startDateTime).getTime() :
                        a.isAllDay ? new Date(b.startDate).getTime() : 0;

                    // 같은 시간이면 생성순
                    if (timeA === timeB) {
                        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
                    }
                    return timeA - timeB;
                });

            case 'NEWEST': // 최신순 (생성 내림차순)
                return sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            case 'OLDEST': // 오래된순 (생성 오름차순)
                return sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

            default:
                return sorted;
        }
    }, [todos, sortOption]);

    // 렌더링 아이템 (useCallback으로 메모이제이션)
    const renderItem = useCallback(({ item }) => (
        <TodoListItem 
            item={item} 
            onToggleComplete={onToggleComplete}
            onEdit={onEdit}
            onDelete={onDelete}
        />
    ), [onToggleComplete, onEdit, onDelete]);

    // 아이템 키 추출 (useCallback으로 메모이제이션)
    const keyExtractor = useCallback((item) => item._id, []);

    if (isLoading) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.loadingText}>목록을 불러오는 중...</Text>
            </View>
        );
    }

    if (!todos || todos.length === 0) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.emptyText}>등록된 할 일이 없습니다.</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* 정렬 옵션 탭 */}
            <View style={styles.sortContainer}>
                <SortButton
                    label="마감순"
                    isActive={sortOption === 'DEADLINE'}
                    onPress={() => setSortOption('DEADLINE')}
                />
                <SortButton
                    label="최신순"
                    isActive={sortOption === 'NEWEST'}
                    onPress={() => setSortOption('NEWEST')}
                />
                <SortButton
                    label="오래된순"
                    isActive={sortOption === 'OLDEST'}
                    onPress={() => setSortOption('OLDEST')}
                />
            </View>

            {/* 리스트 - FlashList로 최적화 */}
            <FlashList
                data={sortedTodos}
                renderItem={renderItem}
                keyExtractor={keyExtractor}
                estimatedItemSize={70}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
}

// 정렬 버튼 컴포넌트
const SortButton = ({ label, isActive, onPress }) => (
    <TouchableOpacity
        onPress={onPress}
        style={[styles.sortButton, isActive && styles.sortButtonActive]}
    >
        <Text style={[styles.sortButtonText, isActive && styles.sortButtonTextActive]}>
            {label}
        </Text>
    </TouchableOpacity>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
        minHeight: 200,
    },
    loadingText: {
        color: '#6B7280',
        fontSize: 14,
    },
    emptyText: {
        color: '#9CA3AF',
        fontSize: 16,
    },
    sortContainer: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 8,
    },
    sortButton: {
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sortButtonActive: {
        backgroundColor: '#3B82F6',
        borderColor: '#3B82F6',
    },
    sortButtonText: {
        fontSize: 13,
        color: '#4B5563',
        fontWeight: '500',
    },
    sortButtonTextActive: {
        color: '#FFFFFF',
    },
    listContent: {
        paddingBottom: 100, // 하단 여백 (나중에 FAB 등에 가려지지 않게)
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        marginBottom: 10,
        // 그림자 효과
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
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
        backgroundColor: '#10B981', // 완료 색상 (초록)
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
});
