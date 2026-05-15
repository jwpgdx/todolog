import React, { useCallback, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import NativeManagedList from '../components/ui/native-managed-list/NativeManagedList';
import { buildManagedTodoItem } from '../features/todo/native/managedTodoItemAdapter';
import { useAllTodos } from '../hooks/queries/useAllTodos';
import { useCategories } from '../hooks/queries/useCategories';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useReorderTodo } from '../hooks/queries/useReorderTodo';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useUpdateTodo } from '../hooks/queries/useUpdateTodo';
import { useTodayDate } from '../hooks/useTodayDate';
import { useFloatingTabBarScrollPadding } from '../navigation/useFloatingTabBarInset';
import { ORDER_STEP } from '../services/db/todoService';
import { useTodoFormStore } from '../store/todoFormStore';

function compareByCreatedAt(a, b) {
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

function compareByFavoriteOrder(a, b) {
  const orderA = Number(a?.order?.favorite ?? a?.favoriteOrder ?? 0);
  const orderB = Number(b?.order?.favorite ?? b?.favoriteOrder ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const createdAtOrder = compareByCreatedAt(a, b);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return String(a?._id || '').localeCompare(String(b?._id || ''));
}

export default function FavoriteTodosScreen() {
  const { todayDate } = useTodayDate();
  const { data: todos = [], isLoading } = useAllTodos(todayDate);
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const updateTodoMutation = useUpdateTodo();
  const reorderTodoMutation = useReorderTodo(todayDate);
  const { openDetail } = useTodoFormStore();
  const bottomInset = useFloatingTabBarScrollPadding(32);

  const categoryById = useMemo(
    () => new Map((categories || []).map((category) => [category._id, category])),
    [categories]
  );

  const favoriteTodos = useMemo(
    () =>
      (Array.isArray(todos) ? todos : [])
        .filter((todo) => todo?.isFavorite === true)
        .sort(compareByFavoriteOrder),
    [todos]
  );

  const todoById = useMemo(
    () => new Map(favoriteTodos.map((todo) => [todo._id, todo])),
    [favoriteTodos]
  );

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

  const handleUnfavorite = useCallback((todo) => {
    updateTodoMutation.mutate({
      id: todo._id,
      data: {
        isFavorite: false,
      },
    });
  }, [updateTodoMutation]);

  const handleTodoAction = useCallback((todo, actionId) => {
    switch (actionId) {
      case 'view':
      case 'edit':
        handleOpenTodo(todo);
        break;
      case 'move':
        handleOpenTodo(todo, 'CATEGORY');
        break;
      case 'unfavorite':
        handleUnfavorite(todo);
        break;
      case 'delete':
        handleDelete(todo);
        break;
      default:
        break;
    }
  }, [handleDelete, handleOpenTodo, handleUnfavorite]);

  const handleManagedReorderCommit = useCallback(async (event) => {
    const section = event?.sections?.find((candidate) => candidate.sectionId === 'favorites');
    if (!section) {
      return;
    }

    const orderedTodoIds = (section.orderedItemIds || []).filter((itemId) => todoById.has(itemId));
    const currentTodoIds = favoriteTodos.map((todo) => todo._id);
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
        const currentOrder = Number(todo.order?.favorite ?? todo.favoriteOrder ?? 0);
        if (currentOrder === nextOrder) {
          return null;
        }

        return {
          id: todoId,
          order: {
            favorite: nextOrder,
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
      console.error('[FavoriteTodosScreen] reorder commit failed:', error?.message || error);
    }
  }, [favoriteTodos, reorderTodoMutation, todoById]);

  const managedSections = useMemo(() => {
    if (favoriteTodos.length === 0) {
      return [];
    }

    return [
      {
        id: 'favorites',
        role: 'normal',
        reorderMode: 'withinSection',
        items: favoriteTodos.map((todo) => {
          const category = categoryById.get(todo.categoryId);
          return buildManagedTodoItem(todo, {
            accentColor: category?.color || '#F59E0B',
            reorderable: true,
            includeCompleteToggle: true,
            includeFavoriteAction: false,
            includeFavoriteToggle: false,
            showFavoriteBadge: false,
            menuActions: [
              { id: 'view', title: '보기' },
              { id: 'edit', title: '수정' },
              { id: 'move', title: '이동' },
              { id: 'unfavorite', title: '즐겨찾기 해제' },
              { id: 'delete', title: '일정 삭제', role: 'destructive' },
            ],
            leadingSwipeActions: [],
            trailingSwipeActions: [
              { id: 'delete', title: '삭제', role: 'destructive' },
            ],
          });
        }),
      },
    ];
  }, [categoryById, favoriteTodos]);

  const isInitialLoading = isLoading || isCategoriesLoading;

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: '즐겨찾기' }} />
      {isInitialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#F59E0B" />
        </View>
      ) : favoriteTodos.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="star-outline" size={48} color="#D1D5DB" />
          <Text style={styles.emptyTitle}>즐겨찾기 일정이 없습니다</Text>
          <Text style={styles.emptyDescription}>
            일정 메뉴에서 즐겨찾기를 추가하면 이곳에 모아볼 수 있습니다.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <View style={styles.listHeader}>
            <Text style={styles.listHeaderText}>총 {favoriteTodos.length}개의 즐겨찾기</Text>
          </View>
          <NativeManagedList
            listId="favorite-todos"
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
              if (todo) {
                handleTodoAction(todo, actionId);
              }
            }}
            onReorderCommit={handleManagedReorderCommit}
            onError={(event) => {
              console.warn('[FavoriteTodosScreen:NativeManagedList]', event?.message || event);
            }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  listHeader: {
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  listHeaderText: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyTitle: {
    marginTop: 16,
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  emptyDescription: {
    marginTop: 8,
    color: '#6B7280',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
