import React, { useEffect, useMemo } from 'react';
import { Platform, Text, View } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

import type {
  NativeManagedListErrorEvent,
  NativeManagedListProps,
} from './contracts';
import {
  buildManagedActionEvent,
  buildManagedControlActionEvent,
  buildManagedPressEvent,
  buildManagedReorderCommitEvent,
  estimateManagedListHeight,
  extractNativePayload,
  mapManagedSectionsToLegacyNativeSections,
  serializeJson,
  validateManagedListSections,
} from './shared';
import NativeManagedListFallback from './NativeManagedListFallback';

type NativeListInteractionsViewProps = {
  sectionsJson: string;
  iosCategoryGestureMode?: string;
  style?: NativeManagedListProps['style'];
  onItemPress?: (event: unknown) => void;
  onMenuAction?: (event: unknown) => void;
  onDelete?: (event: unknown) => void;
  onReorder?: (event: unknown) => void;
  onToggleSwitch?: (event: unknown) => void;
};

const NativeListInteractionsView =
  requireNativeViewManager<NativeListInteractionsViewProps>('NativeListInteractions');

function UnsupportedNativeManagedList({
  variant,
  style,
  onError,
  sections,
  onPressItem,
}: Pick<
  NativeManagedListProps,
  'style' | 'onError' | 'variant' | 'sections' | 'onPressItem'
>) {
  const message = `NativeManagedList v0 currently supports native variant="category" and iOS-only "todo". Received "${variant}", so JS fallback rendering is used.`;

  useEffect(() => {
    onError?.({
      code: 'UNSUPPORTED_VARIANT',
      message,
    } satisfies NativeManagedListErrorEvent);
  }, [message, onError]);

  return (
    <View style={{ width: '100%', gap: 12 }}>
      <View
        style={{
          width: '100%',
          minHeight: 108,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: '#D1D5DB',
          backgroundColor: '#FFFFFF',
          padding: 16,
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontSize: 16,
            fontWeight: '800',
            color: '#111827',
          }}
        >
          NativeManagedList
        </Text>
        <Text
          style={{
            marginTop: 8,
            color: '#6B7280',
            lineHeight: 20,
          }}
        >
          {message}
        </Text>
      </View>

      <NativeManagedListFallback
        variant={variant}
        sections={sections}
        style={style}
        onPressItem={onPressItem}
      />
    </View>
  );
}

export default function NativeManagedList({
  listId,
  variant,
  sections,
  style,
  onPressItem,
  onAction,
  onControlAction,
  onReorderCommit,
  onError,
}: NativeManagedListProps) {
  const warnings = useMemo(
    () => validateManagedListSections(variant, sections),
    [sections, variant]
  );
  const isUnsupportedVariant =
    Platform.OS !== 'ios' || (variant !== 'category' && variant !== 'todo');
  const legacySections = useMemo(
    () =>
      isUnsupportedVariant
        ? []
        : mapManagedSectionsToLegacyNativeSections(variant, sections),
    [isUnsupportedVariant, sections, variant]
  );
  const sectionsJson = useMemo(() => serializeJson(legacySections), [legacySections]);
  const height = useMemo(
    () => Math.max(220, estimateManagedListHeight(sections, variant)),
    [sections, variant]
  );

  useEffect(() => {
    warnings.forEach((warning) => {
      console.warn(`[NativeManagedList] ${warning}`);
    });
  }, [warnings]);

  if (isUnsupportedVariant) {
    return (
      <UnsupportedNativeManagedList
        variant={variant}
        style={style}
        onError={onError}
        sections={sections}
        onPressItem={onPressItem}
      />
    );
  }

  return (
    <NativeListInteractionsView
      sectionsJson={sectionsJson}
      iosCategoryGestureMode={variant === 'category' ? 'custom-lifted' : 'system'}
      style={[{ width: '100%', height }, style]}
      onItemPress={(event) => {
        const payload = extractNativePayload<{ itemId?: string }>(event);
        if (!payload.itemId) {
          return;
        }

        const pressEvent = buildManagedPressEvent(listId, sections, payload.itemId);
        if (pressEvent) {
          onPressItem?.(pressEvent);
        }
      }}
      onMenuAction={(event) => {
        const payload = extractNativePayload<{ itemId?: string; action?: string }>(event);
        if (!payload.itemId || !payload.action) {
          return;
        }

        const actionEvent = buildManagedActionEvent(
          listId,
          sections,
          payload.itemId,
          payload.action,
          'menu'
        );

        if (actionEvent) {
          onAction?.(actionEvent);
        }
      }}
      onDelete={(event) => {
        const payload = extractNativePayload<{ itemId?: string }>(event);
        if (!payload.itemId) {
          return;
        }

        const actionEvent = buildManagedActionEvent(
          listId,
          sections,
          payload.itemId,
          'delete',
          'trailingSwipe'
        );

        if (actionEvent) {
          onAction?.(actionEvent);
        }
      }}
      onReorder={(event) => {
        const payload = extractNativePayload<{ orderedIds?: string[] }>(event);
        if (!Array.isArray(payload.orderedIds)) {
          return;
        }

        onReorderCommit?.(
          buildManagedReorderCommitEvent(listId, sections, payload.orderedIds)
        );
      }}
      onToggleSwitch={(event) => {
        const payload = extractNativePayload<{
          itemId?: string;
          nextValue?: boolean;
          controlId?: string;
          source?: 'leadingControl' | 'trailingControl';
        }>(event);

        if (!payload.itemId || typeof payload.nextValue !== 'boolean') {
          return;
        }

        const controlEvent = buildManagedControlActionEvent(
          listId,
          sections,
          payload.itemId,
          payload.nextValue,
          {
            controlId: payload.controlId,
            source: payload.source,
          }
        );

        if (controlEvent) {
          onControlAction?.(controlEvent);
        }
      }}
    />
  );
}
