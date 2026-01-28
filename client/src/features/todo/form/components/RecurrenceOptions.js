import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import ListRow from '../../../../components/ui/ListRow';
import Dropdown from '../../../../components/ui/Dropdown';
import DatePicker from '../../../../components/ui/DatePicker';
import WeeklySelector from './recurrence/WeeklySelector';
import MonthlySelector from './recurrence/MonthlySelector';
import { Ionicons } from '@expo/vector-icons';

/**
 * RecurrenceOptions Component
 * 반복 설정을 위한 복합 컴포넌트
 * 
 * @param {string} frequency - 반복 주기 ('none' | 'daily' | 'weekly' | 'monthly' | 'yearly')
 * @param {Function} onFrequencyChange - 반복 주기 변경 콜백
 * @param {number[]} weekdays - 주간 반복 시 선택된 요일 (0=일, 1=월, ...)
 * @param {Function} onWeekdaysChange - 요일 변경 콜백
 * @param {number} dayOfMonth - 월간 반복 시 선택된 날짜 (1-31)
 * @param {Function} onDayOfMonthChange - 날짜 변경 콜백
 * @param {string} yearlyDate - 연간 반복 시 선택된 날짜 ("MM-DD")
 * @param {Function} onYearlyDateChange - 연간 날짜 변경 콜백
 * @param {string} endDate - 반복 종료일 ("YYYY-MM-DD" 또는 null)
 * @param {Function} onEndDateChange - 종료일 변경 콜백
 * @param {string} activeInput - 현재 활성화된 Picker Key
 * @param {Function} setActiveInput - Picker 제어 함수
 */
export default function RecurrenceOptions({
    frequency = 'none',
    onFrequencyChange,
    weekdays = [],
    onWeekdaysChange,
    dayOfMonth = 1,
    onDayOfMonthChange,
    yearlyDate,
    onYearlyDateChange,
    endDate,
    onEndDateChange,
    activeInput,
    setActiveInput,
    initialFocusTarget = null,  // 'REPEAT' 일 때 Dropdown 자동 열림
}) {
    const frequencyOptions = [
        { key: 'none', label: '안 함' },
        { key: 'daily', label: '매일' },
        { key: 'weekly', label: '매주' },
        { key: 'monthly', label: '매월' },
        { key: 'yearly', label: '매년' },
    ];

    const currentFrequency = frequencyOptions.find(opt => opt.key === frequency);

    const onToggleInput = (inputType) => {
        setActiveInput(activeInput === inputType ? null : inputType);
    };

    return (
        <>
            {/* 반복 주기 선택 */}
            <ListRow
                title="반복"
                zIndex={90}
                overflowVisible={true}
                right={
                    <Dropdown
                        defaultOpen={initialFocusTarget === 'REPEAT'}
                        trigger={(isOpen) => (
                            <View className="flex-row items-center">
                                <Text className="text-base text-gray-500 mr-1">
                                    {currentFrequency?.label || '안 함'}
                                </Text>
                                <Ionicons
                                    name={isOpen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color="#9CA3AF"
                                />
                            </View>
                        )}
                        align="right"
                        direction="down"
                    >
                        {(close) => (
                            <>
                                {frequencyOptions.map((option) => (
                                    <Dropdown.Item
                                        key={option.key}
                                        label={option.label}
                                        isSelected={frequency === option.key}
                                        onPress={() => {
                                            onFrequencyChange(option.key);
                                            close();
                                        }}
                                    />
                                ))}
                            </>
                        )}
                    </Dropdown>
                }
            />

            {/* 주간 반복 - 요일 선택 */}
            {frequency === 'weekly' && (
                <View className="px-4 py-3 bg-gray-50">
                    <WeeklySelector
                        value={weekdays}
                        onChange={onWeekdaysChange}
                    />
                </View>
            )}

            {/* 월간 반복 - 날짜 선택 */}
            {frequency === 'monthly' && (
                <View className="px-4 py-3 bg-gray-50">
                    <MonthlySelector
                        value={dayOfMonth}
                        onChange={onDayOfMonthChange}
                    />
                </View>
            )}

            {/* 연간 반복 - DatePicker로 월/일 선택 */}
            {frequency === 'yearly' && (
                <>
                    <ListRow
                        title="반복 날짜"
                        onPress={() => onToggleInput('yearlyDate')}
                        right={
                            <Text className={`text-base ${activeInput === 'yearlyDate' ? 'text-blue-500' : 'text-gray-500'}`}>
                                {yearlyDate ? `매년 ${yearlyDate.replace('-', '월 ')}일` : '날짜 선택'}
                            </Text>
                        }
                    />
                    {activeInput === 'yearlyDate' && (
                        <View className="bg-gray-100 p-4">
                            <DatePicker
                                selectedDate={yearlyDate ? `2026-${yearlyDate}` : null} // 임시 연도
                                onDateChange={(date) => {
                                    // "YYYY-MM-DD" → "MM-DD" 추출
                                    if (date) {
                                        const monthDay = date.substring(5); // "MM-DD"
                                        onYearlyDateChange(monthDay);
                                    }
                                    onToggleInput(null);
                                }}
                            />
                        </View>
                    )}
                </>
            )}

            {/* 반복 종료 설정 (frequency가 none이 아닐 때만 표시) */}
            {frequency !== 'none' && (
                <>
                    {/* 반복종료 Dropdown: 안 함 / 날짜 */}
                    <ListRow
                        title="반복종료"
                        zIndex={80}
                        overflowVisible={true}
                        right={
                            <Dropdown
                                trigger={(isOpen) => (
                                    <View className="flex-row items-center">
                                        <Text className="text-base text-gray-500 mr-1">
                                            {endDate ? '날짜' : '안 함'}
                                        </Text>
                                        <Ionicons
                                            name={isOpen ? "chevron-up" : "chevron-down"}
                                            size={16}
                                            color="#9CA3AF"
                                        />
                                    </View>
                                )}
                                align="right"
                                direction="down"
                            >
                                {(close) => (
                                    <>
                                        <Dropdown.Item
                                            label="안 함"
                                            isSelected={!endDate}
                                            onPress={() => {
                                                onEndDateChange(null);
                                                setActiveInput(null);
                                                close();
                                            }}
                                        />
                                        <Dropdown.Item
                                            label="날짜"
                                            isSelected={!!endDate}
                                            onPress={() => {
                                                // 날짜가 없으면 기본값으로 1주일 뒤 설정
                                                if (!endDate) {
                                                    const defaultDate = new Date();
                                                    defaultDate.setDate(defaultDate.getDate() + 7);
                                                    const dateStr = defaultDate.toISOString().split('T')[0];
                                                    onEndDateChange(dateStr);
                                                }
                                                close();
                                            }}
                                        />
                                    </>
                                )}
                            </Dropdown>
                        }
                    />

                    {/* 종료일 행 (날짜 선택 시만 표시) */}
                    {endDate && (
                        <>
                            <ListRow
                                title="종료일"
                                onPress={() => onToggleInput('recurrenceEndDate')}
                                right={
                                    <Text className={`text-base ${activeInput === 'recurrenceEndDate' ? 'text-blue-500' : 'text-gray-500'}`}>
                                        {endDate.replace(/-/g, '.')}
                                    </Text>
                                }
                            />
                            {activeInput === 'recurrenceEndDate' && (
                                <View className="bg-gray-100 p-4">
                                    <DatePicker
                                        selectedDate={endDate}
                                        onDateChange={(date) => {
                                            onEndDateChange(date);
                                            onToggleInput(null);
                                        }}
                                    />
                                </View>
                            )}
                        </>
                    )}
                </>
            )}
        </>
    );
}
