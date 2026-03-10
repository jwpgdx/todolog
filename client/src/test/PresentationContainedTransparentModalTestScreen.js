import React from 'react';
import RouterPresentationBaseScreen from './RouterPresentationBaseScreen';

export default function PresentationContainedTransparentModalTestScreen() {
  return (
    <RouterPresentationBaseScreen
      title="presentation: 'containedTransparentModal'"
      description={`iOS: overCurrentContext 스타일 확인용.\nAndroid는 transparentModal로 fallback될 수 있습니다.`}
      transparent
    />
  );
}

