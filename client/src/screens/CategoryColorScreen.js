import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import CategoryColorList from '../components/domain/category/CategoryColorList';
import { useCategoryFormDraftStore } from '../store/categoryFormDraftStore';

export default function CategoryColorScreen() {
  const router = useRouter();
  const { selectedColor, setSelectedColor } = useCategoryFormDraftStore();

  const handleSelectColor = (color) => {
    setSelectedColor(color);
    router.back();
  };

  return (
    <View className="flex-1 bg-white">
      <CategoryColorList selectedColor={selectedColor} onSelectColor={handleSelectColor} />
    </View>
  );
}
