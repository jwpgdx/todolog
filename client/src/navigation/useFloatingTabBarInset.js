import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getFloatingTabBarOccupiedInset } from './tabBarMetrics';

export default function useFloatingTabBarInset(extra = 0) {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => getFloatingTabBarOccupiedInset(insets.bottom) + extra,
    [extra, insets.bottom]
  );
}

export function useFloatingTabBarScrollPadding(extra = 0) {
  const insets = useSafeAreaInsets();

  return useMemo(
    () => getFloatingTabBarOccupiedInset(insets.bottom) - insets.bottom + extra,
    [extra, insets.bottom]
  );
}
