import { occursOnDate } from './recurrenceUtils';

/**
 * 특정 날짜에 해당하는 할일만 필터링
 * @param {Array} todos - 전체 할일 배열
 * @param {string} date - 필터링할 날짜 (YYYY-MM-DD)
 * @returns {Array} 필터링된 할일 배열
 */
export function filterByDate(todos, date) {
  if (!todos || !Array.isArray(todos)) return [];
  
  return todos.filter(todo => {
    // 하루종일 할일
    if (todo.isAllDay) {
      if (todo.recurrence) {
        return occursOnDate(todo, date);
      } else {
        const startDateStr = todo.startDate;
        const endDateStr = todo.endDate || todo.startDate;
        return date >= startDateStr && date <= endDateStr;
      }
    } 
    // 시간 지정 할일
    else {
      if (!todo.startDateTime) return false;
      
      const startDate = new Date(todo.startDateTime);
      const startDateStr = startDate.toISOString().split('T')[0];
      
      if (!todo.recurrence) {
        if (todo.endDateTime) {
          const endDate = new Date(todo.endDateTime);
          const endDateStr = endDate.toISOString().split('T')[0];
          return date >= startDateStr && date <= endDateStr;
        }
        return date === startDateStr;
      }
      
      return occursOnDate(todo, date);
    }
  });
}

/**
 * 특정 월에 해당하는 할일만 필터링
 * @param {Array} todos - 전체 할일 배열
 * @param {number} year - 연도
 * @param {number} month - 월 (1-12)
 * @returns {Array} 필터링된 할일 배열
 */
export function filterByMonth(todos, year, month) {
  if (!todos || !Array.isArray(todos)) return [];
  
  const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
  const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];
  
  return todos.filter(todo => {
    if (!todo.startDate) return false;
    
    // 반복 일정
    if (todo.recurrence) {
      // recurrenceEndDate가 월 시작보다 이전이면 제외
      if (todo.recurrenceEndDate && todo.recurrenceEndDate < monthStart) {
        return false;
      }
      // startDate가 월 끝보다 이후면 제외
      if (todo.startDate > monthEnd) {
        return false;
      }
      return true;
    }
    
    // 단일/기간 일정
    const endDate = todo.endDate || todo.startDate;
    return !(endDate < monthStart || todo.startDate > monthEnd);
  });
}
