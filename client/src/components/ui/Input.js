import React from 'react';
import { TextInput } from 'react-native';
import BaseInput from './BaseInput';

/**
 * Input - 일반 TextInput 래퍼
 * 
 * 일반 화면에서 사용하는 Input 컴포넌트입니다.
 * BottomSheet 안에서는 BottomSheetInput을 사용하세요.
 */
export default function Input(props) {
  return <BaseInput TextInputComponent={TextInput} {...props} />;
}