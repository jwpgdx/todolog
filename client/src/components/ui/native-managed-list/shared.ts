import { Platform } from 'react-native';

import type {
  ManagedListAction,
  ManagedListControl,
  ManagedListItem,
  ManagedListSection,
  ManagedListVariant,
} from './types';
import type {
  ManagedListActionEvent,
  ManagedListControlActionEvent,
  ManagedListPressEvent,
  ManagedListReorderCommitEvent,
} from './contracts';

type LegacyNativeListItem = {
  id: string;
  kind: 'pageTitle' | 'category' | 'todo' | 'sectionHeader' | 'sectionDivider';
  title: string;
  subtitle?: string;
  metaText?: string;
  collapsed?: boolean;
  hidden?: boolean;
  dropTargetable?: boolean;
  accentColor?: string;
  reorderable: boolean;
  deletable: boolean;
  supportsMenu: boolean;
  menuActions: string[];
  switchValue?: boolean;
  toggleControlId?: string;
  toggleControlSource?: 'leadingControl' | 'trailingControl';
  completed?: boolean;
  selected?: boolean;
};

type LegacyNativeListSection = {
  id: string;
  title?: string;
  footer?: string;
  reorderMode?: 'none' | 'withinSection' | 'acrossSections';
  dropOutsideReorderRangeBehavior?: 'returnOriginal';
  items: LegacyNativeListItem[];
};

const CATEGORY_ROW_HEIGHT = Platform.OS === 'ios' ? 68 : 72;
const TODO_ROW_HEIGHT = Platform.OS === 'ios' ? 64 : 68;
const HEADER_HEIGHT = Platform.OS === 'ios' ? 30 : 24;
const FOOTER_HEIGHT = Platform.OS === 'ios' ? 34 : 28;
const SECTION_GAP = Platform.OS === 'ios' ? 18 : 16;
const SECTION_DIVIDER_HEIGHT = Platform.OS === 'ios' ? 16 : 14;
const BASE_LIST_PADDING = 24;

function getSectionReorderMode(section: ManagedListSection) {
  return section.reorderMode ?? 'withinSection';
}

function isInteractiveItem(item: ManagedListItem) {
  return item.enabled !== false && item.loading !== true;
}

export function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function extractNativePayload<T>(event: unknown): T {
  if (event && typeof event === 'object' && 'nativeEvent' in event) {
    return ((event as { nativeEvent?: T }).nativeEvent ?? {}) as T;
  }

  return (event ?? {}) as T;
}

export function estimateManagedListHeight(
  sections: ManagedListSection[],
  variant: ManagedListVariant
): number {
  const rowHeight = variant === 'category' ? CATEGORY_ROW_HEIGHT : TODO_ROW_HEIGHT;

  return sections.reduce((total, section) => {
    const visibleItems = section.items.filter((item) => item.hidden !== true);
    const itemsHeight = visibleItems.reduce((itemsTotal, item) => {
      if (item.kind === 'sectionDivider') {
        return itemsTotal + SECTION_DIVIDER_HEIGHT;
      }

      return itemsTotal + rowHeight;
    }, 0);

    return (
      total +
      itemsHeight +
      (section.title ? HEADER_HEIGHT : 0) +
      (section.footer ? FOOTER_HEIGHT : 0) +
      SECTION_GAP
    );
  }, BASE_LIST_PADDING);
}

export function validateManagedListSections(
  variant: ManagedListVariant,
  sections: ManagedListSection[]
): string[] {
  const warnings: string[] = [];

  if (variant === 'favoriteTodo') {
    warnings.push(
      `variant="${variant}" is not wired yet. v0 native path supports "category" and "todo".`
    );
  }

  sections.forEach((section) => {
    const reorderMode = getSectionReorderMode(section);

    if (variant === 'category' && reorderMode === 'acrossSections') {
      warnings.push(
        `section "${section.id}" requested acrossSections reorder, but v0 only supports withinSection.`
      );
    }

    section.items.forEach((item) => {
      if (variant === 'category' && item.kind !== 'category') {
        warnings.push(
          `section "${section.id}" contains non-category item "${item.id}". category v0 renders category rows only.`
        );
      }

      if (variant === 'todo' && item.kind !== 'todo') {
        if (item.kind === 'pageTitle' || item.kind === 'sectionHeader' || item.kind === 'sectionDivider') {
          return;
        }

        warnings.push(
          `section "${section.id}" contains non-todo item "${item.id}". todo v0 renders todo rows only.`
        );
      }

      if (variant === 'category' && (item.leadingControl || item.trailingControl)) {
        warnings.push(
          `item "${item.id}" defines controls, but v0 category adapter does not wire native controls yet.`
        );
      }

      const actions = [
        ...(item.menuActions ?? []),
        ...(item.leadingSwipeActions ?? []),
        ...(item.trailingSwipeActions ?? []),
      ];

      actions.forEach((action) => {
        if (!action.title?.trim()) {
          warnings.push(`item "${item.id}" defines action "${action.id}" without a title.`);
        }
      });

      const swipeActions = [
        ...(item.leadingSwipeActions ?? []),
        ...(item.trailingSwipeActions ?? []),
      ];

      const unsupportedSwipeActions = swipeActions.filter(
        (action) => action.id !== 'delete'
      );

      if (unsupportedSwipeActions.length > 0) {
        warnings.push(
          `item "${item.id}" defines non-delete swipe actions, but v0 category adapter only maps delete.`
        );
      }
    });
  });

  return warnings;
}

function shouldExposeDeleteAction(item: ManagedListItem): boolean {
  if (!isInteractiveItem(item)) {
    return false;
  }

  const allActions = [
    ...(item.menuActions ?? []),
    ...(item.leadingSwipeActions ?? []),
    ...(item.trailingSwipeActions ?? []),
  ];

  return allActions.some((action) => action.id === 'delete');
}

function normalizeMenuActionIds(actions?: ManagedListAction[]): string[] {
  if (!actions) {
    return [];
  }

  return [...new Set(actions.map((action) => action.id).filter((id) => id !== 'delete'))];
}

function formatSubLabels(item: ManagedListItem): string | undefined {
  if (!item.subLabels?.length) {
    return undefined;
  }

  return item.subLabels
    .map((subLabel) => {
      const prefix = subLabel.icon ? `${subLabel.icon} ` : '';
      return `${prefix}${subLabel.text}`.trim();
    })
    .join(' · ');
}

function resolveNativeToggleControl(item: ManagedListItem): {
  controlId: string;
  source: 'leadingControl' | 'trailingControl';
  value: boolean;
} | null {
  if (item.leadingControl?.kind === 'toggle') {
    return {
      controlId: item.leadingControl.id,
      source: 'leadingControl',
      value: item.leadingControl.value,
    };
  }

  if (item.trailingControl?.kind === 'toggle') {
    return {
      controlId: item.trailingControl.id,
      source: 'trailingControl',
      value: item.trailingControl.value,
    };
  }

  return null;
}

export function mapManagedSectionsToLegacyNativeSections(
  variant: ManagedListVariant,
  sections: ManagedListSection[]
): LegacyNativeListSection[] {
  if (variant === 'favoriteTodo') {
    return [];
  }

  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    footer: section.footer,
    reorderMode: getSectionReorderMode(section),
    dropOutsideReorderRangeBehavior: section.dropOutsideReorderRangeBehavior,
    items: section.items.map((item) => {
      const toggleControl = resolveNativeToggleControl(item);

      return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        disabled: item.enabled === false || item.loading === true,
        subtitle: item.subtitle ?? formatSubLabels(item),
        metaText: item.metaText,
        collapsed: item.collapsed,
        hidden: item.hidden,
        dropTargetable: item.dropTargetable,
        accentColor: item.accentColor,
        reorderable:
          (getSectionReorderMode(section) === 'withinSection' ||
            getSectionReorderMode(section) === 'acrossSections') &&
          isInteractiveItem(item) &&
          item.reorderable === true &&
          item.pinned !== true,
        deletable: shouldExposeDeleteAction(item),
        supportsMenu:
          isInteractiveItem(item) &&
          ((item.menuActions?.length ?? 0) > 0 || shouldExposeDeleteAction(item)),
        menuActions: normalizeMenuActionIds(item.menuActions),
        switchValue: toggleControl?.value,
        toggleControlId: toggleControl?.controlId,
        toggleControlSource: toggleControl?.source,
        completed: item.completed === true,
        selected: item.selected === true,
      };
    }),
  }));
}

export function buildManagedReorderCommitEventFromNativeSections(
  listId: string | undefined,
  sections: ManagedListSection[],
  payload: {
    movedItemId?: string;
    fromSectionId?: string;
    toSectionId?: string;
    sections?: Array<{
      sectionId?: string;
      orderedItemIds?: string[];
    }>;
  }
): ManagedListReorderCommitEvent {
  const knownItemIds = new Set(
    sections.flatMap((section) => section.items.map((item) => item.id))
  );
  const fallbackSections = buildFallbackSectionOrders(sections);
  const nativeSections = Array.isArray(payload.sections) ? payload.sections : [];

  if (nativeSections.length === 0) {
    return {
      listId,
      movedItemId: payload.movedItemId,
      fromSectionId: payload.fromSectionId,
      toSectionId: payload.toSectionId,
      sections: fallbackSections,
    };
  }

  const normalized = nativeSections
    .filter((section) => typeof section?.sectionId === 'string')
    .map((section) => ({
      sectionId: section.sectionId as string,
      orderedItemIds: Array.isArray(section?.orderedItemIds)
        ? section.orderedItemIds.filter((itemId) => knownItemIds.has(itemId))
        : [],
    }));

  const normalizedSectionIdSet = new Set(normalized.map((section) => section.sectionId));
  const remainingSections = fallbackSections.filter(
    (section) => !normalizedSectionIdSet.has(section.sectionId)
  );

  return {
    listId,
    movedItemId: payload.movedItemId,
    fromSectionId: payload.fromSectionId,
    toSectionId: payload.toSectionId,
    sections: [...normalized, ...remainingSections],
  };
}

export function findManagedItemLocation(
  sections: ManagedListSection[],
  itemId: string
): { sectionId: string; item: ManagedListItem } | null {
  for (const section of sections) {
    const item = section.items.find((candidate) => candidate.id === itemId);
    if (item) {
      return {
        sectionId: section.id,
        item,
      };
    }
  }

  return null;
}

export function buildManagedPressEvent(
  listId: string | undefined,
  sections: ManagedListSection[],
  itemId: string
): ManagedListPressEvent | null {
  const location = findManagedItemLocation(sections, itemId);

  if (!location) {
    return null;
  }

  return {
    listId,
    sectionId: location.sectionId,
    itemId,
    itemKind: location.item.kind,
  };
}

export function buildManagedActionEvent(
  listId: string | undefined,
  sections: ManagedListSection[],
  itemId: string,
  actionId: string,
  source: ManagedListActionEvent['source']
): ManagedListActionEvent | null {
  const location = findManagedItemLocation(sections, itemId);

  if (!location) {
    return null;
  }

  return {
    listId,
    sectionId: location.sectionId,
    itemId,
    actionId,
    source,
  };
}

function resolveControl(
  item: ManagedListItem,
  preferredControlId?: string,
  preferredSource?: ManagedListControlActionEvent['source']
): { control: ManagedListControl; source: ManagedListControlActionEvent['source'] } | null {
  const controls: Array<{
    control: ManagedListControl;
    source: ManagedListControlActionEvent['source'];
  }> = [];

  if (item.leadingControl?.kind === 'toggle') {
    controls.push({
      control: item.leadingControl,
      source: 'leadingControl',
    });
  }

  if (item.trailingControl?.kind === 'toggle') {
    controls.push({
      control: item.trailingControl,
      source: 'trailingControl',
    });
  }

  if (preferredControlId || preferredSource) {
    const preferred = controls.find(({ control, source }) => {
      if (preferredControlId && control.id !== preferredControlId) {
        return false;
      }

      if (preferredSource && source !== preferredSource) {
        return false;
      }

      return true;
    });

    if (preferred) {
      return preferred;
    }
  }

  return controls[0] ?? null;
}

export function buildManagedControlActionEvent(
  listId: string | undefined,
  sections: ManagedListSection[],
  itemId: string,
  value: boolean,
  options?: {
    controlId?: string;
    source?: ManagedListControlActionEvent['source'];
  }
): ManagedListControlActionEvent | null {
  const location = findManagedItemLocation(sections, itemId);

  if (!location) {
    return null;
  }

  const resolved = resolveControl(
    location.item,
    options?.controlId,
    options?.source
  );

  if (!resolved) {
    return null;
  }

  return {
    listId,
    sectionId: location.sectionId,
    itemId,
    controlId: resolved.control.id,
    controlKind: resolved.control.kind,
    value,
    source: resolved.source,
  };
}

function buildFallbackSectionOrders(
  sections: ManagedListSection[]
): ManagedListReorderCommitEvent['sections'] {
  return sections.map((section) => ({
    sectionId: section.id,
    orderedItemIds: section.items.map((item) => item.id),
  }));
}

function resolveReorderedSectionId(
  sections: ManagedListSection[],
  orderedIds: string[]
): string | undefined {
  if (orderedIds.length === 0) {
    return undefined;
  }

  const exactMatch = sections.find((section) => {
    const itemIds = new Set(section.items.map((item) => item.id));
    return orderedIds.every((itemId) => itemIds.has(itemId));
  });

  if (exactMatch) {
    return exactMatch.id;
  }

  const reorderableSection = sections.find(
    (section) => getSectionReorderMode(section) !== 'none'
  );

  return reorderableSection?.id;
}

function buildOrderedItemIdsForSection(
  section: ManagedListSection,
  orderedIds: string[]
): string[] {
  const existingIds = section.items.map((item) => item.id);
  const existingIdSet = new Set(existingIds);
  const nextOrdered = orderedIds.filter((itemId) => existingIdSet.has(itemId));
  const remaining = existingIds.filter((itemId) => !nextOrdered.includes(itemId));
  return [...nextOrdered, ...remaining];
}

export function buildManagedReorderCommitEvent(
  listId: string | undefined,
  sections: ManagedListSection[],
  orderedIds: string[]
): ManagedListReorderCommitEvent {
  const reorderedSectionId = resolveReorderedSectionId(sections, orderedIds);

  if (!reorderedSectionId) {
    return {
      listId,
      sections: buildFallbackSectionOrders(sections),
    };
  }

  return {
    listId,
    fromSectionId: reorderedSectionId,
    toSectionId: reorderedSectionId,
    sections: sections.map((section) => ({
      sectionId: section.id,
      orderedItemIds:
        section.id === reorderedSectionId
          ? buildOrderedItemIdsForSection(section, orderedIds)
          : section.items.map((item) => item.id),
    })),
  };
}
