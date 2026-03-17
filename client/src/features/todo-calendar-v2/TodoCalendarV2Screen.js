import React from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import TodoCalendarV2CalendarList from './ui/TodoCalendarV2CalendarList';

export default function TodoCalendarV2Screen() {
  return (
    <SafeAreaView style={styles.container}>
      <TodoCalendarV2CalendarList />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
});
