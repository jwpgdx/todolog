import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { Ionicons } from '@expo/vector-icons';
import YearMonthPicker from './wheel-picker/YearMonthPicker';

export default function CustomDatePicker({
    selectedDate,
    onDateChange
}) {
    const { t, i18n } = useTranslation();

    // 초기 날짜 설정
    const initialDate = useMemo(() => selectedDate ? dayjs(selectedDate) : dayjs(), []);

    // 상태 관리
    const [currentDateObj, setCurrentDateObj] = useState(initialDate);
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' | 'picker'

    // 달력 컨테이너의 너비 (동적 계산용)
    const [containerWidth, setContainerWidth] = useState(0);

    // 높이 덜컹거림 방지를 위한 상태
    const [calendarHeight, setCalendarHeight] = useState(0);

    // 헤더 타이틀 (localize with dayjs format from i18n or directly)
    const headerTitle = useMemo(() => {
        // use 'date.header_fmt' from locales or fallback
        // The locale json has values like "YYYY년 M월" which dayjs can use directly.
        const formatString = t('date.header_fmt', 'YYYY-MM');
        return currentDateObj.format(formatString);
    }, [currentDateObj, i18n.language]);

    // 달력 데이터 생성 (해당 월의 날짜들, 6주 고정)
    const calendarDays = useMemo(() => {
        const startOfMonth = currentDateObj.startOf('month');
        const startDay = startOfMonth.day(); // 0(Sun) ~ 6(Sat)
        const startDate = startOfMonth.subtract(startDay, 'day');

        const days = [];
        for (let i = 0; i < 42; i++) {
            days.push(startDate.add(i, 'day'));
        }
        return days;
    }, [currentDateObj]);

    // 높이 계산용 셀 크기 (전체 너비 / 7)
    const cellSize = containerWidth > 0 ? containerWidth / 7 : 0;

    // 월 변경
    const handleMonthChange = (direction) => {
        setCurrentDateObj(currentDateObj.add(direction, 'month'));
    };

    // 휠 피커 변경
    const handleWheelChange = (newYear, newMonth) => {
        const newDate = dayjs().year(parseInt(newYear)).month(parseInt(newMonth) - 1).date(1);
        setCurrentDateObj(newDate);
    };

    // 날짜 선택
    const handleDatePress = (date) => {
        if (onDateChange) {
            onDateChange(date.format('YYYY-MM-DD'));
        }
        if (!date.isSame(currentDateObj, 'month')) {
            setCurrentDateObj(date);
        }
    };

    // 뷰 모드 토글
    const toggleViewMode = () => {
        setViewMode(prev => prev === 'calendar' ? 'picker' : 'calendar');
    };

    // 레이아웃 측정 (높이 덜컹거림 방지)
    const handleCalendarLayout = (event) => {
        const { height } = event.nativeEvent.layout;
        const targetHeight = Math.max(height, 300);

        if (Math.abs(calendarHeight - targetHeight) > 1) {
            setCalendarHeight(targetHeight);
        }
    };

    // 요일 헤더 (Dynamic based on locale)
    const weekDays = useMemo(() => {
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(dayjs().day(i).format('dd')); // 'dd' gives short name (Sun/일, Mon/월) based on locale
        }
        return days;
    }, [i18n.language]);

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.titleContainer}
                    onPress={toggleViewMode}
                >
                    <Text style={styles.title}>{headerTitle}</Text>
                    <Ionicons
                        name={viewMode === 'calendar' ? "chevron-down" : "chevron-up"}
                        size={20}
                        color="#333"
                    />
                </TouchableOpacity>

                <View style={styles.arrowContainer}>
                    <TouchableOpacity onPress={() => handleMonthChange(-1)} style={styles.arrowButton}>
                        <Ionicons name="chevron-back" size={24} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleMonthChange(1)} style={styles.arrowButton}>
                        <Ionicons name="chevron-forward" size={24} color="#333" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Content */}
            <View style={[styles.contentContainer, { minHeight: calendarHeight }]}>
                {viewMode === 'picker' ? (
                    <View style={styles.pickerContainer}>
                        <YearMonthPicker
                            year={currentDateObj.format('YYYY')}
                            setYear={(y) => handleWheelChange(y, currentDateObj.format('MM'))}
                            month={currentDateObj.format('MM')}
                            setMonth={(m) => handleWheelChange(currentDateObj.format('YYYY'), m)}
                        />
                    </View>
                ) : (
                    <View style={styles.calendarContainer} onLayout={handleCalendarLayout}>
                        {/* Weekday Header */}
                        <View style={styles.weekRow}>
                            {weekDays.map((day, index) => (
                                <Text key={index} style={[
                                    styles.weekDayText,
                                    index === 0 && styles.textRed,
                                    index === 6 && styles.textBlue
                                ]}>
                                    {day}
                                </Text>
                            ))}
                        </View>

                        {/* Days Grid */}
                        <View
                            style={styles.daysGrid}
                            // 부모 너비 측정 (높이 계산용)
                            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
                        >
                            {calendarDays.map((date, index) => {
                                const isCurrentMonth = date.isSame(currentDateObj, 'month');
                                const isSelected = selectedDate === date.format('YYYY-MM-DD');
                                const isToday = date.isSame(dayjs(), 'day');
                                const dayOfWeek = date.day();

                                return (
                                    <TouchableOpacity
                                        key={index}
                                        style={[
                                            styles.dayCell,
                                            {
                                                width: '14.2857%', // 가로: 무조건 7개 꽉 채움 (밀림 방지)
                                                height: cellSize   // 세로: 계산된 값 사용 (정사각형 유지)
                                            },
                                            isSelected && styles.selectedDayCell,
                                        ]}
                                        onPress={() => handleDatePress(date)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[
                                            styles.dayText,
                                            !isCurrentMonth && styles.textGray,
                                            isCurrentMonth && dayOfWeek === 0 && styles.textRed,
                                            isCurrentMonth && dayOfWeek === 6 && styles.textBlue,
                                            isToday && !isSelected && styles.textToday,
                                            isSelected && styles.textWhite
                                        ]}>
                                            {date.date()}
                                        </Text>
                                        {isToday && <View style={styles.todayDot} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        marginRight: 4,
    },
    arrowContainer: {
        flexDirection: 'row',
        gap: 15,
    },
    arrowButton: {
        padding: 5,
    },
    contentContainer: {
        backgroundColor: 'white',
    },
    pickerContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    calendarContainer: {
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    weekDayText: {
        width: '14.28%',
        textAlign: 'center',
        fontSize: 13,
        color: '#6b7280',
        fontWeight: '500',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        width: '100%',
    },
    dayCell: {
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 20,
        // margin, padding, border가 없어야 정확히 7등분 됩니다.
    },
    selectedDayCell: {
        backgroundColor: '#3b82f6',
        borderRadius: 999,
    },
    dayText: {
        fontSize: 16,
        color: '#1f2937',

        // --- 텍스트 수직 중앙 정렬 핵심 (Android) ---
        textAlign: 'center',
        textAlignVertical: 'center',
        includeFontPadding: false,

        // 줄 간격 설정 (폰트 크기와 비슷하게 하여 박스 내 꽉 차게)
        lineHeight: 20,
    },
    textGray: {
        color: '#d1d5db',
    },
    textRed: {
        color: '#ef4444',
    },
    textBlue: {
        color: '#3b82f6',
    },
    textWhite: {
        color: 'white',
        fontWeight: '600',
    },
    textToday: {
        color: '#3b82f6',
        fontWeight: 'bold',
    },
    todayDot: {
        position: 'absolute',
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#3b82f6',
    }
});