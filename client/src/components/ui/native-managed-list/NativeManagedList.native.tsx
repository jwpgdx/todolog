import React, { useEffect, useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { requireNativeViewManager } from 'expo-modules-core';

import type { NativeManagedListProps } from './contracts';
import {
  buildManagedActionEvent,
  buildManagedControlActionEvent,
  buildManagedPressEvent,
  buildManagedReorderCommitEvent,
  buildManagedReorderCommitEventFromNativeSections,
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
  contentInsetBottom?: number;
  style?: NativeManagedListProps['style'];
  onItemPress?: (event: unknown) => void;
  onMenuAction?: (event: unknown) => void;
  onDelete?: (event: unknown) => void;
  onReorder?: (event: unknown) => void;
  onToggleSwitch?: (event: unknown) => void;
  onSectionExpandRequest?: (event: unknown) => void;
};

const NativeListInteractionsView =
  requireNativeViewManager<NativeListInteractionsViewProps>('NativeListInteractions');

export default function NativeManagedList({
  listId,
  variant,
  sections,
  iosCategoryGestureMode,
  contentInsetBottom = 0,
  style,
  onPressItem,
  onAction,
  onControlAction,
  onReorderCommit,
  onSectionExpandRequest,
  onError,
}: NativeManagedListProps) {
  const warnings = useMemo(
    () => validateManagedListSections(variant, sections),
    [sections, variant]
  );
  const inferredHasReorderableTodoItems = useMemo(
    () =>
      (variant === 'todo' || variant === 'favoriteTodo') &&
      sections.some((section) =>
        section.items.some((item) => item.kind === 'todo' && item.reorderable === true)
      ),
    [sections, variant]
  );
  const resolvedIOSCategoryGestureMode = useMemo(() => {
    if (iosCategoryGestureMode) {
      return iosCategoryGestureMode;
    }

    if (variant === 'category' || inferredHasReorderableTodoItems) {
      return 'custom-lifted';
    }

    return 'system';
  }, [inferredHasReorderableTodoItems, iosCategoryGestureMode, variant]);
  const usesNativeView =
    (Platform.OS === 'ios' && (variant === 'category' || variant === 'todo')) ||
    (Platform.OS === 'android' && variant === 'category');
  const legacySections = useMemo(
    () =>
      !usesNativeView
        ? []
        : mapManagedSectionsToLegacyNativeSections(variant, sections),
    [sections, usesNativeView, variant]
  );
  const sectionsJson = useMemo(() => serializeJson(legacySections), [legacySections]);
  const height = useMemo(
    () => Math.max(220, estimateManagedListHeight(sections, variant)),
    [sections, variant]
  );
  const resolvedContainerStyle = useMemo(() => {
    if (variant === 'todo') {
      return [styles.todoContainer, style];
    }

    return [styles.measuredContainer, { height }, style];
  }, [height, style, variant]);

  useEffect(() => {
    warnings.forEach((warning) => {
      console.warn(`[NativeManagedList] ${warning}`);
    });
  }, [warnings]);

  if (!usesNativeView) {
    return (
      <NativeManagedListFallback
        listId={listId}
        variant={variant}
        style={style}
        sections={sections}
        contentInsetBottom={contentInsetBottom}
        onPressItem={onPressItem}
        onAction={onAction}
        onControlAction={onControlAction}
        onReorderCommit={onReorderCommit}
        onSectionExpandRequest={onSectionExpandRequest}
        onError={onError}
      />
    );
  }

  return (
    <NativeListInteractionsView
      sectionsJson={sectionsJson}
      iosCategoryGestureMode={resolvedIOSCategoryGestureMode}
      contentInsetBottom={contentInsetBottom}
      style={resolvedContainerStyle}
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
        const payload = extractNativePayload<{
          orderedIds?: string[];
          movedItemId?: string;
          fromSectionId?: string;
          toSectionId?: string;
          sections?: Array<{
            sectionId?: string;
            orderedItemIds?: string[];
          }>;
        }>(event);

        if (Array.isArray(payload.sections) && payload.sections.length > 0) {
          onReorderCommit?.(
            buildManagedReorderCommitEventFromNativeSections(
              listId,
              sections,
              payload
            )
          );
          return;
        }

        if (Array.isArray(payload.orderedIds)) {
          onReorderCommit?.(
            buildManagedReorderCommitEvent(listId, sections, payload.orderedIds)
          );
        }
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
      onSectionExpandRequest={(event) => {
        const payload = extractNativePayload<{ sectionId?: string }>(event);
        if (!payload.sectionId) {
          return;
        }

        onSectionExpandRequest?.({
          listId,
          sectionId: payload.sectionId,
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  measuredContainer: {
    width: '100%',
  },
  todoContainer: {
    width: '100%',
    minHeight: 220,
    flex: 1,
  },
});
