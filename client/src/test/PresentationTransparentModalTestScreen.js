import React from 'react';
import RouterPresentationBaseScreen from './RouterPresentationBaseScreen';

export default function PresentationTransparentModalTestScreen() {
  return (
    <RouterPresentationBaseScreen
      title="presentation: 'transparentModal'"
      description={`배경이 보이도록 투명 컨테이너 + 오버레이 카드로 구성했습니다.\n(실제 투명 효과는 screen 옵션 contentStyle이 중요합니다.)`}
      transparent
    />
  );
}

