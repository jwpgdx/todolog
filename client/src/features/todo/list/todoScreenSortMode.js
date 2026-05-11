export const TODO_SCREEN_SORT_MODE = {
  TIME: 'time',
  CUSTOM: 'custom',
  CATEGORY: 'category',
};

export const TODO_SCREEN_SORT_MODE_STORAGE_KEY = 'todo_screen_sort_mode';
export const TODO_SCREEN_COLLAPSED_CATEGORY_IDS_STORAGE_KEY =
  'todo_screen_collapsed_category_ids';

export const TODO_SCREEN_SORT_MODE_OPTIONS = [
  { id: TODO_SCREEN_SORT_MODE.TIME, label: '시간순' },
  { id: TODO_SCREEN_SORT_MODE.CUSTOM, label: '사용자 지정' },
  { id: TODO_SCREEN_SORT_MODE.CATEGORY, label: '카테고리별 순서' },
];
