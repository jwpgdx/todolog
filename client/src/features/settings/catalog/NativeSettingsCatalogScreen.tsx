import React, { useEffect, useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type {
  NativePickerHostProps,
  NativeSelectionListProps,
  NativeSettingsListProps,
} from '../contracts';
import type {
  PickerHostModel,
  ScreenKind,
  SelectionListModel,
  SettingsSection,
} from '../types';
import NativeCategoryManager from '../native/NativeCategoryManager';
import NativePickerHost from '../native/NativePickerHost';
import NativeSelectionList from '../native/NativeSelectionList';
import NativeSettingsList from '../native/NativeSettingsList';
import {
  CATALOG_EXAMPLES,
  cloneCatalogPayload,
  DEFAULT_CATALOG_FAMILY,
  DEFAULT_CATALOG_SCHEMA_IDS,
  findSelectionExampleByScreenId,
  getCatalogExamples,
} from './exampleSchemas';
import {
  CategoryManagerPreview,
  PickerHostPreview,
  SelectionListPreview,
  SettingsListPreview,
} from './previewRenderers';

type PreviewState =
  | { screenId: string; sections: SettingsSection[] }
  | SelectionListModel
  | PickerHostModel;

function nowStamp(): string {
  return new Date().toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function hasSectionsPayload(value: PreviewState | null): value is {
  screenId: string;
  sections: SettingsSection[];
} {
  return !!value && 'sections' in value && Array.isArray(value.sections);
}

function isSelectionPayload(value: PreviewState | null): value is SelectionListModel {
  return !!value && 'options' in value && Array.isArray(value.options);
}

function isPickerPayload(value: PreviewState | null): value is PickerHostModel {
  return !!value && 'pickerId' in value && 'temporalConfig' in value;
}

function reorderSectionItems(items: SettingsSection['items'], orderedItemIds: string[]) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return orderedItemIds
    .map((itemId) => byId.get(itemId))
    .filter((item): item is SettingsSection['items'][number] => !!item);
}

export default function NativeSettingsCatalogScreen() {
  const router = useRouter();
  const [selectedFamily, setSelectedFamily] = useState<ScreenKind>(
    DEFAULT_CATALOG_FAMILY
  );
  const [selectedSchemaId, setSelectedSchemaId] = useState(
    DEFAULT_CATALOG_SCHEMA_IDS[DEFAULT_CATALOG_FAMILY]
  );
  const [logs, setLogs] = useState<string[]>([]);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);

  const examples = useMemo(
    () => getCatalogExamples(selectedFamily),
    [selectedFamily]
  );

  const selectedExample = useMemo(() => {
    return (
      examples.find((example) => example.id === selectedSchemaId) ?? examples[0] ?? null
    );
  }, [examples, selectedSchemaId]);

  useEffect(() => {
    if (!selectedExample) {
      return;
    }
    setPreviewState(cloneCatalogPayload(selectedExample.payload));
  }, [selectedExample]);

  useEffect(() => {
    if (examples.some((example) => example.id === selectedSchemaId)) {
      return;
    }
    const nextId = DEFAULT_CATALOG_SCHEMA_IDS[selectedFamily] ?? examples[0]?.id;
    if (nextId) {
      setSelectedSchemaId(nextId);
    }
  }, [examples, selectedFamily, selectedSchemaId]);

  const latestLog = logs[0] ?? '아직 이벤트가 없습니다.';

  const addLog = (message: string) => {
    setLogs((prev) => [`[${nowStamp()}] ${message}`, ...prev].slice(0, 120));
  };

  const resetPreview = () => {
    if (!selectedExample) {
      return;
    }
    setPreviewState(cloneCatalogPayload(selectedExample.payload));
    addLog(`reset -> ${selectedExample.id}`);
  };

  const handleNavigate = ({
    itemId,
    destination,
  }: {
    itemId: string;
    destination: string;
  }) => {
    addLog(`onNavigate -> ${itemId} / ${destination}`);

    const linkedSelection = findSelectionExampleByScreenId(destination);
    if (linkedSelection) {
      setSelectedFamily('selectionList');
      setSelectedSchemaId(linkedSelection.id);
    }
  };

  const handleSettingsToggleChange = ({
    itemId,
    value,
  }: {
    itemId: string;
    value: boolean;
  }) => {
    setPreviewState((prev) => {
      if (!hasSectionsPayload(prev)) {
        return prev;
      }
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.id === itemId && item.kind === 'toggle'
              ? { ...item, value }
              : item
          ),
        })),
      };
    });
    addLog(`onToggleChange -> ${itemId} / ${value ? 'on' : 'off'}`);
  };

  const handleSettingsMenuAction = ({
    itemId,
    actionId,
  }: {
    itemId: string;
    actionId: string;
  }) => {
    setPreviewState((prev) => {
      if (!hasSectionsPayload(prev)) {
        return prev;
      }
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          items: section.items.map((item) => {
            if (item.id !== itemId || item.kind !== 'menu') {
              return item;
            }
            const selectedOption = item.options.find((option) => option.id === actionId);
            return {
              ...item,
              selectedOptionId: actionId,
              value: selectedOption?.label ?? item.value,
            };
          }),
        })),
      };
    });
    addLog(`onMenuAction -> ${itemId} / ${actionId}`);
  };

  const handleExpandChange = ({
    itemId,
    expanded,
  }: {
    itemId: string;
    expanded: boolean;
  }) => {
    setPreviewState((prev) => {
      if (!hasSectionsPayload(prev)) {
        return prev;
      }
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          items: section.items.map((item) =>
            item.id === itemId && item.kind === 'expandableParent'
              ? { ...item, expanded }
              : item
          ),
        })),
      };
    });
    addLog(`onExpandChange -> ${itemId} / ${expanded ? 'expanded' : 'collapsed'}`);
  };

  const handleSelectionCommit = ({
    screenId,
    selectedIds,
  }: {
    screenId: string;
    selectedIds: string[];
  }) => {
    setPreviewState((prev) => {
      if (!isSelectionPayload(prev)) {
        return prev;
      }
      return {
        ...prev,
        selectedIds,
      };
    });
    addLog(`onSelectionCommit -> ${screenId} / ${selectedIds.join(', ')}`);
  };

  const handleCategoryDelete = ({ itemId }: { itemId: string }) => {
    setPreviewState((prev) => {
      if (!hasSectionsPayload(prev)) {
        return prev;
      }
      return {
        ...prev,
        sections: prev.sections.map((section) => ({
          ...section,
          items: section.items.filter((item) => item.id !== itemId),
        })),
      };
    });
    addLog(`onRequestDelete -> ${itemId}`);
  };

  const handleCategoryReorder = ({
    orderedItemIds,
  }: {
    orderedItemIds: string[];
  }) => {
    setPreviewState((prev) => {
      if (!hasSectionsPayload(prev)) {
        return prev;
      }
      return {
        ...prev,
        sections: prev.sections.map((section) =>
          section.id !== 'categories'
            ? section
            : {
                ...section,
                items: reorderSectionItems(section.items, orderedItemIds),
              }
        ),
      };
    });
    addLog(`onReorderCommit -> ${orderedItemIds.join(', ')}`);
  };

  const handleNativeError = ({
    code,
    message,
  }: {
    code: string;
    message: string;
  }) => {
    addLog(`onError -> ${code} / ${message}`);
  };

  const renderPreview = () => {
    if (!previewState) {
      return null;
    }

    if (selectedFamily === 'settingsList' && hasSectionsPayload(previewState)) {
      const props: NativeSettingsListProps = {
        screenId: previewState.screenId,
        sections: previewState.sections,
        onPressItem: ({ itemId, kind }) => addLog(`onPressItem -> ${itemId} / ${kind}`),
        onToggleChange: handleSettingsToggleChange,
        onMenuAction: handleSettingsMenuAction,
        onNavigate: handleNavigate,
        onExpandChange: handleExpandChange,
        onError: handleNativeError,
      };

      return <SettingsListPreview {...props} />;
    }

    if (selectedFamily === 'selectionList' && isSelectionPayload(previewState)) {
      const props: NativeSelectionListProps = {
        ...previewState,
        onPressItem: ({ itemId }) => addLog(`onPressItem -> ${itemId}`),
        onSelectionCommit: handleSelectionCommit,
        onError: handleNativeError,
      };

      return <SelectionListPreview {...props} />;
    }

    if (selectedFamily === 'categoryManager' && hasSectionsPayload(previewState)) {
      return (
        <CategoryManagerPreview
          screenId={previewState.screenId}
          sections={previewState.sections}
          onPressItem={({ itemId, kind }) =>
            addLog(`onPressItem -> ${itemId} / ${kind}`)
          }
          onMenuAction={({ itemId, actionId }) =>
            addLog(`onMenuAction -> ${itemId} / ${actionId}`)
          }
          onSwipeAction={({ itemId, actionId }) =>
            addLog(`onSwipeAction -> ${itemId} / ${actionId}`)
          }
          onRequestDelete={handleCategoryDelete}
          onReorderCommit={handleCategoryReorder}
          onError={handleNativeError}
        />
      );
    }

    if (selectedFamily === 'pickerHost' && isPickerPayload(previewState)) {
      return (
        <PickerHostPreview
          {...previewState}
          onPreviewValueChange={(nextValueISO) => {
            setPreviewState((prev) => {
              if (!isPickerPayload(prev)) {
                return prev;
              }
              return {
                ...prev,
                valueISO: nextValueISO,
              };
            });
            addLog(`pickerPreviewChange -> ${nextValueISO}`);
          }}
        />
      );
    }

    return null;
  };

  const renderNativeMount = () => {
    if (!previewState) {
      return null;
    }

    return (
      <View
        style={{
          marginTop: 22,
          gap: 10,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '900', color: '#111827' }}>
          Native Mount
        </Text>
        <Text style={{ color: '#6B7280', lineHeight: 20 }}>
          mobile에서는 아래 native renderer에도 semantic event handler를 연결해 둡니다. picker 값
          편집 같은 fixture state 변경은 위 preview renderer가 기준입니다.
        </Text>

        {selectedFamily === 'settingsList' && hasSectionsPayload(previewState) ? (
          <NativeSettingsList
            screenId={previewState.screenId}
            sections={previewState.sections}
            onPressItem={({ itemId, kind }) =>
              addLog(`native:onPressItem -> ${itemId} / ${kind}`)
            }
            onToggleChange={handleSettingsToggleChange}
            onMenuAction={handleSettingsMenuAction}
            onNavigate={handleNavigate}
            onExpandChange={handleExpandChange}
            onError={handleNativeError}
          />
        ) : null}

        {selectedFamily === 'selectionList' && isSelectionPayload(previewState) ? (
          <NativeSelectionList
            {...previewState}
            onPressItem={({ itemId }) => addLog(`native:onPressItem -> ${itemId}`)}
            onSelectionCommit={handleSelectionCommit}
            onError={handleNativeError}
          />
        ) : null}

        {selectedFamily === 'categoryManager' && hasSectionsPayload(previewState) ? (
          <NativeCategoryManager
            screenId={previewState.screenId}
            sections={previewState.sections}
            onPressItem={({ itemId, kind }) =>
              addLog(`native:onPressItem -> ${itemId} / ${kind}`)
            }
            onMenuAction={({ itemId, actionId }) =>
              addLog(`native:onMenuAction -> ${itemId} / ${actionId}`)
            }
            onSwipeAction={({ itemId, actionId }) =>
              addLog(`native:onSwipeAction -> ${itemId} / ${actionId}`)
            }
            onRequestDelete={handleCategoryDelete}
            onReorderCommit={handleCategoryReorder}
            onError={handleNativeError}
          />
        ) : null}

        {selectedFamily === 'pickerHost' && isPickerPayload(previewState) ? (
          <NativePickerHost {...previewState} onError={handleNativeError} />
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: '#F3F4F6' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, paddingRight: 12 }}>
            <Text style={{ fontSize: 22, fontWeight: '900', color: '#111827' }}>
              Native Settings Catalog
            </Text>
            <Text style={{ marginTop: 6, color: '#6B7280', lineHeight: 20 }}>
              settings subsystem family와 schema를 mock/in-memory 상태로 미리 보는 catalog입니다.
            </Text>
          </View>
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
          {[
            `Platform: ${Platform.OS}`,
            'Public route: /native-settings-catalog',
            'SettingsList / SelectionList / CategoryManager / PickerHost preview',
            'Native mount 영역은 mobile에서 실제 semantic event bridge 로그를 같이 확인한다.',
          ].map((note) => (
            <Text key={note} style={{ color: '#4B5563', lineHeight: 20 }}>
              - {note}
            </Text>
          ))}
        </View>

        <View style={{ marginTop: 14, flexDirection: 'row', gap: 10 }}>
          <TouchableOpacity
            onPress={resetPreview}
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

        <View style={{ marginTop: 18, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#6B7280' }}>Family</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {Object.keys(CATALOG_EXAMPLES).map((family) => {
              const selected = selectedFamily === family;
              return (
                <TouchableOpacity
                  key={family}
                  onPress={() => {
                    const nextFamily = family as ScreenKind;
                    setSelectedFamily(nextFamily);
                    setSelectedSchemaId(DEFAULT_CATALOG_SCHEMA_IDS[nextFamily]);
                  }}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: selected ? '#111827' : '#E5E7EB',
                  }}
                >
                  <Text style={{ color: selected ? '#FFFFFF' : '#111827', fontWeight: '800' }}>
                    {family}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={{ marginTop: 18, gap: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#6B7280' }}>Schema</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {examples.map((example) => {
              const selected = selectedSchemaId === example.id;
              return (
                <TouchableOpacity
                  key={example.id}
                  onPress={() => setSelectedSchemaId(example.id)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: selected ? '#111827' : '#E5E7EB',
                  }}
                >
                  <Text style={{ color: selected ? '#FFFFFF' : '#111827', fontWeight: '800' }}>
                    {example.title}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {selectedExample ? (
          <View
            style={{
              marginTop: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: '#D1D5DB',
              backgroundColor: '#FFFFFF',
              padding: 12,
              gap: 6,
            }}
          >
            <Text style={{ color: '#111827', fontSize: 16, fontWeight: '800' }}>
              {selectedExample.title}
            </Text>
            <Text style={{ color: '#4B5563', lineHeight: 20 }}>{selectedExample.description}</Text>
            {selectedExample.notes?.map((note) => (
              <Text key={note} style={{ color: '#6B7280', lineHeight: 18 }}>
                - {note}
              </Text>
            ))}
          </View>
        ) : null}

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
          <Text style={{ color: '#111827', lineHeight: 20 }}>{latestLog}</Text>
        </View>

        <View style={{ marginTop: 18 }}>{renderPreview()}</View>

        {renderNativeMount()}

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
            overflow: 'hidden',
          }}
        >
          {logs.length === 0 ? (
            <Text style={{ padding: 14, color: '#6B7280' }}>아직 기록된 이벤트가 없습니다.</Text>
          ) : (
            logs.map((entry, index) => (
              <View key={`${entry}-${index}`}>
                <Text style={{ paddingHorizontal: 14, paddingVertical: 12, color: '#111827' }}>
                  {entry}
                </Text>
                {index !== logs.length - 1 ? <View style={{ height: 1, backgroundColor: '#E5E7EB' }} /> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
