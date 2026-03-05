import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, SafeAreaView, Platform, FlatList, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCategories } from '../hooks/queries/useCategories';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteCategory } from '../api/categories';
import { useReorderCategory } from '../hooks/queries/useReorderCategory';
import Toast from 'react-native-toast-message';
import { useCategoryActionSheet } from '../hooks/useCategoryActionSheet';
import * as Haptics from 'expo-haptics';


const CategoryListItem = ({ item, isLocked, isDragging, drag, onShowOptions, isWeb, isEditing, onDelete }) => (
  <View
    className={`flex-row items-center justify-between p-4 rounded-xl mb-3 ${isDragging ? 'bg-blue-50 shadow-lg' : 'bg-gray-50'}`}
  >
    <View className="flex-row items-center flex-1">
      {/* Edit Mode: Delete Button on Left */}
      {isEditing && !isLocked && (
        <TouchableOpacity
          onPress={onDelete}
          className="mr-3 p-1"
        >
          <Ionicons name="remove-circle" size={24} color="#EF4444" />
        </TouchableOpacity>
      )}

      {/* Normal Mode: No handle on left, or maybe hidden. 
          Actually previous code had reorder handle on left for drag.
          Requested: "Edit Mode -> Delete Icon CategoryName MoveHandle".
          Normal Mode -> (Old behavior? Just name).
          But we need to support dragging.
          If normal mode supports dragging via handle, where is it?
          If we follow iOS list style strictly:
            Normal: Just list. No drag handle. (Or maybe handle visible?)
            Edit: Delete (Left) ... Handle (Right).
          Let's hide the old left handle if in Edit Mode (replaced by Delete), 
          OR if Normal Mode also hides handle (user said "순서 바꾸는거 핸들을 맨처음에 나오지말고... 편집을 누르면..."). 
          So Handle is HIDDEN in Normal Mode.
      */}

      <View
        style={{ backgroundColor: item.color || '#CCCCCC' }}
        className="w-4 h-4 rounded-full mr-3"
      />
      <View>
        <View className="flex-row items-center">
          <Text className="font-semibold text-base text-gray-900">
            {item.name}
          </Text>
          {isLocked && (
            <Ionicons name="lock-closed" size={14} color="#9CA3AF" style={{ marginLeft: 6 }} />
          )}
        </View>
      </View>
    </View>

    {/* Right Actions */}
    <View className="flex-row items-center">
      {isEditing ? (
        /* Edit Mode: Reorder Handle on Right */
        isLocked ? null : (
          <TouchableOpacity
            onPressIn={!isWeb ? drag : undefined}
            className="ml-2 cursor-grab active:cursor-grabbing p-2"
            disabled={isWeb}
          >
            <Ionicons name="reorder-three" size={24} color="#9CA3AF" />
          </TouchableOpacity>
        )
      ) : (
        isLocked ? null : (
          /* Normal Mode: Ellipsis Button (Action Sheet) */
          <TouchableOpacity
            onPress={() => onShowOptions(item)}
            className="p-2"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#6B7280" />
          </TouchableOpacity>
        )
      )}
    </View>
  </View>
);

// SortableCategoryItem with click support
const SortableCategoryItem = ({ item, onShowOptions, isEditing, onDelete, onItemPress }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 999 : 'auto',
    position: 'relative',
    touchAction: 'none',
    cursor: isEditing ? 'grab' : 'pointer',
  };

  const handleClick = (e) => {
    if (!isEditing && onItemPress) {
      e.stopPropagation();
      onItemPress(item);
    }
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...(isEditing ? listeners : {})} onClick={handleClick}>
      <CategoryListItem
        item={item}
        isLocked={item.systemKey === 'inbox'}
        isDragging={isDragging}
        onShowOptions={onShowOptions}
        isWeb={true}
        isEditing={isEditing}
        onDelete={onDelete}
      />
    </div>
  );
};

// WebCategoryList with click support
const WebCategoryList = ({ data, onDragEnd, HeaderComponent, onShowOptions, FooterComponent, isEditing, onDelete, onItemPress }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = data.findIndex((item) => item._id === active.id);
      const newIndex = data.findIndex((item) => item._id === over.id);

      const newData = arrayMove(data, oldIndex, newIndex);
      onDragEnd({ data: newData, from: oldIndex, to: newIndex });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {HeaderComponent}
        <SortableContext
          items={data.map(d => d._id)}
          strategy={verticalListSortingStrategy}
        >
          {data.map((item) => (
            <SortableCategoryItem
              key={item._id}
              item={item}
              onShowOptions={onShowOptions}
              isEditing={isEditing}
              onDelete={() => onDelete(item._id)}
              onItemPress={onItemPress}
            />
          ))}
          <div className="mt-2 w-full">
            {FooterComponent}
          </div>
          {/* Helper spacer for scrolling */}
          <div style={{ height: 100 }} />
        </SortableContext>
      </ScrollView>
    </DndContext>
  );
};

export default function CategoryManagementScreen({ navigation }) {
  const { data: categories, isLoading } = useCategories();
  const queryClient = useQueryClient();
  const reorderMutation = useReorderCategory();

  const [localCategories, setLocalCategories] = useState([]);
  const isWeb = Platform.OS === 'web';

  const inboxCategory = useMemo(
    () => localCategories.find((cat) => cat?.systemKey === 'inbox') || null,
    [localCategories]
  );
  const draggableCategories = useMemo(
    () => localCategories.filter((cat) => cat?.systemKey !== 'inbox'),
    [localCategories]
  );

  // Sync local state when data loads
  useEffect(() => {
    if (categories) {
      setLocalCategories(categories);
    }
  }, [categories]);

  const [isEditing, setIsEditing] = useState(false);

  // Header "Edit" button logic
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => setIsEditing((prev) => !prev)}
          className="p-2 mr-2"
        >
          <Text className={`${isEditing ? 'text-blue-600 font-bold' : 'text-gray-900 text-base'}`}>
            {isEditing ? '완료' : '편집'}
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, isEditing]);

  const handleEdit = (category) => {
    if (category?.systemKey === 'inbox') {
      Toast.show({ type: 'info', text1: 'Inbox 카테고리는 편집할 수 없습니다.' });
      return;
    }
    navigation.navigate('CategoryForm', { category });
  };

  const handleCreate = () => {
    navigation.navigate('CategoryForm');
  };

  const { showOptions } = useCategoryActionSheet({
    onEdit: (category) => handleEdit(category),
    onDelete: (id) => handleDelete(id),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      Toast.show({ type: 'success', text1: '카테고리가 삭제되었습니다.' });
    },
    onError: (error) => {
      Toast.show({
        type: 'error',
        text1: '삭제 실패',
        text2: error.response?.data?.message || '다시 시도해주세요',
      });
    },
  });

  const handleDelete = (id) => {
    console.log('handleDelete called with:', id);

    const target = localCategories.find((cat) => cat?._id === id) || null;
    if (target?.systemKey === 'inbox') {
      if (isWeb) {
        window.alert('Inbox 카테고리는 삭제할 수 없습니다.');
      } else {
        Alert.alert('알림', 'Inbox 카테고리는 삭제할 수 없습니다.');
      }
      return;
    }

    if (localCategories.length <= 1) {
      if (Platform.OS === 'web') {
        window.alert('마지막 카테고리는 삭제할 수 없습니다.');
      } else {
        Alert.alert('알림', '마지막 카테고리는 삭제할 수 없습니다.');
      }
      return;
    }

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        '정말 삭제하시겠습니까?\n해당 카테고리의 모든 할일도 함께 삭제됩니다.'
      );
      if (confirmed) {
        console.log('Web delete confirmed, mutating:', id);
        deleteMutation.mutate(id);
      }
    } else {
      Alert.alert(
        '카테고리 삭제',
        '정말 삭제하시겠습니까?\n해당 카테고리의 모든 할일도 함께 삭제됩니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '삭제',
            style: 'destructive',
            onPress: () => {
              console.log('Native delete confirmed, mutating:', id);
              deleteMutation.mutate(id);
            }
          },
        ]
      );
    }
  };

  const handleDragEnd = ({ data, from, to }) => {
    const nextAll = inboxCategory ? [inboxCategory, ...data] : data;
    setLocalCategories(nextAll); // Optimistic UI update

    if (from === to) return;

    const movedItem = data[to];
    if (!movedItem) return;
    const prevItem = data[to - 1];
    const nextItem = data[to + 1];

    let newOrder;
    if (!prevItem && !nextItem) {
      newOrder = 0; // Only item
    } else if (!prevItem) {
      // Moved to top
      newOrder = nextItem.order - 100; // Arbitrary gap
    } else if (!nextItem) {
      // Moved to bottom
      newOrder = prevItem.order + 100;
    } else {
      // Between two items
      newOrder = (prevItem.order + nextItem.order) / 2;
    }

    console.log(`[Reorder] ${movedItem.name}: ${movedItem.order} -> ${newOrder}`);
    reorderMutation.mutate({ id: movedItem._id, order: newOrder });
  };

  const renderItem = ({ item, drag, isActive }) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={() => {
            if (!isEditing) {
              setIsEditing(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); // Optional: Add haptic feedback
            }
          }}
          disabled={isEditing || isActive} // Disable touch in edit mode usually, or handle tap
          onPress={() => {
            if (!isEditing) {
              navigation.navigate('CategoryTodos', { category: item });
            }
          }}
          className="mb-3"
        >
          <CategoryListItem
            item={item}
            isLocked={item.systemKey === 'inbox'}
            isDragging={isActive}
            drag={drag}
            onShowOptions={showOptions}
            isWeb={false}
            isEditing={isEditing}
            onDelete={() => handleDelete(item._id)}
          />
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  const renderHeader = () => (
    <View className="px-6 pt-4 mb-2">
      <Text className="text-gray-500 text-sm mb-4">
        {isEditing
          ? '오른쪽 핸들을 드래그하여 순서를 변경하거나 왼쪽 버튼으로 삭제하세요.'
          : '카테고리를 꾹 누르면 편집 모드로 진입합니다.'}
      </Text>
      {inboxCategory ? (
        <TouchableOpacity
          disabled={isEditing}
          onPress={() => navigation.navigate('CategoryTodos', { category: inboxCategory })}
        >
          <CategoryListItem
            item={inboxCategory}
            isLocked={true}
            isDragging={false}
            onShowOptions={() => {}}
            isWeb={isWeb}
            isEditing={isEditing}
            onDelete={() => {}}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const renderFooter = () => (
    <TouchableOpacity
      onPress={handleCreate}
      className="flex-row items-center justify-center py-4 mt-2 bg-gray-50 rounded-xl border border-gray-200 border-dashed active:bg-gray-100"
    >
      <Ionicons name="add-circle-outline" size={24} color="#6B7280" />
      <Text className="text-gray-600 font-medium ml-2 text-base">새로운 카테고리 추가</Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text>로딩 중...</Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView className="flex-1">
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1">


          {Platform.OS === 'web' ? (
            <WebCategoryList
              data={draggableCategories}
              onDragEnd={handleDragEnd}
              HeaderComponent={renderHeader()}
              onShowOptions={showOptions}
              FooterComponent={renderFooter()}
              isEditing={isEditing}
              onDelete={handleDelete}
              onItemPress={(category) => navigation.navigate('CategoryTodos', { category })}
            />
          ) : (
            <DraggableFlatList
              data={draggableCategories}
              onDragEnd={handleDragEnd}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              ListHeaderComponent={renderHeader()}
              ListFooterComponent={renderFooter()}
              contentContainerStyle={{ paddingBottom: 100, paddingHorizontal: 24 }}
            />
          )}
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
