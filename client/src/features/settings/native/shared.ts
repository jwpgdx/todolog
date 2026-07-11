import { Platform } from 'react-native';

import type {
  PickerHostModel,
  RowKind,
  SelectionListModel,
  SettingsSection,
} from '../types';

const ROW_HEIGHTS: Record<RowKind, number> = {
  navigationValue: 62,
  staticValue: 58,
  toggle: 68,
  menu: 62,
  selectionNavigation: 62,
  expandableParent: 62,
  embeddedContent: 152,
  action: 54,
  destructiveAction: 54,
  interactiveCategory: 72,
};

export function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function extractNativePayload<T>(event: unknown): T {
  if (event && typeof event === 'object' && 'nativeEvent' in event) {
    return ((event as { nativeEvent?: T }).nativeEvent ?? {}) as T;
  }
  return (event ?? {}) as T;
}

export function estimateSettingsListHeight(sections: SettingsSection[]): number {
  const headerHeight = Platform.OS === 'ios' ? 24 : 20;
  const footerHeight = Platform.OS === 'ios' ? 26 : 22;
  const sectionGap = Platform.OS === 'ios' ? 18 : 16;
  const base = 36;

  return sections.reduce((total, section) => {
    const rowsHeight = section.items.reduce(
      (sum, item) => sum + ROW_HEIGHTS[item.kind],
      0
    );

    return (
      total +
      rowsHeight +
      (section.title ? headerHeight : 0) +
      (section.footer ? footerHeight : 0) +
      sectionGap
    );
  }, base);
}

export function estimateSelectionListHeight(model: SelectionListModel): number {
  const searchHeight = model.searchEnabled ? 54 : 0;
  const hasTitle = Boolean(model.title?.trim());
  const hasSubtitle = Boolean(model.subtitle?.trim());
  const headerHeight = hasTitle ? (hasSubtitle ? 52 : 32) : hasSubtitle ? 34 : 0;
  const headerChromeHeight = hasTitle || hasSubtitle || model.searchEnabled ? 40 : 0;
  const rowHeight = 56;
  const rowCount = model.searchEnabled ? Math.min(model.options.length, 8) : model.options.length;
  return headerChromeHeight + headerHeight + searchHeight + rowCount * rowHeight;
}

export function estimatePickerHostHeight(model: PickerHostModel): number {
  if (Platform.OS !== 'ios') {
    const base = 220;
    const modeBonus =
      model.temporalConfig.mode === 'dateTime'
        ? 40
        : model.temporalConfig.mode === 'countDownTimer'
          ? 10
          : 0;
    return base + modeBonus;
  }

  const expanded = model.expanded !== false;

  if (!expanded) {
    return model.allDay ? 220 : 250;
  }

  switch (model.temporalConfig.mode) {
    case 'dateTime':
      return model.allDay ? 520 : 660;
    case 'date':
      return 470;
    case 'time':
      return 360;
    case 'countDownTimer':
      return 320;
    default:
      return 420;
  }
}
