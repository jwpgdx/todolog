import React, { useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';

import type {
  MenuActionEvent,
  NativeCategoryManagerProps,
  NativeSettingsErrorEvent,
  PressItemEvent,
  ReorderCommitEvent,
  RequestDeleteEvent,
  SwipeActionEvent,
} from '../contracts';
import { estimateSettingsListHeight, extractNativePayload, serializeJson } from './shared';

type NativeCategoryManagerViewProps = {
  screenId?: string;
  sectionsJson: string;
  style?: NativeCategoryManagerProps['style'];
  onPressItem?: (event: unknown) => void;
  onMenuAction?: (event: unknown) => void;
  onReorderCommit?: (event: unknown) => void;
  onSwipeAction?: (event: unknown) => void;
  onRequestDelete?: (event: unknown) => void;
  onError?: (event: unknown) => void;
};

const NativeCategoryManagerView =
  requireNativeViewManager<NativeCategoryManagerViewProps>(
    'NativeSettings',
    'NativeCategoryManagerView'
  );

export default function NativeCategoryManager({
  screenId,
  sections,
  style,
  onPressItem,
  onMenuAction,
  onReorderCommit,
  onSwipeAction,
  onRequestDelete,
  onError,
}: NativeCategoryManagerProps) {
  const sectionsJson = useMemo(() => serializeJson(sections), [sections]);
  const height = useMemo(
    () => Math.max(220, estimateSettingsListHeight(sections)),
    [sections]
  );

  return (
    <NativeCategoryManagerView
      screenId={screenId}
      sectionsJson={sectionsJson}
      style={[{ width: '100%', height }, style]}
      onPressItem={(event) => onPressItem?.(extractNativePayload<PressItemEvent>(event))}
      onMenuAction={(event) => onMenuAction?.(extractNativePayload<MenuActionEvent>(event))}
      onReorderCommit={(event) =>
        onReorderCommit?.(extractNativePayload<ReorderCommitEvent>(event))
      }
      onSwipeAction={(event) =>
        onSwipeAction?.(extractNativePayload<SwipeActionEvent>(event))
      }
      onRequestDelete={(event) =>
        onRequestDelete?.(extractNativePayload<RequestDeleteEvent>(event))
      }
      onError={(event) =>
        onError?.(extractNativePayload<NativeSettingsErrorEvent>(event))
      }
    />
  );
}
