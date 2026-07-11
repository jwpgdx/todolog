import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { NativeSelectionList } from '../features/settings';
import { NATIVE_SELECTION_LIST_COLORS } from '../features/settings/native/selectionListColors';
import { useAllTodos } from '../hooks/queries/useAllTodos';
import { useCategories } from '../hooks/queries/useCategories';
import { useReorderTodo } from '../hooks/queries/useReorderTodo';
import { useTodayDate } from '../hooks/useTodayDate';
import { ORDER_STEP } from '../services/db/todoService';

function compareCategories(a, b) {
  const aInbox = a?.systemKey === 'inbox' ? 0 : 1;
  const bInbox = b?.systemKey === 'inbox' ? 0 : 1;
  if (aInbox !== bInbox) {
    return aInbox - bInbox;
  }

  const orderA = Number(a?.order ?? a?.order_index ?? 0);
  const orderB = Number(b?.order ?? b?.order_index ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function getParamValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

function parseTodoIds(rawTodoId, rawTodoIds) {
  const todoIdsValue = getParamValue(rawTodoIds);
  if (todoIdsValue) {
    return String(todoIdsValue)
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  const todoId = getParamValue(rawTodoId);
  return todoId ? [todoId] : [];
}

function getCommonCategoryId(todos) {
  if (!todos.length) {
    return null;
  }

  const firstCategoryId = todos[0]?.categoryId || null;
  return todos.every((todo) => (todo?.categoryId || null) === firstCategoryId)
    ? firstCategoryId
    : null;
}

function buildMoveOrderUpdates(todos, allTodos, categoryId) {
  const selectedIdSet = new Set(todos.map((todo) => todo._id));
  const maxOrder = (allTodos || []).reduce((currentMax, todo) => {
    if (!todo || selectedIdSet.has(todo._id) || todo.categoryId !== categoryId) {
      return currentMax;
    }

    return Math.max(currentMax, Number(todo.order?.category ?? todo.categoryOrder ?? 0));
  }, 0);

  return todos.map((todo, index) => ({
    id: todo._id,
    categoryId,
    order: {
      category: maxOrder + (index + 1) * ORDER_STEP,
    },
  }));
}

export default function TodoCategorySelectScreen() {
  const router = useRouter();
  const { todoId: rawTodoId, todoIds: rawTodoIds } = useLocalSearchParams();
  const todoIds = useMemo(
    () => parseTodoIds(rawTodoId, rawTodoIds),
    [rawTodoId, rawTodoIds]
  );
  const { todayDate } = useTodayDate();
  const { data: todos = [], isLoading: isTodosLoading } = useAllTodos(todayDate);
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const reorderTodoMutation = useReorderTodo(todayDate);

  const selectedTodos = useMemo(
    () =>
      todoIds
        .map((todoId) => (Array.isArray(todos) ? todos : []).find((item) => item?._id === todoId))
        .filter(Boolean),
    [todoIds, todos]
  );

  const commonCategoryId = useMemo(
    () => getCommonCategoryId(selectedTodos),
    [selectedTodos]
  );

  const [pendingCategoryId, setPendingCategoryId] = useState(commonCategoryId);

  useEffect(() => {
    if (commonCategoryId) {
      setPendingCategoryId(commonCategoryId);
    }
  }, [commonCategoryId]);

  const selectedCategoryId = pendingCategoryId || commonCategoryId || null;
  const hasCategoryChange = useMemo(
    () =>
      Boolean(selectedCategoryId) &&
      selectedTodos.some((todo) => (todo?.categoryId || null) !== selectedCategoryId),
    [selectedCategoryId, selectedTodos]
  );

  const options = useMemo(
    () =>
      [...(categories || [])]
        .filter((category) => category?._id)
        .sort(compareCategories)
        .map((category) => ({
          id: category._id,
          label: category.name || '이름 없는 카테고리',
          keywords: [category.name, category.systemKey].filter(Boolean),
          leadingColor: category.color,
        })),
    [categories]
  );

  const canApply =
    selectedTodos.length > 0 &&
    Boolean(selectedCategoryId) &&
    hasCategoryChange &&
    !reorderTodoMutation.isPending;

  const handleApply = useCallback(async () => {
    if (!canApply) {
      return;
    }

    try {
      const updates = buildMoveOrderUpdates(selectedTodos, todos, selectedCategoryId);
      await reorderTodoMutation.mutateAsync({ updates });
      router.back();
    } catch (error) {
      console.error('[TodoCategorySelectScreen] move failed:', error?.message || error);
    }
  }, [canApply, reorderTodoMutation, router, selectedCategoryId, selectedTodos, todos]);

  const handleSelectionCommit = useCallback(({ selectedIds }) => {
    const nextCategoryId = selectedIds?.[0];
    if (nextCategoryId) {
      setPendingCategoryId(nextCategoryId);
    }
  }, []);

  const headerColorOptions =
    Platform.OS === 'ios'
      ? {
          headerTransparent: true,
        }
      : {
          headerStyle: {
            backgroundColor: NATIVE_SELECTION_LIST_COLORS.modalHeaderBackground,
          },
          headerTintColor: NATIVE_SELECTION_LIST_COLORS.modalHeaderAction,
          headerTitleStyle: {
            color: NATIVE_SELECTION_LIST_COLORS.modalHeaderText,
          },
        };

  const isLoading = isTodosLoading || isCategoriesLoading;

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          headerShadowVisible: false,
          title: '카테고리 선택',
          ...headerColorOptions,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.headerAction}>
              <Text style={styles.headerActionText}>취소</Text>
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              disabled={!canApply}
              onPress={handleApply}
              style={styles.headerAction}
            >
              <Text
                style={[
                  styles.headerActionText,
                  !canApply && styles.headerActionTextDisabled,
                ]}
              >
                이동
              </Text>
            </TouchableOpacity>
          ),
        }}
      />

      {isLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={NATIVE_SELECTION_LIST_COLORS.action} />
        </View>
      ) : selectedTodos.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>이동할 일정을 찾을 수 없습니다.</Text>
        </View>
      ) : (
        <ScrollView
          style={styles.listScroll}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.listContent}
        >
          <NativeSelectionList
            key={`todo-category-select:${todoIds.join('-') || 'unknown'}:${selectedCategoryId || 'none'}`}
            screenId="todo-category-select"
            title=""
            options={options}
            selectedIds={selectedCategoryId ? [selectedCategoryId] : []}
            onSelectionCommit={handleSelectionCommit}
          />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NATIVE_SELECTION_LIST_COLORS.modalBackground,
  },
  headerAction: {
    marginRight: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  headerActionText: {
    color: NATIVE_SELECTION_LIST_COLORS.modalHeaderAction,
    fontSize: 16,
    fontWeight: '600',
  },
  headerActionTextDisabled: {
    opacity: 0.36,
  },
  listScroll: {
    flex: 1,
    backgroundColor: NATIVE_SELECTION_LIST_COLORS.listBackground,
  },
  listContent: {
    paddingBottom: 24,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
  },
});
