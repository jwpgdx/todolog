import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import Toast from 'react-native-toast-message';
import * as Haptics from 'expo-haptics';
import { useQueryClient } from '@tanstack/react-query';

import { deleteCategory as deleteCategoryApi } from '../../../api/categories';
import { useCategories } from '../../../hooks/queries/useCategories';
import { useReorderCategory } from '../../../hooks/queries/useReorderCategory';
import { deleteCategory as deleteCategoryFromDB } from '../../../services/db/categoryService';
import { ensureDatabase } from '../../../services/db/database';
import { useCategoryActionSheet } from '../../../hooks/useCategoryActionSheet';
import { invalidateAllScreenCaches } from '../../../services/query-aggregation/cache';

function blurActiveElementOnWeb() {
  if (Platform.OS !== 'web') return;
  if (typeof document === 'undefined') return;
  document.activeElement?.blur?.();
}

function CategoryRow({
  item,
  indexLabel,
  isLocked,
  isEditing,
  isDragging,
  onPress,
  onShowOptions,
  onDelete,
  onEnterEditMode,
  drag,
  isWeb,
  isLast,
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDragging}
      onLongPress={() => {
        if (isEditing) return;
        if (Platform.OS === 'web') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onEnterEditMode?.();
      }}
      className={`flex-row items-center justify-between px-4 py-3 ${!isLast ? 'border-b border-gray-100' : ''} ${isDragging ? 'bg-blue-50' : 'bg-white'}`}
    >
      <View className="flex-row items-center flex-1">
        {/* Edit mode: delete on left */}
        {isEditing && !isLocked && (
          <TouchableOpacity onPress={onDelete} className="mr-2 p-1">
            <Ionicons name="remove-circle" size={22} color="#EF4444" />
          </TouchableOpacity>
        )}

        <Text className="w-8 text-xs text-gray-400 tabular-nums">{indexLabel}</Text>
        <View
          style={{ backgroundColor: item.color || '#CCCCCC' }}
          className="w-3 h-3 rounded-full mr-3"
        />
        <View className="flex-row items-center flex-1">
          <Text className={`text-base ${isLocked ? 'text-gray-700' : 'text-gray-900'} font-medium`}>
            {item.name}
          </Text>
          {isLocked && (
            <Ionicons name="lock-closed" size={14} color="#9CA3AF" style={{ marginLeft: 6 }} />
          )}
        </View>
      </View>

      <View className="flex-row items-center">
        {isEditing ? (
          isLocked ? null : (
            <TouchableOpacity
              onPressIn={!isWeb ? drag : undefined}
              className="p-2"
              disabled={isWeb}
            >
              <Ionicons name="reorder-three" size={22} color="#9CA3AF" />
            </TouchableOpacity>
          )
        ) : isLocked ? (
          <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
        ) : (
          <>
            <TouchableOpacity onPress={() => onShowOptions(item)} className="p-2">
              <Ionicons name="ellipsis-horizontal" size={18} color="#6B7280" />
            </TouchableOpacity>
            <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
          </>
        )}
      </View>
    </TouchableOpacity>
  );
}

function SortableCategoryItem({
  item,
  indexLabel,
  isEditing,
  onPress,
  onShowOptions,
  onDelete,
  isLast,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative',
    touchAction: 'none',
    cursor: isEditing ? 'grab' : 'pointer',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(isEditing ? listeners : {})}>
      <CategoryRow
        item={item}
        indexLabel={indexLabel}
        isLocked={item.systemKey === 'inbox'}
        isEditing={isEditing}
        isDragging={isDragging}
        onPress={onPress}
        onShowOptions={onShowOptions}
        onDelete={onDelete}
        isWeb={true}
        isLast={isLast}
      />
    </div>
  );
}

function WebCategoryList({
  inboxCategory,
  categories,
  isEditing,
  onPressCategory,
  onShowOptions,
  onDelete,
  onDragEnd,
  onPressAdd,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over) return;
    if (active.id === over.id) return;

    const oldIndex = categories.findIndex((item) => item._id === active.id);
    const newIndex = categories.findIndex((item) => item._id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const newData = arrayMove(categories, oldIndex, newIndex);
    onDragEnd({ data: newData, from: oldIndex, to: newIndex });
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <View className="bg-white rounded-2xl border border-gray-100">
        {inboxCategory ? (
          <CategoryRow
            item={inboxCategory}
            indexLabel="1"
            isLocked={true}
            isEditing={isEditing}
            isDragging={false}
            onPress={() => onPressCategory(inboxCategory)}
            onShowOptions={() => {}}
            onDelete={() => {}}
            isWeb={true}
            isLast={false}
          />
        ) : null}

        <SortableContext items={categories.map((d) => d._id)} strategy={verticalListSortingStrategy}>
          {categories.map((item, idx) => (
            <SortableCategoryItem
              key={item._id}
              item={item}
              indexLabel={String(idx + 2)}
              isEditing={isEditing}
              onPress={() => onPressCategory(item)}
              onShowOptions={onShowOptions}
              onDelete={() => onDelete(item._id)}
              isLast={false}
            />
          ))}
        </SortableContext>

        <TouchableOpacity
          onPress={onPressAdd}
          className="flex-row items-center px-4 py-3"
        >
          <Text className="w-8 text-xs text-gray-400 tabular-nums" />
          <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
          <Text className="text-base font-medium text-blue-600 ml-2">카테고리 추가</Text>
        </TouchableOpacity>
      </View>
    </DndContext>
  );
}

export default function CategoryGroupList() {
  const router = useRouter();
  const { data: categories, isLoading } = useCategories();
  const queryClient = useQueryClient();
  const reorderMutation = useReorderCategory();
  const isWeb = Platform.OS === 'web';

  const [localCategories, setLocalCategories] = useState([]);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (categories) {
      setLocalCategories(categories);
    }
  }, [categories]);

  const inboxCategory = useMemo(
    () => localCategories.find((cat) => cat?.systemKey === 'inbox') || null,
    [localCategories]
  );
  const draggableCategories = useMemo(
    () => localCategories.filter((cat) => cat?.systemKey !== 'inbox'),
    [localCategories]
  );

  const handlePressCategory = (category) => {
    blurActiveElementOnWeb();
    if (!category?._id) return;
    router.push(`/(app)/category/${category._id}`);
  };

  const handleEdit = (category) => {
    if (category?.systemKey === 'inbox') {
      Toast.show({ type: 'info', text1: 'Inbox 카테고리는 편집할 수 없습니다.' });
      return;
    }
    blurActiveElementOnWeb();
    if (!category?._id) return;
    router.push({
      pathname: '/(app)/category/form',
      params: { categoryId: category._id },
    });
  };

  const handleCreate = () => {
    blurActiveElementOnWeb();
    router.push('/(app)/category/form');
  };

  const handleDelete = async (id) => {
    const target = localCategories.find((cat) => cat?._id === id) || null;
    if (target?.systemKey === 'inbox') {
      if (isWeb) window.alert('Inbox 카테고리는 삭제할 수 없습니다.');
      else Alert.alert('알림', 'Inbox 카테고리는 삭제할 수 없습니다.');
      return;
    }

    if (localCategories.length <= 1) {
      if (isWeb) window.alert('마지막 카테고리는 삭제할 수 없습니다.');
      else Alert.alert('알림', '마지막 카테고리는 삭제할 수 없습니다.');
      return;
    }

    const doDelete = async () => {
      await ensureDatabase();
      await deleteCategoryApi(id);
      await deleteCategoryFromDB(id);
      invalidateAllScreenCaches({
        queryClient,
        reason: 'category:delete',
      });
      setLocalCategories((prev) => prev.filter((cat) => cat?._id !== id));
    };

    if (isWeb) {
      const confirmed = window.confirm('정말 삭제하시겠습니까?\n해당 카테고리의 모든 할일도 함께 삭제됩니다.');
      if (!confirmed) return;
      try {
        await doDelete();
        Toast.show({ type: 'success', text1: '카테고리가 삭제되었습니다.' });
      } catch (error) {
        Toast.show({
          type: 'error',
          text1: '삭제 실패',
          text2: error.response?.data?.message || '다시 시도해주세요',
        });
      }
      return;
    }

    Alert.alert(
      '카테고리 삭제',
      '정말 삭제하시겠습니까?\n해당 카테고리의 모든 할일도 함께 삭제됩니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              await doDelete();
              Toast.show({ type: 'success', text1: '카테고리가 삭제되었습니다.' });
            } catch (error) {
              Toast.show({
                type: 'error',
                text1: '삭제 실패',
                text2: error.response?.data?.message || '다시 시도해주세요',
              });
            }
          },
        },
      ]
    );
  };

  const { showOptions } = useCategoryActionSheet({
    onEdit: (category) => handleEdit(category),
    onDelete: (id) => handleDelete(id),
  });

  const handleDragEnd = ({ data, from, to }) => {
    const nextAll = inboxCategory ? [inboxCategory, ...data] : data;
    setLocalCategories(nextAll);

    if (from === to) return;

    const movedItem = data[to];
    if (!movedItem) return;
    const prevItem = data[to - 1];
    const nextItem = data[to + 1];

    let newOrder;
    if (!prevItem && !nextItem) {
      newOrder = 0;
    } else if (!prevItem) {
      newOrder = nextItem.order - 100;
    } else if (!nextItem) {
      newOrder = prevItem.order + 100;
    } else {
      newOrder = (prevItem.order + nextItem.order) / 2;
    }

    reorderMutation.mutate({ id: movedItem._id, order: newOrder });
  };

  const onToggleEditing = () => {
    setIsEditing((prev) => {
      const next = !prev;
      if (next && Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <View className="px-4 mt-6">
        <Text className="text-xs text-gray-400 mb-2">카테고리</Text>
        <View className="bg-white rounded-2xl border border-gray-100 p-4">
          <Text className="text-gray-500">로딩 중...</Text>
        </View>
      </View>
    );
  }

  const NativeEditList = () => (
    <DraggableFlatList
      data={draggableCategories}
      onDragEnd={handleDragEnd}
      keyExtractor={(item) => item._id}
      renderItem={({ item, drag, isActive, getIndex }) => (
        <ScaleDecorator>
          <CategoryRow
            item={item}
            indexLabel={String((getIndex?.() ?? 0) + 2)}
            isLocked={false}
            isEditing={isEditing}
            isDragging={isActive}
            onPress={() => handlePressCategory(item)}
            onShowOptions={showOptions}
            onDelete={() => handleDelete(item._id)}
            onEnterEditMode={() => setIsEditing(true)}
            drag={drag}
            isWeb={false}
            isLast={false}
          />
        </ScaleDecorator>
      )}
      scrollEnabled={false}
    />
  );

  return (
    <GestureHandlerRootView>
      <View className="px-4 mt-6">
        <View className="flex-row items-center justify-between mb-2">
          <Text className="text-xs font-semibold text-gray-500">카테고리</Text>
          <TouchableOpacity onPress={onToggleEditing} className="px-2 py-1">
            <Text className={`text-sm font-semibold ${isEditing ? 'text-blue-600' : 'text-gray-900'}`}>
              {isEditing ? '완료' : '편집'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* iOS grouped-style list */}
        {isWeb ? (
          <WebCategoryList
            inboxCategory={inboxCategory}
            categories={draggableCategories}
            isEditing={isEditing}
            onPressCategory={handlePressCategory}
            onShowOptions={showOptions}
            onDelete={handleDelete}
            onDragEnd={handleDragEnd}
            onPressAdd={handleCreate}
          />
        ) : (
          <View className="bg-white rounded-2xl border border-gray-100">
            {inboxCategory ? (
              <CategoryRow
                item={inboxCategory}
                indexLabel="1"
                isLocked={true}
                isEditing={isEditing}
                isDragging={false}
                onPress={() => handlePressCategory(inboxCategory)}
                onShowOptions={() => {}}
                onDelete={() => {}}
                onEnterEditMode={() => setIsEditing(true)}
                isWeb={false}
                isLast={false}
              />
            ) : null}

            {isEditing ? (
              <NativeEditList />
            ) : (
              draggableCategories.map((cat, idx) => (
                <CategoryRow
                  key={cat._id}
                  item={cat}
                  indexLabel={String(idx + 2)}
                  isLocked={false}
                  isEditing={false}
                  isDragging={false}
                  onPress={() => handlePressCategory(cat)}
                  onShowOptions={showOptions}
                  onDelete={() => handleDelete(cat._id)}
                  onEnterEditMode={() => setIsEditing(true)}
                  isWeb={false}
                  isLast={false}
                />
              ))
            )}

            <TouchableOpacity onPress={handleCreate} className="flex-row items-center px-4 py-3">
              <Text className="w-8 text-xs text-gray-400 tabular-nums" />
              <Ionicons name="add-circle-outline" size={20} color="#2563EB" />
              <Text className="text-base font-medium text-blue-600 ml-2">카테고리 추가</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </GestureHandlerRootView>
  );
}
