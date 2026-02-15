import React, { useMemo } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

export default function ModeToggleBar({ mode, onSwipeUp, onSwipeDown, onToggleMode }) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 8,
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy < -20) {
            onSwipeUp();
            return;
          }

          if (gestureState.dy > 20) {
            onSwipeDown();
          }
        },
      }),
    [onSwipeDown, onSwipeUp]
  );

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <Pressable onPress={onToggleMode} style={styles.touchArea}>
        <View style={styles.bar} />
        <Text style={styles.chevron}>{mode === 'weekly' ? '˅' : '˄'}</Text>
      </Pressable>
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
