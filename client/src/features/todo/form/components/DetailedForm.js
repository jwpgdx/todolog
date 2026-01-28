import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput } from 'react-native';
import { LayoutAnimation } from 'react-native';
import { BottomSheetInput } from '../../../../components/ui/bottom-sheet';
import BaseInput from '../../../../components/ui/BaseInput';
import ListRow from '../../../../components/ui/ListRow';
import Dropdown from '../../../../components/ui/Dropdown';
import Switch from '../../../../components/ui/Switch';
import DateTimeSection from './DateTimeSection';
import RecurrenceOptions from './RecurrenceOptions';
import CategoryForm from '../../../../components/domain/category/CategoryForm';
import CategoryColorList from '../../../../components/domain/category/CategoryColorList';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../../store/authStore';
import { useSettings, useUpdateSetting } from '../../../../hooks/queries/useSettings';

/**
 * DetailedForm Component
 * Detail Mode에서 보여질 상세 폼 컨텐츠
 * 
 * TECH_SPEC 기준 구성:
 * 2번줄: 제목 입력 (Input)
 * 3번줄: 카테고리 (ListRow + Dropdown)
 * 4번줄: 하루종일 (ListRow + Switch)
 * 5번줄: 시작 날짜/시간 (DateTimeSection mode="datetime")
 * 6번줄: 종료 날짜/시간 (DateTimeSection mode="datetime") - 반복 설정 시 숨김
 * 7번줄: 시작/종료 시간 (DateTimeSection mode="time-range") - 반복 설정 시만 표시
 * 8번줄: 반복 설정 (RecurrenceOptions)
 * 9번줄: 메모 (Input multiline)
 * 
 * @param {object} formState - 폼 상태
 * @param {Function} handleChange - 상태 변경 핸들러
 * @param {array} categories - 카테고리 목록
 * @param {string} viewMode - 현재 뷰 모드 ('default' | 'category_create')
 * @param {Function} setViewMode - 뷰 모드 변경 함수
 * @param {string} newCategoryName - 새 카테고리 이름
 * @param {Function} setNewCategoryName - 새 카테고리 이름 변경 함수
 * @param {string} newCategoryColor - 새 카테고리 색상
 * @param {Function} setNewCategoryColor - 새 카테고리 색상 변경 함수
 */
export default function DetailedForm({
    formState,
    handleChange,
    categories = [],
    viewMode = 'default',
    setViewMode,
    onCreateCategory,
    newCategoryName = '',
    setNewCategoryName,
    newCategoryColor,
    setNewCategoryColor,
    initialFocusTarget = null,  // 'CATEGORY' | 'REPEAT' 등
}) {
    // 아코디언 Picker 상태 관리
    const [activeInput, setActiveInput] = useState(null);


    // ⚡️ 입력 핸들러 최적화 (Uncontrolled Pattern)
    // value prop을 제거하고 defaultValue만 사용하여 네이티브 입력기의 조합 상태를 유지합니다.

    // 디바운스 타이머 Refs
    const titleTimerRef = useRef(null);
    const memoTimerRef = useRef(null);

    // Title 핸들러 (Debounce only)
    const handleChangeTitle = useCallback((text) => {
        if (titleTimerRef.current) clearTimeout(titleTimerRef.current);
        titleTimerRef.current = setTimeout(() => {
            handleChange('title', text);
        }, 300); // 300ms 디바운스
    }, [handleChange]);

    // Memo 핸들러 (Debounce only)
    const handleChangeMemo = useCallback((text) => {
        if (memoTimerRef.current) clearTimeout(memoTimerRef.current);
        memoTimerRef.current = setTimeout(() => {
            handleChange('memo', text);
        }, 300);
    }, [handleChange]);

    const selectedCategory = categories.find(c => c._id === formState.categoryId);
    const hasRecurrence = formState.frequency && formState.frequency !== 'none';

    // 반복 라벨
    const frequencyLabels = {
        'none': '안 함',
        'daily': '매일',
        'weekly': '매주',
        'monthly': '매월',
        'yearly': '매년',
    };

    // 캘린더 동기화 토글 컴포넌트
    const CalendarSyncToggle = () => {
        const { user } = useAuthStore();
        const { data: settings = {} } = useSettings();
        const { mutate: updateSetting } = useUpdateSetting();
        const hasCalendarAccess = user?.hasCalendarAccess;
        const calendarSyncEnabled = settings.calendarSyncEnabled ?? false;

        if (!hasCalendarAccess) return null;

        return (
            <ListRow
                title="캘린더 동기화"
                right={
                    <Switch
                        value={calendarSyncEnabled}
                        onValueChange={(value) => updateSetting({ key: 'calendarSyncEnabled', value })}
                    />
                }
            />
        );
    };

    // 카테고리 색상 선택 모드
    if (viewMode === 'category_color') {
        return (
            <CategoryColorList
                selectedColor={newCategoryColor}
                onSelectColor={(color) => {
                    setNewCategoryColor?.(color);
                    setViewMode?.('category_create');
                }}
            />
        );
    }

    // 카테고리 생성 모드
    if (viewMode === 'category_create') {
        return (
            <ScrollView
                className="flex-1 bg-white px-4 pt-4"
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <CategoryForm
                    name={newCategoryName}
                    onNameChange={setNewCategoryName}
                    selectedColor={newCategoryColor}
                    onColorSelectPress={() => setViewMode?.('category_color')}
                    autoFocus={true}
                />
            </ScrollView>
        );
    }

    return (
        <ScrollView
            className="flex-1 bg-white"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
        >
            {/* 2번줄: 제목 입력 */}
            <View className="px-4 pt-4">
                <BaseInput
                    TextInputComponent={TextInput}
                    defaultValue={formState.title}
                    onChangeText={handleChangeTitle}
                    placeholder="제목"
                />
            </View>

            {/* 3번줄: 카테고리 */}
            <ListRow
                title="카테고리"
                zIndex={100}
                overflowVisible={true}
                right={
                    <Dropdown
                        defaultOpen={initialFocusTarget === 'CATEGORY'}
                        trigger={(isOpen) => (
                            <View className="flex-row items-center">
                                <View
                                    className="w-3 h-3 rounded-full mr-2"
                                    style={{ backgroundColor: selectedCategory?.color || '#9CA3AF' }}
                                />
                                <Text className="text-base text-gray-500">
                                    {selectedCategory?.name || '선택'}
                                </Text>
                                <Ionicons
                                    name={isOpen ? "chevron-up" : "chevron-down"}
                                    size={16}
                                    color="#9CA3AF"
                                    style={{ marginLeft: 4 }}
                                />
                            </View>
                        )}
                        align="right"
                        direction="down"
                    >
                        {(close) => (
                            <>
                                {categories.map((category) => (
                                    <Dropdown.Item
                                        key={category._id}
                                        label={category.name}
                                        isSelected={formState.categoryId === category._id}
                                        onPress={() => {
                                            handleChange('categoryId', category._id);
                                            close();
                                        }}
                                    />
                                ))}
                                <Dropdown.Separator />
                                <Dropdown.Item
                                    label="카테고리 추가"
                                    icon="add-circle-outline"
                                    onPress={() => {
                                        close();
                                        setViewMode?.('category_create');
                                    }}
                                />
                            </>
                        )}
                    </Dropdown>
                }
            />

            {/* 4번줄: 하루종일 */}
            <ListRow
                title="하루종일"
                right={
                    <Switch
                        value={formState.isAllDay}
                        onValueChange={(value) => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            handleChange('isAllDay', value);
                        }}
                    />
                }
            />

            {/* 5번줄: 시작 날짜/시간 */}
            <DateTimeSection
                mode="datetime"
                label="시작"
                date={formState.startDate}
                onDateChange={(date) => handleChange('startDate', date)}
                time={formState.startTime}
                onTimeChange={(time) => handleChange('startTime', time)}
                dateKey="startDate"
                timeKey="startTime"
                activeInput={activeInput}
                setActiveInput={setActiveInput}
                showTimeInput={!formState.isAllDay && !hasRecurrence}
            />

            {/* 6번줄: 종료 날짜/시간 (반복 설정 시 숨김) */}
            {!hasRecurrence && (
                <DateTimeSection
                    mode="datetime"
                    label="종료"
                    date={formState.endDate}
                    onDateChange={(date) => handleChange('endDate', date)}
                    time={formState.endTime}
                    onTimeChange={(time) => handleChange('endTime', time)}
                    dateKey="endDate"
                    timeKey="endTime"
                    activeInput={activeInput}
                    setActiveInput={setActiveInput}
                    showTimeInput={!formState.isAllDay}
                />
            )}

            {/* 7번줄: 시작/종료 시간 (반복 + 시간 지정일 때만) */}
            {hasRecurrence && !formState.isAllDay && (
                <DateTimeSection
                    mode="time-range"
                    label="시간"
                    startTime={formState.startTime}
                    endTime={formState.endTime}
                    onStartTimeChange={(time) => handleChange('startTime', time)}
                    onEndTimeChange={(time) => handleChange('endTime', time)}
                    startTimeKey="recurrenceStartTime"
                    endTimeKey="recurrenceEndTime"
                    activeInput={activeInput}
                    setActiveInput={setActiveInput}
                />
            )}

            {/* 8번줄: 반복 설정 */}
            <RecurrenceOptions
                frequency={formState.frequency}
                onFrequencyChange={(freq) => handleChange('frequency', freq)}
                weekdays={formState.weekdays}
                onWeekdaysChange={(days) => handleChange('weekdays', days)}
                dayOfMonth={formState.dayOfMonth}
                onDayOfMonthChange={(day) => handleChange('dayOfMonth', day)}
                yearlyDate={formState.yearlyDate}
                onYearlyDateChange={(date) => handleChange('yearlyDate', date)}
                endDate={formState.recurrenceEndDate}
                onEndDateChange={(date) => handleChange('recurrenceEndDate', date)}
                activeInput={activeInput}
                setActiveInput={setActiveInput}
                initialFocusTarget={initialFocusTarget}
            />

            {/* 9번줄: 캘린더 동기화 (연동된 경우만 표시) */}
            <CalendarSyncToggle />

            {/* 9번줄: 메모 */}
            <View className="px-4 py-3">
                <BaseInput
                    TextInputComponent={TextInput}
                    defaultValue={formState.memo}
                    onChangeText={handleChangeMemo}
                    placeholder="메모"
                    multiline
                    numberOfLines={5}
                />
            </View>

            {/* 하단 여백 (키보드 대응) */}
            <View className="h-32" />
        </ScrollView>
    );
}