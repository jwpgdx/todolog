import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, ScrollView, Platform } from 'react-native';

// New Wheel Pickers
import TimePicker from '../components/ui/wheel-picker/TimePicker';
import MonthDayPicker from '../components/ui/wheel-picker/MonthDayPicker';
import YearMonthPicker from '../components/ui/wheel-picker/YearMonthPicker';

// Calendars
import CalendarTest from './calendar-test';
import ExpandableCalendarTest from './expandable-calendar-test';
import ReanimatedCalendarTest from './reanimated-calendar-test';
import CalendarListTest from './calendar-list-test';
import CustomDatePicker from '../components/ui/DatePicker';
import TestCalendarDynamicEvents from './TestCalendarDynamicEvents';

export default function TestDashboard() {
    const [currentView, setCurrentView] = useState('menu');
    const [selectedDate, setSelectedDate] = useState('2025-01-01');

    // State for Wheel Pickers
    const [time, setTime] = useState({ hour: '00', min: '00' });
    const [md, setMd] = useState({ month: '01', day: '01' });
    const [ym, setYm] = useState({ year: '2025', month: '01' });

    const renderMenu = () => (
        <View style={styles.menuContainer}>
            <Text style={styles.title}>🧪 Test Lab</Text>
            <Text style={styles.subtitle}>Select a library to test:</Text>

            <Text style={styles.sectionTitle}>Web Wheel Pickers</Text>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('web-time')}>
                <Text style={styles.buttonText}>1. Web Time Picker</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('web-md')}>
                <Text style={styles.buttonText}>2. Web Month + Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('web-ym')}>
                <Text style={styles.buttonText}>3. Web Year + Month</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Native Wheel Pickers</Text>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('native-time')}>
                <Text style={styles.buttonText}>4. Native Time Picker</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('native-md')}>
                <Text style={styles.buttonText}>5. Native Month + Day</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('native-ym')}>
                <Text style={styles.buttonText}>6. Native Year + Month</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Calendars</Text>
            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('calendar-basic')}>
                <Text style={styles.buttonText}>7. Basic Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('expandable-calendar')}>
                <Text style={styles.buttonText}>9. Expandable Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('reanimated-calendar')}>
                <Text style={styles.buttonText}>10. Reanimated Custom Calendar</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('calendar-list')}>
                <Text style={styles.buttonText}>11. Calendar List</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('custom-datepicker')}>
                <Text style={styles.buttonText}>13. Custom DatePicker (New)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.button} onPress={() => setCurrentView('calendar-dynamic-events')}>
                <Text style={styles.buttonText}>14. Calendar Dynamic Events 🆕</Text>
            </TouchableOpacity>
        </View>
    );

    const renderContent = () => {
        switch (currentView) {
            case 'web-time':
            case 'native-time':
                return (
                    <View style={styles.testWrapper}>
                        <Text style={styles.testTitle}>{currentView.includes('web') ? 'Web' : 'Native'} Time Picker</Text>
                        <TimePicker
                            hour={time.hour}
                            setHour={(h) => setTime(prev => ({ ...prev, hour: h }))}
                            min={time.min}
                            setMin={(m) => setTime(prev => ({ ...prev, min: m }))}
                        />
                        <Text style={styles.resultText}>Selected: {time.hour}:{time.min}</Text>
                    </View>
                );
            case 'web-md':
            case 'native-md':
                return (
                    <View style={styles.testWrapper}>
                        <Text style={styles.testTitle}>{currentView.includes('web') ? 'Web' : 'Native'} Month + Day</Text>
                        <MonthDayPicker
                            month={md.month}
                            setMonth={(m) => setMd(prev => ({ ...prev, month: m }))}
                            day={md.day}
                            setDay={(d) => setMd(prev => ({ ...prev, day: d }))}
                        />
                        <Text style={styles.resultText}>Selected: {md.month}/{md.day}</Text>
                    </View>
                );
            case 'web-ym':
            case 'native-ym':
                return (
                    <View style={styles.testWrapper}>
                        <Text style={styles.testTitle}>{currentView.includes('web') ? 'Web' : 'Native'} Year + Month</Text>
                        <YearMonthPicker
                            year={ym.year}
                            setYear={(y) => setYm(prev => ({ ...prev, year: y }))}
                            month={ym.month}
                            setMonth={(m) => setYm(prev => ({ ...prev, month: m }))}
                        />
                        <Text style={styles.resultText}>Selected: {ym.year}-{ym.month}</Text>
                    </View>
                );
            case 'calendar-basic':
                return (
                    <View style={styles.testWrapper}>
                        <CalendarTest />
                    </View>
                );
            case 'expandable-calendar':
                return (
                    <View style={{ flex: 1, width: '100%' }}>
                        <ExpandableCalendarTest />
                    </View>
                );
            case 'reanimated-calendar':
                return (
                    <View style={{ flex: 1, width: '100%' }}>
                        <ReanimatedCalendarTest />
                    </View>
                );
            case 'calendar-list':
                return (
                    <View style={{ flex: 1, width: '100%' }}>
                        <CalendarListTest />
                    </View>
                );
            case 'custom-datepicker':
                return (
                    <View style={styles.testWrapper}>
                        <Text style={styles.testTitle}>Custom DatePicker</Text>
                        <CustomDatePicker
                            selectedDate={selectedDate}
                            onDateChange={setSelectedDate}
                        />
                        <Text style={styles.resultText}>Selected: {selectedDate}</Text>
                    </View>
                );
            case 'calendar-dynamic-events':
                return (
                    <View style={{ flex: 1, width: '100%' }}>
                        <TestCalendarDynamicEvents />
                    </View>
                );
            default:
                return null;
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                {currentView !== 'menu' && (
                    <TouchableOpacity onPress={() => setCurrentView('menu')} style={styles.backButton}>
                        <Text style={styles.backButtonText}>← Back</Text>
                    </TouchableOpacity>
                )}
            </View>

            <View style={{ flex: 1 }}>
                {currentView === 'menu' ? (
                    <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                        {renderMenu()}
                    </ScrollView>
                ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                        {renderContent()}
                    </View>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    header: {
        padding: 16,
        paddingBottom: 0,
        height: 50,
        justifyContent: 'center',
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        backgroundColor: '#eff6ff',
        borderRadius: 20,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        fontSize: 16,
        color: '#2563eb',
        fontWeight: 'bold',
    },
    menuContainer: {
        padding: 24,
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#4b5563',
        marginTop: 20,
        marginBottom: 10,
        alignSelf: 'flex-start',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 32,
    },
    button: {
        backgroundColor: 'white',
        width: '100%',
        padding: 20,
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 2,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    buttonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        textAlign: 'center',
    },
    testWrapper: {
        width: '90%',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    testTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#111',
    },
    resultText: {
        marginTop: 20,
        fontSize: 18,
        fontWeight: '500',
        color: '#2563eb',
    }
});
