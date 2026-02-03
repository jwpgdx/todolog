import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { ListDayCell } from './day-cells';
import { SCREEN_WIDTH, THEME } from './constants';

/**
 * MonthSection - 월별 섹션 컴포넌트 (상세 뷰)
 * 
 * Props:
 *   - monthData: { monthKey, title, weeks }
 *   - eventsByDate: { "2026-01-15": [{ color, title }], ... }
 *   - onDatePress: (dateString) => void
 *   - showWeekDays: 요일 헤더 표시 여부 (기본 true)
 *   - startDayOfWeek: 'sunday' | 'monday'
 * 
 * 특징:
 *   - ListDayCell 사용 (날짜 왼쪽 상단, 이벤트 라인 표시)
 *   - 이벤트 제목 직접 표시 (최대 3개)
 */
const MonthSection = ({
    monthData,
    eventsByDate = {},
    cacheVersion = 0,
    onDatePress,
    showWeekDays = true,
    startDayOfWeek = 'sunday'
}) => {
    const { t, i18n } = useTranslation();

    // 요일 헤더 생성 (Localization 적용)
    const weekDays = React.useMemo(() => {
        return Array.from({ length: 7 }).map((_, i) => {
            const dayIndex = startDayOfWeek === 'monday' ? i + 1 : i;
            return dayjs().day(dayIndex).format('dd');
        });
    }, [startDayOfWeek, i18n.language]);

    // 월 타이틀 포맷팅 (Localization 적용)
    const monthTitle = React.useMemo(() => {
        return dayjs(monthData.monthKey).format(t('date.header_fmt') || 'YYYY[. ]M[.]');
    }, [monthData.monthKey, i18n.language, t]);

    return (
        <View style={styles.container}>
            {/* 월 타이틀 */}
            <View style={styles.monthHeader}>
                <Text style={styles.monthTitle}>{monthTitle}</Text>
            </View>

            {/* 요일 헤더 */}
            {showWeekDays && (
                <View style={styles.weekDaysHeader}>
                    {weekDays.map((day, idx) => {
                        const isSun = (startDayOfWeek === 'sunday' && idx === 0) ||
                            (startDayOfWeek === 'monday' && idx === 6);
                        const isSat = (startDayOfWeek === 'sunday' && idx === 6) ||
                            (startDayOfWeek === 'monday' && idx === 5);
                        return (
                            <Text
                                key={idx}
                                style={[
                                    styles.weekDayText,
                                    isSun && { color: THEME.sunday },
                                    isSat && { color: THEME.saturday }
                                ]}
                            >
                                {day}
                            </Text>
                        );
                    })}
                </View>
            )}

            {/* 주별 행 렌더링 - ListDayCell 사용 */}
            {monthData.weeks.map((week, weekIdx) => (
                <View
                    key={`${monthData.monthKey}-week-${weekIdx}`}
                    style={styles.weekRow}
                >
                    {week.map((day) => (
                        <ListDayCell
                            key={day.dateString}
                            day={day}
                            onPress={onDatePress}
                            events={eventsByDate[day.dateString] || []}
                            isCurrentMonth={day.isCurrentMonth !== false}
                        />
                    ))}
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: SCREEN_WIDTH,
        backgroundColor: 'white',
    },
    monthHeader: {
        paddingHorizontal: 16,
        paddingTop: 20,
        paddingBottom: 12,
    },
    monthTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: THEME.text,
    },
    weekDaysHeader: {
        flexDirection: 'row',
        height: 30,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    weekDayText: {
        flex: 1,
        textAlign: 'center',
        fontSize: 12,
        color: '#666',
        fontWeight: '500',
    },
    weekRow: {
        flexDirection: 'row',
        width: SCREEN_WIDTH,
    },
});

export default React.memo(MonthSection, (prev, next) => {
    const isEqual = prev.monthData.monthKey === next.monthData.monthKey &&
        prev.eventsByDate === next.eventsByDate &&
        prev.cacheVersion === next.cacheVersion &&
        prev.onDatePress === next.onDatePress &&
        prev.startDayOfWeek === next.startDayOfWeek;
    
    // ✅ cacheVersion 변경 시 로그
    if (!isEqual && prev.cacheVersion !== next.cacheVersion) {
        console.log(`🔄 [MonthSection] cacheVersion 변경: ${prev.cacheVersion} → ${next.cacheVersion} (리렌더링)`);
    }
    
    return isEqual;
});
