import React from 'react';

import NativeManagedList from '../../../components/ui/native-managed-list/NativeManagedList';

const CREATE_CATEGORY_ITEM_ID = '__create-category__';

function buildManagedSections(categories) {
  return [
    {
      id: 'categories',
      role: 'category',
      reorderMode: 'withinSection',
      items: [
        ...categories.map((category) => {
          const isInbox = category?.systemKey === 'inbox';
          const todoCount = Number(category?.todoCount || 0);

          return {
            id: category._id,
            kind: 'category',
            title: category.name,
            metaText: String(todoCount),
            accentColor: category.color || '#CCCCCC',
            enabled: true,
            pinned: isInbox,
            reorderable: !isInbox,
            menuActions: isInbox
              ? []
              : [
                  {
                    id: 'rename',
                    title: '이름 변경',
                  },
                ],
            trailingSwipeActions: isInbox
              ? []
              : [
                  {
                    id: 'delete',
                    title: '삭제',
                    role: 'destructive',
                  },
                ],
          };
        }),
        {
          id: CREATE_CATEGORY_ITEM_ID,
          kind: 'category',
          title: '카테고리 추가',
          accentColor: '#D1D5DB',
          enabled: true,
          pinned: false,
          reorderable: false,
          menuActions: [],
          trailingSwipeActions: [],
        },
      ],
    },
  ];
}

export default function NativeCategoryManager({
  categories,
  onPressAddCategory,
  onPressCategory,
  onRenameCategory,
  onDeleteCategory,
  onReorderCommit,
  onError,
}) {
  const sections = buildManagedSections(categories);
  const categoryById = new Map(categories.map((category) => [category._id, category]));

  return (
    <NativeManagedList
      listId="my-page-category-manager"
      variant="category"
      sections={sections}
      onPressItem={({ itemId }) => {
        if (itemId === CREATE_CATEGORY_ITEM_ID) {
          onPressAddCategory?.();
          return;
        }

        const category = categoryById.get(itemId);
        if (category) {
          onPressCategory?.(category);
        }
      }}
      onAction={({ itemId, actionId }) => {
        const category = categoryById.get(itemId);
        if (!category) {
          return;
        }

        if (actionId === 'rename') {
          onRenameCategory?.(category);
          return;
        }

        if (actionId === 'delete') {
          onDeleteCategory?.(itemId);
        }
      }}
      onReorderCommit={onReorderCommit}
      onError={onError}
    />
  );
}
