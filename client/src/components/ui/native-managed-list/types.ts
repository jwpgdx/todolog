export type ManagedListVariant = 'category' | 'todo' | 'favoriteTodo';

export type ManagedListSectionRole =
  | 'normal'
  | 'favorites'
  | 'category'
  | 'date';

export type ManagedListReorderMode =
  | 'none'
  | 'withinSection'
  | 'acrossSections';

export type ManagedListItemKind = 'category' | 'todo' | 'sectionHeader';

export type ManagedListActionRole = 'normal' | 'destructive';

export type ManagedListActionSource =
  | 'menu'
  | 'leadingSwipe'
  | 'trailingSwipe'
  | 'unknown';

export type ManagedListControlKind = 'toggle';

export type ManagedListSubLabelTone =
  | 'default'
  | 'muted'
  | 'accent'
  | 'warning';

export type ManagedListSubLabel = {
  id: string;
  text: string;
  icon?: string;
  tone?: ManagedListSubLabelTone;
};

export type ManagedListAction = {
  id: string;
  title: string;
  role?: ManagedListActionRole;
  systemIcon?: string;
};

export type ManagedListControl = {
  id: string;
  kind: ManagedListControlKind;
  value: boolean;
  disabled?: boolean;
};

export type ManagedListItem = {
  id: string;
  kind: ManagedListItemKind;
  title: string;
  subtitle?: string;
  metaText?: string;
  collapsed?: boolean;
  hidden?: boolean;
  subLabels?: ManagedListSubLabel[];
  enabled?: boolean;
  loading?: boolean;
  pinned?: boolean;
  reorderable?: boolean;
  selected?: boolean;
  completed?: boolean;
  favorite?: boolean;
  accentColor?: string;
  leadingControl?: ManagedListControl;
  trailingControl?: ManagedListControl;
  menuActions?: ManagedListAction[];
  leadingSwipeActions?: ManagedListAction[];
  trailingSwipeActions?: ManagedListAction[];
};

export type ManagedListSection = {
  id: string;
  title?: string;
  footer?: string;
  role?: ManagedListSectionRole;
  reorderMode?: ManagedListReorderMode;
  items: ManagedListItem[];
};
