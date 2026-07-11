import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';

import type { NativeManagedListProps } from './contracts';
import type {
  ManagedListAction,
  ManagedListActionSource,
  ManagedListControl,
  ManagedListItem,
  ManagedListSection,
} from './types';
import { estimateManagedListHeight } from './shared';

function getSubLabelColor(tone: string | undefined) {
  switch (tone) {
    case 'muted':
      return '#9CA3AF';
    case 'accent':
      return '#2563EB';
    case 'warning':
      return '#D97706';
    default:
      return '#6B7280';
  }
}

function getItemActions(item: ManagedListItem): Array<ManagedListAction & { source: ManagedListActionSource }> {
  return [
    ...(item.menuActions ?? []).map((action) => ({ ...action, source: 'menu' as const })),
    ...(item.leadingSwipeActions ?? []).map((action) => ({
      ...action,
      source: 'leadingSwipe' as const,
    })),
    ...(item.trailingSwipeActions ?? []).map((action) => ({
      ...action,
      source: 'trailingSwipe' as const,
    })),
  ];
}

function getToggleGlyph(control: ManagedListControl) {
  if (control.id === 'favorite') {
    return control.value ? '★' : '☆';
  }

  return control.value ? '✓' : '';
}

function getToggleColor(control: ManagedListControl) {
  if (control.id === 'select') {
    return control.value ? '#2563EB' : '#9CA3AF';
  }

  if (control.id === 'favorite') {
    return control.value ? '#F59E0B' : '#9CA3AF';
  }

  return control.value ? '#2563EB' : '#9CA3AF';
}

export default function NativeManagedListFallback({
  listId,
  variant,
  sections,
  contentInsetBottom = 0,
  style,
  onPressItem,
  onAction,
  onControlAction,
}: NativeManagedListProps) {
  const height = Math.max(220, estimateManagedListHeight(sections, variant));
  const [activeActionSheet, setActiveActionSheet] = useState<{
    section: ManagedListSection;
    item: ManagedListItem;
    actions: Array<ManagedListAction & { source: ManagedListActionSource }>;
  } | null>(null);

  const emitControlAction = (
    section: ManagedListSection,
    item: ManagedListItem,
    control: ManagedListControl,
    source: 'leadingControl' | 'trailingControl'
  ) => {
    if (item.enabled === false || item.loading === true || control.disabled === true) {
      return;
    }

    onControlAction?.({
      listId,
      sectionId: section.id,
      itemId: item.id,
      controlId: control.id,
      controlKind: control.kind,
      value: !control.value,
      source,
    });
  };

  const emitAction = (
    section: ManagedListSection,
    item: ManagedListItem,
    action: ManagedListAction & { source: ManagedListActionSource }
  ) => {
    if (item.enabled === false || item.loading === true) {
      return;
    }

    onAction?.({
      listId,
      sectionId: section.id,
      itemId: item.id,
      actionId: action.id,
      source: action.source,
    });
  };

  const openActions = (section: ManagedListSection, item: ManagedListItem) => {
    const actions = getItemActions(item);

    if (actions.length === 0) {
      return;
    }

    setActiveActionSheet({
      section,
      item,
      actions,
    });
  };

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      style={[{ width: '100%' }, style]}
      contentContainerStyle={{
        minHeight: height + contentInsetBottom,
        gap: 18,
        paddingBottom: contentInsetBottom,
      }}
    >
      {sections.map((section) => (
        <View key={section.id}>
          {section.title ? (
            <Text
              style={{
                marginBottom: 8,
                marginLeft: 12,
                fontSize: 12,
                fontWeight: '700',
                color: '#6B7280',
                textTransform: 'uppercase',
              }}
            >
              {section.title}
            </Text>
          ) : null}

          <View
            style={{
              overflow: 'hidden',
              borderRadius: 18,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              backgroundColor: '#FFFFFF',
            }}
          >
            {section.items
              .filter((item) => item.hidden !== true)
              .map((item, index, visibleItems) => {
                if (item.kind === 'sectionDivider') {
                  return (
                    <View
                      key={`${section.id}:${item.id}`}
                      style={{
                        height: 14,
                        backgroundColor: '#EEF0F3',
                        borderBottomWidth: index === visibleItems.length - 1 ? 0 : 1,
                        borderBottomColor: '#E5E7EB',
                      }}
                    />
                  );
                }

                const itemActions = getItemActions(item);
                const isSectionHeader = item.kind === 'sectionHeader';

                return (
                  <View
                    key={`${section.id}:${item.id}`}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      paddingHorizontal: item.kind === 'sectionHeader' ? 12 : 16,
                      paddingVertical: item.kind === 'sectionHeader' ? 8 : 12,
                      borderBottomWidth: index === visibleItems.length - 1 ? 0 : 1,
                      borderBottomColor: '#E5E7EB',
                      opacity:
                        item.kind === 'sectionHeader'
                          ? 1
                          : item.enabled === false
                            ? 0.45
                            : 1,
                      backgroundColor:
                        item.selected === true
                          ? 'rgba(37, 99, 235, 0.08)'
                          : item.kind === 'sectionHeader' ? '#F9FAFB' : '#FFFFFF',
                    }}
                  >
                    {item.leadingControl?.kind === 'toggle' ? (
                      <Pressable
                        disabled={item.leadingControl.disabled === true}
                        onPress={() =>
                          emitControlAction(section, item, item.leadingControl, 'leadingControl')
                        }
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          borderWidth: 1,
                          borderColor: getToggleColor(item.leadingControl),
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: item.leadingControl.id === 'favorite' ? 18 : 14,
                            fontWeight: '800',
                            color: getToggleColor(item.leadingControl),
                          }}
                        >
                          {getToggleGlyph(item.leadingControl)}
                        </Text>
                      </Pressable>
                    ) : (item.kind === 'category' || isSectionHeader) && item.accentColor ? (
                      <View
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 6,
                          backgroundColor: item.accentColor,
                        }}
                      />
                    ) : null}

                    <Pressable
                      disabled={item.enabled === false || item.loading === true}
                      onPress={() => {
                        if (item.enabled === false || item.loading === true) {
                          return;
                        }

                        onPressItem?.({
                          listId,
                          sectionId: section.id,
                          itemId: item.id,
                          itemKind: item.kind,
                        });
                      }}
                      style={{
                        flex: 1,
                      }}
                    >
                      <View style={{ flex: 1, gap: 4 }}>
                        <View
                          style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <Text
                            style={{
                              flexShrink: 1,
                              fontSize: isSectionHeader ? 12 : 16,
                              fontWeight: isSectionHeader ? '700' : '700',
                              color: isSectionHeader ? '#6B7280' : '#111827',
                              textTransform: isSectionHeader ? 'uppercase' : 'none',
                            }}
                          >
                            {item.title}
                          </Text>
                          {isSectionHeader && item.metaText ? (
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: '700',
                                color: '#9CA3AF',
                              }}
                            >
                              {item.metaText}
                            </Text>
                          ) : null}
                        </View>
                        {item.kind === 'sectionHeader' ? null : item.subLabels?.length ? (
                          <View style={{ gap: 2 }}>
                            {item.subLabels.map((subLabel) => (
                              <Text
                                key={subLabel.id}
                                style={{
                                  fontSize: 12,
                                  color: getSubLabelColor(subLabel.tone),
                                }}
                              >
                                {subLabel.icon ? `${subLabel.icon} ` : ''}
                                {subLabel.text}
                              </Text>
                            ))}
                          </View>
                        ) : item.subtitle || item.metaText ? (
                          <Text
                            style={{
                              fontSize: 12,
                              color: '#6B7280',
                            }}
                          >
                            {item.subtitle || item.metaText}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>

                    {item.trailingControl?.kind === 'toggle' ? (
                      <Pressable
                        disabled={item.trailingControl.disabled === true}
                        onPress={() =>
                          emitControlAction(section, item, item.trailingControl, 'trailingControl')
                        }
                        style={{
                          minWidth: 32,
                          minHeight: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: item.trailingControl.id === 'favorite' ? 22 : 16,
                            fontWeight: '800',
                            color: getToggleColor(item.trailingControl),
                          }}
                        >
                          {getToggleGlyph(item.trailingControl)}
                        </Text>
                      </Pressable>
                    ) : null}

                    {isSectionHeader ? (
                      <Text
                        style={{
                          minWidth: 18,
                          textAlign: 'center',
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#9CA3AF',
                        }}
                      >
                        {item.collapsed ? '▾' : '▴'}
                      </Text>
                    ) : null}

                    {itemActions.length > 0 ? (
                      <Pressable
                        onPress={() => openActions(section, item)}
                        style={{
                          minWidth: 32,
                          minHeight: 32,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 18,
                            fontWeight: '800',
                            color: '#9CA3AF',
                          }}
                        >
                          ⋮
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
          </View>

          {section.footer ? (
            <Text
              style={{
                marginTop: 8,
                marginLeft: 12,
                marginRight: 12,
                fontSize: 12,
                lineHeight: 18,
                color: '#6B7280',
              }}
            >
              {section.footer}
            </Text>
          ) : null}
        </View>
      ))}

      <Modal
        visible={activeActionSheet !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setActiveActionSheet(null)}
      >
        <Pressable
          style={{
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: 'rgba(0,0,0,0.2)',
          }}
          onPress={() => setActiveActionSheet(null)}
        >
          <Pressable
            onPress={(event) => {
              event.stopPropagation();
            }}
            style={{
              margin: 12,
              overflow: 'hidden',
              borderRadius: 18,
              backgroundColor: '#FFFFFF',
            }}
          >
            <View
              style={{
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#E5E7EB',
              }}
            >
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  fontWeight: '700',
                  color: '#6B7280',
                }}
              >
                {activeActionSheet?.item.title ?? ''}
              </Text>
            </View>

            {activeActionSheet?.actions.map((action, index) => (
              <Pressable
                key={`${action.source}:${action.id}:${index}`}
                onPress={() => {
                  const current = activeActionSheet;
                  setActiveActionSheet(null);
                  if (current) {
                    emitAction(current.section, current.item, action);
                  }
                }}
                style={{
                  paddingHorizontal: 18,
                  paddingVertical: 15,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F3F4F6',
                }}
              >
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: action.role === 'destructive' ? '#DC2626' : '#111827',
                  }}
                >
                  {action.title}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setActiveActionSheet(null)}
              style={{
                paddingHorizontal: 18,
                paddingVertical: 15,
              }}
            >
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: '700',
                  color: '#6B7280',
                  textAlign: 'center',
                }}
              >
                취소
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}
