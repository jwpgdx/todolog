export const FLOATING_TAB_BAR_HORIZONTAL_INSET = 25;
export const FLOATING_TAB_BAR_MIN_SAFE_CLEARANCE = 25;
export const FLOATING_TAB_BAR_BOTTOM_PADDING = 0;
export const FLOATING_TAB_BAR_TOP_MARGIN = 16;
export const FLOATING_TAB_BAR_HEIGHT = 62;
export const FLOATING_TAB_BAR_RADIUS = 100; // v
export const FLOATING_TAB_BAR_SURFACE_PADDING = 4;
export const FLOATING_TAB_BAR_BLUR_INTENSITY = 8;
export const FLOATING_TAB_BAR_PADDING_X = FLOATING_TAB_BAR_SURFACE_PADDING;
export const FLOATING_TAB_BAR_PADDING_Y = FLOATING_TAB_BAR_SURFACE_PADDING;
export const FLOATING_TAB_BAR_ITEM_HEIGHT = 54;
export const FLOATING_TAB_BAR_ICON_SIZE = 28; // v
export const FLOATING_TAB_BAR_PLUS_SIZE = 54;
export const FLOATING_TAB_BAR_ACTION_GAP = 16; // v
export const FLOATING_TAB_BAR_ITEM_GAP = -10; // v

export function getFloatingTabBarBottomOffset(safeAreaBottom = 0) {
  return Math.max(safeAreaBottom, FLOATING_TAB_BAR_MIN_SAFE_CLEARANCE) + FLOATING_TAB_BAR_BOTTOM_PADDING;
}

export function getFloatingTabBarOccupiedInset(safeAreaBottom = 0) {
  return getFloatingTabBarBottomOffset(safeAreaBottom) + FLOATING_TAB_BAR_TOP_MARGIN + FLOATING_TAB_BAR_HEIGHT;
}
