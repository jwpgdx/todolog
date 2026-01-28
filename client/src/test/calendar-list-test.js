import React, { useState, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CalendarList, LocaleConfig } from 'react-native-calendars';

// Setup Mock Date
const today = new Date();
const initialDate = today.toISOString().split('T')[0];
const RANGE = 24;

const CalendarListTest = () => {
    const [selected, setSelected] = useState(initialDate);
    const [currentMonth, setCurrentMonth] = useState(initialDate);

    const marked = useMemo(() => {
        return {
            [selected]: {
                selected: true,
                disableTouchEvent: true,
                selectedColor: '#5E60CE',
                selectedTextColor: 'white'
            }
        };
    }, [selected]);

    const onDayPress = useCallback((day) => {
        setSelected(day.dateString);
        console.log('Selected day', day);
    }, []);

    const onVisibleMonthsChange = useCallback((months) => {
        if (months.length > 0) {
            console.log('Visible months', months);
            // Update current month state based on the first visible month
            setCurrentMonth(months[0].dateString);
        }
    }, []);

    // Custom Header to display the current visible month (sticky or just informational)
    // Note: CalendarList has its own per-month headers. 
    // If the user wants a separate "Floating Header" that changes as they scroll, 
    // we can render it outside the CalendarList using the state updated by onVisibleMonthsChange.

    return (
        <View style={styles.container}>
            <View style={styles.stickyHeader}>
                <Text style={styles.stickyHeaderText}>
                    Current View: {currentMonth.substring(0, 7)}
                </Text>
            </View>
            <CalendarList
                // testID={testIDs.calendarList.CONTAINER}
                current={initialDate}
                pastScrollRange={RANGE}
                futureScrollRange={RANGE}
                onDayPress={onDayPress}
                markedDates={marked}
                onVisibleMonthsChange={onVisibleMonthsChange}
                // Enable vertical scrolling
                horizontal={false}
                pagingEnabled={false}

                // Theme settings
                theme={{
                    todayTextColor: '#5390D9',
                    selectedDayBackgroundColor: '#5E60CE',
                    arrowColor: 'black',
                }}
            />
        </View>
    );
};

export default CalendarListTest;

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    stickyHeader: {
        padding: 15,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        alignItems: 'center',
        zIndex: 10,
    },
    stickyHeaderText: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333'
    }
});
