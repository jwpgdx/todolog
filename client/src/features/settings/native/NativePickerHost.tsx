import React, { useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';

import type {
  NativePickerHostProps,
  NativeSettingsErrorEvent,
} from '../contracts';
import { estimatePickerHostHeight, extractNativePayload, serializeJson } from './shared';

type NativePickerHostViewProps = {
  screenId: string;
  payloadJson: string;
  style?: NativePickerHostProps['style'];
  onError?: (event: unknown) => void;
};

const NativePickerHostView = requireNativeViewManager<NativePickerHostViewProps>(
  'NativeSettings',
  'NativePickerHostView'
);

export default function NativePickerHost({
  style,
  onError,
  ...model
}: NativePickerHostProps) {
  const payloadJson = useMemo(() => serializeJson(model), [model]);
  const height = useMemo(() => estimatePickerHostHeight(model), [model]);

  return (
    <NativePickerHostView
      screenId={model.screenId}
      payloadJson={payloadJson}
      style={[{ width: '100%', height }, style]}
      onError={(event) =>
        onError?.(extractNativePayload<NativeSettingsErrorEvent>(event))
      }
    />
  );
}
