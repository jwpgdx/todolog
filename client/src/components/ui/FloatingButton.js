import { TouchableOpacity, Text, Platform } from 'react-native';

export default function FloatingButton({ onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="absolute bottom-6 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg active:opacity-80"
      style={{
        // 웹에서 확실한 z-index 적용
        zIndex: 999,
        elevation: Platform.OS === 'android' ? 8 : 0,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
      }}
    >
      <Text className="text-white text-3xl font-light">+</Text>
    </TouchableOpacity>
  );
}
