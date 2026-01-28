import { Platform } from 'react-native';
import * as Web from './bottom-sheet-web';
import * as Native from './bottom-sheet-native';

export const BottomSheetCore = Platform.OS === 'web' ? Web.BottomSheetWeb : Native.BottomSheetNative;
