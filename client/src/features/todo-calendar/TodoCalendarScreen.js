import React from 'react';
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import CalendarList from './ui/CalendarList';

/**
 * TodoCalendarScreen Component
 * 
 * Top-level screen component for infinite scroll calendar.
 * 
 * Features:
 * - SafeAreaView for proper layout on notched devices
 * - CalendarList as main content
 * - Navigation integration (registered in AppNavigator)
 * 
 * Navigation:
 * - Accessible from Settings screen via "무한 스크롤 캘린더 테스트" button
 * - Header with back button (configured in AppNavigator)
 * 
 * Validates: Requirements 8.2, 8.3, 8.4, 8.5
 */
export default function TodoCalendarScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <View style={styles.container}>
        <CalendarList />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
