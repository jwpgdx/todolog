import React from 'react';
import RouterPresentationBaseScreen from './RouterPresentationBaseScreen';

export default function PresentationPageSheetTestScreen() {
  return (
    <RouterPresentationBaseScreen
      title="presentation: 'pageSheet'"
      description={`iOS: UIModalPresentationPageSheet\nAndroid: modal fallback 가능\n(Expo Router native-stack presentation 비교용)`}
    />
  );
}

