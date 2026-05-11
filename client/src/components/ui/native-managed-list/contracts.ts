import type { StyleProp, ViewStyle } from 'react-native';

import type {
  ManagedListActionSource,
  ManagedListControlKind,
  ManagedListItemKind,
  ManagedListSection,
  ManagedListVariant,
} from './types';

export type NativeManagedListErrorEvent = {
  code: string;
  message: string;
};

export type ManagedListPressEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  itemKind: ManagedListItemKind;
};

export type ManagedListActionEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  actionId: string;
  source: ManagedListActionSource;
};

export type ManagedListControlActionEvent = {
  listId?: string;
  sectionId: string;
  itemId: string;
  controlId: string;
  controlKind: ManagedListControlKind;
  value: boolean;
  source: 'leadingControl' | 'trailingControl';
};

export type ManagedListReorderSection = {
  sectionId: string;
  orderedItemIds: string[];
};

export type ManagedListReorderCommitEvent = {
  listId?: string;
  movedItemId?: string;
  fromSectionId?: string;
  toSectionId?: string;
  sections: ManagedListReorderSection[];
};

export type ManagedListSectionExpandRequestEvent = {
  listId?: string;
  sectionId: string;
};

export type NativeManagedListProps = {
  listId?: string;
  variant: ManagedListVariant;
  sections: ManagedListSection[];
  iosCategoryGestureMode?: 'system' | 'custom-experiment' | 'custom-lifted' | 'system-custom';
  contentInsetBottom?: number;
  style?: StyleProp<ViewStyle>;
  onPressItem?: (event: ManagedListPressEvent) => void;
  onAction?: (event: ManagedListActionEvent) => void;
  onControlAction?: (event: ManagedListControlActionEvent) => void;
  onReorderCommit?: (event: ManagedListReorderCommitEvent) => void;
  onSectionExpandRequest?: (event: ManagedListSectionExpandRequestEvent) => void;
  onError?: (event: NativeManagedListErrorEvent) => void;
};
