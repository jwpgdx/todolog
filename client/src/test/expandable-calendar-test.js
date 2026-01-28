import React, { useRef, useCallback } from 'react';
import { Animated, Easing, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ExpandableCalendar, AgendaList, CalendarProvider, WeekCalendar } from 'react-native-calendars';

// Mock Data
const today = new Date().toISOString().split('T')[0];
const fastDate = (pastDays) => {
    const d = new Date(today);
    d.setDate(d.getDate() - pastDays);
    return d.toISOString().split('T')[0];
};

const ITEMS = [
    {
        title: today,
        data: [{ hour: '12am', duration: '1h', title: 'First Yoga' }]
    },
    {
        title: fastDate(-1),
        data: [{ hour: '4pm', duration: '1h', title: 'Pilates ABC' }, { hour: '5pm', duration: '1h', title: 'Vinyasa Yoga' }]
    },
    {
        title: fastDate(1),
        data: [{ hour: '1pm', duration: '1h', title: 'Ashtanga Yoga' }, { hour: '2pm', duration: '1h', title: 'Deep Stretches' }, { hour: '3pm', duration: '1h', title: 'Private Yoga' }]
    },
    {
        title: fastDate(2),
        data: [{ hour: '12am', duration: '1h', title: 'Last Yoga' }]
    }
];

const getMarkedDates = () => {
    const marked = {};
    ITEMS.forEach(item => {
        // NOTE: only mark dates with data
        if (item.data && item.data.length > 0 && item.data[0]) {
            marked[item.title] = { marked: true };
        }
    });
    return marked;
};

const themeColor = '#00AAAF';
const lightThemeColor = '#f2f7f7';

function getTheme() {
    const disabledColor = 'grey';
    return {
        // arrows
        arrowColor: 'black',
        // arrowStyle: {padding: 0},
        // knob
        expandableKnobColor: themeColor,
        // month
        monthTextColor: 'black',
        textMonthFontSize: 16,
        textMonthFontFamily: 'HelveticaNeue',
        textMonthFontWeight: 'bold',
        // day names
        textSectionTitleColor: 'black',
        textDayHeaderFontSize: 12,
        textDayHeaderFontFamily: 'HelveticaNeue',
        textDayHeaderFontWeight: 'normal',
        // dates
        dayTextColor: themeColor,
        todayTextColor: '#af0078',
        textDayFontSize: 18,
        textDayFontFamily: 'HelveticaNeue',
        textDayFontWeight: '500',
        // textDayStyle: { marginTop: 24 },
        selectedDayBackgroundColor: themeColor,
        selectedDayTextColor: 'white',
        // disabled date
        textDisabledColor: disabledColor,
        dotColor: themeColor,
        selectedDotColor: 'white',
        arrowHeight: 20,
        arrowWidth: 20,
        weekVerticalMargin: 6,
        disabledDotColor: disabledColor,
        todayDotColor: '#af0078',
        todayButtonTextColor: themeColor
    };
}


const AgendaItem = React.memo(({ item }) => {
    return (
        <TouchableOpacity style={styles.item} onPress={() => alert(item.title)}>
            <View>
                <Text style={styles.itemHourText}>{item.hour}</Text>
                <Text style={styles.itemDurationText}>{item.duration}</Text>
            </View>
            <Text style={styles.itemTitleText}>{item.title}</Text>
        </TouchableOpacity>
    );
});

const ExpandableCalendarScreen = ({ weekView = false }) => { // Default to full view, can be toggled
    const marked = useRef(getMarkedDates());
    const theme = useRef(getTheme());
    const todayBtnTheme = useRef({
        todayButtonTextColor: themeColor
    });

    const onDateChanged = useCallback((date, updateSource) => {
        console.log('ExpandableCalendarScreen onDateChanged: ', date, updateSource);
    }, []);

    const onMonthChange = useCallback(({ dateString }) => {
        console.log('ExpandableCalendarScreen onMonthChange: ', dateString);
    }, []);

    const renderItem = useCallback(({ item }) => {
        return <AgendaItem item={item} />;
    }, []);

    return (
        <CalendarProvider
            date={ITEMS[0]?.title} // Start at today
            onDateChanged={onDateChanged}
            onMonthChange={onMonthChange}
            showTodayButton
            theme={todayBtnTheme.current}
        >
            {weekView ? (
                <WeekCalendar
                    firstDay={1}
                    markedDates={marked.current}
                />
            ) : (
                <ExpandableCalendar
                    theme={theme.current}
                    firstDay={1}
                    markedDates={marked.current}
                // Use default arrows
                />
            )}
            <AgendaList
                sections={ITEMS}
                renderItem={renderItem}
                sectionStyle={styles.section}
            />
        </CalendarProvider>
    );
};

export default ExpandableCalendarScreen;

const styles = StyleSheet.create({
    calendar: {
        paddingLeft: 20,
        paddingRight: 20
    },
    header: {
        backgroundColor: 'lightgrey'
    },
    section: {
        backgroundColor: lightThemeColor,
        color: 'grey',
        textTransform: 'capitalize',
        padding: 10,
        fontSize: 14,
        fontWeight: 'bold'
    },
    item: {
        padding: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: 'lightgrey',
        flexDirection: 'row'
    },
    itemHourText: {
        color: 'black'
    },
    itemDurationText: {
        color: 'grey',
        fontSize: 12,
        marginTop: 4,
        marginLeft: 4
    },
    itemTitleText: {
        color: 'black',
        marginLeft: 16,
        fontWeight: 'bold',
        fontSize: 16
    }
});
