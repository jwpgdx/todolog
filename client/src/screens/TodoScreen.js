import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Alert,
  InteractionManager,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useDateStore } from '../store/dateStore';
import { useTodos } from '../hooks/queries/useTodos';
import { useCategories } from '../hooks/queries/useCategories';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useReorderTodo } from '../hooks/queries/useReorderTodo';
import { useReorderCategory } from '../hooks/queries/useReorderCategory';
import { useTodoFormStore } from '../store/todoFormStore';
import { WeekFlowTodoHeader } from '../features/week-flow-calendar';
import NativeTodoFormSessionPrototype from '../features/todo/form-session/native/NativeTodoFormSessionPrototype';
import DailyTodoList from '../features/todo/list/DailyTodoList';
import NativeTodoManagedList, {
  TODO_MANAGED_LIST_MODE,
} from '../features/todo/native/NativeTodoManagedList';
import { useManagedCategoryHeaderActions } from '../features/todo/native/useManagedCategoryHeaderActions';
import {
  TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY,
  TODO_SCREEN_SORT_MODE,
  TODO_SCREEN_SORT_MODE_OPTIONS,
  TODO_SCREEN_SORT_MODE_STORAGE_KEY,
} from '../features/todo/list/todoScreenSortMode';
import { ORDER_STEP } from '../services/db/todoService';
import { useFloatingTabBarScrollPadding } from '../navigation/useFloatingTabBarInset';

const CATEGORY_ORDER_STEP = 100;
const DRAG_BOTTOM_BUFFER = 32;

export default function TodoScreen() {
  const router = useRouter();
  const { currentDate } = useDateStore();
  const { data: todos, isLoading } = useTodos(currentDate);
  const { data: categories = [] } = useCategories();
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const reorderTodoMutation = useReorderTodo(currentDate);
  const reorderCategoryMutation = useReorderCategory();
  const { openDetail } = useTodoFormStore();
  const [showNativeQuickPrototype, setShowNativeQuickPrototype] = useState(false);
  const [nativeQuickPrototypeInstanceKey, setNativeQuickPrototypeInstanceKey] = useState(0);
  const [sortMode, setSortMode] = useState(TODO_SCREEN_SORT_MODE.TIME);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState([]);
  const bottomInset = useFloatingTabBarScrollPadding(DRAG_BOTTOM_BUFFER);
  const { handleCategoryHeaderAction } = useManagedCategoryHeaderActions({ categories });

  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;

  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(TODO_SCREEN_SORT_MODE_STORAGE_KEY),
      AsyncStorage.getItem(TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY),
    ])
      .then(([storedSortMode, storedCollapsedCategoryIds]) => {
        if (!mounted) {
          return;
        }

        if (Object.values(TODO_SCREEN_SORT_MODE).includes(storedSortMode)) {
          setSortMode(storedSortMode);
        }

        if (storedCollapsedCategoryIds) {
          try {
            const parsedIds = JSON.parse(storedCollapsedCategoryIds);
            if (Array.isArray(parsedIds)) {
              setCollapsedCategoryIds(parsedIds.filter((value) => typeof value === 'string'));
            }
          } catch {
            // noop
          }
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleComplete = useCallback((todoId) => {
    const actualDate = currentDateRef.current;
    const todo = (todos || []).find((item) => item._id === todoId);
    if (!todo) {
      return;
    }

    toggleCompletion({
      todoId,
      date: actualDate,
      currentCompleted: todo.completed,
      todo,
    });
  }, [todos, toggleCompletion]);

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

  const handleChangeSortMode = useCallback((nextMode) => {
    setSortMode(nextMode);
    AsyncStorage.setItem(TODO_SCREEN_SORT_MODE_STORAGE_KEY, nextMode).catch(() => {});
  }, []);

  const handleToggleCollapsedCategory = useCallback((categoryId) => {
    if (!categoryId) {
      return;
    }

    setCollapsedCategoryIds((currentIds) => {
      const nextIds = currentIds.includes(categoryId)
        ? currentIds.filter((id) => id !== categoryId)
        : [...currentIds, categoryId];

      AsyncStorage.setItem(
        TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY,
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
        TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY,
        JSON.stringify(nextIds)
      ).catch(() => {});
      return nextIds;
    });
  }, []);

  const handleOpenNativeQuickPrototype = useCallback(() => {
    setNativeQuickPrototypeInstanceKey((current) => current + 1);

    InteractionManager.runAfterInteractions(() => {
      setShowNativeQuickPrototype(true);
    });
  }, []);

  const managedListMode = useMemo(() => {
    switch (sortMode) {
      case TODO_SCREEN_SORT_MODE.CUSTOM:
        return TODO_MANAGED_LIST_MODE.CUSTOM;
      case TODO_SCREEN_SORT_MODE.CATEGORY:
        return TODO_MANAGED_LIST_MODE.CATEGORY;
      case TODO_SCREEN_SORT_MODE.TIME:
      default:
        return TODO_MANAGED_LIST_MODE.TIME;
    }
  }, [sortMode]);

  const visibleTodos = useMemo(
    () => (Array.isArray(todos) ? todos : []),
    [todos]
  );

  const handleManagedToggleComplete = useCallback((todo) => {
    if (!todo?._id) {
      return;
    }
    handleToggleComplete(todo._id);
  }, [handleToggleComplete]);

  const handleManagedAction = useCallback((todo, event) => {
    switch (event?.actionId) {
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
  }, [handleDelete, handleOpenTodo]);

  const handleManagedReorderCommit = useCallback(async (event) => {
    if (managedListMode === TODO_MANAGED_LIST_MODE.TIME) {
      return;
    }

    const visibleTodoById = new Map(visibleTodos.map((todo) => [todo._id, todo]));
    const updates = [];
    const categoryOrderUpdates = [];

    if (managedListMode === TODO_MANAGED_LIST_MODE.CUSTOM) {
      const todoSection = event?.sections?.find((section) => section.sectionId === 'todos');
      const orderedTodoIds = (todoSection?.orderedItemIds || []).filter((itemId) =>
        visibleTodoById.has(itemId)
      );

      orderedTodoIds.forEach((todoId, index) => {
        const todo = visibleTodoById.get(todoId);
        if (!todo) {
          return;
        }

        const nextOrder = (index + 1) * ORDER_STEP;
        const currentOrder = Number(todo.order?.custom ?? 0);
        if (currentOrder === nextOrder) {
          return;
        }

        updates.push({
          id: todoId,
          order: {
            custom: nextOrder,
          },
        });
      });
    }

    if (managedListMode === TODO_MANAGED_LIST_MODE.CATEGORY) {
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

      (event?.sections || []).forEach((section) => {
        const categoryId = section.sectionId;
        if (!categoryId || categoryId === 'favorites') {
          return;
        }

        const orderedTodoIds = (section.orderedItemIds || []).filter((itemId) =>
          visibleTodoById.has(itemId)
        );

        orderedTodoIds.forEach((todoId, index) => {
          const todo = visibleTodoById.get(todoId);
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

    if (updates.length === 0 && categoryOrderUpdates.length === 0) {
      return;
    }

    try {
      if (categoryOrderUpdates.length > 0) {
        await reorderCategoryMutation.mutateAsync({ orders: categoryOrderUpdates });
      }

      if (updates.length > 0) {
        await reorderTodoMutation.mutateAsync({ updates });
      }
    } catch (error) {
      console.error('[TodoScreen] reorder commit failed:', error?.message || error);
    }
  }, [categories, managedListMode, reorderCategoryMutation, reorderTodoMutation, visibleTodos]);

  return (
    <SafeAreaView style={styles.container}>
      <WeekFlowTodoHeader />

      <View style={styles.prototypeEntryRow}>
        <TouchableOpacity
          accessibilityRole="button"
          style={styles.prototypeButton}
          onPress={handleOpenNativeQuickPrototype}
          activeOpacity={0.85}
        >
          <Text style={styles.prototypeButtonText}>네이티브 퀵 테스트</Text>
        </TouchableOpacity>
        {Platform.OS === 'ios' ? (
          <TouchableOpacity
            accessibilityRole="button"
            style={[styles.prototypeButton, styles.secondaryPrototypeButton]}
            onPress={() => router.push('/native-category-menu')}
            activeOpacity={0.85}
          >
            <Text style={[styles.prototypeButtonText, styles.secondaryPrototypeButtonText]}>
              Native Managed List
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {Platform.OS === 'ios' ? (
        <View style={styles.managedListContainer}>
          <View style={styles.sortContainer}>
            {TODO_SCREEN_SORT_MODE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleChangeSortMode(option.id)}
                style={[styles.sortButton, sortMode === option.id && styles.sortButtonActive]}
                activeOpacity={0.82}
              >
                <Text style={[styles.sortButtonText, sortMode === option.id && styles.sortButtonTextActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <NativeTodoManagedList
            listId={`todo-screen:${currentDate}`}
            mode={managedListMode}
            todos={visibleTodos}
            categories={categories}
            collapsedCategoryIds={collapsedCategoryIds}
            favoriteTodos={[]}
            includeFavoriteSection={false}
            includeEmptyCategorySections={managedListMode === TODO_MANAGED_LIST_MODE.CATEGORY}
            contentInsetBottom={bottomInset}
            itemOptions={{
              includeFavoriteAction: false,
              includeFavoriteToggle: false,
              showFavoriteBadge: false,
            }}
            style={{ paddingHorizontal: 16 }}
            onPressTodo={handleOpenTodo}
            onPressSectionHeader={handleToggleCollapsedCategory}
            onRequestExpandSection={({ sectionId }) => {
              handleExpandCollapsedCategory(sectionId);
            }}
            onToggleComplete={handleManagedToggleComplete}
            onTodoAction={handleManagedAction}
            onSectionHeaderAction={handleCategoryHeaderAction}
            onReorderCommit={handleManagedReorderCommit}
            onError={(event) => {
              console.warn('[TodoScreen:NativeTodoManagedList]', event?.message || event);
            }}
          />
        </View>
      ) : (
        <DailyTodoList
          todos={visibleTodos}
          categories={categories}
          isLoading={isLoading}
          sortMode={sortMode}
          onChangeSortMode={handleChangeSortMode}
          onToggleComplete={handleToggleComplete}
          onEdit={handleOpenTodo}
          onDelete={handleDelete}
        />
      )}

      <NativeTodoFormSessionPrototype
        visible={showNativeQuickPrototype}
        instanceKey={nativeQuickPrototypeInstanceKey}
        onDismiss={() => setShowNativeQuickPrototype(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  prototypeEntryRow: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  prototypeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    marginRight: 8,
    marginBottom: 8,
  },
  prototypeButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryPrototypeButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryPrototypeButtonText: {
    color: '#111827',
  },
  managedListContainer: {
    flex: 1,
  },
  sortContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 16,
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
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  sortButtonText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
});
