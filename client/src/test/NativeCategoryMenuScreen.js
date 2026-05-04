import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import NativeManagedList from '../components/ui/native-managed-list/NativeManagedList';
import {
  createNativeListInteractionSections,
  nowStamp,
  reorderCategoryItems,
} from './nativeListInteractionFixtures';

const MENU_ACTION_TITLES = {
  rename: '이름 변경',
  duplicate: '복제',
  archive: '보관',
  delete: '삭제',
};

export default function NativeCategoryMenuScreen() {
  const router = useRouter();
  const [sections, setSections] = useState(() =>
    createNativeListInteractionSections(
      Platform.OS === 'ios'
        ? 'iOS 전용 네이티브 카테고리 메뉴 화면입니다. 메뉴, 프리뷰, reorder handoff를 이 화면 기준으로 계속 다듬습니다.'
        : '현재 화면은 iOS 전용 네이티브 카테고리 메뉴 검증용입니다.'
    )
  );
  const [logs, setLogs] = useState([]);
  const latestLog = logs[0] || '아직 이벤트가 없습니다.';

  const addLog = (message) => {
    setLogs((prev) => [`[${nowStamp()}] ${message}`, ...prev].slice(0, 80));
  };

  const resetAll = () => {
    setSections(
      createNativeListInteractionSections(
        Platform.OS === 'ios'
          ? 'iOS 전용 네이티브 카테고리 메뉴 화면입니다. 메뉴, 프리뷰, reorder handoff를 이 화면 기준으로 계속 다듬습니다.'
          : '현재 화면은 iOS 전용 네이티브 카테고리 메뉴 검증용입니다.'
      )
    );
    setLogs([]);
  };

  const handlePress = (itemId) => {
    addLog(`onPress -> ${itemId}`);
  };

  const handleDelete = (itemId, source) => {
    setSections((prev) =>
      prev.map((section) => ({
        ...section,
        items: section.items.filter((item) => item.id !== itemId),
      }))
    );
    addLog(`onAction -> ${itemId} / delete / ${source}`);
  };

  const handleAction = ({ itemId, actionId, source }) => {
    if (actionId === 'delete') {
      handleDelete(itemId, source);
      return;
    }

    addLog(`onAction -> ${itemId} / ${actionId} / ${source}`);
  };

  const handleReorder = (event) => {
    const categorySection = event.sections.find(
      (section) => section.sectionId === 'categories'
    );

    if (!categorySection) {
      addLog('onReorderCommit -> categories section not found');
      return;
    }

    setSections((prev) =>
      prev.map((section) =>
        section.id !== 'categories'
          ? section
          : {
              ...section,
              items: reorderCategoryItems(
                section.items,
                categorySection.orderedItemIds
              ),
            }
      )
    );
    addLog(`onReorderCommit -> ${categorySection.orderedItemIds.join(', ')}`);
  };

  const headerNotes = useMemo(
    () => [
      `Platform: ${Platform.OS}`,
      'Public route: /native-category-menu',
      Platform.OS === 'ios'
        ? 'iOS = NativeManagedList category v0 / custom menu + lifted preview + same-press slide select'
        : 'Android = NativeManagedList category adapter v0',
    ],
    []
  );

  const managedSections = useMemo(
    () =>
      sections.map((section) => ({
        id: section.id,
        title: section.title,
        footer: section.footer,
        role: 'category',
        reorderMode: 'withinSection',
        items: section.items.map((item) => ({
          id: item.id,
          kind: 'category',
          title: item.title,
          subtitle: item.subtitle,
          metaText: item.metaText,
          accentColor: item.accentColor,
          enabled: item.disabled !== true,
          reorderable: item.reorderable === true,
          menuActions: (item.menuActions ?? []).map((actionId) => ({
            id: actionId,
            title: MENU_ACTION_TITLES[actionId] ?? actionId,
          })),
          trailingSwipeActions: item.deletable
            ? [
                {
                  id: 'delete',
                  title: '삭제',
                  role: 'destructive',
                },
              ]
            : [],
        })),
      })),
    [sections]
  );

  return (
    <SafeAreaView
      edges={['top', 'bottom']}
      style={{
        flex: 1,
        backgroundColor: '#F3F4F6',
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827' }}>
            Native Managed List
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 8,
              borderRadius: 10,
              backgroundColor: '#111827',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>뒤로</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 12,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#D1D5DB',
            backgroundColor: '#FFFFFF',
            padding: 14,
            gap: 6,
          }}
        >
          {headerNotes.map((note) => (
            <Text key={note} style={{ color: '#4B5563', lineHeight: 20 }}>
              - {note}
            </Text>
          ))}
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={resetAll}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: '#111827',
            }}
          >
            <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Reset Mock</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setLogs([])}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 12,
              backgroundColor: '#E5E7EB',
            }}
          >
            <Text style={{ color: '#111827', fontWeight: '800' }}>Clear Logs</Text>
          </TouchableOpacity>
        </View>

        <View
          style={{
            marginTop: 14,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#D1D5DB',
            backgroundColor: '#FFFFFF',
            padding: 12,
            gap: 4,
          }}
        >
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#6B7280' }}>
            Latest Event
          </Text>
          <Text style={{ color: '#111827', lineHeight: 20 }}>
            {latestLog}
          </Text>
        </View>

        <View style={{ marginTop: 18 }}>
          <NativeManagedList
            listId="native-category-menu-demo"
            variant="category"
            sections={managedSections}
            onPressItem={(event) => handlePress(event.itemId)}
            onAction={handleAction}
            onReorderCommit={handleReorder}
          />
        </View>

        <Text
          style={{
            marginTop: 22,
            fontSize: 16,
            fontWeight: '900',
            color: '#111827',
          }}
        >
          Event Log
        </Text>

        <View
          style={{
            marginTop: 10,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: '#D1D5DB',
            backgroundColor: '#FFFFFF',
            padding: 14,
            gap: 8,
          }}
        >
          {logs.length === 0 ? (
            <Text style={{ color: '#6B7280' }}>
              아직 이벤트가 없습니다. 카테고리 row를 길게 눌러 확인하세요.
            </Text>
          ) : (
            logs.map((log) => (
              <Text key={log} style={{ color: '#111827', lineHeight: 19 }}>
                {log}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
