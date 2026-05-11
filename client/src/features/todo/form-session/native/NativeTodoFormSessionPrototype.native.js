import React from 'react';
import { StyleSheet } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

const NativeTodoFormSessionView = requireNativeViewManager('NativeTodoFormSession');

function extractNativePayload(event) {
  return event?.nativeEvent ?? event ?? {};
}

export default function NativeTodoFormSessionPrototype({
  visible,
  instanceKey = 0,
  detailPlaceholderText = 'Detail content pending in the other Codex session.',
  onDismiss,
  onStateSettled,
}) {
  if (!visible) {
    return null;
  }

  return (
    <NativeTodoFormSessionView
      key={instanceKey}
      style={styles.fill}
      detailPlaceholderText={detailPlaceholderText}
      onDismiss={(event) => onDismiss?.(extractNativePayload(event))}
      onStateSettled={(event) => onStateSettled?.(extractNativePayload(event))}
    />
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
});
