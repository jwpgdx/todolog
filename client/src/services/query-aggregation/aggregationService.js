function buildCompletionMap(completions) {
  const map = {};
  for (const completion of completions || []) {
    if (!completion?.key) continue;
    map[completion.key] = completion;
  }
  return map;
}

function toDateTimeOrNull(date, time) {
  if (!date || !time) return null;
  return `${date}T${time}:00`;
}

function buildBaseItem(todo) {
  const category = todo.category || null;
  return {
    // 호환 필드
    _id: todo._id,
    categoryId: todo.categoryId || null,
    memo: todo.memo || null,
    recurrence: todo.recurrence || null,
    recurrenceEndDate: todo.recurrenceEndDate || null,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt,
    date: todo.date || null,
    startDate: todo.startDate || null,
    endDate: todo.endDate || null,
    isAllDay: Boolean(todo.isAllDay),
    startTime: todo.startTime || null,
    endTime: todo.endTime || null,
    startDateTime: toDateTimeOrNull(todo.startDate || todo.date, todo.startTime),
    endDateTime: toDateTimeOrNull(todo.endDate || todo.startDate || todo.date, todo.endTime),
    title: todo.title,
    category,

    // 공통 DTO 필드
    todoId: todo._id,
    isRecurring: Boolean(todo.recurrence),
    completionKey: '',
    completionId: null,
    completed: false,
  };
}

function buildCompletionKey(todo, targetDate) {
  if (todo.recurrence) {
    return `${todo._id}_${targetDate}`;
  }
  return `${todo._id}_null`;
}

export function aggregateForDate({ candidates, decision, targetDate }) {
  const startAt = performance.now();
  const todos = Array.isArray(candidates?.todos) ? candidates.todos : [];
  const completions = Array.isArray(candidates?.completions) ? candidates.completions : [];
  const passedSet = new Set(decision?.passedTodoIds || []);
  const completionMap = buildCompletionMap(completions);

  const items = todos
    .filter(todo => passedSet.has(todo._id))
    .map(todo => {
      const completionKey = buildCompletionKey(todo, targetDate);
      const completion = completionMap[completionKey] || null;
      const item = buildBaseItem(todo);

      item.completionKey = completionKey;
      item.completionId = completion?._id || null;
      item.completed = Boolean(completion);

      return item;
    });

  const endAt = performance.now();
  return {
    ok: true,
    mode: 'date',
    targetDate,
    items,
    metrics: {
      aggregatedCount: items.length,
      elapsedMs: Number((endAt - startAt).toFixed(2)),
    },
    error: null,
  };
}

export function aggregateForRange({ candidates, decision, range }) {
  const startAt = performance.now();
  const todos = Array.isArray(candidates?.todos) ? candidates.todos : [];
  const completions = Array.isArray(candidates?.completions) ? candidates.completions : [];
  const passedSet = new Set(decision?.passedTodoIds || []);
  const occurrencesByTodoId = decision?.occurrencesByTodoId || {};
  const completionMap = buildCompletionMap(completions);
  const itemsByDate = {};

  for (const todo of todos) {
    if (!passedSet.has(todo._id)) continue;

    const occurrences = Array.isArray(occurrencesByTodoId[todo._id])
      ? occurrencesByTodoId[todo._id]
      : [];

    if (occurrences.length === 0) continue;

    const base = buildBaseItem(todo);
    for (const date of occurrences) {
      const completionKey = buildCompletionKey(todo, date);
      const completion = completionMap[completionKey] || null;
      const item = {
        ...base,
        occurrenceDate: date,
        completionKey,
        completionId: completion?._id || null,
        completed: Boolean(completion),
      };

      if (!itemsByDate[date]) {
        itemsByDate[date] = [];
      }
      itemsByDate[date].push(item);
    }
  }

  const aggregatedCount = Object.values(itemsByDate).reduce((sum, list) => sum + list.length, 0);
  const endAt = performance.now();
  return {
    ok: true,
    mode: 'range',
    range,
    itemsByDate,
    metrics: {
      aggregatedCount,
      elapsedMs: Number((endAt - startAt).toFixed(2)),
    },
    error: null,
  };
}

