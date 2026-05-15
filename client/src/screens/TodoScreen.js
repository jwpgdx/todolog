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
import { useAllTodos } from '../hooks/queries/useAllTodos';
import { useCategories } from '../hooks/queries/useCategories';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useUpdateTodo } from '../hooks/queries/useUpdateTodo';
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
  buildFavoriteOrderUpdatesFromEvent,
  getFavoriteTodoIdSet,
  getSortedFavoriteTodos,
  mergeTodoReorderUpdates,
} from '../features/todo/native/todoFavoriteOrder';
import {
  compareByTodoScreenTimeMode,
  hasTodoScheduledTime,
  normalizeTodoScreenSortMode,
  TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY,
  TODO_SCREEN_SORT_MODE,
  TODO_SCREEN_SORT_MODE_OPTIONS,
  TODO_SCREEN_SORT_MODE_STORAGE_KEY,
} from '../features/todo/list/todoScreenSortMode';
import { ORDER_STEP } from '../services/db/todoService';
import { useFloatingTabBarScrollPadding } from '../navigation/useFloatingTabBarInset';

const CATEGORY_ORDER_STEP = 100;
const DRAG_BOTTOM_BUFFER = 32;
const TODO_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY =
  'todo_screen_favorites_collapsed';

function areStringArraysEqual(a, b) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

export default function TodoScreen() {
  const router = useRouter();
  const { currentDate } = useDateStore();
  const { data: todos, isLoading } = useTodos(currentDate);
  const { data: allTodos } = useAllTodos(currentDate);
  const { data: categories = [] } = useCategories();
  const { mutate: toggleCompletion } = useToggleCompletion();
  const { mutate: deleteTodo } = useDeleteTodo();
  const updateTodoMutation = useUpdateTodo();
  const reorderTodoMutation = useReorderTodo(currentDate);
  const reorderCategoryMutation = useReorderCategory();
  const { openDetail } = useTodoFormStore();
  const [showNativeQuickPrototype, setShowNativeQuickPrototype] = useState(false);
  const [nativeQuickPrototypeInstanceKey, setNativeQuickPrototypeInstanceKey] = useState(0);
  const [sortMode, setSortMode] = useState(TODO_SCREEN_SORT_MODE.TIME);
  const [collapsedCategoryIds, setCollapsedCategoryIds] = useState([]);
  const [isFavoriteSectionCollapsed, setIsFavoriteSectionCollapsed] = useState(false);
  const bottomInset = useFloatingTabBarScrollPadding(DRAG_BOTTOM_BUFFER);
  const { handleCategoryHeaderAction } = useManagedCategoryHeaderActions({ categories });

  const currentDateRef = useRef(currentDate);
  currentDateRef.current = currentDate;

  const favoriteTodos = useMemo(
    () => getSortedFavoriteTodos(allTodos),
    [allTodos]
  );

  const favoriteTodoIdSet = useMemo(
    () => getFavoriteTodoIdSet(favoriteTodos),
    [favoriteTodos]
  );

  const dateTodos = useMemo(
    () => (Array.isArray(todos) ? todos : []),
    [todos]
  );

  const visibleTodos = useMemo(
    () =>
      dateTodos.filter(
        (todo) => !favoriteTodoIdSet.has(todo._id)
      ),
    [dateTodos, favoriteTodoIdSet]
  );

  const visibleTodoById = useMemo(
    () => new Map([...visibleTodos, ...favoriteTodos].map((todo) => [todo._id, todo])),
    [favoriteTodos, visibleTodos]
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([
      AsyncStorage.getItem(TODO_SCREEN_SORT_MODE_STORAGE_KEY),
      AsyncStorage.getItem(TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY),
      AsyncStorage.getItem(TODO_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY),
    ])
      .then(([storedSortMode, storedCollapsedCategoryIds, storedFavoritesCollapsed]) => {
        if (!mounted) {
          return;
        }

        if (storedSortMode) {
          const normalizedSortMode = normalizeTodoScreenSortMode(storedSortMode);
          setSortMode(normalizedSortMode);
          if (normalizedSortMode !== storedSortMode) {
            AsyncStorage.setItem(
              TODO_SCREEN_SORT_MODE_STORAGE_KEY,
              normalizedSortMode
            ).catch(() => {});
          }
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

        if (storedFavoritesCollapsed != null) {
          setIsFavoriteSectionCollapsed(storedFavoritesCollapsed === 'true');
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, []);

  const handleToggleComplete = useCallback((todoId) => {
    const todo = visibleTodoById.get(todoId);
    if (!todo) {
      return;
    }

    toggleCompletion({
      todoId,
      date: todo.occurrenceDate || currentDateRef.current,
      currentCompleted: todo.completed,
      todo,
    });
  }, [toggleCompletion, visibleTodoById]);

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
    const normalizedSortMode = normalizeTodoScreenSortMode(nextMode);
    setSortMode(normalizedSortMode);
    AsyncStorage.setItem(
      TODO_SCREEN_SORT_MODE_STORAGE_KEY,
      normalizedSortMode
    ).catch(() => {});
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

  const handleToggleFavoriteSectionCollapsed = useCallback(() => {
    setIsFavoriteSectionCollapsed((currentValue) => {
      const nextValue = !currentValue;
      AsyncStorage.setItem(
        TODO_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY,
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
        TODO_SCREEN_FAVORITES_COLLAPSED_STORAGE_KEY,
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

  const handleOpenNativeQuickPrototype = useCallback(() => {
    setNativeQuickPrototypeInstanceKey((current) => current + 1);

    InteractionManager.runAfterInteractions(() => {
      setShowNativeQuickPrototype(true);
    });
  }, []);

  const managedListMode = useMemo(() => {
    switch (sortMode) {
      case TODO_SCREEN_SORT_MODE.CATEGORY:
        return TODO_MANAGED_LIST_MODE.CATEGORY;
      case TODO_SCREEN_SORT_MODE.TIME:
      default:
        return TODO_MANAGED_LIST_MODE.TIME;
    }
  }, [sortMode]);

  const handleManagedToggleComplete = useCallback((todo) => {
    if (!todo?._id) {
      return;
    }
    handleToggleComplete(todo._id);
  }, [handleToggleComplete]);

  const handleFavoriteChange = useCallback((todo, isFavorite) => {
    if (!todo?._id) {
      return;
    }

    updateTodoMutation.mutate({
      id: todo._id,
      data: {
        isFavorite,
        startDate: todo.startDate || todo.date || currentDateRef.current,
      },
    });
  }, [updateTodoMutation]);

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
    const mainTodoById = new Map(visibleTodos.map((todo) => [todo._id, todo]));
    const allTodoById = new Map([...visibleTodos, ...favoriteTodos].map((todo) => [todo._id, todo]));
    const updates = [];
    const categoryOrderUpdates = [];
    const movedToFavorites = event?.toSectionId === 'favorites';
    const movedFromFavorites =
      event?.fromSectionId === 'favorites' &&
      event?.toSectionId &&
      event.toSectionId !== 'favorites';
    const movedTodo = allTodoById.get(event?.movedItemId);
    const favoriteOrderUpdates = buildFavoriteOrderUpdatesFromEvent(event, allTodoById);

    updates.push(...favoriteOrderUpdates);

    if (!movedToFavorites && managedListMode === TODO_MANAGED_LIST_MODE.TIME) {
      const shouldOnlyUnfavoriteTimedTodo =
        movedFromFavorites && movedTodo && hasTodoScheduledTime(movedTodo);

      const todoSection = event?.sections?.find((section) => section.sectionId === 'todos');
      const reorderTodoById = movedFromFavorites ? allTodoById : mainTodoById;
      const timeModeTodos =
        movedFromFavorites && movedTodo && !mainTodoById.has(movedTodo._id)
          ? [...visibleTodos, movedTodo]
          : visibleTodos;
      const orderedTodoIds = (todoSection?.orderedItemIds || []).filter((itemId) =>
        reorderTodoById.has(itemId)
      );
      const orderedTodos = orderedTodoIds
        .map((itemId) => reorderTodoById.get(itemId))
        .filter(Boolean);
      const firstUntimedIndex = orderedTodos.findIndex((todo) => !hasTodoScheduledTime(todo));
      const hasTimedTodoAfterUntimedTodo =
        firstUntimedIndex !== -1 &&
        orderedTodos
          .slice(firstUntimedIndex + 1)
          .some((todo) => hasTodoScheduledTime(todo));
      const expectedOrderedTodos = [...timeModeTodos].sort(compareByTodoScreenTimeMode);
      const expectedTimedTodoIds = expectedOrderedTodos
        .filter((todo) => hasTodoScheduledTime(todo))
        .map((todo) => todo._id);
      const orderedTimedTodoIds = orderedTodos
        .filter((todo) => hasTodoScheduledTime(todo))
        .map((todo) => todo._id);

      if (!shouldOnlyUnfavoriteTimedTodo && (todoSection || movedTodo)) {
        if (
          !todoSection ||
          hasTimedTodoAfterUntimedTodo ||
          (!movedFromFavorites && movedTodo && hasTodoScheduledTime(movedTodo)) ||
          !areStringArraysEqual(orderedTimedTodoIds, expectedTimedTodoIds)
        ) {
          return;
        }

        const orderedTodoIdsWithoutTime = orderedTodoIds.filter((itemId) => {
          const todo = reorderTodoById.get(itemId);
          return todo && !hasTodoScheduledTime(todo);
        });
        const currentTodoIdsWithoutTime = expectedOrderedTodos
          .filter((todo) => !hasTodoScheduledTime(todo))
          .map((todo) => todo._id);

        if (
          movedFromFavorites ||
          !areStringArraysEqual(orderedTodoIdsWithoutTime, currentTodoIdsWithoutTime)
        ) {
          orderedTodoIdsWithoutTime.forEach((todoId, index) => {
            const todo = reorderTodoById.get(todoId);
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
      }
    }

    if (!movedToFavorites && managedListMode === TODO_MANAGED_LIST_MODE.CATEGORY) {
      const reorderTodoById = movedFromFavorites ? allTodoById : mainTodoById;
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
      console.error('[TodoScreen] reorder commit failed:', error?.message || error);
    }
  }, [categories, favoriteTodos, managedListMode, reorderCategoryMutation, reorderTodoMutation, visibleTodos]);

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
            includeEmptyCategorySections={managedListMode === TODO_MANAGED_LIST_MODE.CATEGORY}
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
            onToggleComplete={handleManagedToggleComplete}
            onToggleFavorite={(todo) => {
              handleFavoriteChange(todo, !todo?.isFavorite);
            }}
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
          todos={dateTodos}
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
