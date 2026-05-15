import React, { useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    SafeAreaView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Ionicons } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import dayjs from 'dayjs';
import { useCategories } from '../hooks/queries/useCategories';
import { useTodosByCategory } from '../hooks/queries/useTodosByCategory';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useReorderTodo } from '../hooks/queries/useReorderTodo';
import { useTodayDate } from '../hooks/useTodayDate';
import { useTodoFormStore } from '../store/todoFormStore';
import { useFloatingTabBarScrollPadding } from '../navigation/useFloatingTabBarInset';
import { hasRecurrenceRule } from '../utils/recurrenceEngine';
import NativeManagedList from '../components/ui/native-managed-list/NativeManagedList';
import { buildManagedTodoItem } from '../features/todo/native/managedTodoItemAdapter';
import { ORDER_STEP } from '../services/db/todoService';

const DEFAULT_CONTROL_TINT = '#007AFF';

const formatDateLabel = (date) => {
    if (!date) {
        return null;
    }

    const parsed = dayjs(date);
    return parsed.isValid() ? parsed.format('YYYY.MM.DD') : date;
};

const formatScheduleLabel = (todo) => {
    if (hasRecurrenceRule(todo?.recurrence)) {
        return formatDateLabel(todo.occurrenceDate || todo.startDate || todo.date);
    }

    const startDate = todo.startDate || todo.date;
    const endDate = todo.endDate || startDate;
    if (!startDate) {
        return null;
    }

    if (!endDate || startDate === endDate) {
        return formatDateLabel(startDate);
    }

    return `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`;
};

const formatTimeLabel = (todo) => {
    if (!todo.startTime && !todo.endTime) {
        return null;
    }

    if (todo.startTime && todo.endTime) {
        return `${todo.startTime} ~ ${todo.endTime}`;
    }

    return todo.startTime || todo.endTime;
};

const buildMetaItems = (todo) => {
    const items = [];
    const scheduleLabel = formatScheduleLabel(todo);
    const timeLabel = formatTimeLabel(todo);

    if (scheduleLabel) {
        items.push({
            icon: hasRecurrenceRule(todo?.recurrence) ? 'repeat-outline' : 'calendar-outline',
            text: scheduleLabel,
        });
    }

    if (timeLabel) {
        items.push({
            icon: 'alarm-outline',
            text: timeLabel,
        });
    }

    return items;
};

function CategoryTodoRow({
    todo,
    onDelete,
    onOpen,
    onOpenActions,
    onToggleComplete,
}) {
    const metaItems = buildMetaItems(todo);
    const isCompleted = todo.completed;

    const renderRightActions = useCallback(() => (
        <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onDelete(todo)}
            style={styles.deleteAction}
        >
            <Ionicons name="trash-outline" size={20} color="#FFFFFF" />
            <Text style={styles.deleteActionText}>삭제</Text>
        </TouchableOpacity>
    ), [onDelete, todo]);

    return (
        <Swipeable
            overshootRight={false}
            renderRightActions={renderRightActions}
        >
            <View style={styles.rowWrapper}>
                <View style={[styles.row, isCompleted && styles.rowCompleted]}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => onToggleComplete(todo)}
                        style={[
                            styles.checkButton,
                            { borderColor: DEFAULT_CONTROL_TINT },
                            isCompleted && { backgroundColor: DEFAULT_CONTROL_TINT },
                        ]}
                    >
                        {isCompleted ? <Ionicons color="#FFFFFF" name="checkmark" size={16} /> : null}
                    </TouchableOpacity>

                    <TouchableOpacity
                        activeOpacity={0.82}
                        delayLongPress={180}
                        onLongPress={Platform.OS === 'ios' ? () => onOpenActions(todo) : undefined}
                        onPress={() => onOpen(todo)}
                        style={styles.contentPressable}
                    >
                        <View style={styles.content}>
                            <Text
                                numberOfLines={1}
                                style={[styles.title, isCompleted && styles.completedTitle]}
                            >
                                {todo.title}
                            </Text>

                            {metaItems.length > 0 ? (
                                <View style={styles.metaRow}>
                                    {metaItems.map((item) => (
                                        <View key={`${todo._id}-${item.icon}-${item.text}`} style={styles.metaItem}>
                                            <Ionicons
                                                color={isCompleted ? '#9CA3AF' : '#6B7280'}
                                                name={item.icon}
                                                size={13}
                                                style={styles.metaIcon}
                                            />
                                            <Text style={[styles.metaText, isCompleted && styles.completedMetaText]}>
                                                {item.text}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>

                    {Platform.OS === 'android' ? (
                        <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => onOpenActions(todo)}
                            style={styles.menuButton}
                        >
                            <Ionicons color="#6B7280" name="ellipsis-horizontal" size={20} />
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </Swipeable>
    );
}

export default function CategoryTodosScreen() {
    const { categoryId: rawCategoryId } = useLocalSearchParams();
    const categoryId = Array.isArray(rawCategoryId) ? rawCategoryId[0] : rawCategoryId;
    const { data: categories, isLoading: isCategoriesLoading } = useCategories();
    const { todayDate } = useTodayDate();
    const { showActionSheetWithOptions } = useActionSheet();
    const { openDetail } = useTodoFormStore();

    const category = useMemo(
        () => categories?.find((cat) => cat?._id === categoryId) || null,
        [categories, categoryId]
    );
    const bottomInset = useFloatingTabBarScrollPadding(16);

    const { data: todos = [], isLoading } = useTodosByCategory(categoryId, todayDate);
    const { mutate: toggleCompletion } = useToggleCompletion();
    const { mutate: deleteTodo } = useDeleteTodo();
    const reorderTodoMutation = useReorderTodo(todayDate);

    const sortedTodos = useMemo(() => {
        return [...todos].sort((a, b) => {
            const orderA = Number(a?.order?.category ?? 0);
            const orderB = Number(b?.order?.category ?? 0);
            if (orderA !== orderB) {
                return orderA - orderB;
            }

            const createdAtOrder = String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
            if (createdAtOrder !== 0) {
                return createdAtOrder;
            }

            return String(a?._id || '').localeCompare(String(b?._id || ''));
        });
    }, [todos]);

    const headerTitle = category?.name || '카테고리';
    const handleOpenTodo = useCallback((todo, target = null) => {
        openDetail(todo, target);
    }, [openDetail]);

    const handleToggleComplete = useCallback((todo) => {
        toggleCompletion({
            todoId: todo._id,
            date: todo.occurrenceDate || todayDate,
            currentCompleted: todo.completed,
            todo,
        });
    }, [todayDate, toggleCompletion]);

    const handleDelete = useCallback((todo) => {
        Alert.alert(
            '일정 삭제',
            `"${todo.title}" 일정을 삭제할까요?`,
            [
                { text: '취소', style: 'cancel' },
                {
                    text: '삭제',
                    style: 'destructive',
                    onPress: () => deleteTodo(todo),
                },
            ]
        );
    }, [deleteTodo]);

    const handleOpenActions = useCallback((todo) => {
        const options = ['일정 보기', '수정', '이동', '일정 삭제', '취소'];
        const cancelButtonIndex = 4;
        const destructiveButtonIndex = 3;

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                destructiveButtonIndex,
                title: todo.title,
                message: '실행할 작업을 선택하세요.',
            },
            (selectedIndex) => {
                switch (selectedIndex) {
                    case 0:
                    case 1:
                        handleOpenTodo(todo);
                        break;
                    case 2:
                        handleOpenTodo(todo, 'CATEGORY');
                        break;
                    case 3:
                        handleDelete(todo);
                        break;
                    default:
                        break;
                }
            }
        );
    }, [handleDelete, handleOpenTodo, showActionSheetWithOptions]);

    const renderItem = useCallback(({ item }) => (
        <CategoryTodoRow
            onDelete={handleDelete}
            onOpen={handleOpenTodo}
            onOpenActions={handleOpenActions}
            onToggleComplete={handleToggleComplete}
            todo={item}
        />
    ), [handleDelete, handleOpenActions, handleOpenTodo, handleToggleComplete]);

    const todoById = useMemo(
        () => new Map(sortedTodos.map((todo) => [todo._id, todo])),
        [sortedTodos]
    );

    const handleManagedReorderCommit = useCallback(async (event) => {
        const sectionId = categoryId || 'category-todos';
        const section = event?.sections?.find((candidate) => candidate.sectionId === sectionId);
        if (!section) {
            return;
        }

        const orderedTodoIds = (section.orderedItemIds || []).filter((itemId) => todoById.has(itemId));
        const currentTodoIds = sortedTodos.map((todo) => todo._id);
        const hasSameOrder =
            orderedTodoIds.length === currentTodoIds.length &&
            orderedTodoIds.every((todoId, index) => todoId === currentTodoIds[index]);

        if (hasSameOrder) {
            return;
        }

        const updates = orderedTodoIds
            .map((todoId, index) => {
                const todo = todoById.get(todoId);
                if (!todo) {
                    return null;
                }

                const nextOrder = (index + 1) * ORDER_STEP;
                const currentOrder = Number(todo.order?.category ?? 0);
                if (currentOrder === nextOrder && todo.categoryId === categoryId) {
                    return null;
                }

                return {
                    id: todoId,
                    categoryId,
                    order: {
                        category: nextOrder,
                    },
                };
            })
            .filter(Boolean);

        if (updates.length === 0) {
            return;
        }

        try {
            await reorderTodoMutation.mutateAsync({ updates });
        } catch (error) {
            console.error('[CategoryTodosScreen] reorder commit failed:', error?.message || error);
        }
    }, [categoryId, reorderTodoMutation, sortedTodos, todoById]);

    const managedSections = useMemo(() => {
        if (sortedTodos.length === 0) {
            return [];
        }

        return [
            {
                id: categoryId || 'category-todos',
                role: 'normal',
                reorderMode: 'withinSection',
                items: sortedTodos.map((todo) =>
                    buildManagedTodoItem(todo, {
                        reorderable: true,
                        showFavoriteBadge: true,
                        includeCompleteToggle: true,
                        includeFavoriteAction: false,
                        includeFavoriteToggle: false,
                        menuActions: [
                            { id: 'view', title: '보기' },
                            { id: 'edit', title: '수정' },
                            { id: 'move', title: '이동' },
                            { id: 'delete', title: '일정 삭제', role: 'destructive' },
                        ],
                        leadingSwipeActions: [],
                        trailingSwipeActions: [
                            { id: 'delete', title: '삭제', role: 'destructive' },
                        ],
                    })
                ),
            },
        ];
    }, [categoryId, sortedTodos]);

    if (!categoryId) {
        return (
            <SafeAreaView style={styles.centeredScreen}>
                <Text style={styles.centerMessage}>잘못된 접근입니다.</Text>
            </SafeAreaView>
        );
    }

    if (isLoading || (isCategoriesLoading && !category)) {
        return (
            <SafeAreaView style={styles.centeredScreen}>
                <ActivityIndicator size="large" />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.screen}>
            <Stack.Screen
                options={{
                    title: headerTitle,
                }}
            />
            {Platform.OS === 'ios' ? (
                sortedTodos.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
                        <Text style={styles.emptyText}>등록된 일정이 없습니다</Text>
                    </View>
                ) : (
                    <View
                        style={{
                            flex: 1,
                            padding: 16,
                            paddingBottom: 0,
                        }}
                    >
                        <View style={styles.listHeader}>
                            <Text style={styles.listHeaderText}>
                                총 {sortedTodos.length}개의 일정
                            </Text>
                        </View>

                        <NativeManagedList
                            listId={`category-todos:${categoryId || 'unknown'}`}
                            variant="todo"
                            sections={managedSections}
                            contentInsetBottom={bottomInset}
                            onPressItem={({ itemId }) => {
                                const todo = todoById.get(itemId);
                                if (todo) {
                                    handleOpenTodo(todo);
                                }
                            }}
                            onControlAction={({ itemId, controlId }) => {
                                if (controlId !== 'complete') {
                                    return;
                                }

                                const todo = todoById.get(itemId);
                                if (todo) {
                                    handleToggleComplete(todo);
                                }
                            }}
                            onAction={({ itemId, actionId }) => {
                                const todo = todoById.get(itemId);
                                if (!todo) {
                                    return;
                                }

                                switch (actionId) {
                                    case 'view':
                                    case 'edit':
                                        handleOpenTodo(todo);
                                        break;
                                    case 'move':
                                        handleOpenTodo(todo, 'CATEGORY');
                                        break;
                                    case 'delete':
                                        handleDelete(todo);
                                        break;
                                    default:
                                        break;
                                }
                            }}
                            onReorderCommit={handleManagedReorderCommit}
                            onError={(event) => {
                                console.warn('[CategoryTodosScreen:NativeManagedList]', event?.message || event);
                            }}
                        />
                    </View>
                )
            ) : (
                <FlashList
                    data={sortedTodos}
                    keyExtractor={(item) => item._id}
                    renderItem={renderItem}
                    estimatedItemSize={88}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        padding: 16,
                        paddingBottom: bottomInset,
                    }}
                    ListEmptyComponent={
                        <View style={styles.emptyState}>
                            <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
                            <Text style={styles.emptyText}>등록된 일정이 없습니다</Text>
                        </View>
                    }
                    ListHeaderComponent={
                        <View style={styles.listHeader}>
                            <Text style={styles.listHeaderText}>
                                총 {sortedTodos.length}개의 일정
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    centeredScreen: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    centerMessage: {
        fontSize: 15,
        color: '#6B7280',
    },
    listHeader: {
        marginBottom: 12,
    },
    listHeaderText: {
        fontSize: 13,
        color: '#6B7280',
        fontWeight: '500',
    },
    rowWrapper: {
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 15,
        borderRadius: 18,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#F3F4F6',
    },
    rowCompleted: {
        backgroundColor: '#F3F4F6',
    },
    checkButton: {
        width: 28,
        height: 28,
        borderRadius: 999,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    content: {
        flex: 1,
    },
    contentPressable: {
        flex: 1,
    },
    title: {
        fontSize: 16,
        lineHeight: 21,
        color: '#111827',
        fontWeight: '600',
    },
    completedTitle: {
        color: '#9CA3AF',
        textDecorationLine: 'line-through',
    },
    metaRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginTop: 6,
        gap: 10,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaIcon: {
        marginRight: 4,
    },
    metaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    completedMetaText: {
        color: '#9CA3AF',
    },
    menuButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    deleteAction: {
        width: 84,
        borderRadius: 18,
        marginBottom: 12,
        marginLeft: 10,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#EF4444',
    },
    deleteActionText: {
        marginTop: 4,
        fontSize: 12,
        color: '#FFFFFF',
        fontWeight: '600',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 96,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 15,
        color: '#9CA3AF',
    },
});
