import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

export default function MyPageUpcomingScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: '예정' }} />
      <View className="p-4">
        <Text className="text-gray-500">
          구현 예정: 향후 1주일간 예정된 일정 전용 리스트 화면
        </Text>
      </View>
    </ScrollView>
  );
}

