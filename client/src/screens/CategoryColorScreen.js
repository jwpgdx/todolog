import React, { useLayoutEffect } from 'react';
import { View } from 'react-native';
import CategoryColorList from '../components/domain/category/CategoryColorList';

export default function CategoryColorScreen({ navigation, route }) {
    const { selectedColor, onSelect } = route.params;

    useLayoutEffect(() => {
        navigation.setOptions({
            title: '색상 선택',
        });
    }, [navigation]);

    const handleSelectColor = (color) => {
        onSelect(color);
        navigation.goBack();
    };

    return (
        <View className="flex-1 bg-white">
            <CategoryColorList
                selectedColor={selectedColor}
                onSelectColor={handleSelectColor}
            />
        </View>
    );
}
