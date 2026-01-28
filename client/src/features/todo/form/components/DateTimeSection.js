import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import DatePicker from '../../../../components/ui/DatePicker';
import ListRow from '../../../../components/ui/ListRow';
import TimePicker from '../../../../components/ui/wheel-picker/TimePicker';
import { Ionicons } from '@expo/vector-icons';

// Helper to parse "HH:MM" -> { hour, minute }
const parseTime = (timeStr) => {
    if (!timeStr) return { hour: '00', minute: '00' };
    const [h, m] = timeStr.split(':');
    return { hour: h || '00', minute: m || '00' };
};

// Helper to format { hour, minute } -> "HH:MM"
const formatTime = (hour, minute) => {
    return `${hour}:${minute}`;
};

/**
 * DateTimeSection Component
 * 
 * @param {string} mode - 'datetime' (기본) | 'time-range' (반복 설정용)
 * 
 * === Mode A: datetime (기본) ===
 * @param {string} label - 라벨 (예: "시작", "종료")
 * @param {string} date - 날짜 값 ("YYYY-MM-DD")
 * @param {Function} onDateChange - 날짜 변경 콜백
 * @param {string} time - 시간 값 ("HH:MM")
 * @param {Function} onTimeChange - 시간 변경 콜백
 * @param {string} dateKey - 날짜 Picker 식별자
 * @param {string} timeKey - 시간 Picker 식별자
 * @param {boolean} showTimeInput - 시간 입력 표시 여부 (하루종일일 때 false)
 * 
 * === Mode B: time-range (반복 설정용) ===
 * @param {string} startTime - 시작 시간 ("HH:MM")
 * @param {string} endTime - 종료 시간 ("HH:MM")
 * @param {Function} onStartTimeChange - 시작 시간 변경 콜백
 * @param {Function} onEndTimeChange - 종료 시간 변경 콜백
 * @param {string} startTimeKey - 시작 시간 Picker 식별자
 * @param {string} endTimeKey - 종료 시간 Picker 식별자
 * 
 * === 공통 ===
 * @param {string} activeInput - 현재 활성화된 Picker Key
 * @param {Function} setActiveInput - Picker 제어 함수
 */
export default function DateTimeSection({
    // 공통
    mode = 'datetime',
    label,
    activeInput,
    setActiveInput,

    // Mode A: datetime
    date,
    onDateChange,
    time,
    onTimeChange,
    dateKey,
    timeKey,
    showTimeInput = true,

    // Mode B: time-range
    startTime,
    endTime,
    onStartTimeChange,
    onEndTimeChange,
    startTimeKey,
    endTimeKey,
}) {
    const onToggleInput = (inputType) => {
        setActiveInput(activeInput === inputType ? null : inputType);
    };

    // === Mode A: datetime ===
    if (mode === 'datetime') {
        const { hour, minute } = parseTime(time);

        const handleHourChange = (newHour) => {
            onTimeChange(formatTime(newHour, minute));
        };

        const handleMinuteChange = (newMinute) => {
            onTimeChange(formatTime(hour, newMinute));
        };

        return (
            <>
                <ListRow
                    title={label}
                    right={
                        <View className="flex-row items-center gap-1">
                            <TouchableOpacity
                                onPress={() => onToggleInput(dateKey)}
                                className="flex-row items-center rounded-md h-8 px-3 bg-gray-100"
                            >
                                <Text className={`text-base ${activeInput === dateKey
                                    ? "text-blue-500"
                                    : date
                                        ? "text-gray-900"
                                        : "text-gray-500"
                                    }`}>
                                    {date ? date.replace(/-/g, '.') + '.' : "----.--.--."}
                                </Text>
                            </TouchableOpacity>

                            {showTimeInput && (
                                <TouchableOpacity
                                    onPress={() => onToggleInput(timeKey)}
                                    className="flex-row items-center rounded-md h-8 px-3 bg-gray-100"
                                >
                                    <Text className={`text-base ${activeInput === timeKey
                                        ? "text-blue-500"
                                        : time
                                            ? "text-gray-900"
                                            : "text-gray-500"
                                        }`}>
                                        {time || "--:--"}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    }
                />

                {/* Inline Picker (Date or Time) */}
                {(activeInput === dateKey || (showTimeInput && activeInput === timeKey)) && (
                    <View>
                        {activeInput === dateKey && (
                            <View className="bg-gray-100 p-4 rounded-lg mt-2">
                                <DatePicker
                                    selectedDate={date}
                                    onDateChange={(newDate) => {
                                        onDateChange(newDate);
                                        onToggleInput(null);
                                    }}
                                />
                            </View>
                        )}
                        {showTimeInput && activeInput === timeKey && (
                            <View className="bg-gray-100 p-4 rounded-lg mt-2">
                                <TimePicker
                                    hour={hour}
                                    setHour={handleHourChange}
                                    min={minute}
                                    setMin={handleMinuteChange}
                                />
                            </View>
                        )}
                    </View>
                )}
            </>
        );
    }

    // === Mode B: time-range (반복 설정용) ===
    if (mode === 'time-range') {
        const startParsed = parseTime(startTime);
        const endParsed = parseTime(endTime);

        // 익일 표시 로직: 종료 시간이 시작 시간보다 이르거나 같으면 (+1)
        const isNextDay = (() => {
            if (!startTime || !endTime) return false;
            const startMinutes = parseInt(startParsed.hour) * 60 + parseInt(startParsed.minute);
            const endMinutes = parseInt(endParsed.hour) * 60 + parseInt(endParsed.minute);
            return endMinutes <= startMinutes;
        })();

        return (
            <>
                <ListRow
                    title={label}
                    right={
                        <View className="flex-row items-center gap-2">
                            {/* 시작 시간 */}
                            <TouchableOpacity
                                onPress={() => onToggleInput(startTimeKey)}
                                className="flex-row items-center rounded-md h-8 px-3 bg-gray-100"
                            >
                                <Text className={`text-base ${activeInput === startTimeKey
                                    ? "text-blue-500"
                                    : startTime
                                        ? "text-gray-900"
                                        : "text-gray-500"
                                    }`}>
                                    {startTime || "--:--"}
                                </Text>
                            </TouchableOpacity>

                            {/* 화살표 */}
                            <Ionicons name="arrow-forward" size={16} color="#9CA3AF" />

                            {/* 종료 시간 */}
                            <TouchableOpacity
                                onPress={() => onToggleInput(endTimeKey)}
                                className="flex-row items-center rounded-md h-8 px-3 bg-gray-100"
                            >
                                <Text className={`text-base ${activeInput === endTimeKey
                                    ? "text-blue-500"
                                    : endTime
                                        ? "text-gray-900"
                                        : "text-gray-500"
                                    }`}>
                                    {endTime || "--:--"}
                                </Text>
                            </TouchableOpacity>

                            {/* 익일 표시 */}
                            {isNextDay && (
                                <Text className="text-xs text-gray-500 ml-1">(+1)</Text>
                            )}
                        </View>
                    }
                />

                {/* Inline TimePicker */}
                {(activeInput === startTimeKey || activeInput === endTimeKey) && (
                    <View className="bg-gray-100 p-4 rounded-lg mt-2">
                        {activeInput === startTimeKey && (
                            <TimePicker
                                hour={startParsed.hour}
                                setHour={(h) => onStartTimeChange(formatTime(h, startParsed.minute))}
                                min={startParsed.minute}
                                setMin={(m) => onStartTimeChange(formatTime(startParsed.hour, m))}
                            />
                        )}
                        {activeInput === endTimeKey && (
                            <TimePicker
                                hour={endParsed.hour}
                                setHour={(h) => onEndTimeChange(formatTime(h, endParsed.minute))}
                                min={endParsed.minute}
                                setMin={(m) => onEndTimeChange(formatTime(endParsed.hour, m))}
                            />
                        )}
                    </View>
                )}
            </>
        );
    }

    return null;
}
