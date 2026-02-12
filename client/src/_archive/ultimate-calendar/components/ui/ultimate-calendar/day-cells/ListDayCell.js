import React, { useCallback } from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { THEME, COLUMN_WIDTH } from '../constants';
import { useDayCell } from './useDayCell';

// MonthSection용 셀 높이 (이벤트 리스트 공간 확보)
const LIST_CELL_HEIGHT = 90;
const EVENT_LINE_HEIGHT = 18;

/**
 * 📋 List DayCell - 라인(제목) 표시 방식
 * 
 * 사용처: MonthSection (상세 월간 뷰)
 * 특징:
 * - 날짜 왼쪽 상단 고정
 * - 이벤트를 라인 형태로 제목 표시 (최대 3개)
 * - 3개 초과 시 "+ N more" 표시
 */
const ListDayCell = React.memo(({
    day,
    onPress,
    events = [],
    isCurrentMonth = true,
}) => {
    const { text, isToday, dateString } = day;

    // 공통 Hook 사용 (list 모드: 모든 이벤트 표시)
    const { isSelected, visibleEvents, hasMore, remainingCount } = useDayCell(day, events, 3, 'list');

    const handlePress = useCallback(() => {
        onPress(dateString);
    }, [onPress, dateString]);

    // 다른 월 날짜는 빈 셀로 표시
    if (!isCurrentMonth) {
        return <View style={styles.emptyCell} />;
    }

    return (
        <Pressable
            style={styles.container}
            onPress={handlePress}
        >
            {/* 날짜 - 왼쪽 상단 */}
            <View style={styles.dateContainer}>
                <View style={[
                    styles.dateCircle,
                    isToday && styles.todayCircle,
                    isSelected && styles.selectedCircle,
                ]}>
                    <Text style={[
                        styles.dateText,
                        day.isSunday && styles.sundayText,
                        day.isSaturday && styles.saturdayText,
                        isToday && styles.todayText,
                        isSelected && styles.selectedText,
                    ]}>
                        {text}
                    </Text>
                </View>
            </View>

            {/* 이벤트 리스트 */}
            <View style={styles.eventsContainer}>
                {visibleEvents.map((event, idx) => (
                    <View
                        key={idx}
                        style={[
                            styles.eventLine,
                            { backgroundColor: event.color || THEME.primary }
                        ]}
                    >
                        <Text
                            style={styles.eventTitle}
                            numberOfLines={1}
                        >
                            {event.title || '일정'}
                        </Text>
                    </View>
                ))}
                {hasMore && (
                    <Text style={styles.moreText}>
                        + {remainingCount} more
                    </Text>
                )}
            </View>
        </Pressable>
    );
}, (prev, next) => {
    // ✅ events 참조 비교 - 카테고리 색상/Todo 제목 변경 감지
    return prev.day.dateString === next.day.dateString &&
        prev.onPress === next.onPress &&
        prev.events === next.events &&
        prev.isCurrentMonth === next.isCurrentMonth;
});

const styles = StyleSheet.create({
    container: {
        width: COLUMN_WIDTH,
        minHeight: LIST_CELL_HEIGHT,
        backgroundColor: 'white',
        borderRightWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: '#E5E7EB',
        padding: 4,
    },
    emptyCell: {
        width: COLUMN_WIDTH,
        minHeight: LIST_CELL_HEIGHT,
        backgroundColor: '#F9FAFB',
        borderRightWidth: 0.5,
        borderBottomWidth: 0.5,
        borderColor: '#E5E7EB',
    },
    dateContainer: {
        alignItems: 'flex-start',
        marginBottom: 4,
    },
    dateCircle: {
        width: 24,
        height: 24,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    todayCircle: {
        backgroundColor: THEME.todayBg,
    },
    selectedCircle: {
        backgroundColor: THEME.primary,
    },
    dateText: {
        fontSize: 12,
        fontWeight: '500',
        color: THEME.text,
    },
    sundayText: {
        color: THEME.sunday,
    },
    saturdayText: {
        color: THEME.saturday,
    },
    todayText: {
        color: THEME.primary,
        fontWeight: 'bold',
    },
    selectedText: {
        color: THEME.selectedText,
        fontWeight: 'bold',
    },
    eventsContainer: {
        flex: 1,
        gap: 2,
    },
    eventLine: {
        height: EVENT_LINE_HEIGHT,
        borderRadius: 3,
        paddingHorizontal: 4,
        justifyContent: 'center',
    },
    eventTitle: {
        fontSize: 10,
        color: 'white',
        fontWeight: '500',
    },
    moreText: {
        fontSize: 9,
        color: THEME.textGray,
        marginTop: 2,
    },
});

export default ListDayCell;
