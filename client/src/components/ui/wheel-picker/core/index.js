import { Platform } from 'react-native';
import * as Web from './wheel-web';
import * as Native from './wheel-native';

// 플랫폼에 맞춰서 컴포넌트 배달
export const RootPicker = Platform.OS === 'web' ? Web.Picker : Native.MobilePicker;
export const WheelItem = Platform.OS === 'web' ? Web.Wheel : Native.MobileWheel;