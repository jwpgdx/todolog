import React from 'react';
import RouterPresentationBaseScreen from './RouterPresentationBaseScreen';

export default function PresentationModalTestScreen() {
  return (
    <RouterPresentationBaseScreen
      title="presentation: 'modal'"
      description={`Expo Router Stack.Screen options.presentation = "modal"\n(플랫폼별 표시/뒤로 동작 확인)`}
    />
  );
}

