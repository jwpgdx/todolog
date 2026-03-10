import React, { useMemo } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';

/**
 * WeekFlowModeToggleBar (iOS)
 *
 * - Swipe down on weekly -> toggle to monthly
 * - Swipe up on monthly -> toggle to weekly
 *
 * No animation: the parent can instantly swap modes for perf.
 */
export default function WeekFlowModeToggleBar({ mode, onToggleMode }) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 8 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderRelease: (_, gestureState) => {
          const dy = gestureState.dy;
          const action = dy < -20 ? 'swipeUp' : dy > 20 ? 'swipeDown' : 'none';

          if (action === 'swipeUp' && mode === 'monthly') {
            onToggleMode?.();
            return;
          }

          if (action === 'swipeDown' && mode === 'weekly') {
            onToggleMode?.();
          }
        },
      }),
    [mode, onToggleMode]
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

