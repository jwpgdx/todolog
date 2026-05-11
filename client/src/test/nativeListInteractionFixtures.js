import { Platform } from 'react-native';

export function createNativeListInteractionSections(categoryFooterOverride) {
  return [
    {
      id: 'categories',
      title: '카테고리',
      footer:
        categoryFooterOverride ||
        (Platform.OS === 'android'
          ? 'Android에서는 카테고리 row를 길게 눌러 mock reorder callback을 검증합니다.'
          : 'iOS에서는 NativeManagedList category v0 기준으로 category row의 menu / reorder / preview 흐름을 검증합니다.'),
      items: [
        {
          id: 'cat-work',
          kind: 'category',
          title: 'Work',
          metaText: '3 tasks',
          accentColor: '#2563EB',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate', 'archive'],
        },
        {
          id: 'cat-home',
          kind: 'category',
          title: 'Home',
          metaText: '5 tasks',
          accentColor: '#10B981',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate'],
        },
        {
          id: 'cat-personal',
          kind: 'category',
          title: 'Personal',
          metaText: '4 tasks',
          accentColor: '#F59E0B',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate', 'archive'],
        },
        {
          id: 'cat-errands',
          kind: 'category',
          title: 'Errands',
          metaText: '6 tasks',
          accentColor: '#EF4444',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate'],
        },
        {
          id: 'cat-health',
          kind: 'category',
          title: 'Health',
          metaText: '2 tasks',
          accentColor: '#06B6D4',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate', 'archive'],
        },
        {
          id: 'cat-reading',
          kind: 'category',
          title: 'Reading',
          metaText: '8 tasks',
          accentColor: '#8B5CF6',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate'],
        },
        {
          id: 'cat-travel',
          kind: 'category',
          title: 'Travel',
          metaText: '1 task',
          accentColor: '#F97316',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate', 'archive'],
        },
        {
          id: 'cat-finance',
          kind: 'category',
          title: 'Finance',
          metaText: '3 tasks',
          accentColor: '#14B8A6',
          reorderable: true,
          deletable: true,
          supportsMenu: true,
          menuActions: ['rename', 'duplicate'],
        },
      ],
    },
  ];
}

export function nowStamp() {
  return new Date().toLocaleTimeString();
}

export function reorderCategoryItems(items, orderedIds) {
  const orderMap = new Map(orderedIds.map((id, index) => [id, index]));
  const categories = items.filter((item) => item.kind === 'category');
  const rest = items.filter((item) => item.kind !== 'category');

  categories.sort((a, b) => {
    const aIndex = orderMap.get(a.id);
    const bIndex = orderMap.get(b.id);
    return (aIndex ?? Number.MAX_SAFE_INTEGER) - (bIndex ?? Number.MAX_SAFE_INTEGER);
  });

  return [...categories, ...rest];
}
