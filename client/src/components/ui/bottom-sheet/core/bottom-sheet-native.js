import React, { useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import BottomSheetLib, { BottomSheetScrollView, BottomSheetBackdrop, useBottomSheet } from '@gorhom/bottom-sheet';

/**
 * 💡 공통 BottomSheet Native (일반 BottomSheet + 조건부 렌더링)
 * 
 * 키보드 연동이 필요하므로 BottomSheetModal 대신 일반 BottomSheet 사용
 * - isOpen이 true일 때만 렌더링
 * - keyboardBehavior로 키보드 위에 시트 표시
 */
export const BottomSheetNative = forwardRef(({
    isOpen,
    onOpenChange,
    snapPoints: propsSnapPoints,
    children,
    trigger,
    title,
    contentContainerStyle,

    useScrollView = true,
    defaultIndex = 0,
    keyboardBehavior = 'interactive',  // 키보드와 함께 움직임
    keyboardBlurBehavior = 'none',
    enablePanDownToClose = true,
}, ref) => {
    const bottomSheetRef = useRef(null);
    const snapPoints = useMemo(() => propsSnapPoints || ['25%', '50%', '90%'], [propsSnapPoints]);

    // 부모에서 ref로 접근 가능한 메소드 노출
    useImperativeHandle(ref, () => ({
        snapToIndex: (index) => bottomSheetRef.current?.snapToIndex(index),
        expand: () => bottomSheetRef.current?.expand(),
        collapse: () => bottomSheetRef.current?.collapse(),
        close: () => bottomSheetRef.current?.close(),
    }));

    const handleSheetChanges = useCallback((index) => {
        console.log('📦 BottomSheet onChange - index:', index);
        // -1이면 닫힌 상태
        if (index === -1) {
            onOpenChange?.(false);
        }
    }, [onOpenChange]);

    const handleSheetAnimate = useCallback((fromIndex, toIndex) => {
        console.log('📦 BottomSheet onAnimate:', fromIndex, '->', toIndex);
    }, []);

    const renderBackdrop = useCallback((props) => (
        <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
            pressBehavior={enablePanDownToClose ? 'close' : 'none'}
        />
    ), [enablePanDownToClose]);

    const ContentWrapper = useScrollView ? BottomSheetScrollView : View;
    const wrapperStyle = useScrollView
        ? [styles.contentContainer, contentContainerStyle]
        : [{ flex: 1 }, contentContainerStyle];

    // 🔑 조건부 렌더링: isOpen이 true일 때만 BottomSheet 렌더링
    return (
        <>
            {trigger && (
                <TouchableOpacity onPress={() => onOpenChange?.(true)}>
                    {trigger}
                </TouchableOpacity>
            )}

            {isOpen && (
                <BottomSheetLib
                    ref={bottomSheetRef}
                    index={defaultIndex}
                    snapPoints={snapPoints}
                    enableDynamicSizing={false}
                    animateOnMount={true}
                    keyboardBehavior={keyboardBehavior}
                    keyboardBlurBehavior={keyboardBlurBehavior}
                    android_keyboardInputMode="adjustResize"
                    enablePanDownToClose={enablePanDownToClose}
                    backdropComponent={renderBackdrop}
                    onChange={handleSheetChanges}
                    onAnimate={handleSheetAnimate}
                >
                    {title && (
                        <View style={styles.header}>
                            <Text style={styles.title}>{title}</Text>
                        </View>
                    )}

                    <ContentWrapper style={wrapperStyle}>
                        {typeof children === 'function'
                            ? <RenderPropsWrapper>{children}</RenderPropsWrapper>
                            : children
                        }
                    </ContentWrapper>
                </BottomSheetLib>
            )}
        </>
    );
});

// BottomSheet 내부에서 useBottomSheet 훅 사용
const RenderPropsWrapper = ({ children }) => {
    const { animatedIndex } = useBottomSheet();
    return children({ animatedIndex });
};

const styles = StyleSheet.create({
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 24,
    },
    header: { alignItems: 'center', paddingBottom: 12 },
    title: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
});

export default BottomSheetNative;