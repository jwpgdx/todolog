import { Stack } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { useFloatingTabBarScrollPadding } from '../../../../src/navigation/useFloatingTabBarInset';

export default function MyPageFavoritesScreen() {
  const bottomInset = useFloatingTabBarScrollPadding(16);

  return (
    <ScrollView
      className="flex-1 bg-white"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ paddingBottom: bottomInset }}
    >
      <Stack.Screen options={{ title: '즐겨찾기' }} />
      <View className="p-4">
        <Text className="text-gray-500">
          구현 예정: 즐겨찾기(별표) 표시된 일정만 모아보는 스마트 리스트
        </Text>
      </View>
    </ScrollView>
  );
}
