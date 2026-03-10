import React from 'react';
import RouterPresentationBaseScreen from './RouterPresentationBaseScreen';

export default function PresentationContainedModalTestScreen() {
  return (
    <RouterPresentationBaseScreen
      title="presentation: 'containedModal'"
      description={`iOS: currentContext 스타일 확인용.\nAndroid는 modal로 fallback될 수 있습니다.`}
    />
  );
}

