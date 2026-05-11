import React, { useCallback, useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import DetailContent from '../form/content/DetailContent';
import { useTodoFormLogic } from '../form/useTodoFormLogic';
import { useTodoFormV2Store } from '../../../store/todoFormV2Store';

function getSingleParam(value) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return typeof value === 'string' && value.length > 0 ? value : null;
}

export default function TodoFormDetailV2Screen() {
  const params = useLocalSearchParams();
  const draft = useTodoFormV2Store((state) => state.draft);
  const clearDraft = useTodoFormV2Store((state) => state.clearDraft);

  const handoffSource = getSingleParam(params.handoff);
  const focusTargetParam = getSingleParam(params.focusTarget);
  const hasQuickHandoff = handoffSource === 'quick' && !!draft?.formState;

  const initialFocusTarget = useMemo(
    () => focusTargetParam || draft?.focusTarget || null,
    [draft?.focusTarget, focusTargetParam]
  );

  const handleClose = useCallback(() => {
    clearDraft();

    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }

    router.replace('/(app)/(tabs)');
  }, [clearDraft]);

  const logic = useTodoFormLogic(
    hasQuickHandoff ? draft?.activeTodo || null : null,
    handleClose,
    true,
    hasQuickHandoff ? draft?.formState || null : null
  );

  useEffect(() => {
    return () => {
      clearDraft();
    };
  }, [clearDraft]);

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: 'white' }}>
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        <DetailContent
          logic={logic}
          onClose={handleClose}
          initialFocusTarget={initialFocusTarget}
        />
      </View>
    </SafeAreaView>
  );
}
