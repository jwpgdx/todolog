import React, { useMemo, useRef, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import * as DropdownMenu from 'zeego/dropdown-menu';
import * as ContextMenu from 'zeego/context-menu';

function nowStamp() {
  return new Date().toLocaleTimeString();
}

function webOnly(value) {
  return Platform.OS === 'web' ? value : undefined;
}

function SectionTitle({ children }) {
  return <Text style={{ fontSize: 16, fontWeight: '900', marginTop: 18 }}>{children}</Text>;
}

function Card({ children }) {
  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 14,
        backgroundColor: '#FFFFFF',
      }}
    >
      {children}
    </View>
  );
}

function TriggerButton({ label }) {
  return (
    <View
      style={{
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        backgroundColor: '#111827',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: 'white', fontWeight: '900', fontSize: 14 }}>{label}</Text>
    </View>
  );
}

function makeGestureRows() {
  return [
    {
      id: 'row-1',
      title: 'Inbox zero review',
      meta: 'Today · Inbox',
      accent: '#2563EB',
      archived: false,
      pinned: true,
    },
    {
      id: 'row-2',
      title: 'Zeego + swipe interaction audit',
      meta: 'Tomorrow · Product',
      accent: '#10B981',
      archived: false,
      pinned: false,
    },
    {
      id: 'row-3',
      title: 'Category reorder gesture spike',
      meta: 'No date · Design',
      accent: '#F97316',
      archived: false,
      pinned: false,
    },
    {
      id: 'row-4',
      title: 'Offline sync edge case pass',
      meta: 'Friday · Engineering',
      accent: '#8B5CF6',
      archived: false,
      pinned: false,
    },
  ];
}

function NativeSwipeAction({ label, icon, backgroundColor, align = 'flex-start', onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={{
        flex: 1,
        minWidth: 96,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor,
        alignItems: align,
        justifyContent: 'center',
      }}
    >
      <Ionicons name={icon} size={18} color="#FFFFFF" />
      <Text style={{ marginTop: 6, color: '#FFFFFF', fontWeight: '900', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ZeegoMenuTestScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [singleChoice, setSingleChoice] = useState('b');
  const [gestureRows, setGestureRows] = useState(() => makeGestureRows());
  const swipeableRefs = useRef({});

  const choices = useMemo(
    () => [
      { id: 'a', label: 'Choice A' },
      { id: 'b', label: 'Choice B' },
      { id: 'c', label: 'Choice C' },
    ],
    []
  );

  const addLog = (message) => {
    setLogs((prev) => [`[${nowStamp()}] ${message}`, ...prev].slice(0, 60));
  };

  const notify = (title) => {
    addLog(title);
  };

  const closeSwipeable = (id) => {
    swipeableRefs.current[id]?.close?.();
  };

  const resetGestureRows = () => {
    setGestureRows(makeGestureRows());
    addLog('Gesture playground rows reset');
  };

  const toggleArchive = (id, source) => {
    setGestureRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              archived: !row.archived,
            }
          : row
      )
    );
    addLog(`Row ${id} archive toggled via ${source}`);
    closeSwipeable(id);
  };

  const removeGestureRow = (id, source) => {
    setGestureRows((prev) => prev.filter((row) => row.id !== id));
    addLog(`Row ${id} removed via ${source}`);
    closeSwipeable(id);
  };

  const duplicateGestureRow = (id) => {
    setGestureRows((prev) => {
      const index = prev.findIndex((row) => row.id === id);
      if (index < 0) return prev;

      const target = prev[index];
      const clone = {
        ...target,
        id: `${target.id}-copy-${Date.now()}`,
        title: `${target.title} copy`,
        pinned: false,
      };

      const next = [...prev];
      next.splice(index + 1, 0, clone);
      return next;
    });
    addLog(`Row ${id} duplicated from context menu`);
  };

  const togglePinned = (id) => {
    setGestureRows((prev) =>
      prev.map((row) =>
        row.id === id
          ? {
              ...row,
              pinned: !row.pinned,
            }
          : row
      )
    );
    addLog(`Row ${id} pin toggled from context menu`);
  };

  const menuContentStyle = webOnly({
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 6,
    minWidth: 240,
    boxShadow: '0px 12px 36px rgba(0,0,0,0.16)',
    border: '1px solid rgba(17,24,39,0.08)',
  });

  const menuItemStyle = webOnly({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    padding: '10px 10px',
    borderRadius: 10,
    cursor: 'default',
    userSelect: 'none',
    outline: 'none',
  });

  const indicatorStyle = webOnly({
    width: 18,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    color: '#111827',
    fontWeight: 900,
  });

  const disabledItemStyle = webOnly({
    ...menuItemStyle,
    opacity: 0.45,
  });

  const destructiveTextStyle = webOnly({
    color: '#DC2626',
    fontWeight: 900,
  });

  const renderGestureRow = ({ item, drag, isActive, getIndex }) => (
    <ScaleDecorator>
      <ReanimatedSwipeable
        ref={(instance) => {
          swipeableRefs.current[item.id] = instance;
        }}
        leftThreshold={72}
        rightThreshold={88}
        dragOffsetFromLeftEdge={18}
        dragOffsetFromRightEdge={18}
        overshootFriction={8}
        containerStyle={{ borderRadius: 18 }}
        renderLeftActions={(_, __, swipeableMethods) => (
          <View style={{ width: 112, paddingRight: 10 }}>
            <NativeSwipeAction
              label={item.archived ? 'Restore' : 'Archive'}
              icon={item.archived ? 'return-up-back' : 'archive-outline'}
              backgroundColor="#0F766E"
              onPress={() => {
                toggleArchive(item.id, 'swipe-left-button');
                swipeableMethods.close();
              }}
            />
          </View>
        )}
        renderRightActions={(_, __, swipeableMethods) => (
          <View style={{ width: 112, paddingLeft: 10 }}>
            <NativeSwipeAction
              label="Delete"
              icon="trash-outline"
              backgroundColor="#DC2626"
              align="flex-end"
              onPress={() => {
                removeGestureRow(item.id, 'swipe-right-button');
                swipeableMethods.close();
              }}
            />
          </View>
        )}
        onSwipeableOpen={(direction) => {
          addLog(`Swipe opened for ${item.id}: ${direction}`);
          if (direction === 'left') {
            toggleArchive(item.id, 'full-swipe-left');
          }
        }}
      >
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: isActive ? '#93C5FD' : '#E5E7EB',
            backgroundColor: isActive ? '#EFF6FF' : '#FFFFFF',
            paddingHorizontal: 14,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <ContextMenu.Root>
            <ContextMenu.Trigger action="longPress" style={{ flex: 1 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => addLog(`Row pressed: ${item.id}`)}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                }}
              >
                <View
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    backgroundColor: item.accent,
                    marginRight: 12,
                    opacity: item.archived ? 0.45 : 1,
                  }}
                />

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: '800',
                        color: '#111827',
                        textDecorationLine: item.archived ? 'line-through' : 'none',
                        opacity: item.archived ? 0.55 : 1,
                        flexShrink: 1,
                      }}
                    >
                      {item.title}
                    </Text>
                    {item.pinned ? <Ionicons name="star" size={14} color="#F59E0B" /> : null}
                  </View>

                  <Text
                    style={{
                      marginTop: 4,
                      color: '#6B7280',
                      fontSize: 12,
                      opacity: item.archived ? 0.65 : 1,
                    }}
                  >
                    #{(getIndex?.() ?? 0) + 1} · {item.meta}
                  </Text>
                </View>
              </TouchableOpacity>
            </ContextMenu.Trigger>

            <ContextMenu.Content style={menuContentStyle}>
              <ContextMenu.Item
                key={`${item.id}-pin`}
                textValue={item.pinned ? 'Unpin row' : 'Pin row'}
                onSelect={() => togglePinned(item.id)}
                style={menuItemStyle}
              >
                <ContextMenu.ItemTitle>{item.pinned ? 'Unpin row' : 'Pin row'}</ContextMenu.ItemTitle>
              </ContextMenu.Item>
              <ContextMenu.Item
                key={`${item.id}-duplicate`}
                textValue="Duplicate row"
                onSelect={() => duplicateGestureRow(item.id)}
                style={menuItemStyle}
              >
                <ContextMenu.ItemTitle>Duplicate row</ContextMenu.ItemTitle>
              </ContextMenu.Item>
              <ContextMenu.Item
                key={`${item.id}-archive`}
                textValue={item.archived ? 'Restore row' : 'Archive row'}
                onSelect={() => toggleArchive(item.id, 'context-menu')}
                style={menuItemStyle}
              >
                <ContextMenu.ItemTitle>{item.archived ? 'Restore row' : 'Archive row'}</ContextMenu.ItemTitle>
              </ContextMenu.Item>
              <ContextMenu.Separator />
              <ContextMenu.Item
                key={`${item.id}-delete`}
                destructive
                textValue="Delete row"
                onSelect={() => removeGestureRow(item.id, 'context-menu')}
                style={menuItemStyle}
              >
                <ContextMenu.ItemTitle style={destructiveTextStyle}>Delete row</ContextMenu.ItemTitle>
              </ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>

          <TouchableOpacity
            activeOpacity={0.85}
            delayLongPress={120}
            onLongPress={() => {
              addLog(`Drag handle long-pressed: ${item.id}`);
              drag();
            }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isActive ? '#DBEAFE' : '#F3F4F6',
            }}
          >
            <Ionicons name="reorder-three" size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>
      </ReanimatedSwipeable>
    </ScaleDecorator>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView
        edges={['top', 'bottom']}
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          borderWidth: 10,
          borderColor: '#10B981',
        }}
      >
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 20, fontWeight: '900' }}>Zeego Menu Test</Text>
            <TouchableOpacity
              onPress={() => router.back()}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                backgroundColor: '#111827',
              }}
              activeOpacity={0.85}
            >
              <Text style={{ color: 'white', fontWeight: '800' }}>뒤로</Text>
            </TouchableOpacity>
          </View>

          <Text style={{ marginTop: 10, color: '#6b7280', lineHeight: 20 }}>
            Platform: {Platform.OS}
            {'\n'}
            - DropdownMenu: 버튼을 눌러서 메뉴를 엽니다.
            {'\n'}
            - ContextMenu: Web은 right click, Native는 long press로 엽니다.
            {'\n'}
            - 아래 playground는 body long-press menu + swipe + handle reorder 조합을 검증합니다.
          </Text>

          <SectionTitle>1) DropdownMenu</SectionTitle>
          <Card>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger
                style={webOnly({
                  backgroundColor: 'transparent',
                  border: 'none',
                  padding: 0,
                  cursor: 'pointer',
                })}
              >
                <TriggerButton label="Open DropdownMenu" />
              </DropdownMenu.Trigger>

              <DropdownMenu.Content sideOffset={8} style={menuContentStyle}>
                <DropdownMenu.Item
                  key="dm-edit"
                  textValue="Edit"
                  onSelect={() => notify('DropdownMenu: Edit')}
                  style={menuItemStyle}
                >
                  <DropdownMenu.ItemTitle>Edit</DropdownMenu.ItemTitle>
                </DropdownMenu.Item>

                <DropdownMenu.Item
                  key="dm-duplicate"
                  onSelect={() => notify('DropdownMenu: Duplicate')}
                  style={menuItemStyle}
                >
                  <DropdownMenu.ItemTitle>Duplicate</DropdownMenu.ItemTitle>
                </DropdownMenu.Item>

                <DropdownMenu.Item key="dm-disabled" disabled style={disabledItemStyle}>
                  <DropdownMenu.ItemTitle>Disabled item</DropdownMenu.ItemTitle>
                </DropdownMenu.Item>

                <DropdownMenu.Separator />

                {choices.map((choice) => (
                  <DropdownMenu.CheckboxItem
                    key={`dm-choice-${choice.id}`}
                    textValue={choice.label}
                    value={singleChoice === choice.id ? 'on' : 'off'}
                    shouldDismissMenuOnSelect
                    style={menuItemStyle}
                    onValueChange={() => {
                      setSingleChoice(choice.id);
                      notify(`DropdownMenu: singleChoice = ${choice.id}`);
                    }}
                  >
                    <DropdownMenu.ItemIndicator
                      style={webOnly({
                        ...indicatorStyle,
                        visibility: singleChoice === choice.id ? 'visible' : 'hidden',
                      })}
                    >
                      ✓
                    </DropdownMenu.ItemIndicator>
                    <DropdownMenu.ItemTitle>{choice.label}</DropdownMenu.ItemTitle>
                  </DropdownMenu.CheckboxItem>
                ))}

                <DropdownMenu.Separator />

                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger key="dm-more" style={menuItemStyle}>
                    <DropdownMenu.ItemTitle>More…</DropdownMenu.ItemTitle>
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.SubContent sideOffset={6} style={menuContentStyle}>
                    <DropdownMenu.Item
                      key="dm-sub-1"
                      onSelect={() => notify('DropdownMenu: Sub action 1')}
                      style={menuItemStyle}
                    >
                      <DropdownMenu.ItemTitle>Sub action 1</DropdownMenu.ItemTitle>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                      key="dm-sub-2"
                      onSelect={() => notify('DropdownMenu: Sub action 2')}
                      style={menuItemStyle}
                    >
                      <DropdownMenu.ItemTitle>Sub action 2</DropdownMenu.ItemTitle>
                    </DropdownMenu.Item>
                  </DropdownMenu.SubContent>
                </DropdownMenu.Sub>

                <DropdownMenu.Separator />

                <DropdownMenu.Item
                  key="dm-delete"
                  destructive
                  onSelect={() => notify('DropdownMenu: Delete (destructive)')}
                  style={menuItemStyle}
                >
                  <DropdownMenu.ItemTitle style={destructiveTextStyle}>Delete</DropdownMenu.ItemTitle>
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Root>
          </Card>

          <SectionTitle>2) ContextMenu</SectionTitle>
          <Card>
            <ContextMenu.Root>
              {Platform.OS === 'web' ? (
                <ContextMenu.Trigger asChild>
                  <div
                    style={{
                      borderRadius: 14,
                      padding: 14,
                      background: '#F3F4F6',
                      border: '1px solid #E5E7EB',
                    }}
                  >
                    <div style={{ fontWeight: 900, color: '#111827' }}>Right click / Long press here</div>
                    <div style={{ marginTop: 6, color: '#6b7280', lineHeight: '18px', fontSize: 12 }}>
                      Web: 마우스 우클릭
                      <br />
                      Native: 길게 누르기
                    </div>
                  </div>
                </ContextMenu.Trigger>
              ) : (
                <ContextMenu.Trigger>
                  <View
                    style={{
                      borderRadius: 14,
                      padding: 14,
                      backgroundColor: '#F3F4F6',
                      borderWidth: 1,
                      borderColor: '#E5E7EB',
                    }}
                  >
                    <Text style={{ fontWeight: '900', color: '#111827' }}>Right click / Long press here</Text>
                    <Text style={{ marginTop: 6, color: '#6b7280', lineHeight: 18, fontSize: 12 }}>
                      Web: 마우스 우클릭
                      {'\n'}
                      Native: 길게 누르기
                    </Text>
                  </View>
                </ContextMenu.Trigger>
              )}

              <ContextMenu.Content style={menuContentStyle}>
                <ContextMenu.Item key="cm-pin" onSelect={() => notify('ContextMenu: Pin')} style={menuItemStyle}>
                  <ContextMenu.ItemTitle>Pin</ContextMenu.ItemTitle>
                </ContextMenu.Item>
                <ContextMenu.Item key="cm-share" onSelect={() => notify('ContextMenu: Share')} style={menuItemStyle}>
                  <ContextMenu.ItemTitle>Share</ContextMenu.ItemTitle>
                </ContextMenu.Item>
                <ContextMenu.Separator />
                <ContextMenu.Sub>
                  <ContextMenu.SubTrigger key="cm-more" style={menuItemStyle}>
                    <ContextMenu.ItemTitle>More…</ContextMenu.ItemTitle>
                  </ContextMenu.SubTrigger>
                  <ContextMenu.SubContent sideOffset={6} style={menuContentStyle}>
                    <ContextMenu.Item
                      key="cm-sub-1"
                      onSelect={() => notify('ContextMenu: Sub action 1')}
                      style={menuItemStyle}
                    >
                      <ContextMenu.ItemTitle>Sub action 1</ContextMenu.ItemTitle>
                    </ContextMenu.Item>
                    <ContextMenu.Item
                      key="cm-sub-2"
                      onSelect={() => notify('ContextMenu: Sub action 2')}
                      style={menuItemStyle}
                    >
                      <ContextMenu.ItemTitle>Sub action 2</ContextMenu.ItemTitle>
                    </ContextMenu.Item>
                  </ContextMenu.SubContent>
                </ContextMenu.Sub>
                <ContextMenu.Separator />
                <ContextMenu.Item
                  key="cm-delete"
                  destructive
                  onSelect={() => notify('ContextMenu: Delete (destructive)')}
                  style={menuItemStyle}
                >
                  <ContextMenu.ItemTitle style={destructiveTextStyle}>Delete</ContextMenu.ItemTitle>
                </ContextMenu.Item>
              </ContextMenu.Content>
            </ContextMenu.Root>
          </Card>

          <SectionTitle>3) Gesture Playground</SectionTitle>
          <Card>
            <Text style={{ color: '#374151', lineHeight: 20 }}>
              목표:
              {'\n'}
              - row 본문 long press = Zeego context menu
              {'\n'}
              - 좌우 swipe = archive / delete
              {'\n'}
              - 오른쪽 grip long press = reorder
            </Text>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <TouchableOpacity
                onPress={resetGestureRows}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: '#111827',
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Rows reset</Text>
              </TouchableOpacity>

              <View
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  backgroundColor: '#F3F4F6',
                }}
              >
                <Text style={{ color: '#374151', fontWeight: '700' }}>
                  {Platform.OS === 'web' ? 'Web fallback' : 'Native gesture mode'}
                </Text>
              </View>
            </View>

            {Platform.OS === 'web' ? (
              <View
                style={{
                  marginTop: 14,
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: '#E5E7EB',
                  backgroundColor: '#F9FAFB',
                }}
              >
                <Text style={{ color: '#111827', fontWeight: '800' }}>Web note</Text>
                <Text style={{ color: '#6B7280', marginTop: 6, lineHeight: 20 }}>
                  이 playground의 핵심은 iOS/Android 제스처 충돌 검증이라, full combo는 Native 우선으로 넣었습니다.
                  {'\n'}
                  {'\n'}
                  Web에서는 위 ContextMenu 섹션으로 right click 동작을 먼저 확인하고, native simulator/device에서 swipe +
                  long press + reorder 조합을 확인하는 쪽이 맞습니다.
                </Text>
              </View>
            ) : (
              <View style={{ marginTop: 14 }}>
                <DraggableFlatList
                  data={gestureRows}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  activationDistance={12}
                  onDragEnd={({ data, from, to }) => {
                    setGestureRows(data);
                    addLog(`Rows reordered: ${from} -> ${to}`);
                  }}
                  ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                  renderItem={renderGestureRow}
                />
              </View>
            )}
          </Card>

          <SectionTitle>Logs</SectionTitle>
          <View
            style={{
              borderRadius: 16,
              borderWidth: 1,
              borderColor: '#E5E7EB',
              backgroundColor: '#0B1220',
              padding: 12,
              marginTop: 8,
            }}
          >
            {logs.length === 0 ? (
              <Text style={{ color: '#9CA3AF' }}>아직 로그가 없습니다. 메뉴나 제스처를 실행해보세요.</Text>
            ) : (
              logs.map((line, idx) => (
                <Text
                  key={`${line}-${idx}`}
                  style={{
                    color: '#E5E7EB',
                    fontFamily: Platform.OS === 'web' ? 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas' : undefined,
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  {line}
                </Text>
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}
