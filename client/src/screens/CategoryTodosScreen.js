import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, FlatList, ActivityIndicator } from 'react-native';
import { useActionSheet } from '@expo/react-native-action-sheet';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import { useTodosByCategory } from '../hooks/queries/useTodosByCategory';
import { useUpdateTodo } from '../hooks/queries/useUpdateTodo';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';

const formatDateRange = (startDate, endDate) => {
    const start = dayjs(startDate);
    const end = endDate ? dayjs(endDate) : null;

    if (!end || start.isSame(end, 'day')) {
        return start.format('YYYY.MM.DD');
    }
    return `${start.format('YYYY.MM.DD')} ~ ${end.format('YYYY.MM.DD')}`;
};

const TodoItem = ({ todo, onToggleComplete, onDelete }) => {
    const isCompleted = todo.isCompleted;
    const dateRange = formatDateRange(todo.startDate, todo.endDate);

    return (
        <View className={`flex-row items-center p-4 rounded-xl mb-3 ${isCompleted ? 'bg-gray-100' : 'bg-gray-50'}`}>
            {/* Checkbox */}
            <TouchableOpacity
                onPress={() => onToggleComplete(todo)}
                className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${isCompleted ? 'bg-blue-500 border-blue-500' : 'border-gray-300'}`}
            >
                {isCompleted && (
                    <Ionicons name="checkmark" size={16} color="white" />
                )}
            </TouchableOpacity>

            {/* Todo Info */}
            <View className="flex-1">
                <Text className={`text-base font-medium ${isCompleted ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {todo.title}
                </Text>
                <Text className={`text-sm mt-1 ${isCompleted ? 'text-gray-400' : 'text-gray-500'}`}>
                    {dateRange}
                </Text>
            </View>

            {/* Recurring indicator */}
            {todo.recurrence && (
                <Ionicons name="repeat" size={18} color="#9CA3AF" className="mr-2" />
            )}

            {/* Delete button */}
            <TouchableOpacity
                onPress={() => onDelete(todo)}
                className="p-2 ml-2"
            >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );
};

export default function CategoryTodosScreen({ route, navigation }) {
    const { category } = route.params;
    const { data: todos, isLoading } = useTodosByCategory(category._id);
    const updateTodo = useUpdateTodo();
    const deleteTodo = useDeleteTodo();

    // 날짜순 정렬
    const sortedTodos = useMemo(() => {
        if (!todos) return [];
        return [...todos].sort((a, b) => {
            // 미완료 먼저, 그 다음 날짜순
            if (a.isCompleted !== b.isCompleted) {
                return a.isCompleted ? 1 : -1;
            }
            return new Date(a.startDate) - new Date(b.startDate);
        });
    }, [todos]);

    React.useEffect(() => {
        navigation.setOptions({
            title: category.name,
            headerStyle: {
                backgroundColor: category.color || '#3B82F6',
            },
            headerTintColor: '#fff',
        });
    }, [navigation, category]);

    const handleToggleComplete = (todo) => {
        updateTodo.mutate({
            id: todo._id,
            data: { isCompleted: !todo.isCompleted }
        });
    };

    const { showActionSheetWithOptions } = useActionSheet();

    const handleDelete = (todo) => {
        const options = ['이벤트 삭제', '취소'];
        const destructiveButtonIndex = 0;
        const cancelButtonIndex = 1;

        showActionSheetWithOptions(
            {
                options,
                cancelButtonIndex,
                destructiveButtonIndex,
                title: '이 이벤트를 삭제하겠습니까?',
                message: todo.title,
                containerStyle: {
                    // Web-specific tweaks if needed
                }
            },
            (selectedIndex) => {
                if (selectedIndex === destructiveButtonIndex) {
                    console.log('🗑️ [CategoryTodosScreen] 삭제 요청:', todo._id, todo.title);
                    deleteTodo.mutate(todo);
                }
            }
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView className="flex-1 bg-white items-center justify-center">
                <ActivityIndicator size="large" color={category.color || '#3B82F6'} />
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView className="flex-1 bg-white">
            <FlatList
                data={sortedTodos}
                keyExtractor={(item) => item._id}
                renderItem={({ item }) => (
                    <TodoItem
                        todo={item}
                        onToggleComplete={handleToggleComplete}
                        onDelete={handleDelete}
                    />
                )}
                contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
                ListEmptyComponent={
                    <View className="items-center justify-center py-20">
                        <Ionicons name="folder-open-outline" size={48} color="#D1D5DB" />
                        <Text className="text-gray-400 mt-4 text-base">등록된 일정이 없습니다</Text>
                    </View>
                }
                ListHeaderComponent={
                    <View className="mb-4">
                        <Text className="text-gray-500 text-sm">
                            총 {sortedTodos.length}개의 일정
                        </Text>
                    </View>
                }
            />
        </SafeAreaView>
    );
}
