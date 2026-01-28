import { TouchableOpacity, Text } from 'react-native';

export default function Button({ title, onPress, variant = 'primary', disabled = false }) {
  const variants = {
    primary: 'bg-blue-500',
    secondary: 'bg-gray-500',
    danger: 'bg-red-500',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      className={`py-4 rounded-lg items-center ${variants[variant]} ${
        disabled ? 'opacity-50' : 'active:opacity-80'
      }`}
    >
      <Text className="text-white font-semibold text-base">{title}</Text>
    </TouchableOpacity>
  );
}
