import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useActionSheet } from '@expo/react-native-action-sheet';

import type {
  NativeCategoryManagerProps,
  NativePickerHostProps,
  NativeSelectionListProps,
  NativeSettingsListProps,
} from '../contracts';
import type {
  InteractiveCategoryItem,
  MenuActionSpec,
  SelectionOption,
  SettingsItem,
  SettingsSection,
  SwipeActionSpec,
} from '../types';

const IOS_GROUP_BACKGROUND = '#FFFFFF';
const ANDROID_GROUP_BACKGROUND = '#FFFFFF';

function nowStamp(): string {
  return new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function chevronText(expanded?: boolean): string {
  if (typeof expanded === 'boolean') {
    return expanded ? '⌃' : '⌄';
  }
  return '›';
}

function resolveSelectedLabel(
  options: SelectionOption[],
  selectedOptionId?: string,
  fallback?: string
): string | undefined {
  if (selectedOptionId) {
    const option = options.find((entry) => entry.id === selectedOptionId);
    if (option) {
      return option.label;
    }
  }
  return fallback;
}

function useChoiceSheet() {
  const { showActionSheetWithOptions } = useActionSheet();

  return (
    title: string,
    options: Array<{ id: string; title: string; role?: 'normal' | 'destructive' }>,
    onSelect: (selectedId: string) => void
  ) => {
    const labels = options.map((option) => option.title);
    const destructiveButtonIndex = options.findIndex(
      (option) => option.role === 'destructive'
    );

    showActionSheetWithOptions(
      {
        title,
        options: [...labels, '취소'],
        cancelButtonIndex: labels.length,
        destructiveButtonIndex:
          destructiveButtonIndex >= 0 ? destructiveButtonIndex : undefined,
      },
      (buttonIndex) => {
        if (buttonIndex == null || buttonIndex < 0 || buttonIndex >= options.length) {
          return;
        }
        onSelect(options[buttonIndex].id);
      }
    );
  };
}

function getVisibleSectionItems(section: SettingsSection): SettingsItem[] {
  const expandedContentIds = new Set<string>();
  const activeToggleChildren = new Set<string>();

  section.items.forEach((item) => {
    if (item.kind === 'expandableParent' && item.expanded) {
      expandedContentIds.add(item.embeddedContentId);
    }
    if (item.kind === 'toggle' && item.value && item.childVisibilityKey) {
      activeToggleChildren.add(item.childVisibilityKey);
    }
  });

  return section.items.filter((item) => {
    if (item.kind !== 'embeddedContent') {
      return true;
    }
    return expandedContentIds.has(item.id) || activeToggleChildren.has(item.id);
  });
}

function SectionHeader({
  title,
  grouped,
}: {
  title?: string;
  grouped: boolean;
}) {
  if (!title) {
    return null;
  }

  return (
    <Text
      style={{
        marginTop: grouped ? 14 : 12,
        marginBottom: 8,
        marginLeft: grouped && Platform.OS === 'ios' ? 12 : 2,
        color: '#6B7280',
        fontSize: 12,
        fontWeight: '800',
        textTransform: 'uppercase',
      }}
    >
      {title}
    </Text>
  );
}

function SectionFooter({
  footer,
  grouped,
}: {
  footer?: string;
  grouped: boolean;
}) {
  if (!footer) {
    return null;
  }

  return (
    <Text
      style={{
        marginTop: 8,
        marginLeft: grouped && Platform.OS === 'ios' ? 12 : 2,
        marginRight: 8,
        color: '#6B7280',
        fontSize: 12,
        lineHeight: 18,
      }}
    >
      {footer}
    </Text>
  );
}

function SectionContainer({
  children,
  grouped,
}: {
  children: React.ReactNode;
  grouped: boolean;
}) {
  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: grouped && Platform.OS === 'ios' ? 16 : 14,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: grouped ? IOS_GROUP_BACKGROUND : ANDROID_GROUP_BACKGROUND,
      }}
    >
      {children}
    </View>
  );
}

function RowDivider({ inset = 16 }: { inset?: number }) {
  return (
    <View
      style={{
        height: 1,
        marginLeft: inset,
        backgroundColor: '#E5E7EB',
      }}
    />
  );
}

function renderEmbeddedContentSummary(item: Extract<SettingsItem, { kind: 'embeddedContent' }>) {
  const lines = [`type: ${item.contentType}`];
  if (item.temporalConfig?.mode) {
    lines.push(`mode: ${item.temporalConfig.mode}`);
  }
  if (item.temporalConfig?.presentation) {
    lines.push(`presentation: ${item.temporalConfig.presentation}`);
  }
  if (item.temporalConfig?.timeZone) {
    lines.push(`timeZone: ${item.temporalConfig.timeZone}`);
  }
  return lines.join(' · ');
}

export function SettingsListPreview({
  sections,
  onPressItem,
  onToggleChange,
  onMenuAction,
  onNavigate,
  onExpandChange,
}: NativeSettingsListProps) {
  const openSheet = useChoiceSheet();

  const grouped = Platform.OS === 'ios';

  return (
    <View style={{ gap: 12 }}>
      {sections.map((section) => {
        const visibleItems = getVisibleSectionItems(section);
        return (
          <View key={section.id}>
            <SectionHeader title={section.title} grouped={grouped} />
            <SectionContainer grouped={grouped}>
              {visibleItems.map((item, index) => {
                const disabled = item.enabled === false || item.loading === true;
                const isLast = index === visibleItems.length - 1;
                const commonTextColor =
                  item.kind === 'destructiveAction' ? '#DC2626' : '#111827';

                const firePress = () => {
                  onPressItem?.({ itemId: item.id, kind: item.kind });
                };

                const handlePress = () => {
                  if (disabled) {
                    return;
                  }

                  switch (item.kind) {
                    case 'navigationValue':
                      firePress();
                      onNavigate?.({ itemId: item.id, destination: item.destination });
                      break;
                    case 'selectionNavigation':
                      firePress();
                      onNavigate?.({
                        itemId: item.id,
                        destination: item.selectionScreenId,
                      });
                      break;
                    case 'toggle':
                      onToggleChange?.({ itemId: item.id, value: !item.value });
                      break;
                    case 'menu':
                      openSheet(
                        item.title,
                        item.options.map((option) => ({
                          id: option.id,
                          title: option.label,
                        })),
                        (selectedId) => {
                          onMenuAction?.({ itemId: item.id, actionId: selectedId });
                        }
                      );
                      break;
                    case 'expandableParent':
                      onExpandChange?.({
                        itemId: item.id,
                        expanded: !item.expanded,
                      });
                      break;
                    case 'action':
                    case 'destructiveAction':
                      firePress();
                      break;
                    default:
                      firePress();
                      break;
                  }
                };

                let trailing: React.ReactNode = null;

                if (item.kind === 'navigationValue') {
                  trailing = (
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>
                      {(item.value ? `${item.value} ` : '') + chevronText()}
                    </Text>
                  );
                }

                if (item.kind === 'selectionNavigation') {
                  trailing = (
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>
                      {(item.value ? `${item.value} ` : '') + chevronText()}
                    </Text>
                  );
                }

                if (item.kind === 'staticValue') {
                  trailing = (
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>
                      {item.value ?? '-'}
                    </Text>
                  );
                }

                if (item.kind === 'toggle') {
                  trailing = (
                    <Switch
                      value={item.value}
                      onValueChange={(nextValue) =>
                        onToggleChange?.({ itemId: item.id, value: nextValue })
                      }
                    />
                  );
                }

                if (item.kind === 'menu') {
                  trailing = (
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>
                      {(resolveSelectedLabel(item.options, item.selectedOptionId, item.value) ?? '선택') +
                        ' ' +
                        chevronText(false)}
                    </Text>
                  );
                }

                if (item.kind === 'expandableParent') {
                  trailing = (
                    <Text style={{ color: '#6B7280', fontSize: 14 }}>
                      {(item.value ? `${item.value} ` : '') + chevronText(item.expanded)}
                    </Text>
                  );
                }

                if (item.kind === 'embeddedContent') {
                  return (
                    <View key={item.id}>
                      <View
                        style={{
                          paddingHorizontal: 16,
                          paddingVertical: 14,
                          backgroundColor: Platform.OS === 'ios' ? '#F9FAFB' : '#F3F4F6',
                        }}
                      >
                        <Text style={{ color: '#111827', fontWeight: '700' }}>
                          Embedded Content
                        </Text>
                        <Text style={{ marginTop: 4, color: '#6B7280', lineHeight: 18 }}>
                          {renderEmbeddedContentSummary(item)}
                        </Text>
                      </View>
                      {!isLast ? <RowDivider inset={16} /> : null}
                    </View>
                  );
                }

                return (
                  <View key={item.id}>
                    <Pressable
                      onPress={handlePress}
                      disabled={disabled}
                      style={{
                        minHeight: item.kind === 'toggle' ? 68 : 58,
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        opacity: disabled ? 0.45 : 1,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: commonTextColor,
                              fontSize: 16,
                              fontWeight: item.kind === 'action' ? '800' : '600',
                            }}
                          >
                            {item.title}
                          </Text>
                          {'subtitle' in item && item.subtitle ? (
                            <Text
                              style={{
                                marginTop: 4,
                                color: '#6B7280',
                                lineHeight: 18,
                              }}
                            >
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>
                        {trailing}
                      </View>
                    </Pressable>
                    {!isLast ? <RowDivider inset={16} /> : null}
                  </View>
                );
              })}
            </SectionContainer>
            <SectionFooter footer={section.footer} grouped={grouped} />
          </View>
        );
      })}
    </View>
  );
}

export function SelectionListPreview({
  title,
  subtitle,
  options,
  selectedIds,
  searchEnabled,
  allowsMultiple,
  emptyStateText,
  screenId,
  onSelectionCommit,
  onPressItem,
}: NativeSelectionListProps) {
  const [query, setQuery] = useState('');

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return options;
    }
    return options.filter((option) => {
      const candidates = [option.label, option.subtitle, ...(option.keywords ?? [])];
      return candidates.some((candidate) =>
        candidate?.toLowerCase().includes(normalized)
      );
    });
  }, [options, query]);

  return (
    <View
      style={{
        overflow: 'hidden',
        borderRadius: Platform.OS === 'ios' ? 16 : 14,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
      }}
    >
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: subtitle ? 10 : 14 }}>
        <Text style={{ color: '#111827', fontSize: 18, fontWeight: '800' }}>{title}</Text>
        {subtitle ? (
          <Text style={{ marginTop: 6, color: '#6B7280', lineHeight: 18 }}>{subtitle}</Text>
        ) : null}
      </View>

      {searchEnabled ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="검색"
            style={{
              borderRadius: 12,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              backgroundColor: '#F9FAFB',
              paddingHorizontal: 14,
              paddingVertical: 12,
            }}
          />
        </View>
      ) : null}

      {filteredOptions.length === 0 ? (
        <View style={{ paddingHorizontal: 16, paddingBottom: 18 }}>
          <Text style={{ color: '#6B7280' }}>{emptyStateText ?? '검색 결과가 없습니다.'}</Text>
        </View>
      ) : null}

      {filteredOptions.map((option, index) => {
        const selected = selectedIds.includes(option.id);

        return (
          <View key={option.id}>
            <Pressable
              onPress={() => {
                const nextSelectedIds = allowsMultiple
                  ? selected
                    ? selectedIds.filter((selectedId) => selectedId !== option.id)
                    : [...selectedIds, option.id]
                  : [option.id];

                onPressItem?.({ itemId: option.id, kind: 'selectionOption' });
                onSelectionCommit?.({
                  screenId,
                  selectedIds: nextSelectedIds,
                });
              }}
              style={{
                minHeight: 56,
                paddingHorizontal: 16,
                paddingVertical: 14,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>
                  {option.label}
                </Text>
                {option.subtitle ? (
                  <Text style={{ marginTop: 4, color: '#6B7280', lineHeight: 18 }}>
                    {option.subtitle}
                  </Text>
                ) : null}
              </View>
              <Text style={{ color: selected ? '#16A34A' : '#D1D5DB', fontSize: 18 }}>
                {selected ? '✓' : '○'}
              </Text>
            </Pressable>
            {index !== filteredOptions.length - 1 ? <RowDivider inset={16} /> : null}
          </View>
        );
      })}
    </View>
  );
}

function buildCategoryMenuItems(
  item: InteractiveCategoryItem
): Array<{ id: string; title: string; role?: 'normal' | 'destructive' }> {
  return (item.menuActions ?? []).map((entry: MenuActionSpec) => ({
    id: entry.id,
    title: entry.title,
    role: entry.role,
  }));
}

function moveCategoryIds(
  items: InteractiveCategoryItem[],
  targetId: string,
  direction: 'up' | 'down'
): string[] {
  const movableIds = items
    .filter((item) => item.reorderable && !item.pinned)
    .map((item) => item.id);
  const currentIndex = movableIds.indexOf(targetId);

  if (currentIndex < 0) {
    return items.map((item) => item.id);
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= movableIds.length) {
    return items.map((item) => item.id);
  }

  const reordered = [...movableIds];
  const [moved] = reordered.splice(currentIndex, 1);
  reordered.splice(nextIndex, 0, moved);

  let cursor = 0;
  return items.map((item) => {
    if (item.reorderable && !item.pinned) {
      const nextId = reordered[cursor];
      cursor += 1;
      return nextId;
    }
    return item.id;
  });
}

export function CategoryManagerPreview({
  sections,
  onPressItem,
  onMenuAction,
  onReorderCommit,
  onSwipeAction,
  onRequestDelete,
}: NativeCategoryManagerProps) {
  const openSheet = useChoiceSheet();

  return (
    <View style={{ gap: 12 }}>
      {sections.map((section) => {
        const items = section.items.filter(
          (item): item is InteractiveCategoryItem => item.kind === 'interactiveCategory'
        );

        return (
          <View key={section.id}>
            <SectionHeader title={section.title} grouped={false} />
            <SectionContainer grouped={false}>
              {items.map((item, index) => {
                const isLast = index === items.length - 1;
                const platformMetadata =
                  Platform.OS === 'ios' ? item.subtitle : undefined;
                const quickActions = item.swipeActions ?? [];

                return (
                  <View key={item.id}>
                    <Pressable
                      onPress={() =>
                        onPressItem?.({ itemId: item.id, kind: item.kind })
                      }
                      onLongPress={() => {
                        const menuItems = buildCategoryMenuItems(item);
                        if (menuItems.length === 0) {
                          return;
                        }
                        openSheet(item.title, menuItems, (selectedId) => {
                          onMenuAction?.({ itemId: item.id, actionId: selectedId });
                        });
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 14,
                        minHeight: 68,
                      }}
                    >
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ color: '#111827', fontSize: 16, fontWeight: '700' }}>
                              {item.title}
                            </Text>
                            {item.pinned ? (
                              <Text
                                style={{
                                  borderRadius: 999,
                                  backgroundColor: '#E5E7EB',
                                  color: '#4B5563',
                                  fontSize: 11,
                                  fontWeight: '800',
                                  overflow: 'hidden',
                                  paddingHorizontal: 8,
                                  paddingVertical: 3,
                                }}
                              >
                                PINNED
                              </Text>
                            ) : null}
                          </View>
                          {item.subtitle && Platform.OS !== 'ios' ? (
                            <Text style={{ marginTop: 4, color: '#6B7280', lineHeight: 18 }}>
                              {item.subtitle}
                            </Text>
                          ) : null}
                        </View>

                        <View style={{ alignItems: 'flex-end', gap: 8 }}>
                          {platformMetadata ? (
                            <Text style={{ color: '#6B7280', fontSize: 13 }}>
                              {platformMetadata} ›
                            </Text>
                          ) : null}

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            {item.reorderable && !item.pinned ? (
                              <>
                                <Pressable
                                  onPress={() =>
                                    onReorderCommit?.({
                                      orderedItemIds: moveCategoryIds(items, item.id, 'up'),
                                    })
                                  }
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: '#E5E7EB',
                                  }}
                                >
                                  <Text style={{ fontWeight: '800', color: '#111827' }}>↑</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() =>
                                    onReorderCommit?.({
                                      orderedItemIds: moveCategoryIds(items, item.id, 'down'),
                                    })
                                  }
                                  style={{
                                    paddingHorizontal: 8,
                                    paddingVertical: 6,
                                    borderRadius: 8,
                                    backgroundColor: '#E5E7EB',
                                  }}
                                >
                                  <Text style={{ fontWeight: '800', color: '#111827' }}>↓</Text>
                                </Pressable>
                              </>
                            ) : null}

                            <Pressable
                              onPress={() => {
                                const menuItems = buildCategoryMenuItems(item);
                                if (menuItems.length === 0) {
                                  return;
                                }
                                openSheet(item.title, menuItems, (selectedId) => {
                                  onMenuAction?.({ itemId: item.id, actionId: selectedId });
                                });
                              }}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 6,
                                borderRadius: 8,
                                backgroundColor: '#E5E7EB',
                              }}
                            >
                              <Text style={{ fontWeight: '800', color: '#111827' }}>…</Text>
                            </Pressable>
                          </View>
                        </View>
                      </View>

                      {quickActions.length > 0 ? (
                        <View style={{ marginTop: 12, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                          {quickActions.map((action: SwipeActionSpec) => (
                            <Pressable
                              key={action.id}
                              onPress={() => {
                                if (action.id === 'delete') {
                                  onRequestDelete?.({ itemId: item.id });
                                  return;
                                }
                                onSwipeAction?.({ itemId: item.id, actionId: action.id });
                              }}
                              style={{
                                paddingHorizontal: 10,
                                paddingVertical: 7,
                                borderRadius: 999,
                                backgroundColor:
                                  action.role === 'destructive' ? '#FEE2E2' : '#E0F2FE',
                              }}
                            >
                              <Text
                                style={{
                                  color:
                                    action.role === 'destructive' ? '#B91C1C' : '#0369A1',
                                  fontWeight: '700',
                                }}
                              >
                                {action.title}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : null}
                    </Pressable>
                    {!isLast ? <RowDivider inset={16} /> : null}
                  </View>
                );
              })}
            </SectionContainer>
            <SectionFooter footer={section.footer} grouped={false} />
          </View>
        );
      })}
    </View>
  );
}

function buildPickerQuickValues(model: NativePickerHostProps): Array<{ id: string; label: string; valueISO: string }> {
  const now = new Date('2026-03-19T09:30:00.000Z');

  if (model.temporalConfig.mode === 'date') {
    return [
      { id: 'today', label: '오늘', valueISO: '2026-03-19T00:00:00.000Z' },
      { id: 'tomorrow', label: '내일', valueISO: '2026-03-20T00:00:00.000Z' },
    ];
  }

  if (model.temporalConfig.mode === 'time') {
    return [
      { id: 'now', label: '09:30', valueISO: now.toISOString() },
      {
        id: 'plus30',
        label: '+30분',
        valueISO: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
      },
    ];
  }

  if (model.temporalConfig.mode === 'countDownTimer') {
    return [
      { id: '15m', label: '15분', valueISO: 'PT15M' },
      { id: '30m', label: '30분', valueISO: 'PT30M' },
    ];
  }

  return [
    { id: 'now', label: '지금', valueISO: now.toISOString() },
    {
      id: 'plus1h',
      label: '+1시간',
      valueISO: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
    },
  ];
}

function parsePreviewPickerDate(valueISO?: string): Date | null {
  if (!valueISO) {
    return null;
  }

  const parsed = new Date(valueISO);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  return null;
}

function formatPreviewPickerDate(valueISO?: string): string {
  const date = parsePreviewPickerDate(valueISO);
  if (!date) {
    return '값 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Seoul',
  })
    .format(date)
    .replace(/\.\s/g, '.')
    .replace(/\.$/, '');
}

function formatPreviewPickerTime(valueISO?: string): string {
  const date = parsePreviewPickerDate(valueISO);
  if (!date) {
    return '값 없음';
  }

  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date);
}

export function PickerHostPreview({
  title,
  subtitle,
  valueISO,
  allDay,
  allowsAllDay,
  activeField,
  temporalConfig,
  onPreviewValueChange,
}: NativePickerHostProps & {
  onPreviewValueChange?: (nextValueISO: string) => void;
}) {
  const [previewValueISO, setPreviewValueISO] = useState(valueISO);
  const [previewAllDay, setPreviewAllDay] = useState(allDay ?? false);
  const [previewField, setPreviewField] = useState<'date' | 'time'>(
    activeField ?? (temporalConfig.mode === 'time' ? 'time' : 'date')
  );

  useEffect(() => {
    setPreviewValueISO(valueISO);
    setPreviewAllDay(allDay ?? false);
    setPreviewField(activeField ?? (temporalConfig.mode === 'time' ? 'time' : 'date'));
  }, [activeField, allDay, temporalConfig.mode, valueISO]);

  const quickValues = buildPickerQuickValues({
    screenId: 'preview',
    pickerId: 'preview',
    title,
    subtitle,
    valueISO: previewValueISO,
    allDay: previewAllDay,
    allowsAllDay,
    activeField: previewField,
    temporalConfig,
  });

  const showAllDayRow = allowsAllDay && temporalConfig.mode === 'dateTime';
  const showTimeRow =
    temporalConfig.mode === 'time' ||
    (temporalConfig.mode === 'dateTime' && !previewAllDay);

  const handleQuickValuePress = (nextValueISO: string) => {
    setPreviewValueISO(nextValueISO);
    onPreviewValueChange?.(nextValueISO);
  };

  return (
    <View>
      <Text
        style={{
          marginBottom: 8,
          color: '#6B7280',
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ marginBottom: 10, color: '#6B7280', lineHeight: 18 }}>{subtitle}</Text>
      ) : null}

      <View
        style={{
          overflow: 'hidden',
          borderRadius: Platform.OS === 'ios' ? 16 : 14,
          borderWidth: 1,
          borderColor: '#D1D5DB',
          backgroundColor: '#FFFFFF',
        }}
      >
        {showAllDayRow ? (
          <View
            style={{
              minHeight: 56,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>하루 종일</Text>
            <Switch value={previewAllDay} onValueChange={setPreviewAllDay} />
          </View>
        ) : null}

        {showAllDayRow ? <RowDivider inset={16} /> : null}

        <Pressable
          onPress={() => setPreviewField('date')}
          style={{
            minHeight: 56,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>날짜</Text>
          <Text style={{ color: '#9CA3AF', fontSize: 16 }}>
            {formatPreviewPickerDate(previewValueISO)} {previewField === 'date' ? '⌃' : '⌄'}
          </Text>
        </Pressable>

        {previewField === 'date' ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
              backgroundColor: '#F9FAFB',
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '800' }}>Inline calendar preview</Text>
            <Text style={{ marginTop: 6, color: '#6B7280' }}>
              {formatPreviewPickerDate(previewValueISO)} 선택 상태
            </Text>
          </View>
        ) : null}

        {showTimeRow ? <RowDivider inset={16} /> : null}

        {showTimeRow ? (
          <Pressable
            onPress={() => setPreviewField('time')}
            style={{
              minHeight: 56,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Text style={{ color: '#111827', fontSize: 16, fontWeight: '600' }}>시간</Text>
            <Text style={{ color: '#9CA3AF', fontSize: 16 }}>
              {formatPreviewPickerTime(previewValueISO)} {previewField === 'time' ? '⌃' : '⌄'}
            </Text>
          </Pressable>
        ) : null}

        {showTimeRow && previewField === 'time' ? (
          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: 16,
              backgroundColor: '#F9FAFB',
              borderTopWidth: 1,
              borderTopColor: '#E5E7EB',
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '800' }}>Inline time wheel preview</Text>
            <Text style={{ marginTop: 6, color: '#6B7280' }}>
              {formatPreviewPickerTime(previewValueISO)} 선택 상태
            </Text>
          </View>
        ) : null}
      </View>

      <View style={{ marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {quickValues.map((entry) => (
          <Pressable
            key={entry.id}
            onPress={() => handleQuickValuePress(entry.valueISO)}
            disabled={!onPreviewValueChange}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: onPreviewValueChange ? '#111827' : '#D1D5DB',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>{entry.label}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ marginTop: 12, color: '#6B7280', fontSize: 12 }}>
        [{nowStamp()}] preview-only controls
      </Text>
    </View>
  );
}
