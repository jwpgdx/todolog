import { buildManagedTodoItem } from './managedTodoItemAdapter';

export const TODO_MANAGED_LIST_MODE = {
  TIME: 'time',
  CUSTOM: 'custom',
  CATEGORY: 'category',
};

function compareByCreatedAt(a, b) {
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

function compareById(a, b) {
  return String(a?._id || '').localeCompare(String(b?._id || ''));
}

function compareByTimeMode(a, b) {
  const allDayA = a?.isAllDay === true ? 0 : 1;
  const allDayB = b?.isAllDay === true ? 0 : 1;
  if (allDayA !== allDayB) {
    return allDayA - allDayB;
  }

  const startA = String(a?.startTime || '');
  const startB = String(b?.startTime || '');
  if (startA !== startB) {
    return startA.localeCompare(startB);
  }

  const createdOrder = compareByCreatedAt(a, b);
  if (createdOrder !== 0) {
    return createdOrder;
  }

  return compareById(a, b);
}

function compareByCustomOrder(a, b) {
  const orderA = Number(a?.order?.custom ?? 0);
  const orderB = Number(b?.order?.custom ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const createdOrder = compareByCreatedAt(a, b);
  if (createdOrder !== 0) {
    return createdOrder;
  }

  return compareById(a, b);
}

function compareByCategoryOrder(a, b) {
  const orderA = Number(a?.order?.category ?? 0);
  const orderB = Number(b?.order?.category ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const createdOrder = compareByCreatedAt(a, b);
  if (createdOrder !== 0) {
    return createdOrder;
  }

  return compareById(a, b);
}

function compareByFavoriteOrder(a, b) {
  const orderA = Number(a?.order?.favorite ?? 0);
  const orderB = Number(b?.order?.favorite ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const createdOrder = compareByCreatedAt(a, b);
  if (createdOrder !== 0) {
    return createdOrder;
  }

  return compareById(a, b);
}

function compareCategories(a, b) {
  const aInbox = a?.systemKey === 'inbox' ? 0 : 1;
  const bInbox = b?.systemKey === 'inbox' ? 0 : 1;
  if (aInbox !== bInbox) {
    return aInbox - bInbox;
  }

  const orderA = Number(a?.order ?? a?.order_index ?? 0);
  const orderB = Number(b?.order ?? b?.order_index ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  return String(a?.name || '').localeCompare(String(b?.name || ''));
}

function buildDefaultMenuActions(todo, options = {}) {
  const includeFavoriteAction = options.includeFavoriteAction !== false;
  const favoriteActionId = todo?.isFavorite ? 'unfavorite' : 'favorite';
  const favoriteActionTitle = todo?.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가';

  return [
    { id: 'view', title: '보기' },
    { id: 'edit', title: '수정' },
    { id: 'move', title: '이동' },
    ...(includeFavoriteAction
      ? [{ id: favoriteActionId, title: favoriteActionTitle }]
      : []),
    { id: 'duplicate', title: '일정 복사' },
    { id: 'delete', title: '일정 삭제', role: 'destructive' },
  ];
}

function buildDefaultLeadingSwipeActions(todo, options = {}) {
  if (options.includeFavoriteAction === false) {
    return [];
  }

  return [
    {
      id: todo?.isFavorite ? 'unfavorite' : 'favorite',
      title: todo?.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가',
    },
  ];
}

function buildDefaultTrailingSwipeActions() {
  return [
    {
      id: 'delete',
      title: '삭제',
      role: 'destructive',
    },
  ];
}

function buildCategoryHeaderItem(category, options = {}) {
  const isSystemCategory = category?.systemKey === 'inbox';

  return {
    id: `section-header:${category._id}`,
    kind: 'sectionHeader',
    title: category.name || '',
    accentColor: category.color,
    collapsed: options.collapsed === true,
    enabled: true,
    loading: false,
    pinned: isSystemCategory,
    reorderable: options.reorderable === true && !isSystemCategory,
    menuActions: isSystemCategory
      ? []
      : [
          {
            id: 'rename',
            title: '이름 변경',
          },
          {
            id: 'delete',
            title: '삭제',
            role: 'destructive',
          },
        ],
    leadingSwipeActions: [],
    trailingSwipeActions: [],
  };
}

function buildTodoItem(todo, options = {}) {
  return buildManagedTodoItem(todo, {
    enabled: options.enabled,
    loading: options.loading,
    reorderable: options.reorderable,
    includeCompleteToggle: options.includeCompleteToggle !== false,
    completeDisabled: options.completeDisabled,
    includeFavoriteToggle: options.includeFavoriteToggle === true,
    favoriteDisabled: options.favoriteDisabled,
    showFavoriteBadge: options.showFavoriteBadge,
    nextOccurrenceLabel: options.nextOccurrenceLabel,
    menuActions:
      options.menuActions ?? buildDefaultMenuActions(todo, options),
    leadingSwipeActions:
      options.leadingSwipeActions ?? buildDefaultLeadingSwipeActions(todo, options),
    trailingSwipeActions:
      options.trailingSwipeActions ?? buildDefaultTrailingSwipeActions(),
  });
}

function buildFavoriteSection(favoriteTodos, options = {}) {
  if (!favoriteTodos?.length) {
    return null;
  }

  const items = [...favoriteTodos]
    .sort(compareByFavoriteOrder)
    .map((todo) =>
      buildTodoItem(todo, {
        ...options.favoriteItemOptions,
        reorderable: options.favoriteReorderable !== false,
        showFavoriteBadge: false,
        nextOccurrenceLabel: options.nextOccurrenceLabelByTodoId?.[todo._id],
      })
    );

  return {
    id: 'favorites',
    title: '즐겨찾기',
    role: 'favorites',
    reorderMode: options.favoriteSectionReorderMode ?? 'withinSection',
    items,
  };
}

export function buildManagedTodoSections({
  mode = TODO_MANAGED_LIST_MODE.CUSTOM,
  todos = [],
  categories = [],
  collapsedCategoryIds = [],
  favoriteTodos = [],
  includeFavoriteSection = false,
  includeEmptyCategorySections = false,
  nextOccurrenceLabelByTodoId = {},
  itemOptions = {},
} = {}) {
  const sections = [];
  const favoriteSection = includeFavoriteSection
    ? buildFavoriteSection(favoriteTodos, {
        favoriteSectionReorderMode:
          mode === TODO_MANAGED_LIST_MODE.TIME ? 'none' : 'acrossSections',
        favoriteReorderable: mode !== TODO_MANAGED_LIST_MODE.TIME,
        nextOccurrenceLabelByTodoId,
      })
    : null;

  if (favoriteSection) {
    sections.push(favoriteSection);
  }

  if (mode === TODO_MANAGED_LIST_MODE.TIME) {
    sections.push({
      id: 'todos',
      role: 'date',
      reorderMode: 'none',
      items: [...todos]
        .sort(compareByTimeMode)
        .map((todo) =>
          buildTodoItem(todo, {
            ...itemOptions,
            reorderable: false,
            showFavoriteBadge: false,
          })
        ),
    });

    return sections;
  }

  if (mode === TODO_MANAGED_LIST_MODE.CUSTOM) {
    sections.push({
      id: 'todos',
      role: 'normal',
      reorderMode: includeFavoriteSection ? 'acrossSections' : 'withinSection',
      items: [...todos]
        .sort(compareByCustomOrder)
        .map((todo) =>
          buildTodoItem(todo, {
            ...itemOptions,
            reorderable: true,
            showFavoriteBadge: false,
          })
        ),
    });

    return sections;
  }

  const sortedCategories = [...categories].sort(compareCategories);
  const collapsedCategoryIdSet = new Set(collapsedCategoryIds);
  const todosByCategoryId = new Map();

  todos.forEach((todo) => {
    const key = todo?.categoryId || 'uncategorized';
    if (!todosByCategoryId.has(key)) {
      todosByCategoryId.set(key, []);
    }

    todosByCategoryId.get(key).push(todo);
  });

  sortedCategories.forEach((category) => {
    const categoryTodos = todosByCategoryId.get(category._id) ?? [];
    const isCollapsed = collapsedCategoryIdSet.has(category._id);
    if (!includeEmptyCategorySections && categoryTodos.length === 0) {
      return;
    }

    sections.push({
      id: category._id,
      role: 'category',
      reorderMode: 'acrossSections',
      items: [
        buildCategoryHeaderItem(category, {
          collapsed: isCollapsed,
          reorderable: category?.systemKey !== 'inbox',
        }),
        ...[...categoryTodos]
          .sort(compareByCategoryOrder)
          .map((todo) => ({
            ...buildTodoItem(todo, {
              ...itemOptions,
              reorderable: true,
              showFavoriteBadge: false,
            }),
            hidden: isCollapsed,
          })),
      ],
    });
  });

  return sections;
}
