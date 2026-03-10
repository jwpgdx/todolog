import React from 'react';
import RouterPresentationBaseScreen from './RouterPresentationBaseScreen';

export default function PresentationFullScreenModalTestScreen() {
  return (
    <RouterPresentationBaseScreen
      title="presentation: 'fullScreenModal'"
      description={`iOS에서 UIModalPresentationFullScreen 확인용.\nAndroid는 modal fallback일 수 있습니다.`}
    />
  );
}

