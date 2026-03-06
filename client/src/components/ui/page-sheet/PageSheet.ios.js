import React, { useCallback, useEffect, useRef } from 'react';
import { KeyboardAvoidingView, Modal, StyleSheet, View } from 'react-native';

export default function PageSheet({
  open,
  onOpenChange,
  children,
  contentContainerStyle,
  testID,
}) {
  const closeRequestedRef = useRef(false);

  useEffect(() => {
    if (open) {
      closeRequestedRef.current = false;
    }
  }, [open]);

  const requestClose = useCallback(() => {
    if (closeRequestedRef.current) {
      return;
    }

    closeRequestedRef.current = true;
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <Modal
      visible={open}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={requestClose}
      onDismiss={requestClose}
      testID={testID}
    >
      <View style={styles.container} testID={testID ? `${testID}-container` : undefined}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <View style={[styles.content, contentContainerStyle]}>
            {open ? children : null}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 20,
  },
  content: {
    flex: 1,
  },
});
