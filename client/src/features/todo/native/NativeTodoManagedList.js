import React, { useMemo } from 'react';

import NativeManagedList from '../../../components/ui/native-managed-list/NativeManagedList';
import { buildManagedTodoSections, TODO_MANAGED_LIST_MODE } from './buildManagedTodoSections';

export { TODO_MANAGED_LIST_MODE };

export default function NativeTodoManagedList({
  listId = 'todo-managed-list',
  mode = TODO_MANAGED_LIST_MODE.CUSTOM,
  todos = [],
  categories = [],
  favoriteTodos = [],
  includeFavoriteSection = false,
  includeEmptyCategorySections = false,
  nextOccurrenceLabelByTodoId = {},
  style,
  onPressTodo,
  onToggleComplete,
  onToggleFavorite,
  onTodoAction,
  onReorderCommit,
  onError,
}) {
  const sections = useMemo(
    () =>
      buildManagedTodoSections({
        mode,
        todos,
        categories,
        favoriteTodos,
        includeFavoriteSection,
        includeEmptyCategorySections,
        nextOccurrenceLabelByTodoId,
      }),
    [
      mode,
      todos,
      categories,
      favoriteTodos,
      includeFavoriteSection,
      includeEmptyCategorySections,
      nextOccurrenceLabelByTodoId,
    ]
  );

  const todoById = useMemo(() => {
    const entries = [...todos, ...favoriteTodos].map((todo) => [todo._id, todo]);
    return new Map(entries);
  }, [favoriteTodos, todos]);

  return (
    <NativeManagedList
      listId={listId}
      variant="todo"
      sections={sections}
      style={style}
      onPressItem={({ itemId }) => {
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
        const todo = todoById.get(event.itemId);
        if (todo) {
          onTodoAction?.(todo, event);
        }
      }}
      onReorderCommit={onReorderCommit}
      onError={onError}
    />
  );
}
