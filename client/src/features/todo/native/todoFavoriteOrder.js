import { ORDER_STEP } from '../../../services/db/todoService';

function compareByCreatedAt(a, b) {
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

function compareById(a, b) {
  return String(a?._id || '').localeCompare(String(b?._id || ''));
}

export function compareByFavoriteOrder(a, b) {
  const orderA = Number(a?.order?.favorite ?? a?.favoriteOrder ?? 0);
  const orderB = Number(b?.order?.favorite ?? b?.favoriteOrder ?? 0);
  if (orderA !== orderB) {
    return orderA - orderB;
  }

  const createdOrder = compareByCreatedAt(a, b);
  if (createdOrder !== 0) {
    return createdOrder;
  }

  return compareById(a, b);
}

export function getSortedFavoriteTodos(todos = []) {
  return (Array.isArray(todos) ? todos : [])
    .filter((todo) => todo?.isFavorite === true)
    .sort(compareByFavoriteOrder);
}

export function getFavoriteTodoIdSet(favoriteTodos = []) {
  return new Set(favoriteTodos.map((todo) => todo._id));
}

export function buildFavoriteOrderUpdatesFromEvent(event, todoById) {
  const favoriteSection = event?.sections?.find(
    (section) => section.sectionId === 'favorites'
  );
  if (!todoById) {
    return [];
  }

  const updates = [];

  (favoriteSection?.orderedItemIds || [])
    .filter((itemId) => todoById.has(itemId))
    .forEach((todoId, index) => {
      const todo = todoById.get(todoId);
      const nextOrder = (index + 1) * ORDER_STEP;
      const currentOrder = Number(todo?.order?.favorite ?? todo?.favoriteOrder ?? 0);

      if (currentOrder === nextOrder) {
        return;
      }

      updates.push({
        id: todoId,
        order: {
          favorite: nextOrder,
        },
      });
    });

  const movedOutOfFavorites =
    event?.fromSectionId === 'favorites' &&
    event?.toSectionId &&
    event.toSectionId !== 'favorites' &&
    todoById.has(event?.movedItemId);

  if (movedOutOfFavorites) {
    const todo = todoById.get(event.movedItemId);
    const currentOrder = todo?.order?.favorite ?? todo?.favoriteOrder ?? null;
    if (todo?.isFavorite === true || currentOrder != null) {
      updates.push({
        id: event.movedItemId,
        order: {
          favorite: null,
        },
      });
    }
  }

  return updates;
}

export function mergeTodoReorderUpdates(updates = []) {
  const mergedById = new Map();

  updates.forEach((update) => {
    if (!update?.id) {
      return;
    }

    const existing = mergedById.get(update.id) || { id: update.id };
    const nextUpdate = {
      ...existing,
      ...(update.categoryId !== undefined ? { categoryId: update.categoryId } : {}),
      order: {
        ...(existing.order || {}),
        ...(update.order || {}),
      },
    };

    if (Object.keys(nextUpdate.order).length === 0) {
      delete nextUpdate.order;
    }

    mergedById.set(update.id, nextUpdate);
  });

  return Array.from(mergedById.values());
}
