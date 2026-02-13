import api from './axios';

const normalizeDateField = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return typeof value === 'string' ? value : null;
};

const normalizeTimeField = (value) => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  return typeof value === 'string' ? value : null;
};

const normalizeTodoPayload = (data = {}) => {
  const payload = { ...data };

  if ('startDate' in payload) payload.startDate = normalizeDateField(payload.startDate);
  if ('endDate' in payload) payload.endDate = normalizeDateField(payload.endDate);
  if ('recurrenceEndDate' in payload) payload.recurrenceEndDate = normalizeDateField(payload.recurrenceEndDate);
  if ('startTime' in payload) payload.startTime = normalizeTimeField(payload.startTime);
  if ('endTime' in payload) payload.endTime = normalizeTimeField(payload.endTime);

  return payload;
};

export const todoAPI = {
  getTodos: (date) => api.get(`/todos?date=${date}`),
  getAllTodos: () => api.get('/todos/all'),
  getMonthEvents: (year, month) => api.get(`/todos/month/${year}/${month}`),
  getDeltaSync: (lastSyncTime) => api.get(`/todos/delta-sync?lastSyncTime=${encodeURIComponent(lastSyncTime)}`),
  createTodo: (data) => api.post('/todos', normalizeTodoPayload({
    _id: data._id,  // 클라이언트 UUID
    title: data.title,
    memo: data.memo,
    categoryId: data.categoryId,
    isAllDay: data.isAllDay,
    startDate: data.startDate,        // "YYYY-MM-DD" (필수!)
    endDate: data.endDate,            // "YYYY-MM-DD"
    startTime: data.startTime,        // "HH:MM" (isAllDay=false일 때)
    endTime: data.endTime,            // "HH:MM" (isAllDay=false일 때)
    userTimeZone: data.userTimeZone,  // Google Calendar 연동용
    recurrence: data.recurrence,
    recurrenceEndDate: data.recurrenceEndDate,
  })),
  updateTodo: (id, data) => api.put(`/todos/${id}`, normalizeTodoPayload(data)),
  deleteTodo: (id) => api.delete(`/todos/${id}`),
  bulkDeleteTodos: (todoIds) => api.post('/todos/bulk-delete', { todoIds }),
  retryCalendarSync: (id) => api.post(`/todos/retry-sync/${id}`),
  retryAllFailedSync: () => api.post('/todos/retry-all-sync'),
  getCalendarSummary: (year, month) => api.get(`/todos/calendar-summary?year=${year}&month=${month}`),
};

export const completionAPI = {
  toggleCompletion: (todoId, date = null, completionId = null) => 
    api.post('/completions/toggle', { todoId, date, _id: completionId }),
  getCompletions: (startDate, endDate) =>
    api.get(`/completions?startDate=${startDate}&endDate=${endDate}`),
};
