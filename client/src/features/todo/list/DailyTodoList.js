import React, { useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';

import TodoListItem from './TodoListItem';
import { useFloatingTabBarScrollPadding } from '../../../navigation/useFloatingTabBarInset';
import {
  TODO_SCREEN_SORT_MODE,
  TODO_SCREEN_SORT_MODE_OPTIONS,
} from './todoScreenSortMode';

function compareByCreatedAt(a, b) {
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

function compareById(a, b) {
  return String(a?._id || '').localeCompare(String(b?._id || ''));
}

function compareByTime(a, b) {
  const allDayA = a?.isAllDay === true ? 0 : 1;
  const allDayB = b?.isAllDay === true ? 0 : 1;
  if (allDayA !== allDayB) {
    return allDayA - allDayB;
  }

  const startA = String(a?.startTime || '');
  const startB = String(b?.startTime || '');
  if (startA !== startB) {
    return startA.localeCompare(startB);
  }

  const createdAtOrder = compareByCreatedAt(a, b);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return compareById(a, b);
}

function compareByCustom(a, b) {
  const orderA = Number(a?.order?.custom ?? 0);
  const orderB = Number(b?.order?.custom ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const createdAtOrder = compareByCreatedAt(a, b);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return compareById(a, b);
}

function compareByCategory(categoriesById, a, b) {
  const categoryA = categoriesById.get(a?.categoryId || '');
  const categoryB = categoriesById.get(b?.categoryId || '');
  const categoryOrderA = Number(categoryA?.order ?? categoryA?.order_index ?? 0);
  const categoryOrderB = Number(categoryB?.order ?? categoryB?.order_index ?? 0);

  if (categoryOrderA !== categoryOrderB) {
    return categoryOrderA - categoryOrderB;
  }

  const todoOrderA = Number(a?.order?.category ?? 0);
  const todoOrderB = Number(b?.order?.category ?? 0);
  if (todoOrderA !== todoOrderB) {
    return todoOrderA - todoOrderB;
  }

  const createdAtOrder = compareByCreatedAt(a, b);
  if (createdAtOrder !== 0) {
    return createdAtOrder;
  }

  return compareById(a, b);
}

export default function DailyTodoList({
  todos = [],
  categories = [],
  isLoading,
  sortMode = TODO_SCREEN_SORT_MODE.TIME,
  onChangeSortMode,
  onToggleComplete,
  onEdit,
  onDelete,
}) {
  const bottomInset = useFloatingTabBarScrollPadding(16);

  const categoriesById = useMemo(
    () => new Map((categories || []).map((category) => [category._id, category])),
    [categories]
  );

  const sortedTodos = useMemo(() => {
    if (!todos?.length) {
      return [];
    }

    const items = [...todos];

    switch (sortMode) {
      case TODO_SCREEN_SORT_MODE.CUSTOM:
        return items.sort(compareByCustom);
      case TODO_SCREEN_SORT_MODE.CATEGORY:
        return items.sort((a, b) => compareByCategory(categoriesById, a, b));
      case TODO_SCREEN_SORT_MODE.TIME:
      default:
        return items.sort(compareByTime);
    }
  }, [categoriesById, sortMode, todos]);

  const renderItem = useCallback(({ item }) => (
    <TodoListItem
      item={item}
      onToggleComplete={onToggleComplete}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  ), [onDelete, onEdit, onToggleComplete]);

  const keyExtractor = useCallback((item) => item._id, []);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.loadingText}>목록을 불러오는 중...</Text>
      </View>
    );
  }

  if (!todos?.length) {
    return (
      <View style={styles.container}>
        <View style={styles.sortContainer}>
          {TODO_SCREEN_SORT_MODE_OPTIONS.map((option) => (
            <SortButton
              key={option.id}
              label={option.label}
              isActive={sortMode === option.id}
              onPress={() => onChangeSortMode?.(option.id)}
            />
          ))}
        </View>
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>등록된 할 일이 없습니다.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.sortContainer}>
        {TODO_SCREEN_SORT_MODE_OPTIONS.map((option) => (
          <SortButton
            key={option.id}
            label={option.label}
            isActive={sortMode === option.id}
            onPress={() => onChangeSortMode?.(option.id)}
          />
        ))}
      </View>

      <FlashList
        data={sortedTodos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        estimatedItemSize={88}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset }]}
      />
    </View>
  );
}

function SortButton({ label, isActive, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.sortButton, isActive && styles.sortButtonActive]}
    >
      <Text style={[styles.sortButtonText, isActive && styles.sortButtonTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

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
  listContent: {
    paddingBottom: 0,
  },
});
