import type { StyleProp, ViewStyle } from 'react-native';

import type {
  PickerHostModel,
  SelectionListModel,
  SettingsSection,
} from './types';

export type PressItemEvent = {
  itemId: string;
  kind: string;
};

export type ToggleChangeEvent = {
  itemId: string;
  value: boolean;
};

export type MenuActionEvent = {
  itemId: string;
  actionId: string;
};

export type NavigateEvent = {
  itemId: string;
  destination: string;
};

export type SelectionCommitEvent = {
  screenId: string;
  selectedIds: string[];
};

export type ExpandChangeEvent = {
  itemId: string;
  expanded: boolean;
};

export type ReorderCommitEvent = {
  orderedItemIds: string[];
};

export type SwipeActionEvent = {
  itemId: string;
  actionId: string;
};

export type RequestDeleteEvent = {
  itemId: string;
};

export type NativeSettingsErrorEvent = {
  code: string;
  message: string;
};

type BaseNativeViewProps = {
  style?: StyleProp<ViewStyle>;
  onError?: (event: NativeSettingsErrorEvent) => void;
};

export type NativeSettingsListProps = BaseNativeViewProps & {
  screenId?: string;
  sections: SettingsSection[];
  onPressItem?: (event: PressItemEvent) => void;
  onToggleChange?: (event: ToggleChangeEvent) => void;
  onMenuAction?: (event: MenuActionEvent) => void;
  onNavigate?: (event: NavigateEvent) => void;
  onExpandChange?: (event: ExpandChangeEvent) => void;
};

export type NativeSelectionListProps = BaseNativeViewProps &
  SelectionListModel & {
    onPressItem?: (event: PressItemEvent) => void;
    onSelectionCommit?: (event: SelectionCommitEvent) => void;
  };

export type NativeCategoryManagerProps = BaseNativeViewProps & {
  screenId?: string;
  sections: SettingsSection[];
  onPressItem?: (event: PressItemEvent) => void;
  onMenuAction?: (event: MenuActionEvent) => void;
  onReorderCommit?: (event: ReorderCommitEvent) => void;
  onSwipeAction?: (event: SwipeActionEvent) => void;
  onRequestDelete?: (event: RequestDeleteEvent) => void;
};

export type NativePickerHostProps = BaseNativeViewProps & PickerHostModel;
