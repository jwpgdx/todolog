import React, { useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';

const CustomBottomSheet = forwardRef(({ children }, ref) => {
    // ref
    const bottomSheetRef = useRef(null);

    // variables
    const snapPoints = useMemo(() => ['25%', '50%', '90%'], []);

    // expose methods to parent
    useImperativeHandle(ref, () => ({
        expand: () => bottomSheetRef.current?.expand(),
        close: () => bottomSheetRef.current?.close(),
        collapse: () => bottomSheetRef.current?.collapse(),
        snapToIndex: (index) => bottomSheetRef.current?.snapToIndex(index),
    }));

    return (
        <BottomSheet
            ref={bottomSheetRef}
            snapPoints={snapPoints}
            enablePanDownToClose={true}
            index={-1} // Start closed
        >
            <BottomSheetScrollView style={styles.contentContainer}>
                {children}
            </BottomSheetScrollView>
        </BottomSheet>
    );
});

const styles = StyleSheet.create({
    contentContainer: {
        flex: 1,
    }
});

export default CustomBottomSheet;
