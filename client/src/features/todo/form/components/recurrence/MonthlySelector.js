import { View, Text, TouchableOpacity } from 'react-native';

/**
 * MonthlySelector (월간 날짜 선택기)
 * 월간 반복 시 반복할 날짜(1-31)를 선택하는 컴포넌트
 * 
 * @param {number[]} value - 선택된 날짜 배열 [1, 15, 28] 또는 단일 숫자 (호환용)
 * @param {Function} onChange - 날짜 변경 콜백 (배열로 전달)
 */
export default function MonthlySelector({ value, onChange }) {
  // 1~31까지의 날짜 배열 생성
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  // value가 숫자면 배열로 변환 (하위 호환성)
  const selectedDays = Array.isArray(value) ? value : (value ? [value] : []);

  // 날짜 토글 핸들러
  const toggleDay = (day) => {
    if (selectedDays.includes(day)) {
      // 이미 선택된 경우 제거 (단, 최소 1개는 유지)
      if (selectedDays.length > 1) {
        onChange(selectedDays.filter(d => d !== day).sort((a, b) => a - b));
      }
    } else {
      // 선택되지 않은 경우 추가
      onChange([...selectedDays, day].sort((a, b) => a - b));
    }
  };

  // 7x5 그리드로 배치하기 위해 5개 행으로 나누기
  const rows = [];
  for (let i = 0; i < 5; i++) {
    const startIndex = i * 7;
    const endIndex = Math.min(startIndex + 7, days.length);
    const row = days.slice(startIndex, endIndex);

    // 마지막 행이 7개 미만인 경우 빈 공간 추가
    while (row.length < 7) {
      row.push(null);
    }

    rows.push(row);
  }

  // 선택된 날짜 표시 텍스트
  const selectedText = selectedDays.length > 0
    ? selectedDays.join(', ') + '일'
    : '선택 없음';

  return (
    <View>
      <Text className="text-sm text-gray-600 mb-2 dark:text-gray-400">
        매월 몇일 (복수 선택 가능)
      </Text>
      <View className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row justify-between mb-2 last:mb-0">
            {row.map((day, dayIndex) => {
              const isSelected = day !== null && selectedDays.includes(day);
              return (
                <View key={`${rowIndex}-${dayIndex}`} className="w-9 h-9">
                  {day !== null ? (
                    <TouchableOpacity
                      onPress={() => toggleDay(day)}
                      className={`w-full h-full rounded-lg items-center justify-center ${isSelected
                          ? 'bg-primary'
                          : 'bg-gray-100 dark:bg-gray-700'
                        }`}
                    >
                      <Text
                        className={`text-sm font-medium ${isSelected
                            ? 'text-white'
                            : 'text-gray-700 dark:text-gray-300'
                          }`}
                      >
                        {day}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View />
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </View>

      {/* 선택된 날짜 표시 */}
      <View className="mt-2 flex-row items-center justify-center flex-wrap">
        <Text className="text-sm text-gray-500 dark:text-gray-400">
          선택된 날짜:
        </Text>
        <Text className="text-sm font-medium text-primary ml-1">
          매월 {selectedText}
        </Text>
      </View>
    </View>
  );
}
