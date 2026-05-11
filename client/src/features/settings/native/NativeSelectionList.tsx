import React, { useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';

import type {
  NativeSelectionListProps,
  PressItemEvent,
  SelectionCommitEvent,
  NativeSettingsErrorEvent,
} from '../contracts';
import { estimateSelectionListHeight, extractNativePayload, serializeJson } from './shared';

type NativeSelectionListViewProps = {
  screenId: string;
  payloadJson: string;
  style?: NativeSelectionListProps['style'];
  onPressItem?: (event: unknown) => void;
  onSelectionCommit?: (event: unknown) => void;
  onError?: (event: unknown) => void;
};

const NativeSelectionListView = requireNativeViewManager<NativeSelectionListViewProps>(
  'NativeSettings',
  'NativeSelectionListView'
);

export default function NativeSelectionList({
  style,
  onPressItem,
  onSelectionCommit,
  onError,
  ...model
}: NativeSelectionListProps) {
  const payloadJson = useMemo(() => serializeJson(model), [model]);
  const height = useMemo(() => estimateSelectionListHeight(model), [model]);

  return (
    <NativeSelectionListView
      screenId={model.screenId}
      payloadJson={payloadJson}
      style={[{ width: '100%', height }, style]}
      onPressItem={(event) => onPressItem?.(extractNativePayload<PressItemEvent>(event))}
      onSelectionCommit={(event) =>
        onSelectionCommit?.(extractNativePayload<SelectionCommitEvent>(event))
      }
      onError={(event) =>
        onError?.(extractNativePayload<NativeSettingsErrorEvent>(event))
      }
    />
  );
}
