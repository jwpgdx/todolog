import React from 'react';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useDateStore } from '../store/dateStore';
import { StripCalendarShell } from '../features/strip-calendar';

/**
 * StripCalendarTestScreen
 *
 * Strip Calendar 전용 테스트 화면
 * - 모드 전환, 스와이프, today jump, 날짜 선택 검증용
 */
export default function StripCalendarTestScreen() {
  const { currentDate } = useDateStore();

  return (
    <SafeAreaView style={styles.container}>
      <StripCalendarShell />

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>Strip Calendar Test</Text>
        <Text style={styles.infoText}>Selected Date: {currentDate}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  infoCard: {
    marginHorizontal: 12,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  infoText: {
    marginTop: 6,
    fontSize: 13,
    color: '#374151',
  },
});
