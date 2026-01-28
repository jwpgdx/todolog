import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Calendar, LocaleConfig } from 'react-native-calendars';
import { useTranslation } from 'react-i18next';
import YearMonthPicker from '../components/ui/wheel-picker/YearMonthPicker';

// Basic Locale Config
LocaleConfig.locales['en'] = {
    monthNames: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    monthNamesShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    dayNames: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    dayNamesShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    today: 'Today'
};
LocaleConfig.locales['ko'] = {
    monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    monthNamesShort: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
    dayNames: ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'],
    dayNamesShort: ['일', '월', '화', '수', '목', '금', '토'],
    today: '오늘'
};
LocaleConfig.locales['ja'] = {
    monthNames: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    dayNames: ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'],
    dayNamesShort: ['日', '月', '火', '水', '木', '金', '土'],
    today: '今日'
};

LocaleConfig.defaultLocale = 'en';

const CalendarTest = () => {
    const { i18n } = useTranslation();
    const [selectedDate, setSelectedDate] = useState('');
    const [currentMonth, setCurrentMonth] = useState('2025-01-01'); // Tracks the visible month
    const [mode, setMode] = useState('calendar'); // 'calendar' | 'wheel'

    // Sync Calendar Locale with i18n
    useEffect(() => {
        // Map i18n language code to Calendar locale code if necessary
        // Assuming 'en', 'ko', 'ja' match directly
        const lang = i18n.language || 'en';
        if (LocaleConfig.locales[lang]) {
            LocaleConfig.defaultLocale = lang;
        }
    }, [i18n.language]);

    // Helper to get Year/Month strings for Wheel Picker
    const { year, monthInt } = useMemo(() => {
        const date = new Date(currentMonth);
        return {
            year: date.getFullYear().toString(),
            monthInt: (date.getMonth() + 1).toString().padStart(2, '0')
        };
    }, [currentMonth]);

    // Helper to format Header Title
    const headerTitle = useMemo(() => {
        const date = new Date(currentMonth);
        // Use i18n.language for formatting
        return new Intl.DateTimeFormat(i18n.language || 'en-US', { month: 'long', year: 'numeric' }).format(date);
    }, [currentMonth, i18n.language]);

    const handleMonthChange = (direction) => {
        // Robust local parsing to avoid timezone shifts
        const [y, m, d] = currentMonth.split('-').map(Number);
        const date = new Date(y, m - 1, d);

        date.setMonth(date.getMonth() + direction);

        const nextY = date.getFullYear();
        const nextM = String(date.getMonth() + 1).padStart(2, '0');
        const nextD = String(date.getDate()).padStart(2, '0'); // Should remain 01
        setCurrentMonth(`${nextY}-${nextM}-${nextD}`);
    };

    // Debug Logs
    console.log('render:', { currentMonth, year, monthInt });

    const handleWheelChange = useCallback((newYear, newMonth) => {
        console.log('handleWheelChange:', { newYear, newMonth });
        const safeDateStr = `${newYear}-${newMonth.padStart(2, '0')}-01`;
        setCurrentMonth(safeDateStr);
    }, []);

    return (
        <View style={styles.container}>
            {/* Custom Header */}
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.titleContainer}
                    onPress={() => setMode(prev => prev === 'calendar' ? 'wheel' : 'calendar')}
                >
                    <Text style={styles.title}>{headerTitle}</Text>
                    <Text style={styles.toggleIcon}>{mode === 'calendar' ? '▶' : '▼'}</Text>
                </TouchableOpacity>

                <View style={styles.arrowContainer}>
                    {mode === 'calendar' && (
                        <>
                            <TouchableOpacity onPress={() => handleMonthChange(-1)} style={styles.arrowButton}>
                                <Text style={styles.arrowText}>{'<'}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleMonthChange(1)} style={styles.arrowButton}>
                                <Text style={styles.arrowText}>{'>'}</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>

            <View style={styles.contentContainer}>
                {mode === 'calendar' ? (
                    <Calendar
                        current={currentMonth}
                        key={`${currentMonth}-${i18n.language}`} // Force re-render when current changes or language changes
                        onDayPress={day => {
                            setSelectedDate(day.dateString);
                        }}
                        markedDates={{
                            [selectedDate]: { selected: true, disableTouchEvent: true, selectedDotColor: 'orange' }
                        }}
                        // Hide Default Header
                        renderHeader={() => null}
                        hideArrows={true}

                        theme={{
                            backgroundColor: '#ffffff',
                            calendarBackground: '#ffffff',
                            textSectionTitleColor: '#b6c1cd',
                            selectedDayBackgroundColor: '#00adf5',
                            selectedDayTextColor: '#ffffff',
                            todayTextColor: '#00adf5',
                            dayTextColor: '#2d4150',
                            textDisabledColor: '#d9e1e8',
                            dotColor: '#00adf5',
                            selectedDotColor: '#ffffff',
                            monthTextColor: 'blue',
                            indicatorColor: 'blue',
                            textDayFontFamily: 'monospace',
                            textMonthFontFamily: 'monospace',
                            textDayHeaderFontFamily: 'monospace',
                            textDayFontWeight: '300',
                            textMonthFontWeight: 'bold',
                            textDayHeaderFontWeight: '300',
                            textDayFontSize: 16,
                            textMonthFontSize: 16,
                            textDayHeaderFontSize: 16
                        }}
                        style={{
                            marginBottom: 10
                        }}
                    />
                ) : (
                    <View style={styles.pickerContainer}>
                        <YearMonthPicker
                            year={year}
                            setYear={(y) => handleWheelChange(y, monthInt)}
                            month={monthInt}
                            setMonth={(m) => handleWheelChange(year, m)}
                        />
                    </View>
                )}
            </View>

            {selectedDate ? (
                <Text style={styles.selectedText}>Selected Date: {selectedDate}</Text>
            ) : (
                <Text style={styles.placeholderText}>Select a date</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 10,
        backgroundColor: '#fff',
        borderRadius: 10,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        height: 50,
    },
    titleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#00adf5',
        marginRight: 8,
    },
    toggleIcon: {
        fontSize: 14,
        color: '#00adf5',
    },
    arrowContainer: {
        flexDirection: 'row',
    },
    arrowButton: {
        paddingHorizontal: 15, // Easy tap target
        paddingVertical: 5,
    },
    arrowText: {
        fontSize: 20,
        color: '#00adf5',
        fontWeight: 'bold',
    },
    contentContainer: {
        height: 350, // Fixed height to minimize layout shift
    },
    pickerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectedText: {
        marginTop: 10,
        fontSize: 16,
        color: '#00adf5',
        fontWeight: '600',
        textAlign: 'center',
    },
    placeholderText: {
        marginTop: 10,
        fontSize: 16,
        color: '#999',
        textAlign: 'center',
    },
});

export default CalendarTest;
