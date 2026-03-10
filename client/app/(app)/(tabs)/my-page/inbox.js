import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

export default function MyPageInboxScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: 'Inbox' }} />
      <View className="p-4">
        <Text className="text-gray-500">
          구현 예정: 미분류(systemKey='inbox') 일정 보관함 + 빠른 캡처 플로우
        </Text>
      </View>
    </ScrollView>
  );
}

