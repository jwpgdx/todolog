import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { Ionicons } from '@expo/vector-icons';

import CustomBottomSheet from '../../ui/bottom-sheet';

export default function TodoDetailBottomSheet({ visible, onClose, todo }) {
  // 60%, 95% snap points as requested
  const snapPoints = useMemo(() => ['60%', '95%'], []);

  if (!todo) return null;

  return (
    <CustomBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={snapPoints}
    >
      <View className="flex-1 px-6 pt-4">
        {/* Header / Title */}
        <View className="mb-6 border-b border-gray-100 pb-4">
          <Text className="text-2xl font-bold text-gray-900 leading-tight">
            {todo.title}
          </Text>
        </View>

        {/* Content Placeholder */}
        <BottomSheetScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {todo.memo && (
            <View className="mb-4">
              <Text className="text-gray-500 font-medium mb-1">메모</Text>
              <Text className="text-gray-800 text-base leading-relaxed bg-gray-50 p-3 rounded-lg">
                {todo.memo}
              </Text>
            </View>
          )}

          <View className="flex-row items-center mb-4">
            <Text className="text-gray-500 font-medium mr-2">상태:</Text>
            <View className={`px-2 py-1 rounded-md ${todo.completed ? 'bg-blue-100' : 'bg-gray-100'}`}>
              <Text className={`text-xs ${todo.completed ? 'text-blue-600' : 'text-gray-600'}`}>
                {todo.completed ? '완료됨' : '진행 중'}
              </Text>
            </View>
          </View>

          {(todo.isAllDay || todo.startTime || todo.endTime) && (
            <View className="mb-4">
              <Text className="text-gray-500 font-medium mb-1">시간</Text>
              <Text className="text-gray-800 text-base">
                {todo.isAllDay
                  ? '하루종일'
                  : `${todo.startTime || '미정'} ~ ${todo.endTime || '미정'}`
                }
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </View>
    </CustomBottomSheet>
  );
}
