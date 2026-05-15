import React from 'react';
import { Pressable, Text, View } from 'react-native';

import type { NativeManagedListProps } from './contracts';
import { estimateManagedListHeight } from './shared';

function getSubLabelColor(tone) {
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

export default function NativeManagedListFallback({
  variant,
  sections,
  style,
  onPressItem,
}: NativeManagedListProps) {
  const height = Math.max(220, estimateManagedListHeight(sections, variant));

  return (
    <View style={[{ width: '100%', minHeight: height, gap: 18 }, style]}>
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

                return (
                  <Pressable
                    key={`${section.id}:${item.id}`}
                    disabled={item.enabled === false || item.loading === true}
                    onPress={() => {
                      if (item.enabled === false || item.loading === true) {
                        return;
                      }

                      onPressItem?.({
                        listId: undefined,
                        sectionId: section.id,
                        itemId: item.id,
                        itemKind: item.kind,
                      });
                    }}
                    style={{
                      paddingHorizontal: item.kind === 'sectionHeader' ? 12 : 16,
                      paddingVertical: item.kind === 'sectionHeader' ? 10 : 14,
                      borderBottomWidth: index === visibleItems.length - 1 ? 0 : 1,
                      borderBottomColor: '#E5E7EB',
                      opacity:
                        item.kind === 'sectionHeader'
                          ? 1
                          : item.enabled === false
                            ? 0.45
                            : 1,
                      backgroundColor:
                        item.kind === 'sectionHeader' ? '#F9FAFB' : '#FFFFFF',
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
                      <View style={{ flex: 1, gap: 4 }}>
                        <Text
                          style={{
                            fontSize: item.kind === 'sectionHeader' ? 12 : 16,
                            fontWeight: item.kind === 'sectionHeader' ? '700' : '700',
                            color: item.kind === 'sectionHeader' ? '#6B7280' : '#111827',
                            textTransform:
                              item.kind === 'sectionHeader' ? 'uppercase' : 'none',
                          }}
                        >
                          {item.title}
                        </Text>
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

                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '700',
                          color: '#9CA3AF',
                        }}
                      >
                        {item.kind === 'sectionHeader'
                          ? item.collapsed
                            ? '▾'
                            : '▴'
                          : variant}
                      </Text>
                    </View>
                  </Pressable>
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
    </View>
  );
}
