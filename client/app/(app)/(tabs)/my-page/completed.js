import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';

export default function MyPageCompletedScreen() {
  return (
    <ScrollView className="flex-1 bg-white" contentInsetAdjustmentBehavior="automatic">
      <Stack.Screen options={{ title: '완료' }} />
      <View className="p-4">
        <Text className="text-gray-500">구현 예정: 완료 기록 전용 리스트 화면</Text>
      </View>
    </ScrollView>
  );
}

