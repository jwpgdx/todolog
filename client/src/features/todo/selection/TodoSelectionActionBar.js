import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIONS = [
  { id: 'delete', label: '삭제' },
  { id: 'complete', label: '완료' },
  { id: 'favorite', label: '즐겨찾기' },
  { id: 'move', label: '이동' },
];

const ACTION_BAR_TOP_PADDING = 10;
const ACTION_BAR_SURFACE_MIN_HEIGHT = 48;
const ACTION_BAR_MIN_BOTTOM_PADDING = 10;
const ACTION_BAR_CONTENT_CLEARANCE = 8;

export function getTodoSelectionActionBarOccupiedInset(safeAreaBottom = 0) {
  return (
    ACTION_BAR_TOP_PADDING +
    ACTION_BAR_SURFACE_MIN_HEIGHT +
    Math.max(safeAreaBottom, ACTION_BAR_MIN_BOTTOM_PADDING)
  );
}

export function useTodoSelectionActionBarInset(extra = ACTION_BAR_CONTENT_CLEARANCE) {
  const insets = useSafeAreaInsets();
  return getTodoSelectionActionBarOccupiedInset(insets.bottom) + extra;
}

export default function TodoSelectionActionBar({
  selectedCount = 0,
  onDelete,
  onComplete,
  onFavorite,
  onMove,
}) {
  const insets = useSafeAreaInsets();
  const isDisabled = selectedCount <= 0;

  const handlers = {
    delete: onDelete,
    complete: onComplete,
    favorite: onFavorite,
    move: onMove,
  };

  return (
    <View
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, ACTION_BAR_MIN_BOTTOM_PADDING) },
      ]}
    >
      <View style={styles.surface}>
        {ACTIONS.map((action) => {
          const handler = handlers[action.id];
          const disabled = isDisabled || typeof handler !== 'function';

          return (
            <Pressable
              key={action.id}
              disabled={disabled}
              onPress={handler}
              style={[styles.action, disabled && styles.actionDisabled]}
            >
              <Text
                style={[
                  styles.actionText,
                  action.id === 'delete' && styles.destructiveText,
                  disabled && styles.actionTextDisabled,
                ]}
              >
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: ACTION_BAR_TOP_PADDING,
    backgroundColor: 'rgba(249, 250, 251, 0.94)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(148, 163, 184, 0.36)',
  },
  surface: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 18,
    borderCurve: 'continuous',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  action: {
    flex: 1,
    minHeight: ACTION_BAR_SURFACE_MIN_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionDisabled: {
    opacity: 0.38,
  },
  actionText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
  destructiveText: {
    color: '#DC2626',
  },
  actionTextDisabled: {
    color: '#9CA3AF',
  },
});
