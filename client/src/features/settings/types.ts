export type ScreenKind =
  | 'settingsList'
  | 'selectionList'
  | 'categoryManager'
  | 'pickerHost';

export type RowKind =
  | 'navigationValue'
  | 'staticValue'
  | 'toggle'
  | 'menu'
  | 'selectionNavigation'
  | 'expandableParent'
  | 'embeddedContent'
  | 'action'
  | 'destructiveAction'
  | 'interactiveCategory';

export type SelectionOption = {
  id: string;
  label: string;
  subtitle?: string;
  keywords?: string[];
  leadingColor?: string;
};

export type SwipeActionSpec = {
  id: string;
  title: string;
  role?: 'normal' | 'destructive';
};

export type MenuActionSpec = {
  id: string;
  title: string;
  role?: 'normal' | 'destructive';
};

export type TemporalConfig = {
  mode: 'date' | 'time' | 'dateTime' | 'countDownTimer';
  minISO?: string;
  maxISO?: string;
  minuteInterval?: number;
  locale?: string;
  timeZone?: string;
  calendar?: string;
  presentation?: 'inline' | 'sheet' | 'dialog' | 'compact';
};

export type CommonItemState = {
  enabled?: boolean;
  loading?: boolean;
  errorMessage?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
};

type BaseSettingsItem = {
  id: string;
} & CommonItemState;

export type NavigationValueItem = BaseSettingsItem & {
  kind: 'navigationValue';
  title: string;
  subtitle?: string;
  value?: string;
  destination: string;
};

export type StaticValueItem = BaseSettingsItem & {
  kind: 'staticValue';
  title: string;
  subtitle?: string;
  value?: string;
};

export type ToggleItem = BaseSettingsItem & {
  kind: 'toggle';
  title: string;
  subtitle?: string;
  value: boolean;
  childVisibilityKey?: string;
};

export type MenuItem = BaseSettingsItem & {
  kind: 'menu';
  title: string;
  subtitle?: string;
  value?: string;
  options: SelectionOption[];
  selectedOptionId?: string;
};

export type SelectionNavigationItem = BaseSettingsItem & {
  kind: 'selectionNavigation';
  title: string;
  subtitle?: string;
  value?: string;
  selectionScreenId: string;
};

export type ExpandableParentItem = BaseSettingsItem & {
  kind: 'expandableParent';
  title: string;
  subtitle?: string;
  value?: string;
  expanded: boolean;
  embeddedContentId: string;
};

export type EmbeddedContentItem = BaseSettingsItem & {
  kind: 'embeddedContent';
  contentType: 'date' | 'time' | 'dateTime' | 'custom';
  temporalConfig?: TemporalConfig;
};

export type ActionItem = BaseSettingsItem & {
  kind: 'action';
  title: string;
  subtitle?: string;
};

export type DestructiveActionItem = BaseSettingsItem & {
  kind: 'destructiveAction';
  title: string;
  subtitle?: string;
  confirmStyle?: 'alert' | 'sheet';
};

export type InteractiveCategoryItem = BaseSettingsItem & {
  kind: 'interactiveCategory';
  title: string;
  subtitle?: string;
  reorderable: boolean;
  pinned?: boolean;
  swipeActions?: SwipeActionSpec[];
  menuActions?: MenuActionSpec[];
};

export type SettingsItem =
  | NavigationValueItem
  | StaticValueItem
  | ToggleItem
  | MenuItem
  | SelectionNavigationItem
  | ExpandableParentItem
  | EmbeddedContentItem
  | ActionItem
  | DestructiveActionItem
  | InteractiveCategoryItem;

export type SettingsSection = {
  id: string;
  title?: string;
  footer?: string;
  items: SettingsItem[];
};

export type SelectionListModel = {
  screenId: string;
  title: string;
  subtitle?: string;
  options: SelectionOption[];
  selectedIds: string[];
  searchEnabled?: boolean;
  allowsMultiple?: boolean;
  emptyStateText?: string;
};

export type PickerHostModel = {
  screenId: string;
  pickerId: string;
  title: string;
  subtitle?: string;
  valueISO?: string;
  allDay?: boolean;
  allowsAllDay?: boolean;
  expanded?: boolean;
  activeField?: 'date' | 'time';
  temporalConfig: TemporalConfig;
};
