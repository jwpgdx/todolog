import React, { useMemo } from 'react';
import { requireNativeViewManager } from 'expo-modules-core';

import type {
  ExpandChangeEvent,
  MenuActionEvent,
  NativeSettingsErrorEvent,
  NativeSettingsListProps,
  NavigateEvent,
  PressItemEvent,
  ToggleChangeEvent,
} from '../contracts';
import { estimateSettingsListHeight, extractNativePayload, serializeJson } from './shared';

type NativeSettingsListViewProps = {
  screenId?: string;
  sectionsJson: string;
  style?: NativeSettingsListProps['style'];
  onPressItem?: (event: unknown) => void;
  onToggleChange?: (event: unknown) => void;
  onMenuAction?: (event: unknown) => void;
  onNavigate?: (event: unknown) => void;
  onExpandChange?: (event: unknown) => void;
  onError?: (event: unknown) => void;
};

const NativeSettingsListView =
  requireNativeViewManager<NativeSettingsListViewProps>(
    'NativeSettings',
    'NativeSettingsListView'
  );

export default function NativeSettingsList({
  screenId,
  sections,
  style,
  onPressItem,
  onToggleChange,
  onMenuAction,
  onNavigate,
  onExpandChange,
  onError,
}: NativeSettingsListProps) {
  const sectionsJson = useMemo(() => serializeJson(sections), [sections]);
  const height = useMemo(() => estimateSettingsListHeight(sections), [sections]);

  return (
    <NativeSettingsListView
      screenId={screenId}
      sectionsJson={sectionsJson}
      style={[{ width: '100%', height }, style]}
      onPressItem={(event) => onPressItem?.(extractNativePayload<PressItemEvent>(event))}
      onToggleChange={(event) =>
        onToggleChange?.(extractNativePayload<ToggleChangeEvent>(event))
      }
      onMenuAction={(event) => onMenuAction?.(extractNativePayload<MenuActionEvent>(event))}
      onNavigate={(event) => onNavigate?.(extractNativePayload<NavigateEvent>(event))}
      onExpandChange={(event) =>
        onExpandChange?.(extractNativePayload<ExpandChangeEvent>(event))
      }
      onError={(event) =>
        onError?.(extractNativePayload<NativeSettingsErrorEvent>(event))
      }
    />
  );
}
