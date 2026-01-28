import React from 'react';
import { View, StyleSheet } from 'react-native';
import DayCell from './DayCell';
import { SCREEN_WIDTH, CELL_HEIGHT } from './constants';

const WeekRow = ({ week, currentDate, onPressDate }) => {
    return (
        <View style={styles.container}>
            {week.map((day, index) => (
                <DayCell
                    key={`${day.dateString}-${index}`}
                    day={day}
                    isSelected={day.dateString === currentDate}
                    onPress={onPressDate}
                />
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        width: SCREEN_WIDTH,
        height: CELL_HEIGHT,
        alignItems: 'center',
        justifyContent: 'space-around', // or space-between depending on exact math
    },
});

function arePropsEqual(prevProps, nextProps) {
    // 1. If the week data reference changed, must re-render
    if (prevProps.week !== nextProps.week) return false;

    // 2. If the current date hasn't changed, and week hasn't changed -> Skip
    if (prevProps.currentDate === nextProps.currentDate) return true;

    // 3. If current date changed, check if this specific row is affected
    const prevSelectedInThisWeek = prevProps.week.some(d => d.dateString === prevProps.currentDate);
    const nextSelectedInThisWeek = nextProps.week.some(d => d.dateString === nextProps.currentDate);

    // If neither the old selection nor the new selection is in this row, we don't need to update
    if (!prevSelectedInThisWeek && !nextSelectedInThisWeek) {
        return true;
    }

    // Otherwise, this row needs to update (either unselect old, or select new)
    return false;
}

export default React.memo(WeekRow, arePropsEqual);
