import { useState } from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';
import { convertFromApiFormat, getRecurrenceDescription } from '../../../utils/recurrenceUtils';

export default function TodoItem({ todo, onToggle, onPress, onDelete }) {
  const [showMenu, setShowMenu] = useState(false);

  const handleEdit = () => {
    setShowMenu(false);
    onPress();
  };

  const handleDelete = () => {
    setShowMenu(false);
    if (onDelete) {
      onDelete();
    }
  };

  // RRULE 기반 데이터를 UI 표시용으로 변환
  const displayTodo = convertFromApiFormat(todo);

  // 시간 표시 텍스트 생성
  const getTimeText = () => {
    // 하루종일 할일인 경우
    if (displayTodo.isAllDay) {
      return '📅 하루종일';
    }
    
    // 시간이 설정되지 않은 경우
    if (!displayTodo.startTime && !displayTodo.endTime) {
      return '📅 하루종일';
    }
    
    let timeText = '⏰ ';
    if (displayTodo.startTime) {
      timeText += displayTodo.startTime;
      if (displayTodo.endTime) {
        timeText += ` - ${displayTodo.endTime}`;
      }
    } else if (displayTodo.endTime) {
      timeText += `종료: ${displayTodo.endTime}`;
    }
    
    return timeText;
  };

  // 날짜 표시 텍스트 생성
  const getDateText = () => {
    if (displayTodo.isRecurring) {
      return `🔄 ${getRecurrenceDescription(todo.recurrence)}`;
    }
    
    if (displayTodo.endDate && displayTodo.endDate !== displayTodo.startDate) {
      return `📅 ${displayTodo.startDate} ~ ${displayTodo.endDate}`;
    }
    
    return null;
  };

  const timeText = getTimeText();
  const dateText = getDateText();

  return (
    <>
      <View className="mx-4 mb-3 p-4 rounded-lg border bg-white border-gray-200">
        <View className="flex-row items-center">
          <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            className={`w-6 h-6 rounded-full border-2 mr-3 items-center justify-center ${
              todo.completed ? 'bg-blue-500 border-blue-500' : 'border-gray-400'
            }`}
          >
            {todo.completed && <Text className="text-white text-xs">✓</Text>}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={onPress}
            activeOpacity={0.7}
            className="flex-1"
          >
            <Text
              className={`text-base font-medium ${
                todo.completed ? 'text-gray-400 line-through' : 'text-gray-900'
              }`}
            >
              {todo.title}
            </Text>
            
            {timeText && (
              <Text className="text-sm text-gray-500 mt-1">
                {timeText}
              </Text>
            )}
            
            {dateText && (
              <Text className="text-sm text-blue-600 mt-1">
                {dateText}
              </Text>
            )}
            
            {todo.memo && (
              <Text className="text-sm text-gray-600 mt-1">{todo.memo}</Text>
            )}
            
            {/* 캘린더 동기화 실패 시 재시도 버튼 */}
            {todo.syncStatus === 'failed' && (
              <View className="mt-2 px-3 py-1 bg-orange-100 rounded-full self-start">
                <Text className="text-xs text-orange-600">
                  📅 캘린더 동기화 실패
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowMenu(true)}
            activeOpacity={0.7}
            className="ml-2 px-2 py-1"
          >
            <Text className="text-gray-400 text-xl font-bold">⋮</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bottom Sheet Menu */}
      <Modal
        visible={showMenu}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowMenu(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setShowMenu(false)}
          className="flex-1 bg-black/50 justify-end"
        >
          <View className="bg-white rounded-t-3xl">
            <View className="py-2 border-b border-gray-200">
              <View className="w-12 h-1 bg-gray-300 rounded-full self-center" />
            </View>
            
            <TouchableOpacity
              onPress={handleEdit}
              className="px-6 py-4 border-b border-gray-100"
            >
              <Text className="text-base text-gray-900">수정</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleDelete}
              className="px-6 py-4"
            >
              <Text className="text-base text-red-500">삭제</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowMenu(false)}
              className="px-6 py-4 border-t border-gray-200"
            >
              <Text className="text-base text-gray-500 text-center">취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
