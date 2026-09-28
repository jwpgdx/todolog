import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useDateStore } from '../../../store/dateStore';
import { useAuthStore } from '../../../store/authStore';
import { useSettings, useUpdateSetting } from '../../../hooks/queries/useSettings';
import { useCreateTodo } from '../../../hooks/queries/useCreateTodo';
import { useUpdateTodo } from '../../../hooks/queries/useUpdateTodo';
import { useCategories } from '../../../hooks/queries/useCategories';
import { useCreateCategory } from '../../../hooks/queries/useCreateCategory';
import Toast from 'react-native-toast-message';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_COLOR } from '../../../constants/categoryColors';
import dayjs from 'dayjs';
import {
    addDaysToYmd,
    getCurrentDateInTimeZone,
    getCurrentTimeInTimeZone,
} from '../../../utils/timeZoneDate';

/**
 * useTodoFormLogic
 * Todo 생성/수정 폼의 비즈니스 로직 훅
 * 
 * TECH_SPEC 및 DB 스키마 기준:
 * - isAllDay 기본값: true
 * - frequency 기본값: 'none'
 * - 시간 자동 조정 (시작시간 변경 시 종료시간 +1시간)
 * - buildPayload()로 isAllDay에 따른 데이터 분기
 */

// ✅ RRULE 파싱 헬퍼 함수들
const parseFrequencyFromRRule = (recurrence) => {
    if (!recurrence || recurrence.length === 0) return 'none';
    const rrule = Array.isArray(recurrence) ? recurrence[0] : recurrence;
    if (rrule.includes('FREQ=DAILY')) return 'daily';
    if (rrule.includes('FREQ=WEEKLY')) return 'weekly';
    if (rrule.includes('FREQ=MONTHLY')) return 'monthly';
    if (rrule.includes('FREQ=YEARLY')) return 'yearly';
    return 'none';
};

const parseWeekdaysFromRRule = (recurrence) => {
    if (!recurrence || recurrence.length === 0) return [];
    const rrule = Array.isArray(recurrence) ? recurrence[0] : recurrence;
    const match = rrule.match(/BYDAY=([^;]+)/);
    if (!match) return [];
    
    const dayMap = { 'SU': 0, 'MO': 1, 'TU': 2, 'WE': 3, 'TH': 4, 'FR': 5, 'SA': 6 };
    const days = match[1].split(',');
    return days.map(d => dayMap[d]).filter(d => d !== undefined);
};

const parseDayOfMonthFromRRule = (recurrence) => {
    if (!recurrence || recurrence.length === 0) return [1];
    const rrule = Array.isArray(recurrence) ? recurrence[0] : recurrence;
    const match = rrule.match(/BYMONTHDAY=([^;]+)/);
    if (!match) return [1];
    
    return match[1].split(',').map(d => parseInt(d));
};

const parseYearlyDateFromRRule = (recurrence) => {
    if (!recurrence || recurrence.length === 0) return null;
    const rrule = Array.isArray(recurrence) ? recurrence[0] : recurrence;
    const monthMatch = rrule.match(/BYMONTH=(\d+)/);
    const dayMatch = rrule.match(/BYMONTHDAY=(\d+)/);
    
    if (monthMatch && dayMatch) {
        const month = String(monthMatch[1]).padStart(2, '0');
        const day = String(dayMatch[1]).padStart(2, '0');
        return `${month}-${day}`;
    }
    return null;
};

const getPrimaryRecurrenceRule = (recurrence) => {
    if (Array.isArray(recurrence)) {
        return recurrence.find(item => typeof item === 'string' && item.trim()) || null;
    }
    return typeof recurrence === 'string' && recurrence.trim() ? recurrence : null;
};

const parseUntilDateFromRRule = (recurrence) => {
    const rrule = getPrimaryRecurrenceRule(recurrence);
    if (!rrule) return null;

    const match = rrule.match(/(?:^|;)UNTIL=(\d{4})(\d{2})(\d{2})(?:T\d{6}Z?)?(?:;|$)/i);
    if (!match) return null;

    const candidate = `${match[1]}-${match[2]}-${match[3]}`;
    return dayjs(candidate).format('YYYY-MM-DD') === candidate ? candidate : null;
};

const RECURRENCE_FORM_KEYS = new Set([
    'frequency',
    'weekdays',
    'dayOfMonth',
    'yearlyDate',
    'recurrenceEndDate',
]);

export const useTodoFormLogic = (initialTodo, onClose, visible, initialDraft = null) => {
    const { currentDate } = useDateStore();
    const { user } = useAuthStore();
    const { data: settings = {} } = useSettings();
    const { mutate: updateSetting } = useUpdateSetting();
    const { data: categories } = useCategories();
    const hasInitializedRef = useRef(false);
    const recurrenceDirtyRef = useRef(false);

    // 사용자 타임존
    const userTimeZone = settings.timeZone || 'Asia/Seoul';

    // 현재 시간 기준 기본값 계산
    const getDefaultTimes = useCallback(() => {
        const [hour] = getCurrentTimeInTimeZone(userTimeZone).split(':');
        const startHour = hour;
        const startTime = `${startHour}:00`;
        const endTime = `${String((parseInt(startHour, 10) + 1) % 24).padStart(2, '0')}:00`;
        return { startTime, endTime };
    }, [userTimeZone]);

    // 전체 폼 상태
    const [formState, setFormState] = useState(() => {
        const { startTime, endTime } = getDefaultTimes();
        const isAllDay = settings.defaultIsAllDay ?? true;
        return {
            title: '',
            memo: '',
            categoryId: '',

            // 날짜/시간 (TECH_SPEC 기준)
            isAllDay,
            startDate: currentDate,   // "YYYY-MM-DD"
            endDate: !isAllDay && endTime <= startTime ? addDaysToYmd(currentDate, 1) : currentDate,
            startTime,                // "HH:MM"
            endTime,                  // "HH:MM"
            timeZone: userTimeZone,   // 사용자 설정에서 가져옴

            // 반복 설정
            frequency: 'none',        // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly'
            weekdays: [],             // [0,1,2...6] (0=일요일)
            dayOfMonth: [1],          // [1, 15, 28] - 월간 반복 날짜 배열
            yearlyDate: null,         // "MM-DD"
            recurrenceEndDate: null,  // "YYYY-MM-DD" 또는 null (무한 반복)
        };
    });
    const formStateRef = useRef(formState);

    // Keep the latest draft synchronously addressable. React state still drives
    // rendering, but submit/buildPayload must not depend on a rerender having
    // happened between the final native text event and a save tap.
    const commitFormState = useCallback((nextOrUpdater) => {
        const nextState = typeof nextOrUpdater === 'function'
            ? nextOrUpdater(formStateRef.current)
            : nextOrUpdater;
        formStateRef.current = nextState;
        setFormState(nextState);
        return nextState;
    }, []);

    // 뷰 모드
    const [viewMode, setViewMode] = useState('default'); // 'default' | 'category_create'

    // 카테고리 생성용 임시 상태
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState(DEFAULT_COLOR);

    const createTodo = useCreateTodo();
    const updateTodo = useUpdateTodo();
    const createCategory = useCreateCategory();

    const applyInitialDraft = useCallback((draft) => {
        if (!draft) return;

        commitFormState(prev => ({
            ...prev,
            ...draft,
        }));
        setViewMode('default');
    }, [commitFormState]);

    // 초기화 로직
    useEffect(() => {
        if (!visible) {
            hasInitializedRef.current = false;
            recurrenceDirtyRef.current = false;
            return;
        }

        if (hasInitializedRef.current) {
            return;
        }

        hasInitializedRef.current = true;

        // A quick-to-detail handoff is newer than the original persisted todo.
        if (initialDraft) {
            recurrenceDirtyRef.current = false;
            applyInitialDraft(initialDraft);
            return;
        }

        if (initialTodo) {
            recurrenceDirtyRef.current = false;
            const embeddedRecurrenceEndDate = parseUntilDateFromRRule(initialTodo.recurrence);
            // 수정 모드: 기존 데이터 로드
            commitFormState(prev => ({
                ...prev,
                title: initialTodo.title || '',
                memo: initialTodo.memo || '',
                categoryId: initialTodo.categoryId || '',
                isAllDay: initialTodo.isAllDay ?? true,
                // Preserve legacy/null schedule data exactly instead of silently
                // assigning today's date during an unrelated edit. Server
                // writes still require startDate, so submit validates it below.
                startDate: initialTodo.startDate ?? null,
                endDate: initialTodo.endDate ?? null,
                timeZone: userTimeZone,
                // Canonical floating times are not Date/UTC values. Preserve
                // explicit null, including a timed todo with no end time.
                startTime: initialTodo.startTime ?? null,
                endTime: initialTodo.endTime ?? null,
                // ✅ 반복 설정 로드
                frequency: initialTodo.recurrence ? parseFrequencyFromRRule(initialTodo.recurrence) : 'none',
                weekdays: initialTodo.recurrence ? parseWeekdaysFromRRule(initialTodo.recurrence) : [],
                dayOfMonth: initialTodo.recurrence ? parseDayOfMonthFromRRule(initialTodo.recurrence) : [1],
                yearlyDate: initialTodo.recurrence ? parseYearlyDateFromRRule(initialTodo.recurrence) : null,
                recurrenceEndDate: initialTodo.recurrenceEndDate
                    ? dayjs(initialTodo.recurrenceEndDate).format('YYYY-MM-DD')
                    : embeddedRecurrenceEndDate,
            }));
            return;
        }

        // 생성 모드: 폼 초기화
        resetForm();
        loadDefaultCategory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible, initialTodo, initialDraft, currentDate, userTimeZone, applyInitialDraft]);

    // 기본 카테고리 로드
    const loadDefaultCategory = async () => {
        if (categories?.length > 0) {
            try {
                const lastUsed = await AsyncStorage.getItem('lastUsedCategoryId');
                if (lastUsed && categories.find(c => c._id === lastUsed)) {
                    handleChange('categoryId', lastUsed);
                } else {
                    const firstCategory = categories[0];
                    if (firstCategory) {
                        handleChange('categoryId', firstCategory._id);
                    }
                }
            } catch (e) {
                console.error('Failed to load default category:', e);
            }
        }
    };

    // 폼 리셋
    const resetForm = useCallback(() => {
        const { startTime, endTime } = getDefaultTimes();
        const defaultIsAllDay = user?.settings?.defaultIsAllDay ?? true;
        console.log('🔄 [resetForm] 폼 초기화 - defaultIsAllDay:', defaultIsAllDay);

        recurrenceDirtyRef.current = false;
        commitFormState({
            title: '',
            memo: '',
            categoryId: '',
            isAllDay: defaultIsAllDay,
            startDate: currentDate,
            endDate: !defaultIsAllDay && endTime <= startTime ? addDaysToYmd(currentDate, 1) : currentDate,
            startTime,
            endTime,
            timeZone: userTimeZone,
            frequency: 'none',
            weekdays: [],
            dayOfMonth: [1],
            yearlyDate: null,
            recurrenceEndDate: null,
        });
        setViewMode('default');
    }, [commitFormState, currentDate, getDefaultTimes, user?.settings?.defaultIsAllDay, userTimeZone]);

    // 상태 변경 핸들러 (시간 자동 조정 로직 포함)
    const handleChange = useCallback((key, value) => {
        if (RECURRENCE_FORM_KEYS.has(key)) {
            recurrenceDirtyRef.current = true;
        }

        // I/O must not run inside a React state updater (which may be replayed).
        if (key === 'isAllDay') {
            updateSetting({ key: 'defaultIsAllDay', value });
        }
        const defaultTimes = key === 'isAllDay' && !value ? getDefaultTimes() : null;
        commitFormState(prev => {
            const newState = { ...prev, [key]: value };

            // ⚡️ 시간 자동 조정 로직 (TECH_SPEC 5번줄, 6번줄)
            if (key === 'startTime' && !prev.isAllDay && typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)) {
                // 시작 시간 변경 시 → 종료 시간 +1시간
                const [h, m] = value.split(':').map(Number);
                const newEndHour = (h + 1) % 24;
                newState.endTime = `${String(newEndHour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

                // 자정 넘어가면 종료일도 +1일
                if (newEndHour < h && prev.startDate) {
                    const minimumEndDate = addDaysToYmd(prev.startDate, 1);
                    // Do not repeatedly extend an already overnight/multiday todo.
                    if (!prev.endDate || prev.endDate < minimumEndDate) {
                        newState.endDate = minimumEndDate;
                    }
                }
            }

            // 종료 시간이 시작 시간보다 이전이고 같은 날짜면 → 종료일 +1일
            if (key === 'endTime' && prev.startDate && prev.startDate === prev.endDate && !prev.isAllDay) {
                if (typeof value === 'string' && typeof prev.startTime === 'string' && value <= prev.startTime) {
                    newState.endDate = addDaysToYmd(prev.startDate, 1);
                }
            }

            if (defaultTimes) {
                newState.startTime = prev.startTime || defaultTimes.startTime;
                newState.endTime = prev.endTime || defaultTimes.endTime;
                if (prev.startDate && prev.startDate === prev.endDate && newState.endTime <= newState.startTime) {
                    newState.endDate = addDaysToYmd(prev.startDate, 1);
                }
            }

            return newState;
        });
    }, [commitFormState, updateSetting, getDefaultTimes]);

    // API 전송용 Payload 생성
    const buildPayload = useCallback(() => {
        const {
            title, memo, categoryId, isAllDay,
            startDate, endDate, startTime, endTime,
            frequency, weekdays, dayOfMonth, yearlyDate, recurrenceEndDate
        } = formStateRef.current;

        // 서버 스키마에 맞는 payload 구성
        // Persist floating date/time strings; timezone belongs to user.settings.
        const payload = {
            title: title?.trim() || '',
            memo: memo?.trim() || '',
            categoryId,
            isAllDay,
            startDate,  // "YYYY-MM-DD" - 항상 필수
            endDate: endDate ?? null,
            startTime: isAllDay ? null : (startTime || null),
            endTime: isAllDay ? null : (endTime || null),
        };

        // Existing recurrence can contain grammar the current form does not
        // expose (INTERVAL/COUNT/WKST/etc). An unrelated edit must round-trip
        // it exactly. Once a recurrence control is edited, rebuild only the
        // supported form subset intentionally.
        if (initialTodo && !recurrenceDirtyRef.current) {
            payload.recurrence = Array.isArray(initialTodo.recurrence)
                ? [...initialTodo.recurrence]
                : (initialTodo.recurrence ?? null);
            payload.recurrenceEndDate = initialTodo.recurrenceEndDate ?? null;
        } else if (frequency !== 'none') {
            const recurrenceRule = buildRecurrenceRule({
                frequency,
                weekdays,
                dayOfMonth,
                yearlyDate,
                recurrenceEndDate,
            });
            payload.recurrence = recurrenceRule ? [recurrenceRule] : null;
            payload.recurrenceEndDate = recurrenceEndDate || null;
        } else {
            payload.recurrence = null;
            payload.recurrenceEndDate = null;
        }

        return payload;
    }, [initialTodo]);

    // RRULE 문자열 생성
    const buildRecurrenceRule = ({ frequency, weekdays, dayOfMonth, yearlyDate, recurrenceEndDate }) => {
        let rule = '';

        switch (frequency) {
            case 'daily':
                rule = 'RRULE:FREQ=DAILY';
                break;
            case 'weekly':
                const dayMap = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
                const byDay = weekdays.map(d => dayMap[d]).join(',');
                rule = `RRULE:FREQ=WEEKLY${byDay ? `;BYDAY=${byDay}` : ''}`;
                break;
            case 'monthly':
                // dayOfMonth가 배열인 경우 복수 날짜 지원
                const monthDays = Array.isArray(dayOfMonth) ? dayOfMonth.join(',') : dayOfMonth;
                rule = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${monthDays}`;
                break;
            case 'yearly':
                if (yearlyDate) {
                    const [month, day] = yearlyDate.split('-');
                    rule = `RRULE:FREQ=YEARLY;BYMONTH=${parseInt(month)};BYMONTHDAY=${parseInt(day)}`;
                } else {
                    rule = 'RRULE:FREQ=YEARLY';
                }
                break;
            default:
                return null;
        }

        // 종료일 추가
        if (recurrenceEndDate) {
            const until = dayjs(recurrenceEndDate).format('YYYYMMDD') + 'T235959Z';
            rule += `;UNTIL=${until}`;
        }

        return rule;
    };

    // 제출 핸들러
    // @param {object} options - { quickMode: boolean } - Quick Mode에서 isAllDay 강제 true
    const handleSubmit = useCallback((options = {}) => {
        const { quickMode = false } = options;
        const currentFormState = formStateRef.current;

        // 유효성 검사
        if (!currentFormState.title.trim()) {
            Toast.show({ type: 'error', text1: '제목을 입력해주세요' });
            return;
        }
        if (!currentFormState.categoryId) {
            Toast.show({ type: 'error', text1: '카테고리를 선택해주세요' });
            return;
        }
        if (!currentFormState.startDate) {
            Toast.show({ type: 'error', text1: '시작 날짜를 선택해주세요' });
            return;
        }

        const payload = buildPayload();

        // ⚡️ Quick Mode에서는 항상 하루종일
        if (quickMode) {
            payload.isAllDay = true;
            payload.startTime = null;
            payload.endTime = null;
        }

        // 마지막 사용 카테고리 저장
        AsyncStorage.setItem('lastUsedCategoryId', currentFormState.categoryId).catch(() => { });

        if (initialTodo) {
            updateTodo.mutate(
                { id: initialTodo._id, data: payload },
                {
                    onSuccess: () => {
                        Toast.show({ type: 'success', text1: '수정되었습니다' });
                        onClose?.();
                    }
                }
            );
        } else {
            createTodo.mutate(
                payload,
                {
                    // onSettled: 성공/실패 관계없이 호출 (오프라인에서도 폼 닫힘)
                    onSettled: (data, error) => {
                        // data가 있으면 저장 성공 (온라인 또는 오프라인)
                        if (data) {
                            Toast.show({ type: 'success', text1: '추가되었습니다' });
                            onClose?.();
                        } else if (error) {
                            Toast.show({ type: 'error', text1: '저장에 실패했습니다' });
                        }
                    }
                }
            );
        }
    }, [buildPayload, initialTodo, onClose, createTodo, updateTodo]);

    // Quick Mode용 라벨 계산
    const quickModeLabels = useMemo(() => {
        const selectedCategory = categories?.find(c => c._id === formState.categoryId);

        const frequencyLabels = {
            'none': '안 함',
            'daily': '매일',
            'weekly': '매주',
            'monthly': '매월',
            'yearly': '매년',
        };

        // 날짜 라벨
        const today = getCurrentDateInTimeZone(userTimeZone);
        const tomorrow = addDaysToYmd(today, 1);
        let dateLabel = formState.startDate ? '오늘' : '날짜 선택';
        if (formState.startDate === tomorrow) {
            dateLabel = '내일';
        } else if (formState.startDate && formState.startDate !== today) {
            dateLabel = dayjs(formState.startDate).format('M.D');
        }

        return {
            categoryName: selectedCategory?.name || '카테고리',
            dateLabel,
            repeatLabel: frequencyLabels[formState.frequency] || '안 함',
        };
    }, [categories, formState.categoryId, formState.startDate, formState.frequency, userTimeZone]);

    return {
        formState,
        handleChange,
        handleSubmit,
        resetForm,
        buildPayload,

        // 뷰 모드
        viewMode,
        setViewMode,

        // 카테고리 생성
        newCategoryName,
        setNewCategoryName,
        newCategoryColor,
        setNewCategoryColor,

        // 기타
        categories,
        isPending: createTodo.isPending || updateTodo.isPending || createCategory.isPending,
        isEditMode: !!initialTodo,

        // Quick Mode 라벨
        quickModeLabels,

        // 카테고리 생성
        handleCategoryCreate: useCallback(() => {
            if (!newCategoryName.trim()) return;

            createCategory.mutate(
                { name: newCategoryName.trim(), color: newCategoryColor },
                {
                    onSuccess: (data) => {
                        // 생성된 카테고리 선택
                        handleChange('categoryId', data._id);
                        // 뷰 모드 복귀
                        setViewMode('default');
                        // 임시 상태 초기화
                        setNewCategoryName('');
                        setNewCategoryColor(DEFAULT_COLOR);
                        Toast.show({ type: 'success', text1: '카테고리가 추가되었습니다.' });
                    },
                    onError: (error) => {
                        const message = error.response?.data?.message || '카테고리 추가에 실패했습니다.';
                        Toast.show({ type: 'error', text1: message });
                    }
                }
            );
        }, [newCategoryName, newCategoryColor, handleChange]),
    };
};
