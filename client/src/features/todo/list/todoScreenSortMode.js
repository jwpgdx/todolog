export const TODO_SCREEN_SORT_MODE = {
  TIME: 'time',
  // Legacy stored value. Hidden from the UI and normalized to TIME.
  CUSTOM: 'custom',
  CATEGORY: 'category',
};

export const TODO_SCREEN_SORT_MODE_STORAGE_KEY = 'todo_screen_sort_mode';
export const TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY =
  'todo_screen_collapsed_category_ids';

export const TODO_SCREEN_SORT_MODE_OPTIONS = [
  { id: TODO_SCREEN_SORT_MODE.TIME, label: '시간순' },
  { id: TODO_SCREEN_SORT_MODE.CATEGORY, label: '카테고리순' },
];

function compareByCreatedAt(a, b) {
  return String(a?.createdAt || '').localeCompare(String(b?.createdAt || ''));
}

function compareById(a, b) {
  return String(a?._id || '').localeCompare(String(b?._id || ''));
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

export function normalizeTodoScreenSortMode(value) {
  return value === TODO_SCREEN_SORT_MODE.CATEGORY
    ? TODO_SCREEN_SORT_MODE.CATEGORY
    : TODO_SCREEN_SORT_MODE.TIME;
}

export function hasTodoScheduledTime(todo) {
  return todo?.isAllDay !== true && Boolean(todo?.startTime || todo?.endTime);
}

export function compareByTodoScreenTimeMode(a, b) {
  const hasTimeA = hasTodoScheduledTime(a);
  const hasTimeB = hasTodoScheduledTime(b);
  if (hasTimeA !== hasTimeB) {
    return hasTimeA ? -1 : 1;
  }

  if (!hasTimeA && !hasTimeB) {
    return compareByCustomOrder(a, b);
  }

  const startA = String(a?.startTime || a?.endTime || '');
  const startB = String(b?.startTime || b?.endTime || '');
  if (startA !== startB) {
    return startA.localeCompare(startB);
  }

  const endA = String(a?.endTime || '');
  const endB = String(b?.endTime || '');
  if (endA !== endB) {
    return endA.localeCompare(endB);
  }

  const createdOrder = compareByCreatedAt(a, b);
  if (createdOrder !== 0) {
    return createdOrder;
  }

  return compareById(a, b);
}
