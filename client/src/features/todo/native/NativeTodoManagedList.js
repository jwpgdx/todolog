import React, { useMemo } from 'react';

import NativeManagedList from '../../../components/ui/native-managed-list/NativeManagedList';
import { buildManagedTodoSections, TODO_MANAGED_LIST_MODE } from './buildManagedTodoSections';

export { TODO_MANAGED_LIST_MODE };

export default function NativeTodoManagedList({
  listId = 'todo-managed-list',
  mode = TODO_MANAGED_LIST_MODE.CUSTOM,
  todos = [],
  categories = [],
  collapsedCategoryIds = [],
  favoriteTodos = [],
  includeFavoriteSection = false,
  favoriteSectionReorderMode,
  favoriteReorderable,
  favoriteSectionCollapsed = false,
  favoriteItemOptions,
  includeEmptyCategorySections = false,
  nextOccurrenceLabelByTodoId = {},
  itemOptions = {},
  selectionMode = false,
  selectedTodoIds = [],
  contentInsetBottom = 0,
  style,
  onPressTodo,
  onPressSectionHeader,
  onRequestExpandSection,
  onToggleComplete,
  onToggleFavorite,
  onToggleSelection,
  onTodoAction,
  onSectionHeaderAction,
  onReorderCommit,
  onError,
}) {
  const iosCategoryGestureMode = 'custom-lifted';
  const sections = useMemo(
    () =>
      buildManagedTodoSections({
        mode,
        todos,
        categories,
        collapsedCategoryIds,
        favoriteTodos,
        includeFavoriteSection,
        favoriteSectionReorderMode,
        favoriteReorderable,
        favoriteSectionCollapsed,
        favoriteItemOptions,
        includeEmptyCategorySections,
        nextOccurrenceLabelByTodoId,
        itemOptions: {
          ...itemOptions,
          selectionMode,
          selectedTodoIdSet: new Set(selectedTodoIds),
        },
      }),
    [
      mode,
      todos,
      categories,
      collapsedCategoryIds,
      favoriteTodos,
      includeFavoriteSection,
      favoriteSectionReorderMode,
      favoriteReorderable,
      favoriteSectionCollapsed,
      favoriteItemOptions,
      includeEmptyCategorySections,
      nextOccurrenceLabelByTodoId,
      itemOptions,
      selectionMode,
      selectedTodoIds,
    ]
  );

  const todoById = useMemo(() => {
    const entries = [...todos, ...favoriteTodos].map((todo) => [todo._id, todo]);
    return new Map(entries);
  }, [favoriteTodos, todos]);

  const categoryByHeaderItemId = useMemo(() => {
    const entries = categories
      .filter((category) => category?._id)
      .map((category) => [`section-header:${category._id}`, category]);
    return new Map(entries);
  }, [categories]);

  return (
    <NativeManagedList
      listId={listId}
      variant="todo"
      sections={sections}
      iosCategoryGestureMode={iosCategoryGestureMode}
      contentInsetBottom={contentInsetBottom}
      style={style}
      onPressItem={(event) => {
        if (event?.itemKind === 'sectionHeader') {
          onPressSectionHeader?.(event?.sectionId);
          return;
        }
        const { itemId } = event ?? {};
        const todo = todoById.get(itemId);
        if (todo) {
          onPressTodo?.(todo);
        }
      }}
      onControlAction={(event) => {
        const todo = todoById.get(event.itemId);
        if (!todo) {
          return;
        }

        if (event.controlId === 'complete') {
          onToggleComplete?.(todo, event);
          return;
        }

        if (event.controlId === 'favorite') {
          onToggleFavorite?.(todo, event);
          return;
        }

        if (event.controlId === 'select') {
          onToggleSelection?.(todo, event);
        }
      }}
      onAction={(event) => {
        if (event?.itemId?.startsWith('section-header:')) {
          const category = categoryByHeaderItemId.get(event.itemId);
          if (category) {
            onSectionHeaderAction?.(category, event);
          }
          return;
        }

        const todo = todoById.get(event.itemId);
        if (todo) {
          onTodoAction?.(todo, event);
        }
      }}
      onReorderCommit={onReorderCommit}
      onSectionExpandRequest={onRequestExpandSection}
      onError={onError}
    />
  );
}
