import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { CELL_HEIGHT, THEME } from '../constants';
import { useDayCell } from './useDayCell';

/**
 * ⚡️ Compact DayCell - 점(Dot) 표시 방식
 * 
 * 사용처: Weekly View, Monthly View (UltimateCalendar)
 * 특징:
 * - 날짜 가운데 정렬
 * - 이벤트를 점(Dot)으로 표시 (최대 3개)
 * - 3개 초과 시 ... 표시
 */
const DayCell = React.memo(({
    day,
    onPress,
    events = [],
    isCurrentMonth = true,
    showMonthLabel = true,
    useAlternatingBg = true
}) => {
    const { text, isToday, dateString, monthIndex, isFirstDay, dateObj } = day;
    const { i18n } = useTranslation();

    // 공통 Hook 사용
    const { isSelected, visibleEvents, hasMore } = useDayCell(day, events);

    // ⚡️ 핵심: onPress를 useCallback으로 감싸서 매번 새 함수 생성 방지
    const handlePress = useCallback(() => {
        onPress(dateString);
    }, [onPress, dateString]);

    // 배경색: UltimateCalendar에서만 짝수/홀수 월 구분, MonthSection에서는 흰색
    const backgroundColor = useAlternatingBg
        ? (monthIndex % 2 === 0 ? '#F9FAFB' : 'white')
        : 'white';

    // 월 라벨: 첫날이고 showMonthLabel이 true일 때만 표시
    const monthLabel = (showMonthLabel && isFirstDay)
        ? dayjs(dateObj).locale(i18n.language).format('MMM')
        : null;

    return (
        <Pressable
            style={[styles.touchable, { backgroundColor }]}
            onPress={handlePress}
        >
            {/* 월 라벨 (첫날에만 표시) */}
            {monthLabel && (
                <Text style={styles.monthLabel}>{monthLabel}</Text>
            )}
            <View style={[
                styles.circle,
                isSelected && styles.selectedCircle
            ]}>
                <Text style={[
                    styles.text,
                    !isCurrentMonth && styles.otherMonthText,
                    !isSelected && day.isSunday && styles.sundayText,
                    !isSelected && day.isSaturday && styles.saturdayText,
                    !isSelected && isToday && styles.todayText,
                    isSelected && styles.selectedText
                ]}>
                    {text}
                </Text>
                {!isSelected && isToday && <View style={styles.todayDot} />}
            </View>
            {/* 이벤트 dot 표시 (최대 3개 + ... 표시) */}
            {(visibleEvents.length > 0 || hasMore) && (
                <View style={styles.eventDotsContainer}>
                    {visibleEvents.map((event, idx) => (
                        <View
                            key={idx}
                            style={[styles.eventDot, { backgroundColor: event.color || '#ccc' }]}
                        />
                    ))}
                    {hasMore && (
                        <Text style={styles.moreDots}>…</Text>
                    )}
                </View>
            )}
        </Pressable>
    );
}, (prev, next) => {
    // ⚡️ 커스텀 비교: 필요한 props만 비교
    return prev.day.dateString === next.day.dateString &&
        prev.onPress === next.onPress &&
        prev.events?.length === next.events?.length &&
        prev.isCurrentMonth === next.isCurrentMonth &&
        prev.showMonthLabel === next.showMonthLabel &&
        prev.useAlternatingBg === next.useAlternatingBg;
});

const styles = StyleSheet.create({
    touchable: {
        flex: 1,
        height: CELL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthLabel: {
        fontSize: 9,
        color: THEME.textGray,
        fontWeight: '600',
        marginBottom: 1,
    },
    circle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedCircle: {
        backgroundColor: THEME.primary,
    },
    text: {
        fontSize: 14,
        color: THEME.text,
        fontWeight: '500',
    },
    otherMonthText: {
        color: THEME.textGray,
    },
    sundayText: { color: THEME.sunday },
    saturdayText: { color: THEME.saturday },
    todayText: {
        color: THEME.primary,
        fontWeight: 'bold'
    },
    selectedText: {
        color: 'white',
        fontWeight: 'bold',
    },
    todayDot: {
        position: 'absolute',
        bottom: 2,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: THEME.primary,
    },
    eventDotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 2,
        gap: 2,
    },
    eventDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
    },
    moreDots: {
        fontSize: 8,
        color: THEME.textGray,
        marginLeft: 1,
    },
});

export default DayCell;
