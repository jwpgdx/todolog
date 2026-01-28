import React, { useRef } from 'react';
import { View, Button, Text, ScrollView } from 'react-native';
import CustomBottomSheet from './gorhom-bottom-sheet'; // CustomBottomSheet import 확인
import ReactNativeWheelPickTest from './react-native-wheel-pick';

const GorhomWheelPickTest = () => {
    const sheetRef = useRef(null);

    const handleOpen = () => {
        sheetRef.current?.expand();
    };

    return (
        // [1] 최상위는 View (flex-1)로 감싸서 전체 화면을 잡습니다.
        <View className="w-full" style={{ flex: 1, backgroundColor: 'white' }}>

            {/* [2] 본문 스크롤 영역: 바텀시트와 별개로 동작합니다. */}
            <ScrollView className="w-full">
                <Button title="Open Picker Sheet" onPress={handleOpen} />

                <View className="w-full h-32 bg-red-500 opacity-50">
                    <Text className="text-2xl font-bold text-white py-12">Page Content 1</Text>
                </View>
                <View className="w-full h-32 bg-yellow-500 opacity-50">
                    <Text className="text-2xl font-bold text-white py-12">Page Content 2</Text>
                </View>
                {/* ... 긴 내용들 ... */}
                <View className="w-full h-64 bg-orange-800">
                    <Text className="text-white p-10">스크롤 테스트를 위한 여백</Text>
                </View>
                <View className="w-full h-64 bg-blue-800">
                    <Text className="text-white p-10">스크롤 테스트를 위한 여백</Text>
                </View>
                <View className="w-full h-64 bg-red-800">
                    <Text className="text-white p-10">스크롤 테스트를 위한 여백</Text>
                </View>
                <View className="w-full h-64 bg-blue-800">
                    <Text className="text-white p-10">스크롤 테스트를 위한 여백</Text>
                </View>
                <View className="w-full h-64 bg-red-800">
                    <Text className="text-white p-10">스크롤 테스트를 위한 여백</Text>
                </View>
            </ScrollView>

            {/* [3] 바텀시트는 ScrollView 밖으로 빼야 합니다! */}
            {/* CustomBottomSheet 내부의 BottomSheetScrollView는 유지해도 됩니다. 
                그건 '시트 내부'의 스크롤을 담당하기 때문입니다. */}
            <CustomBottomSheet ref={sheetRef}>
                <Text className="text-2xl font-bold text-orange-500 h-64 text-center">
                    Sheet Content Top
                </Text>
                <Text className="text-2xl font-bold text-black h-64 bg-red-800 text-center">
                    Sheet Content Bottom
                </Text>
                <ReactNativeWheelPickTest />

                <Text className="text-2xl font-bold text-black h-64 bg-red-800 text-center">
                    Sheet Content Bottom
                </Text>

                <Text className="text-2xl font-bold text-black h-64 bg-red-400 text-center">
                    Sheet Content Bottom
                </Text>
                <Text className="text-2xl font-bold text-black h-64 bg-red-800 text-center">
                    Sheet Content Bottom
                </Text>
                {/* 시트 내부 내용이 길어지면 CustomBottomSheet 안의 
                    BottomSheetScrollView 덕분에 시트 안에서만 따로 스크롤 됩니다. */}
            </CustomBottomSheet>

        </View>
    );
};

export default GorhomWheelPickTest;