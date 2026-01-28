import { View, Text, FlatList } from 'react-native';

export default function NotificationScreen() {
  const notifications = [
    { id: '1', title: '새로운 이벤트가 추가되었습니다', time: '5분 전' },
    { id: '2', title: '할일을 완료했습니다', time: '1시간 전' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white px-6 py-4 border-b border-gray-200">
        <Text className="text-2xl font-bold">알림</Text>
      </View>
      <FlatList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View className="bg-white px-6 py-4 border-b border-gray-100">
            <Text className="text-base font-medium mb-1">{item.title}</Text>
            <Text className="text-sm text-gray-500">{item.time}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-20">
            <Text className="text-gray-400">알림이 없습니다</Text>
          </View>
        }
      />
    </View>
  );
}
