import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useFloatingTabBarScrollPadding } from '../../../../src/navigation/useFloatingTabBarInset';

export default function MyPageUpcomingScreen() {
  const bottomInset = useFloatingTabBarScrollPadding(16);

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: bottomInset }}
    >
      <Stack.Screen options={{ title: '예정' }} />
      <View className="p-4">
        <Text className="text-gray-500">
          구현 예정: 향후 1주일간 예정된 일정 전용 리스트 화면
        </Text>
      </View>
    </ScrollView>
  );
}
