import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { useTodoSelectionResultStore } from '../features/todo/selection/todoSelectionResultStore';
import { useBulkMoveTodos } from '../hooks/queries/useBulkMoveTodos';
import { useCategories } from '../hooks/queries/useCategories';

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

function buildOriginScope(sourceScreen, sourceCategoryId) {
  if (sourceScreen === 'allTodos') {
    return { screen: 'allTodos' };
  }

  if (sourceScreen === 'favorites') {
    return { screen: 'favorites' };
  }

  if (sourceScreen === 'category' && sourceCategoryId) {
    return {
      screen: 'category',
      categoryId: sourceCategoryId,
    };
  }

  return null;
}

export default function TodoCategorySelectScreen() {
  const router = useRouter();
  const {
    todoId: rawTodoId,
    todoIds: rawTodoIds,
    orderedTodoIds: rawOrderedTodoIds,
    selectionSessionId: rawSelectionSessionId,
    sourceScreen: rawSourceScreen,
    sourceCategoryId: rawSourceCategoryId,
  } = useLocalSearchParams();
  const todoIds = useMemo(
    () => parseTodoIds(rawTodoId, rawTodoIds),
    [rawTodoId, rawTodoIds]
  );
  const orderedTodoIds = useMemo(() => {
    const parsedOrderedTodoIds = parseTodoIds(null, rawOrderedTodoIds);
    if (parsedOrderedTodoIds.length > 0) {
      return parsedOrderedTodoIds;
    }

    return todoIds.length === 1 ? todoIds : [];
  }, [rawOrderedTodoIds, todoIds]);
  const selectionSessionId = getParamValue(rawSelectionSessionId) || null;
  const sourceScreen = getParamValue(rawSourceScreen) || null;
  const sourceCategoryId = getParamValue(rawSourceCategoryId) || null;
  const originScope = useMemo(
    () => buildOriginScope(sourceScreen, sourceCategoryId),
    [sourceCategoryId, sourceScreen]
  );
  const { data: categories = [], isLoading: isCategoriesLoading } = useCategories();
  const bulkMoveMutation = useBulkMoveTodos();
  const publishSelectionResult = useTodoSelectionResultStore((state) => state.publishResult);

  const [pendingCategoryId, setPendingCategoryId] = useState(null);
  const todoRequestKey = todoIds.join(',');

  useEffect(() => {
    setPendingCategoryId(null);
  }, [todoRequestKey]);

  const selectedCategoryId = pendingCategoryId || null;

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
    todoIds.length > 0 &&
    Boolean(selectedCategoryId) &&
    !bulkMoveMutation.isPending;

  const handleApply = useCallback(async () => {
    if (!canApply) {
      return;
    }
    if (todoIds.length > 1 && (!selectionSessionId || !originScope?.screen)) {
      Alert.alert(
        '선택 정보를 확인할 수 없습니다',
        '이전 화면으로 돌아가 일정을 다시 선택한 뒤 이동해 주세요.'
      );
      return;
    }

    try {
      const result = await bulkMoveMutation.mutateAsync({
        selectedTodoIds: todoIds,
        orderedTodoIds,
        targetCategoryId: selectedCategoryId,
        originScope,
      });

      if (result?.status === 'selection_stale') {
        if (selectionSessionId) {
          publishSelectionResult({
            sessionId: selectionSessionId,
            status: 'selection_stale',
            invalidTodoIds: result.invalidTodoIds || [],
            validTodoIds: result.validTodoIds || [],
          });
        }

        Alert.alert(
          '선택 항목이 변경되었습니다',
          '선택한 일정 중 현재 상태에서 이동할 수 없는 항목이 있어 이동을 취소했습니다. 변경된 항목을 제외한 뒤 다시 확인해 주세요.',
          [
            {
              text: '확인',
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      if (result?.status === 'target_invalid') {
        setPendingCategoryId(null);
        Alert.alert(
          '카테고리를 사용할 수 없습니다',
          '선택한 카테고리가 삭제되었거나 더 이상 사용할 수 없습니다. 다른 카테고리를 선택해 주세요.'
        );
        return;
      }

      if (result?.status === 'selection_order_unresolved') {
        Alert.alert(
          '목록 순서를 다시 확인해 주세요',
          '선택한 일정의 현재 화면 순서를 확정할 수 없어 이동을 취소했습니다. 목록으로 돌아가 상태를 확인한 뒤 다시 시도해 주세요.',
          [
            {
              text: '확인',
              onPress: () => router.back(),
            },
          ]
        );
        return;
      }

      if (selectionSessionId) {
        publishSelectionResult({
          sessionId: selectionSessionId,
          status: 'success',
          movedTodoIds: result?.movedTodoIds || [],
          noOpTodoIds: result?.noOpTodoIds || [],
        });
      }
      router.back();
    } catch (error) {
      console.error('[TodoCategorySelectScreen] move failed:', error?.message || error);
      Alert.alert('이동하지 못했습니다', '로컬 저장 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    }
  }, [
    bulkMoveMutation,
    canApply,
    originScope,
    orderedTodoIds,
    publishSelectionResult,
    router,
    selectedCategoryId,
    selectionSessionId,
    todoIds,
  ]);

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

  const isLoading = isCategoriesLoading;

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
      ) : todoIds.length === 0 ? (
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
