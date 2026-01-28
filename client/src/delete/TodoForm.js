import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, LayoutAnimation, ScrollView, Animated, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Dropdown from '../../ui/Dropdown';
import CategoryForm from '../category/CategoryForm';
import { DEFAULT_COLOR } from '../../../constants/categoryColors';
import CategoryColorList from '../category/CategoryColorList';
import Toast from 'react-native-toast-message';
import { useNavigation } from '@react-navigation/native';
import { useDateStore } from '../../../store/dateStore';
import { useAuthStore } from '../../../store/authStore';
import Input from '../../ui/Input';
import BottomSheet from '../../ui/bottom-sheet';
import ThemeSwitch from '../../ui/Switch'; // Import custom Switch
import { useUpdateTodo } from '../../../hooks/queries/useUpdateTodo';
import { useCreateTodo } from '../../../hooks/queries/useCreateTodo';
import { useCategories, useCreateCategory } from '../../../hooks/queries/useCategories';
import { Ionicons } from '@expo/vector-icons';
import { convertToApiFormat } from '../../../utils/recurrenceUtils';
import DateTimeSection from './DateTimeSection';
import RecurrenceOptions from './RecurrenceOptions';

export default function TodoForm({ visible, onClose, initialTodo }) {
  const navigation = useNavigation();
  const { currentDate } = useDateStore();
  const { user } = useAuthStore();
  const { data: categories } = useCategories();

  // 기본 상태, initialTodo가 있으면 초기값 설정
  const [title, setTitle] = useState(initialTodo?.title || '');
  const [memo, setMemo] = useState(initialTodo?.memo || '');
  const [categoryId, setCategoryId] = useState(initialTodo?.categoryId || '');

  // View Mode: 'form' | 'category_create'
  const [viewMode, setViewMode] = useState('form');

  // Category Form State
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_COLOR); // Default Peacock
  const createCategory = useCreateCategory();

  // 날짜/시간 상태
  const [startDate, setStartDate] = useState(initialTodo?.startDate || currentDate);
  const [startTime, setStartTime] = useState(initialTodo?.startTime || '');
  const [endDate, setEndDate] = useState(initialTodo?.endDate || null);
  const [endTime, setEndTime] = useState(initialTodo?.endTime || '');
  const [isAllDay, setIsAllDay] = useState(initialTodo?.isAllDay || false); // Add isAllDay state
  const [activeInput, setActiveInput] = useState(null);

  // 반복 설정 상태
  const [isRecurring, setIsRecurring] = useState(initialTodo?.isRecurring || false);
  const [frequency, setFrequency] = useState(initialTodo?.frequency || 'weekly');
  const [weekdays, setWeekdays] = useState(initialTodo?.weekdays || []);
  const [dayOfMonth, setDayOfMonth] = useState(initialTodo?.dayOfMonth || 1);
  const [month, setMonth] = useState(initialTodo?.month || 1);
  const [day, setDay] = useState(initialTodo?.day || 1);

  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();

  // initialTodo가 변경되면 상태 업데이트 (다시 열 때 등)
  useEffect(() => {
    if (visible) {
      if (initialTodo) {
        setTitle(initialTodo.title || '');
        setMemo(initialTodo.memo || '');
        setCategoryId(initialTodo.categoryId || '');
        setStartDate(initialTodo.startDate || currentDate);
        setStartTime(initialTodo.startTime || '');
        setEndDate(initialTodo.endDate || null);
        setEndTime(initialTodo.endTime || '');
        setIsAllDay(initialTodo.isAllDay || false); // Update isAllDay
        setIsRecurring(initialTodo.isRecurring || false);
        setFrequency(initialTodo.frequency || 'weekly');
        setWeekdays(initialTodo.weekdays || []);
        setDayOfMonth(initialTodo.dayOfMonth || initialTodo.startDate?.getDate() || 1);
        setMonth(initialTodo.month || 1);
        setDay(initialTodo.day || 1);
      } else {
        // Add Mode - Reset if no initialTodo passed upon open (or handled by parent)
        // But usually parent handles unmounting or passing null logic
        // Here we rely on `resetForm` being called on close, or manual reset if needed.
        // If we reuse the same component instance, need to reset if visible becomes true and initialTodo is null
      }
    }
  }, [visible, initialTodo, currentDate]);

  // 기본 카테고리 자동 설정 (New mode only or if categoryId empty)
  useEffect(() => {
    const loadDefaultCategory = async () => {
      if (categories?.length > 0 && !categoryId) {
        try {
          const lastUsed = await AsyncStorage.getItem('lastUsedCategoryId');
          if (lastUsed && categories.find(c => c._id === lastUsed)) {
            setCategoryId(lastUsed);
          } else {
            const defaultCat = categories.find(c => c.isDefault) || categories[0];
            setCategoryId(defaultCat._id);
          }
        } catch (error) {
          console.error('Failed to load last used category:', error);
          const defaultCat = categories.find(c => c.isDefault) || categories[0];
          setCategoryId(defaultCat._id);
        }
      }
    };

    if (visible && !initialTodo) { // Only load default if creating new
      loadDefaultCategory();
    }
  }, [categories, visible, categoryId, initialTodo]);

  // 마지막 사용 타입 로드 (New mode only)
  useEffect(() => {
    if (visible && !initialTodo) {
      AsyncStorage.getItem('lastUsedTodoType').then(type => {
        if (type === 'routine') {
          setIsRecurring(true);
        }
      }).catch(err => console.error(err));
    }
  }, [visible, initialTodo]);

  const resetForm = () => {
    if (!initialTodo) {
      setTitle('');
      setMemo('');
      setCategoryId('');
      setStartDate(currentDate);
      setStartTime('');
      setEndDate(null);
      setEndTime('');
      setIsAllDay(false); // Reset isAllDay
      setIsRecurring(false);
      setFrequency('weekly');
      setWeekdays([]);
      setDayOfMonth(1);
      setMonth(1);
      setDay(1);
    }

    setNewCategoryName('');
    setNewCategoryColor(DEFAULT_COLOR);
    setViewMode('form');
  };

  const handleCategoryCreate = () => {
    if (!newCategoryName.trim()) return;

    createCategory.mutate(
      { name: newCategoryName.trim(), color: newCategoryColor },
      {
        onSuccess: (newCategory) => {
          Toast.show({ type: 'success', text1: '카테고리가 생성되었습니다.' });
          setCategoryId(newCategory._id);
          setViewMode('form');
          setNewCategoryName('');
          setNewCategoryColor(DEFAULT_COLOR);
        },
        onError: (error) => {
          Toast.show({
            type: 'error',
            text1: '생성 실패',
            text2: error.response?.data?.message || '다시 시도해주세요',
          });
        }
      }
    );
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleEndTimeChange = (time) => {
    if (time && !endDate && startDate) {
      setEndDate(startDate);
    }
    setEndTime(time);
  };

  const handleEndDateChange = (date) => {
    if (date && startDate && date < startDate) {
      Toast.show({
        type: 'error',
        text1: '날짜 오류',
        text2: '종료 날짜는 시작 날짜보다 이후여야 합니다',
      });
      return;
    }
    setEndDate(date);
  };

  const handleSave = () => {
    if (!title.trim()) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '제목을 입력해주세요',
      });
      return;
    }

    if (!startDate) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '시작 날짜를 선택해주세요',
      });
      return;
    }

    if (!categoryId) {
      Toast.show({
        type: 'error',
        text1: '입력 오류',
        text2: '카테고리를 선택해주세요',
      });
      return;
    }

    // 반복 설정 검증
    if (isRecurring) {
      if (frequency === 'weekly' && weekdays.length === 0) {
        Toast.show({
          type: 'error',
          text1: '입력 오류',
          text2: '반복할 요일을 선택해주세요',
        });
        return;
      }
    }

    const formData = {
      title: title.trim(),
      memo: memo.trim() || undefined,
      categoryId,
      startDate,
      startTime: isAllDay ? undefined : (startTime || undefined), // Clear time if isAllDay
      endDate: endDate || undefined,
      endTime: isAllDay ? undefined : (endTime || undefined), // Clear time if isAllDay
      isAllDay, // Include isAllDay
      isRecurring,
      frequency: isRecurring ? frequency : undefined,
      weekdays: isRecurring && frequency === 'weekly' ? weekdays : undefined,
      dayOfMonth: isRecurring && frequency === 'monthly' ? dayOfMonth : undefined,
      month: isRecurring && frequency === 'yearly' ? month : undefined,
      day: isRecurring && frequency === 'yearly' ? day : undefined,
      recurrenceEndDate: isRecurring ? endDate : undefined,
    };

    // RRULE 기반 API 형식으로 변환
    const apiData = convertToApiFormat(formData);

    if (initialTodo) {
      // Update Logic
      updateTodo.mutate({ id: initialTodo._id, ...apiData }, {
        onSuccess: () => {
          Toast.show({
            type: 'success',
            text1: '이벤트 수정 완료',
          });
          handleClose();
        },
        onError: (error) => {
          Toast.show({
            type: 'error',
            text1: '이벤트 수정 실패',
            text2: error.response?.data?.message || '다시 시도해주세요',
          });
        },
      });
    } else {
      // Create Logic
      createTodo.mutate(apiData, {
        onSuccess: () => {
          Toast.show({
            type: 'success',
            text1: '이벤트 추가 완료',
          });
          handleClose();
        },
        onError: (error) => {
          Toast.show({
            type: 'error',
            text1: '이벤트 추가 실패',
            text2: error.response?.data?.message || '다시 시도해주세요',
          });
        },
      });
    }
  };

  const debugData = {
    title,
    memo,
    startDate,
    startTime,
    endDate,
    endTime,
    isRecurring,
    frequency,
    weekdays,
    dayOfMonth,
    month,
    day,
    isAllDay,
  };

  return (
    <BottomSheet
      isOpen={visible}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
      contentContainerStyle={{ padding: 0 }}
    >
      <TodoFormHeader
        viewMode={viewMode}
        setViewMode={setViewMode}
        initialTodo={initialTodo}
        isPending={createTodo.isPending || updateTodo.isPending}
        onSave={handleSave}
        onCategoryCreate={handleCategoryCreate}
        canCreateCategory={!!newCategoryName.trim()}
      />

      <View
        className="flex-1 px-4 py-4"
        contentContainerStyle={{ paddingBottom: 20 }}
        showsVerticalScrollIndicator={false}
      >
        {viewMode === 'form' && (
          <>
            {/* Debug Info */}
            <View className="bg-gray-100 p-2 mb-4 rounded border border-gray-300 hidden">
              <Text className="text-xs font-mono text-gray-800">
                {JSON.stringify(debugData, null, 2)}
              </Text>
            </View>

            {/* 제목 입력 */}
            <Input
              value={title}
              onChangeText={setTitle}
              placeholder="이벤트 제목을 입력하세요"
              className="mb-4"
            />

            {/* 카테고리 선택 */}
            <View className="mb-4 z-[1000]">
              <Dropdown
                trigger={(isOpen) => (
                  <View className="flex-row items-center bg-muted rounded-lg px-4 py-3 gap-2">
                    <Ionicons
                      name="file-tray-outline"
                      size={18}
                      color={categories?.find(c => c._id === categoryId)?.color || '#666'}
                    />
                    <Text className="text-base text-text flex-1">
                      {categories?.find(c => c._id === categoryId)?.name || '카테고리 선택'}
                    </Text>
                    <Chevron isOpen={isOpen} />
                  </View>
                )}
              >
                {(close) => (
                  <>
                    {categories?.map((category) => (
                      <Dropdown.Item
                        key={category._id}
                        onPress={() => {
                          setCategoryId(category._id);
                          close();
                        }}
                        isSelected={categoryId === category._id}
                        label={category.name}
                        icon="file-tray-outline"
                        iconColor={category.color}
                      />
                    ))}
                    <Dropdown.Separator />
                    <Dropdown.Item
                      onPress={() => {
                        close();
                        setViewMode('category_create');
                      }}
                      label="새 카테고리 추가"
                      icon="add"
                    />
                  </>
                )}
              </Dropdown>
            </View>

            {/* 날짜 및 시간 설정 */}
            <View className="mb-4">
              <View className="flex-row items-center justify-between mb-2">
                <Text className="text-gray-700 font-medium dark:text-gray-300">날짜 및 시간</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-sm text-gray-500">하루종일</Text>
                  <ThemeSwitch
                    value={isAllDay}
                    onValueChange={(val) => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setIsAllDay(val);
                    }}
                  />
                </View>
              </View>

              <DateTimeSection
                label="시작"
                date={startDate}
                onDateChange={setStartDate}
                time={startTime}
                onTimeChange={setStartTime}
                dateKey="startDate"
                timeKey="startTime"
                activeInput={activeInput}
                setActiveInput={setActiveInput}
                showTimeInput={!isAllDay}
              />

              <DateTimeSection
                label={isRecurring ? "반복 종료" : "종료"}
                date={endDate}
                onDateChange={handleEndDateChange}
                time={endTime}
                onTimeChange={handleEndTimeChange}
                dateKey="endDate"
                timeKey="endTime"
                activeInput={activeInput}
                setActiveInput={setActiveInput}
                showTimeInput={!isRecurring && !isAllDay} // Hide if recurring OR all day
              />
            </View>

            {/* 반복 설정 (Dropdown) */}
            <View className="mb-4 z-[900]">
              <Text className="text-gray-700 font-medium mb-2 dark:text-gray-300">반복 설정</Text>
              <Dropdown
                trigger={(isOpen) => (
                  <View className="flex-row items-center bg-muted rounded-lg px-4 py-3 gap-2">
                    <Ionicons
                      name={isRecurring ? "repeat" : "remove-circle-outline"}
                      size={18}
                      color="#666"
                    />
                    <Text className="text-base text-text flex-1">
                      {!isRecurring ? '없음' :
                        frequency === 'daily' ? '매일' :
                          frequency === 'weekly' ? '매주' :
                            frequency === 'monthly' ? '매월' :
                              frequency === 'yearly' ? '매년' : '반복 설정'}
                    </Text>
                    <Chevron isOpen={isOpen} />
                  </View>
                )}
              >
                {(close) => (
                  <>
                    {[
                      { id: 'none', label: '없음', icon: 'remove-circle-outline' },
                      { id: 'daily', label: '매일', icon: 'repeat' },
                      { id: 'weekly', label: '매주', icon: 'calendar-outline' },
                      { id: 'monthly', label: '매월', icon: 'calendar' },
                      { id: 'yearly', label: '매년', icon: 'earth' },
                    ].map((option) => (
                      <Dropdown.Item
                        key={option.id}
                        onPress={() => {
                          if (option.id === 'none') {
                            setIsRecurring(false);
                          } else {
                            setIsRecurring(true);
                            setFrequency(option.id);
                          }
                          close();
                        }}
                        isSelected={(!isRecurring && option.id === 'none') || (isRecurring && frequency === option.id)}
                        label={option.label}
                        icon={option.icon}
                      />
                    ))}
                  </>
                )}
              </Dropdown>
            </View>

            {isRecurring && (
              <RecurrenceOptions
                frequency={frequency}
                weekdays={weekdays}
                setWeekdays={setWeekdays}
                dayOfMonth={dayOfMonth}
                setDayOfMonth={setDayOfMonth}
                month={month}
                setMonth={setMonth}
                day={day}
                setDay={setDay}
              />
            )}

            {/* 메모 */}
            <Input
              label="메모"
              value={memo}
              onChangeText={setMemo}
              placeholder="메모를 입력하세요"
              multiline
              numberOfLines={3}
            />
          </>
        )}

        {viewMode === 'color_selection' && (
          <CategoryColorList
            selectedColor={newCategoryColor}
            onSelectColor={(color) => {
              setNewCategoryColor(color);
              setViewMode('category_create');
            }}
          />
        )}

        {viewMode === 'category_create' && (
          <CategoryForm
            name={newCategoryName}
            onNameChange={setNewCategoryName}
            selectedColor={newCategoryColor}
            onColorSelectPress={() => setViewMode('color_selection')}
            autoFocus={true}
          />
        )}
      </View>
    </BottomSheet>
  );
}

function TodoFormHeader({
  viewMode,
  setViewMode,
  initialTodo,
  isPending,
  onSave,
  onCategoryCreate,
  canCreateCategory,
}) {
  return (
    <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-100 min-h-[56px]">
      <View className="flex-1 items-start">
        {viewMode === 'category_create' && (
          <TouchableOpacity onPress={() => setViewMode('form')}>
            <Text className="text-base text-blue-500">뒤로</Text>
          </TouchableOpacity>
        )}
        {viewMode === 'color_selection' && (
          <TouchableOpacity onPress={() => setViewMode('category_create')}>
            <Text className="text-base text-blue-500">뒤로</Text>
          </TouchableOpacity>
        )}
      </View>
      <View className="flex-2 items-center">
        <Text className="text-base font-bold text-center">
          {viewMode === 'form'
            ? (initialTodo ? "이벤트 수정" : "이벤트 추가")
            : viewMode === 'color_selection' ? "색상 선택" : "카테고리 추가"}
        </Text>
      </View>
      <View className="flex-1 items-end">
        {viewMode === 'form' ? (
          <TouchableOpacity onPress={onSave} disabled={isPending}>
            <Text className={`text-base ${isPending ? 'text-mute' : 'text-primary'}`}>
              {isPending
                ? '저장 중...'
                : (initialTodo ? '수정' : '저장')}
            </Text>
          </TouchableOpacity>
        ) : viewMode === 'category_create' ? (
          <TouchableOpacity onPress={onCategoryCreate} disabled={!canCreateCategory || isPending}>
            <Text className={`text-base ${!canCreateCategory || isPending ? 'text-gray-400' : 'text-blue-500'}`}>
              {isPending ? '생성 중...' : '완료'}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

function Chevron({ isOpen }) {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(rotateAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web', // 웹에서는 네이티브 드라이버 미지원
    }).start();
  }, [isOpen]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="chevron-down" size={18} color="#666" />
    </Animated.View>
  );
}