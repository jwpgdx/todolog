import React from 'react';
import { View, StyleSheet, TouchableWithoutFeedback, Keyboard } from 'react-native';
import { useKeyboardHandler } from 'react-native-keyboard-controller';
import Reanimated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

/**
 * QuickContainer (Native - iOS/Android 공용)
 * Quick Mode용 컨테이너 - useKeyboardHandler + Reanimated 기반
 * 
 * @param {ReactNode} children - QuickModeContent
 * @param {function} onClose - 배경 터치 시 닫기 핸들러
 */
export default function QuickContainer({ children, onClose }) {
    const keyboardHeight = useSharedValue(0);

    useKeyboardHandler(
        {
            onMove: (e) => {
                'worklet';
                keyboardHeight.value = e.height;
            },
            onInteractive: (e) => {
                'worklet';
                keyboardHeight.value = e.height;
            },
            onEnd: (e) => {
                'worklet';
                keyboardHeight.value = e.height;
            },
        },
        []
    );

    const containerStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: -keyboardHeight.value }],
    }));

    const handleBackdropPress = () => {
        Keyboard.dismiss();
        onClose?.();
    };

    return (
        <View style={styles.fullScreenContainer}>
            <TouchableWithoutFeedback onPress={handleBackdropPress}>
                <View style={styles.backdrop} />
            </TouchableWithoutFeedback>

            <Reanimated.View style={containerStyle}>
                {children}
            </Reanimated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    fullScreenContainer: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 100,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
});