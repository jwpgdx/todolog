import React from 'react';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import BaseInput from '../BaseInput';

/**
 * BottomSheetInput - BottomSheet 전용 Input
 * 
 * BottomSheet/BottomSheetModal 안에서 사용하는 Input 컴포넌트입니다.
 * BottomSheetTextInput을 사용하여 키보드와 자동으로 연동됩니다.
 * 
 * 일반 화면에서는 Input을 사용하세요.
 */
export default function BottomSheetInput(props) {
    return <BaseInput TextInputComponent={BottomSheetTextInput} {...props} />;
}
