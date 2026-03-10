import React from 'react';
import { Keyboard, StyleSheet, TouchableWithoutFeedback, View } from 'react-native';

/**
 * QuickContainer (iOS)
 * - 배경(backdrop)만 제공
 * - 실제 Bar는 QuickModeContent.ios에서 InputAccessoryView로 렌더링
 */
export default function QuickContainer({ children, onClose }) {
  const handleBackdropPress = () => {
    Keyboard.dismiss();
    onClose?.();
  };

  return (
    <View style={styles.fullScreenContainer}>
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreenContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
});

