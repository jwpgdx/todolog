import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { CATEGORY_PALETTE } from '../constants/categoryColors';
import { NativeSelectionList } from '../features/settings';
import { NATIVE_SELECTION_LIST_COLORS } from '../features/settings/native/selectionListColors';
import { useCategoryFormDraftStore } from '../store/categoryFormDraftStore';

export default function CategoryColorScreen() {
  const router = useRouter();
  const { selectedColor, setSelectedColor } = useCategoryFormDraftStore();
  const [pendingColor, setPendingColor] = useState(selectedColor);

  useEffect(() => {
    setPendingColor(selectedColor);
  }, [selectedColor]);

  const options = useMemo(
    () =>
      CATEGORY_PALETTE.map(({ value, name }) => ({
        id: value,
        label: name,
        keywords: [name, value],
        leadingColor: value,
        value,
      })),
    []
  );

  const handleApply = useCallback(() => {
    if (pendingColor) {
      setSelectedColor(pendingColor);
    }
    router.back();
  }, [pendingColor, router, setSelectedColor]);

  const selectedOptionId = useMemo(
    () => options.find((option) => option.value === pendingColor)?.id,
    [options, pendingColor]
  );

  const handleSelectionCommit = ({ selectedIds }) => {
    const nextColor = selectedIds?.[0];
    if (!nextColor) {
      return;
    }

    const selectedOption = options.find((option) => option.id === nextColor);
    setPendingColor(selectedOption?.value || nextColor);
  };

  const headerColorOptions =
    Platform.OS === 'ios'
      ? {
          headerTransparent: true,
        }
      : {
          headerStyle: {
            backgroundColor: NATIVE_SELECTION_LIST_COLORS.modalHeaderBackground,
          },
          headerTintColor: NATIVE_SELECTION_LIST_COLORS.modalHeaderAction,
          headerTitleStyle: {
            color: NATIVE_SELECTION_LIST_COLORS.modalHeaderText,
          },
        };

  return (
    <View
      className="flex-1"
      style={{ backgroundColor: NATIVE_SELECTION_LIST_COLORS.modalBackground }}
    >
      <Stack.Screen
        options={{
          headerShadowVisible: false,
          ...headerColorOptions,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleApply}
              className="mr-2 rounded-lg px-2 py-1"
            >
              <Text
                className="text-base font-semibold"
                style={{ color: NATIVE_SELECTION_LIST_COLORS.modalHeaderAction }}
              >
                완료
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        className="flex-1"
        style={{ backgroundColor: NATIVE_SELECTION_LIST_COLORS.listBackground }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <NativeSelectionList
          screenId="category-color"
          title=""
          options={options}
          selectedIds={selectedOptionId ? [selectedOptionId] : []}
          onSelectionCommit={handleSelectionCommit}
        />
      </ScrollView>
    </View>
  );
}
