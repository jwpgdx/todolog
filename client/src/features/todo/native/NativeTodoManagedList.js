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
  includeEmptyCategorySections = false,
  nextOccurrenceLabelByTodoId = {},
  itemOptions = {},
  contentInsetBottom = 0,
  style,
  onPressTodo,
  onPressSectionHeader,
  onRequestExpandSection,
  onToggleComplete,
  onToggleFavorite,
  onTodoAction,
  onSectionHeaderAction,
  onReorderCommit,
  onError,
}) {
  const iosCategoryGestureMode =
    mode === TODO_MANAGED_LIST_MODE.TIME ? 'system' : 'custom-lifted';
  const sections = useMemo(
    () =>
      buildManagedTodoSections({
        mode,
        todos,
        categories,
        collapsedCategoryIds,
        favoriteTodos,
        includeFavoriteSection,
        includeEmptyCategorySections,
        nextOccurrenceLabelByTodoId,
        itemOptions,
      }),
    [
      mode,
      todos,
      categories,
      collapsedCategoryIds,
      favoriteTodos,
      includeFavoriteSection,
      includeEmptyCategorySections,
      nextOccurrenceLabelByTodoId,
      itemOptions,
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
