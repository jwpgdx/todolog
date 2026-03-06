import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { NavigationRouteContext } from '@react-navigation/native';
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

function hasNestedHistory(state) {
  if (!state || !Array.isArray(state.routes) || state.routes.length === 0) {
    return false;
  }

  const currentIndex = typeof state.index === 'number' ? state.index : state.routes.length - 1;
  if (currentIndex > 0) {
    return true;
  }

  const currentRoute = state.routes[currentIndex];
  return hasNestedHistory(currentRoute?.state);
}

export default function PageSheet({
  open,
  onOpenChange,
  children,
  snapPoints,
  enablePanDownToClose = true,
  scroll = 'scrollview',
  contentContainerStyle,
  testID,
}) {
  const route = useContext(NavigationRouteContext);
  const sheetRef = useRef(null);
  const wasOpenRef = useRef(open);
  const closeRequestedRef = useRef(false);
  const [sessionKey, setSessionKey] = useState(open ? 1 : 0);

  const resolvedSnapPoints = useMemo(
    () => (Array.isArray(snapPoints) && snapPoints.length > 0 ? snapPoints : ['90%']),
    [snapPoints]
  );
  const useScrollView = scroll !== 'view';

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

  useEffect(() => {
    const wasOpen = wasOpenRef.current;

    if (open && !wasOpen) {
      setSessionKey((prev) => prev + 1);
      requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
    } else if (open) {
      requestAnimationFrame(() => {
        sheetRef.current?.present();
      });
    } else if (!open && wasOpen) {
      sheetRef.current?.dismiss();
    }

    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (hasNestedHistory(route?.state)) {
        return false;
      }

      requestClose();
      return true;
    });

    return () => {
      subscription.remove();
    };
  }, [open, requestClose, route?.state]);

  const handleDismiss = useCallback(() => {
    requestClose();
  }, [requestClose]);

  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    []
  );

  const sessionContent = (
    <View key={sessionKey} style={[styles.sessionBoundary, !useScrollView && contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={resolvedSnapPoints}
      enableDynamicSizing={false}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      enablePanDownToClose={enablePanDownToClose}
      backdropComponent={renderBackdrop}
      onDismiss={handleDismiss}
      testID={testID}
    >
      {useScrollView ? (
        <BottomSheetScrollView
          style={styles.scrollContainer}
          contentContainerStyle={[styles.scrollContentContainer, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
        >
          {sessionContent}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView style={styles.viewContainer}>
          {sessionContent}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContentContainer: {
    paddingBottom: 24,
  },
  viewContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  sessionBoundary: {
    flexGrow: 1,
  },
});
