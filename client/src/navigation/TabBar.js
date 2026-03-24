import { useRouter, useSegments } from 'expo-router';
import { BlurView } from 'expo-blur';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CalendarTabIcon from './icons/CalendarTabIcon';
import MyPageTabIcon from './icons/MyPageTabIcon';
import QuickAddIcon from './icons/QuickAddIcon';
import TodoTabIcon from './icons/TodoTabIcon';
import { useTodoFormStore } from '../store/todoFormStore';
import {
  FLOATING_TAB_BAR_ACTION_GAP,
  FLOATING_TAB_BAR_BLUR_INTENSITY,
  FLOATING_TAB_BAR_HEIGHT,
  FLOATING_TAB_BAR_HORIZONTAL_INSET,
  FLOATING_TAB_BAR_ICON_SIZE,
  FLOATING_TAB_BAR_ITEM_GAP,
  FLOATING_TAB_BAR_ITEM_HEIGHT,
  FLOATING_TAB_BAR_PADDING_X,
  FLOATING_TAB_BAR_PADDING_Y,
  FLOATING_TAB_BAR_PLUS_SIZE,
  FLOATING_TAB_BAR_RADIUS,
  FLOATING_TAB_BAR_SURFACE_PADDING,
  getFloatingTabBarBottomOffset,
} from './tabBarMetrics';

const TAB_META = {
  index: {
    href: '/(app)/(tabs)',
    Icon: TodoTabIcon,
    label: 'Todo',
  },
  calendar: {
    href: '/(app)/(tabs)/calendar',
    Icon: CalendarTabIcon,
    label: 'Calendar',
  },
  'my-page': {
    href: '/(app)/(tabs)/my-page',
    Icon: MyPageTabIcon,
    label: 'My Page',
  },
};

const TAB_ORDER = ['index', 'calendar', 'my-page'];

const TAB_BAR_SURFACE_STYLE = {
  borderWidth: 1,
  borderColor: 'rgba(226, 232, 240, 0.92)',
};

function SurfaceBackground({ style }) {
  return (
    <View pointerEvents="none" style={[styles.surfaceBackground, style]}>
      <BlurView
        intensity={FLOATING_TAB_BAR_BLUR_INTENSITY}
        tint="light"
        style={StyleSheet.absoluteFillObject}
      />
      <View style={styles.surfaceOverlay} />
    </View>
  );
}

function TabItem({
  focused,
  Icon,
  isFirst,
  isLast,
  itemGap,
  label,
  onLayout,
  onPress,
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      onLayout={onLayout}
      onPress={onPress}
      style={[
        styles.itemPressable,
        itemGap < 0
          ? {
              marginLeft: isFirst ? 0 : itemGap / 2,
              marginRight: isLast ? 0 : itemGap / 2,
            }
          : null,
      ]}
    >
    <View
        style={[
          styles.item,
        ]}
      >
        <Icon
          focused={focused}
          size={FLOATING_TAB_BAR_ICON_SIZE}
          color={focused ? '#FFFFFF' : '#6B7280'}
        />
        <Text
          style={[
            styles.itemLabel,
            focused ? styles.itemLabelActive : null,
          ]}
        >
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

function QuickActionButton({ onPress }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="새 할 일"
      onPress={onPress}
      style={styles.plusButtonShell}
    >
      <>
        <SurfaceBackground style={styles.plusButtonBackground} />
        <View style={styles.plusButtonFace}>
          <QuickAddIcon size={26} color="#4B5563" />
        </View>
      </>
    </Pressable>
  );
}

export default function TabBar({ state }) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { mode, openQuick } = useTodoFormStore();
  const [tabLayouts, setTabLayouts] = useState({});
  const hasInitializedSelection = useRef(false);
  const selectedPillX = useSharedValue(0);
  const selectedPillWidth = useSharedValue(0);
  const selectedPillOpacity = useSharedValue(0);
  const bottomOffset = useMemo(
    () => getFloatingTabBarBottomOffset(insets.bottom),
    [insets.bottom]
  );

  const visibleRoutes = useMemo(
    () =>
      TAB_ORDER.map((routeName) => state.routes.find((route) => route.name === routeName)).filter(Boolean),
    [state.routes]
  );

  const activeTabName = useMemo(() => {
    if (segments.includes('my-page')) {
      return 'my-page';
    }
    if (segments.includes('calendar')) {
      return 'calendar';
    }
    return 'index';
  }, [segments]);

  const activeTabLayout = tabLayouts[activeTabName];

  useEffect(() => {
    if (!activeTabLayout) {
      return;
    }

    if (!hasInitializedSelection.current) {
      selectedPillX.value = activeTabLayout.x;
      selectedPillWidth.value = activeTabLayout.width;
      selectedPillOpacity.value = 1;
      hasInitializedSelection.current = true;
      return;
    }

    selectedPillX.value = withTiming(activeTabLayout.x, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    selectedPillWidth.value = withTiming(activeTabLayout.width, {
      duration: 240,
      easing: Easing.out(Easing.cubic),
    });
    selectedPillOpacity.value = withTiming(1, { duration: 160 });
  }, [activeTabLayout, selectedPillOpacity, selectedPillWidth, selectedPillX]);

  const selectedPillStyle = useAnimatedStyle(() => ({
    opacity: selectedPillOpacity.value,
    transform: [{ translateX: selectedPillX.value }],
    width: selectedPillWidth.value,
  }));

  const handleTabPress = (routeName) => {
    const href = TAB_META[routeName]?.href;
    if (!href) return;
    router.replace(href);
  };

  const handleQuickActionPress = () => {
    if (mode !== 'CLOSED') {
      return;
    }
    openQuick();
  };

  const handleTabLayout = (routeName, event) => {
    const { x, width } = event.nativeEvent.layout;

    setTabLayouts((prev) => {
      const current = prev[routeName];
      if (
        current &&
        current.x === x &&
        current.width === width
      ) {
        return prev;
      }

      return {
        ...prev,
        [routeName]: { x, width },
      };
    });
  };

  return (
    <View pointerEvents="box-none" style={styles.wrapper}>
      <View
        style={[
          styles.barRow,
          {
            bottom: bottomOffset,
            left: FLOATING_TAB_BAR_HORIZONTAL_INSET,
            right: FLOATING_TAB_BAR_HORIZONTAL_INSET,
          },
        ]}
      >
        <View style={styles.menuShell}>
          <SurfaceBackground style={styles.menuBackground} />
          <View
            style={[
              styles.routeRow,
              FLOATING_TAB_BAR_ITEM_GAP >= 0 ? { gap: FLOATING_TAB_BAR_ITEM_GAP } : null,
            ]}
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.selectedPill, selectedPillStyle]}
            />
            {visibleRoutes.map((route, index) => {
              const meta = TAB_META[route.name];
              const focused = route.name === activeTabName;

              return (
                <TabItem
                  key={route.key}
                  focused={focused}
                  Icon={meta.Icon}
                  isFirst={index === 0}
                  isLast={index === visibleRoutes.length - 1}
                  itemGap={FLOATING_TAB_BAR_ITEM_GAP}
                  label={meta.label}
                  onLayout={(event) => handleTabLayout(route.name, event)}
                  onPress={() => handleTabPress(route.name)}
                />
              );
            })}
          </View>
        </View>

        <QuickActionButton onPress={handleQuickActionPress} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  barRow: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: FLOATING_TAB_BAR_ACTION_GAP,
  },
  menuShell: {
    position: 'relative',
    flex: 1,
    minHeight: FLOATING_TAB_BAR_HEIGHT,
    justifyContent: 'center',
  },
  menuBackground: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: FLOATING_TAB_BAR_RADIUS,
    borderCurve: 'continuous',
    ...TAB_BAR_SURFACE_STYLE,
  },
  surfaceBackground: {
    overflow: 'hidden',
  },
  surfaceOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
  },
  routeRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: FLOATING_TAB_BAR_PADDING_X,
    paddingVertical: FLOATING_TAB_BAR_PADDING_Y,
  },
  item: {
    minHeight: FLOATING_TAB_BAR_ITEM_HEIGHT,
    borderRadius: FLOATING_TAB_BAR_ITEM_HEIGHT / 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 12,
  },
  itemPressable: {
    flex: 1,
    zIndex: 1,
  },
  selectedPill: {
    position: 'absolute',
    top: FLOATING_TAB_BAR_PADDING_Y,
    backgroundColor: '#2563EB',
    height: FLOATING_TAB_BAR_ITEM_HEIGHT,
    borderRadius: FLOATING_TAB_BAR_ITEM_HEIGHT / 2,
    borderCurve: 'continuous',
  },
  itemLabel: {
    color: '#6B7280',
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '500',
  },
  itemLabelActive: {
    color: '#FFFFFF',
  },
  plusButtonShell: {
    width: FLOATING_TAB_BAR_PLUS_SIZE,
    height: FLOATING_TAB_BAR_PLUS_SIZE,
    borderRadius: FLOATING_TAB_BAR_PLUS_SIZE / 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  plusButtonBackground: {
    position: 'absolute',
    top: -FLOATING_TAB_BAR_SURFACE_PADDING,
    right: -FLOATING_TAB_BAR_SURFACE_PADDING,
    bottom: -FLOATING_TAB_BAR_SURFACE_PADDING,
    left: -FLOATING_TAB_BAR_SURFACE_PADDING,
    borderRadius: (FLOATING_TAB_BAR_PLUS_SIZE + FLOATING_TAB_BAR_SURFACE_PADDING * 2) / 2,
    borderCurve: 'continuous',
    ...TAB_BAR_SURFACE_STYLE,
  },
  plusButtonFace: {
    width: FLOATING_TAB_BAR_PLUS_SIZE,
    height: FLOATING_TAB_BAR_PLUS_SIZE,
    borderRadius: FLOATING_TAB_BAR_PLUS_SIZE / 2,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
});
