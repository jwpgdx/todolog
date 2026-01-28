import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import {
    BottomSheetModal,
    BottomSheetScrollView,
    BottomSheetBackdrop,
} from '@gorhom/bottom-sheet';

/**
 * DetailContainer (Android)
 * Detail Mode용 컨테이너 - @gorhom/bottom-sheet BottomSheetModal
 * 
 * @param {boolean} visible - 모달 표시 여부
 * @param {function} onClose - 닫기 핸들러
 * @param {ReactNode} children - DetailContent
 */
export default function DetailContainer({ visible, onClose, children }) {
    const sheetRef = useRef(null);
    const snapPoints = useMemo(() => ['90%'], []);

    useEffect(() => {
        if (visible) {
            sheetRef.current?.present();
        } else {
            sheetRef.current?.dismiss();
        }
    }, [visible]);

    const handleDismiss = useCallback(() => {
        onClose?.();
    }, [onClose]);

    const renderBackdrop = useCallback((props) => (
        <BottomSheetBackdrop
            {...props}
            disappearsOnIndex={-1}
            appearsOnIndex={0}
            opacity={0.5}
            pressBehavior="close"
        />
    ), []);

    return (
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            keyboardBehavior="interactive"
            keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize"
            enablePanDownToClose={true}
            backdropComponent={renderBackdrop}
            onDismiss={handleDismiss}
        >
            <BottomSheetScrollView
                style={styles.content}
                contentContainerStyle={{ paddingBottom: 20 }}
            >
                {children}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    content: {
        flex: 1,
        paddingHorizontal: 16,
    },
});
