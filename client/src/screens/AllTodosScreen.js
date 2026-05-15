import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAllTodos } from '../hooks/queries/useAllTodos';
import { useCategories } from '../hooks/queries/useCategories';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useReorderCategory } from '../hooks/queries/useReorderCategory';
import { useReorderTodo } from '../hooks/queries/useReorderTodo';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useUpdateTodo } from '../hooks/queries/useUpdateTodo';
import { useTodayDate } from '../hooks/useTodayDate';
import { useFloatingTabBarScrollPadding } from '../navigation/useFloatingTabBarInset';
import { useTodoFormStore } from '../store/todoFormStore';
import NativeTodoManagedList, {
  TODO_MANAGED_LIST_MODE,
} from '../features/todo/native/NativeTodoManagedList';
import { useManagedCategoryHeaderActions } from '../features/todo/native/useManagedCategoryHeaderActions';
import {
  buildFavoriteOrderUpdatesFromEvent,
  getFavoriteTodoIdSet,
  getSortedFavoriteTodos,
  mergeTodoReorderUpdates,
} from '../features/todo/native/todoFavoriteOrder';
import { ORDER_STEP } from '../services/db/todoService';

const CATEGORY_ORDER_STEP = 100;
const ALL_TODOS_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY =
  'all_todos_screen_collapsed_category_ids';
const ALL_TODOS_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY =
  'all_todos_screen_favorites_collapsed';
const DRAG_BOTTOM_BUFFER = 32;

export default function AllTodosScreen() {
  const { todayDate } = useTodayDate();
  const { data: todos = [], isLoading } = useAllTodos(todayDate);
  const { data: categories = [] } = useCategories();
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const { mutate: updateTodo } = useUpdateTodo();
  const reorderTodoMutation = useReorderTodo(todayDate);
  const reorderCategoryMutation = useReorderCategory();
  const { openDetail } = useTodoFormStore();
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState([]);
  const [isFavoriteSectionCollapsed, setIsFavoriteSectionCollapsed] = useState(false);
  const bottomInset = useFloatingTabBarScrollPadding(DRAG_BOTTOM_BUFFER);
  const { handleCategoryHeaderAction } = useManagedCategoryHeaderActions({ categories });

  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(ALL_TODOS_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY),
      AsyncStorage.getItem(ALL_TODOS_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY),
    ])
      .then(([storedIds, storedFavoritesCollapsed]) => {
        if (!mounted) {
          return;
        }

        if (storedIds) {
          try {
            const parsedIds = JSON.parse(storedIds);
            if (Array.isArray(parsedIds)) {
              setCollapsedCategoryIds(parsedIds.filter((value) => typeof value === 'string'));
            }
          } catch {
            // noop
          }
        }

        if (storedFavoritesCollapsed != null) {
          setIsFavoriteSectionCollapsed(storedFavoritesCollapsed === 'true');
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const favoriteTodos = useMemo(
    () => getSortedFavoriteTodos(todos),
    [todos]
  );

  const favoriteTodoIdSet = useMemo(
    () => getFavoriteTodoIdSet(favoriteTodos),
    [favoriteTodos]
  );

  const visibleTodos = useMemo(
    () =>
      (Array.isArray(todos) ? todos : []).filter(
        (todo) => !favoriteTodoIdSet.has(todo._id)
      ),
    [favoriteTodoIdSet, todos]
  );

  const handleToggleCollapsedCategory = useCallback((categoryId) => {
    if (!categoryId) {
      return;
    }

    setCollapsedCategoryIds((currentIds) => {
      const nextIds = currentIds.includes(categoryId)
        ? currentIds.filter((id) => id !== categoryId)
        : [...currentIds, categoryId];

      AsyncStorage.setItem(
        ALL_TODOS_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY,
        JSON.stringify(nextIds)
      ).catch(() => {});

      return nextIds;
    });
  }, []);

  const handleExpandCollapsedCategory = useCallback((categoryId) => {
    if (!categoryId) {
      return;
    }

    setCollapsedCategoryIds((currentIds) => {
      if (!currentIds.includes(categoryId)) {
        return currentIds;
      }

      const nextIds = currentIds.filter((id) => id !== categoryId);
      AsyncStorage.setItem(
        ALL_TODOS_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY,
        JSON.stringify(nextIds)
      ).catch(() => {});
      return nextIds;
    });
  }, []);

  const handleToggleFavoriteSectionCollapsed = useCallback(() => {
    setIsFavoriteSectionCollapsed((currentValue) => {
      const nextValue = !currentValue;
      AsyncStorage.setItem(
        ALL_TODOS_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY,
        nextValue ? 'true' : 'false'
      ).catch(() => {});

      return nextValue;
    });
  }, []);

  const handleExpandFavoriteSection = useCallback(() => {
    setIsFavoriteSectionCollapsed((currentValue) => {
      if (!currentValue) {
        return currentValue;
      }

      AsyncStorage.setItem(
        ALL_TODOS_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY,
        'false'
      ).catch(() => {});
      return false;
    });
  }, []);

  const handlePressManagedSectionHeader = useCallback((sectionId) => {
    if (sectionId === 'favorites') {
      handleToggleFavoriteSectionCollapsed();
      return;
    }

    handleToggleCollapsedCategory(sectionId);
  }, [handleToggleCollapsedCategory, handleToggleFavoriteSectionCollapsed]);

  const handleRequestExpandSection = useCallback((sectionId) => {
    if (sectionId === 'favorites') {
      handleExpandFavoriteSection();
      return;
    }

    handleExpandCollapsedCategory(sectionId);
  }, [handleExpandCollapsedCategory, handleExpandFavoriteSection]);

  const handleOpenTodo = useCallback((todo, target = null) => {
    openDetail(todo, target);
  }, [openDetail]);

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

  const handleToggleComplete = useCallback((todo) => {
    if (!todo?._id) {
      return;
    }

    toggleCompletion({
      todoId: todo._id,
      date: todo.occurrenceDate || todayDate,
      currentCompleted: todo.completed,
      todo,
    });
  }, [todayDate, toggleCompletion]);

  const handleFavoriteChange = useCallback((todo, isFavorite) => {
    if (!todo?._id) {
      return;
    }

    updateTodo({
      id: todo._id,
      data: {
        isFavorite,
        startDate: todo.startDate || todo.date || todayDate,
      },
    });
  }, [todayDate, updateTodo]);

  const handleManagedAction = useCallback((todo, event) => {
    switch (event?.actionId) {
      case 'view':
      case 'edit':
        handleOpenTodo(todo);
        break;
      case 'move':
        handleOpenTodo(todo, 'CATEGORY');
        break;
      case 'favorite':
        handleFavoriteChange(todo, true);
        break;
      case 'unfavorite':
        handleFavoriteChange(todo, false);
        break;
      case 'delete':
        handleDelete(todo);
        break;
      default:
        break;
    }
  }, [handleDelete, handleFavoriteChange, handleOpenTodo]);

  const handleManagedReorderCommit = useCallback(async (event) => {
    const visibleTodoById = new Map(visibleTodos.map((todo) => [todo._id, todo]));
    const allTodoById = new Map([...visibleTodos, ...favoriteTodos].map((todo) => [todo._id, todo]));
    const updates = [];
    const categoryOrderUpdates = [];
    const movedToFavorites = event?.toSectionId === 'favorites';
    const movedFromFavorites =
      event?.fromSectionId === 'favorites' &&
      event?.toSectionId &&
      event.toSectionId !== 'favorites';
    const favoriteOrderUpdates = buildFavoriteOrderUpdatesFromEvent(event, allTodoById);
    const reorderTodoById = movedFromFavorites ? allTodoById : visibleTodoById;
    const categoryById = new Map(categories.map((category) => [category._id, category]));
    const orderedCategoryIds = (event?.sections || [])
      .map((section) => section.sectionId)
      .filter((sectionId) => categoryById.has(sectionId));
    const nonInboxOrderedCategoryIds = orderedCategoryIds.filter((sectionId) => {
      const category = categoryById.get(sectionId);
      return category?.systemKey !== 'inbox';
    });
    const currentNonInboxCategoryIds = [...categories]
      .filter((category) => category?._id && category?.systemKey !== 'inbox')
      .sort((a, b) => Number(a?.order ?? a?.order_index ?? 0) - Number(b?.order ?? b?.order_index ?? 0))
      .map((category) => category._id);

    if (
      nonInboxOrderedCategoryIds.length === currentNonInboxCategoryIds.length &&
      nonInboxOrderedCategoryIds.some((categoryId, index) => categoryId !== currentNonInboxCategoryIds[index])
    ) {
      nonInboxOrderedCategoryIds.forEach((categoryId, index) => {
        categoryOrderUpdates.push({
          _id: categoryId,
          order: (index + 1) * CATEGORY_ORDER_STEP,
        });
      });
    }

    updates.push(...favoriteOrderUpdates);

    if (!movedToFavorites) {
      (event?.sections || []).forEach((section) => {
        const categoryId = section.sectionId;
        if (!categoryId || categoryId === 'favorites') {
          return;
        }

        const orderedTodoIds = (section.orderedItemIds || []).filter((itemId) =>
          reorderTodoById.has(itemId)
        );

        orderedTodoIds.forEach((todoId, index) => {
          const todo = reorderTodoById.get(todoId);
          if (!todo) {
            return;
          }

          const nextOrder = (index + 1) * ORDER_STEP;
          const currentOrder = Number(todo.order?.category ?? 0);
          const categoryChanged = todo.categoryId !== categoryId;
          if (!categoryChanged && currentOrder === nextOrder) {
            return;
          }

          updates.push({
            id: todoId,
            categoryId,
            order: {
              category: nextOrder,
            },
          });
        });
      });
    }

    const mergedUpdates = mergeTodoReorderUpdates(updates);

    if (mergedUpdates.length === 0 && categoryOrderUpdates.length === 0) {
      return;
    }

    try {
      if (categoryOrderUpdates.length > 0) {
        await reorderCategoryMutation.mutateAsync({ orders: categoryOrderUpdates });
      }

      if (mergedUpdates.length > 0) {
        await reorderTodoMutation.mutateAsync({ updates: mergedUpdates });
      }
    } catch (error) {
      console.error('[AllTodosScreen] reorder commit failed:', error?.message || error);
    }
  }, [categories, favoriteTodos, reorderCategoryMutation, reorderTodoMutation, visibleTodos]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator color="#2563EB" size="small" />
          <Text style={styles.loadingText}>전체 일정을 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {visibleTodos.length === 0 && favoriteTodos.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyText}>등록된 일정이 없습니다.</Text>
          </View>
        ) : (
          <NativeTodoManagedList
            listId="all-todos-screen"
            mode={TODO_MANAGED_LIST_MODE.CATEGORY}
            todos={visibleTodos}
            categories={categories}
            collapsedCategoryIds={collapsedCategoryIds}
            favoriteTodos={favoriteTodos}
            includeFavoriteSection
            favoriteSectionReorderMode="withinSection"
            favoriteReorderable
            favoriteSectionCollapsed={isFavoriteSectionCollapsed}
            favoriteItemOptions={{
              includeFavoriteAction: true,
              includeFavoriteToggle: false,
              showFavoriteBadge: false,
              leadingSwipeActions: [],
            }}
            includeEmptyCategorySections
            contentInsetBottom={bottomInset}
            itemOptions={{
              includeFavoriteAction: true,
              includeFavoriteToggle: false,
              showFavoriteBadge: false,
              leadingSwipeActions: [],
            }}
            style={{ paddingHorizontal: 16 }}
            onPressTodo={handleOpenTodo}
            onPressSectionHeader={handlePressManagedSectionHeader}
            onRequestExpandSection={({ sectionId }) => {
              handleRequestExpandSection(sectionId);
            }}
            onToggleComplete={handleToggleComplete}
            onTodoAction={handleManagedAction}
            onSectionHeaderAction={handleCategoryHeaderAction}
            onReorderCommit={handleManagedReorderCommit}
            onError={(event) => {
              console.warn('[AllTodosScreen:NativeTodoManagedList]', event?.message || event);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 8 : 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 10,
  },
  loadingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  emptyText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
});
