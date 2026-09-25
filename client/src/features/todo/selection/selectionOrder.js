export function getVisibleTodoIdsFromManagedSections(sections = []) {
  return (Array.isArray(sections) ? sections : []).flatMap((section) =>
    (Array.isArray(section?.items) ? section.items : [])
      .filter((item) => item?.kind === 'todo' && item?.hidden !== true && item?.id)
      .map((item) => item.id)
  );
}

export function orderSelectedTodoIds(visibleTodoIds = [], selectedTodoIds = []) {
  const selectedIds = Array.isArray(selectedTodoIds) ? selectedTodoIds.filter(Boolean) : [];
  const selectedIdSet = new Set(selectedIds);
  const seen = new Set();
  const orderedIds = [];

  (Array.isArray(visibleTodoIds) ? visibleTodoIds : []).forEach((todoId) => {
    if (!todoId || !selectedIdSet.has(todoId) || seen.has(todoId)) {
      return;
    }

    seen.add(todoId);
    orderedIds.push(todoId);
  });

  return orderedIds;
}
