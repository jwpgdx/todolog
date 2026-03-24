import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useFloatingTabBarScrollPadding } from '../../../../src/navigation/useFloatingTabBarInset';

export default function MyPageCompletedScreen() {
  const bottomInset = useFloatingTabBarScrollPadding(16);

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: bottomInset }}
    >
      <Stack.Screen options={{ title: '완료' }} />
      <View className="p-4">
        <Text className="text-gray-500">구현 예정: 완료 기록 전용 리스트 화면</Text>
      </View>
    </ScrollView>
  );
}
