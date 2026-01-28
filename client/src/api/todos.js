import api from './axios';

export const todoAPI = {
  getTodos: (date) => api.get(`/todos?date=${date}`),
  getAllTodos: () => api.get('/todos/all'),
  getMonthEvents: (year, month) => api.get(`/todos/month/${year}/${month}`),
  getDeltaSync: (lastSyncTime) => api.get(`/todos/delta-sync?lastSyncTime=${encodeURIComponent(lastSyncTime)}`),
  createTodo: (data) => api.post('/todos', {
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
  }),
  updateTodo: (id, data) => api.put(`/todos/${id}`, data),
  deleteTodo: (id) => api.delete(`/todos/${id}`),
  bulkDeleteTodos: (todoIds) => api.post('/todos/bulk-delete', { todoIds }),
  retryCalendarSync: (id) => api.post(`/todos/retry-sync/${id}`),
  retryAllFailedSync: () => api.post('/todos/retry-all-sync'),
  getCalendarSummary: (year, month) => api.get(`/todos/calendar-summary?year=${year}&month=${month}`),
};

export const completionAPI = {
  toggleCompletion: (todoId, date = null) => api.post('/completions/toggle', { todoId, date }),
  getCompletions: (startDate, endDate) =>
    api.get(`/completions?startDate=${startDate}&endDate=${endDate}`),
};
