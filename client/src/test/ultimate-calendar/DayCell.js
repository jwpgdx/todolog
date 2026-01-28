import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { CELL_HEIGHT, THEME } from './constants';

const DayCell = React.memo(({ day, isSelected, onPress }) => {
    const { text, isToday, isSunday, isSaturday, dateString } = day;

    return (
        <TouchableOpacity
            style={[
                styles.container,
                isSelected && styles.selectedContainer
            ]}
            onPress={() => onPress(dateString)}
            activeOpacity={0.7}
        >
            <View style={styles.textContainer}>
                <Text style={[
                    styles.text,
                    isSunday && styles.sundayText,
                    isSaturday && styles.saturdayText,
                    isToday && !isSelected && styles.todayText,
                    isSelected && styles.selectedText
                ]}>
                    {text}
                </Text>
                {isToday && !isSelected && <View style={styles.todayDot} />}
            </View>
        </TouchableOpacity>
    );
});

const styles = StyleSheet.create({
    container: {
        width: CELL_HEIGHT,
        height: CELL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    textContainer: {
        width: 32,
        height: 32,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
    },
    selectedContainer: {
        backgroundColor: THEME.selectedBg,
        borderRadius: 16, // Applying to the touchable ensures the whole hit area, or match textContainer
        // Adjusting to match design: usually the circle around the text is what we want
        // But if we want the Whole Cell to be touchable, we keep outer, but style inner.
        // Let's style the outer container's inner view actually.
        // Re-thinking: The previous designs often had a circle background.
        // Let's reset background on container and put it on a sub-view or just style the container if it's small enough.
        // CELL_HEIGHT is ~50+, 32 is small.
        // Let's remove bg from container and put it on a wrapper view if needed, or leave as is if we want square selection?
        // Typically calendars use circle selections.
    },
    // FIX: Moving selection style to a specific circle view
    container: {
        flex: 1, // fill the column width provided by parent
        height: CELL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
    },
    text: {
        fontSize: 14,
        fontWeight: '500',
        color: THEME.text,
    },
    sundayText: { color: THEME.sunday },
    saturdayText: { color: THEME.saturday },
    todayText: {
        color: THEME.primary,
        fontWeight: '700',
    },
    selectedText: {
        color: 'white',
        fontWeight: '700',
    },
    todayDot: {
        position: 'absolute',
        bottom: 2,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: THEME.primary,
    },
    // Redefine selected container to be the circle
    selectedContainer: {
        backgroundColor: THEME.primary,
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
    }
});

/**
 * Re-writing component to correctly use the styles logic for circle selection
 */
const DayCellFinal = React.memo(({ day, isSelected, onPress }) => {
    const { text, isToday, isSunday, isSaturday, dateString } = day;

    return (
        <TouchableOpacity
            style={styles2.touchable}
            onPress={() => onPress(dateString)}
        >
            <View style={[
                styles2.circle,
                isSelected && styles2.selectedCircle
            ]}>
                <Text style={[
                    styles2.text,
                    !isSelected && isSunday && styles2.sundayText,
                    !isSelected && isSaturday && styles2.saturdayText,
                    !isSelected && isToday && styles2.todayText,
                    isSelected && styles2.selectedText
                ]}>
                    {text}
                </Text>
                {/* Optional Today Dot if not selected */}
                {!isSelected && isToday && <View style={styles2.dot} />}
            </View>
        </TouchableOpacity>
    );
});

const styles2 = StyleSheet.create({
    touchable: {
        flex: 1,
        height: CELL_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
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
    dot: {
        position: 'absolute',
        bottom: 4,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: THEME.primary,
    }
});

export default DayCellFinal;
