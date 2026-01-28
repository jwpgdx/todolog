import { View, Text, TouchableOpacity } from 'react-native';

/**
 * WeeklySelector (요일 선택기)
 * 주간 반복 시 반복할 요일을 선택하는 컴포넌트
 * 
 * @param {number[]} value - 선택된 요일 배열 (0=일, 1=월, ..., 6=토)
 * @param {Function} onChange - 요일 변경 콜백
 */
export default function WeeklySelector({ value = [], onChange }) {
  const weekdays = [
    { key: 0, label: '일' },
    { key: 1, label: '월' },
    { key: 2, label: '화' },
    { key: 3, label: '수' },
    { key: 4, label: '목' },
    { key: 5, label: '금' },
    { key: 6, label: '토' },
  ];

  const toggleWeekday = (day) => {
    if (value.includes(day)) {
      onChange(value.filter(d => d !== day));
    } else {
      onChange([...value, day].sort());
    }
  };

  return (
    <View>
      <Text className="text-sm text-gray-600 mb-2 dark:text-gray-400">
        반복할 요일
      </Text>
      <View className="flex-row gap-2">
        {weekdays.map((day) => {
          const isActive = value.includes(day.key);
          return (
            <TouchableOpacity
              key={day.key}
              onPress={() => toggleWeekday(day.key)}
              className={`w-10 h-10 rounded-full items-center justify-center ${isActive ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                }`}
            >
              <Text
                className={`font-medium ${isActive ? 'text-white' : 'text-gray-700 dark:text-gray-300'
                  }`}
              >
                {day.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}