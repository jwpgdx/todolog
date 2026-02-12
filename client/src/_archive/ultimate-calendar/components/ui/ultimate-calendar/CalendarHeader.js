import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from './constants';

const CalendarHeader = ({ 
    title, 
    weekNumber, 
    isWeekly, 
    onToggleMode, 
    onTodayPress, 
    isTodayVisible,
    onPrevious,
    onNext 
}) => {
    return (
        <View style={styles.container}>
            <View style={styles.leftContainer}>
                {/* ✅ Arrow 버튼 추가 */}
                {onPrevious && (
                    <TouchableOpacity style={styles.arrowButton} onPress={onPrevious}>
                        <Ionicons name="chevron-back" size={20} color={THEME.text} />
                    </TouchableOpacity>
                )}
                
                <Text style={styles.title}>{title}</Text>
                
                {/* ✅ Arrow 버튼 추가 */}
                {onNext && (
                    <TouchableOpacity style={styles.arrowButton} onPress={onNext}>
                        <Ionicons name="chevron-forward" size={20} color={THEME.text} />
                    </TouchableOpacity>
                )}

                {/* Today Button - Visible if today is not locally visible or selected */}
                {!isTodayVisible && (
                    <TouchableOpacity style={styles.todayButton} onPress={onTodayPress}>
                        <Text style={styles.todayButtonText}>오늘</Text>
                    </TouchableOpacity>
                )}
            </View>

            <TouchableOpacity style={styles.modeButton} onPress={onToggleMode}>
                <Text style={styles.modeButtonText}>
                    {isWeekly ? '월간' : '주간'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 15,
        backgroundColor: 'white',
    },
    leftContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    arrowButton: {
        padding: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: THEME.text,
    },
    weekNumber: {
        fontSize: 16,
        fontWeight: '600',
        color: THEME.primary,
    },
    todayButton: {
        backgroundColor: THEME.todayBg,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 4,
    },
    todayButtonText: {
        color: THEME.primary,
        fontSize: 12,
        fontWeight: 'bold',
    },
    modeButton: {
        backgroundColor: THEME.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    modeButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
});

export default React.memo(CalendarHeader);
