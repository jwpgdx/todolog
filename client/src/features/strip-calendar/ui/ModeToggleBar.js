import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { STRIP_CALENDAR_PERF_LOG_ENABLED } from '../utils/stripCalendarConstants';

function nowPerfMs() {
  if (typeof globalThis?.performance?.now === 'function') {
    return globalThis.performance.now();
  }
  return Date.now();
}

function formatMs(value) {
  return Number((value || 0).toFixed(2));
}

export default function ModeToggleBar({ mode, onSwipeUp, onSwipeDown }) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
        onPanResponderRelease: (_, gestureState) => {
          const dy = gestureState.dy;
          const action = dy < -20 ? 'swipeUp' : dy > 20 ? 'swipeDown' : 'none';
          if (STRIP_CALENDAR_PERF_LOG_ENABLED) {
            console.log(
              `[strip-calendar:ui] modeToggle release mode=${mode} dy=${formatMs(dy)} ` +
                `action=${action} t=${formatMs(nowPerfMs())}ms`
            );
          }

          if (action === 'swipeUp') {
            onSwipeUp();
            return;
          }

          if (action === 'swipeDown') {
            onSwipeDown();
          }
        },
      }),
    [onSwipeDown, onSwipeUp]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <View style={styles.touchArea}>
        <View style={styles.bar} />
        <Text style={styles.chevron}>{mode === 'weekly' ? '˅' : '˄'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  touchArea: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  bar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
  },
  chevron: {
    marginTop: 2,
    fontSize: 12,
    color: '#6B7280',
  },
});
