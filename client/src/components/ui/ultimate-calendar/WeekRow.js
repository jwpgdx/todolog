import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import { DayCell } from './day-cells';
import { SCREEN_WIDTH, CELL_HEIGHT } from './constants';
import { useDateStore } from '../../../store/dateStore';

/**
 * ⚡️ 성능 최적화: currentDate를 store에서 직접 구독
 * - 부모(MonthlyView/WeeklyView)가 renderItem을 재생성하지 않아도 됨
 * - 이 row에 선택된 날짜가 있을 때만 리렌더링됨
 */
const WeekRow = ({ week, onPressDate, eventsByDate = {}, showMonthLabel = true, hideOtherMonthDates = false, useAlternatingBg = true }) => {
    const currentDate = useDateStore(state => state.currentDate);

    // 이 주에 선택된 날짜가 있는지 미리 계산
    const weekDateStrings = useMemo(() =>
        week.map(d => d.dateString),
        [week]
    );

    return (
        <View style={styles.container}>
            {week.map((day) => {
                // MonthSection에서 다른 월 날짜는 빈 View로 처리
                if (hideOtherMonthDates && day.isCurrentMonth === false) {
                    return <View key={day.dateString} style={styles.emptyCell} />;
                }

                return (
                    <DayCell
                        key={day.dateString}
                        day={day}
                        isSelected={day.dateString === currentDate}
                        onPress={onPressDate}
                        events={eventsByDate[day.dateString] || []}
                        isCurrentMonth={day.isCurrentMonth !== false}
                        showMonthLabel={showMonthLabel}
                        useAlternatingBg={useAlternatingBg}
                    />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: SCREEN_WIDTH,
        height: CELL_HEIGHT,
        alignItems: 'center',
        justifyContent: 'space-around',
    },
    emptyCell: {
        flex: 1,
        height: CELL_HEIGHT,
    },
});

/**
 * ⚡️ 최적화된 비교 함수
 * - currentDate는 이제 store에서 직접 구독하므로 props 비교에서 제외
 * - week 참조, onPressDate, eventsByDate를 비교
 */
function arePropsEqual(prevProps, nextProps) {
    return prevProps.week === nextProps.week &&
        prevProps.onPressDate === nextProps.onPressDate &&
        prevProps.eventsByDate === nextProps.eventsByDate &&
        prevProps.showMonthLabel === nextProps.showMonthLabel &&
        prevProps.hideOtherMonthDates === nextProps.hideOtherMonthDates &&
        prevProps.useAlternatingBg === nextProps.useAlternatingBg;
}

export default React.memo(WeekRow, arePropsEqual);
