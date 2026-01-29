import { useMemo, useRef, useState, useEffect } from 'react';
import { useAllTodos } from './queries/useAllTodos';
import { useCategories } from './queries/useCategories';
import dayjs from 'dayjs';
import { isDateInRRule } from '../utils/routineUtils';

/**
 * 캘린더 동적 이벤트 계산 Hook
 * 
 * 무한 스크롤 캘린더에서 보이는 범위만 동적으로 이벤트를 계산합니다.
 * 주별 캐싱을 통해 성능을 최적화합니다.
 * 
 * @param {Object} params
 * @param {Array} params.weeks - 주 데이터 배열 (또는 months)
 * @param {number} params.visibleIndex - 현재 보이는 인덱스
 * @param {number} params.range - 계산 범위 (±N)
 * @param {string} params.cacheType - 'week' 또는 'month'
 * @returns {Object} eventsByDate 맵 { "YYYY-MM-DD": [{ _id, title, color, isRecurring, event }] }
 */
export function useCalendarDynamicEvents({ 
  weeks, 
  visibleIndex, 
  range = 3, 
  cacheType = 'week' 
}) {
  // 1. 데이터 가져오기
  const { data: todos } = useAllTodos();
  const { data: categories } = useCategories();
  
  // 2. 캐시 관리
  const eventsCacheRef = useRef({});
  const [cacheVersion, setCacheVersion] = useState(0);
  
  // 3. todos 또는 categories 변경 시 캐시 무효화
  useEffect(() => {
    if (todos || categories) {
      eventsCacheRef.current = {};
      setCacheVersion(prev => prev + 1);
      console.log('🔄 [useCalendarDynamicEvents] 캐시 무효화 (todos 또는 categories 변경)');
    }
  }, [todos, categories]);
  
  // 4. 동적 이벤트 계산
  const eventsByDate = useMemo(() => {
    if (!todos || !categories || !weeks || weeks.length === 0) {
      console.log('⚠️ [useCalendarDynamicEvents] 데이터 없음');
      return {};
    }
    
    const startTime = performance.now();
    
    // 1️⃣ 보이는 범위 계산
    const startIdx = Math.max(0, visibleIndex - range);
    const endIdx = Math.min(weeks.length - 1, visibleIndex + range);
    
    console.log(`🎯 [useCalendarDynamicEvents] 범위: ${startIdx} ~ ${endIdx} (총 ${endIdx - startIdx + 1}${cacheType})`);
    
    // 2️⃣ 날짜 범위 계산
    const startWeek = weeks[startIdx];
    const endWeek = weeks[endIdx];
    
    if (!startWeek || !endWeek) {
      console.log('⚠️ [useCalendarDynamicEvents] 주 데이터 없음');
      return {};
    }
    
    const rangeStart = dayjs(startWeek[0].dateString);
    const rangeEnd = dayjs(endWeek[6].dateString);
    
    console.log(`📅 [useCalendarDynamicEvents] 날짜 범위: ${rangeStart.format('YYYY-MM-DD')} ~ ${rangeEnd.format('YYYY-MM-DD')}`);
    
    // 3️⃣ 주별 캐싱 및 이벤트 계산
    const eventsMap = {};
    let cacheHits = 0;
    let cacheMisses = 0;
    
    // 카테고리 색상 맵
    const categoryColorMap = {};
    categories.forEach(c => categoryColorMap[c._id] = c.color);
    
    console.log('🎨 [카테고리 색상 맵]', categoryColorMap);
    console.log('📝 [전체 todos]', todos.length, '개');
    
    // 주별로 캐시 확인 및 계산
    for (let i = startIdx; i <= endIdx; i++) {
      const week = weeks[i];
      if (!week) continue;
      
      // 캐시 키 생성 (첫 날짜 기준)
      const weekKey = week[0].dateString;
      
      // 캐시 확인
      if (eventsCacheRef.current[weekKey]) {
        // 캐시 히트
        Object.assign(eventsMap, eventsCacheRef.current[weekKey]);
        cacheHits++;
        continue;
      }
      
      // 캐시 미스 - 계산 필요
      cacheMisses++;
      const weekEvents = {};
      
      // 주의 시작/끝 날짜
      const weekStart = dayjs(week[0].dateString);
      const weekEnd = dayjs(week[6].dateString);
      
      // 모든 todos 순회
      todos.forEach(todo => {
        if (!todo.startDate) return;
        
        // 🎨 디버그: 첫 번째 todo 색상 확인
        if (i === startIdx && todos.indexOf(todo) === 0) {
          console.log('🔍 [첫 todo 색상 체크]');
          console.log('  - todo._id:', todo._id);
          console.log('  - todo.categoryId:', todo.categoryId);
          console.log('  - categoryColorMap[todo.categoryId]:', categoryColorMap[todo.categoryId]);
          console.log('  - 최종 색상:', categoryColorMap[todo.categoryId] || '#808080');
        }
        
        // 반복 일정 처리
        if (todo.recurrence) {
          const rruleString = Array.isArray(todo.recurrence) 
            ? todo.recurrence[0] 
            : todo.recurrence;
          if (!rruleString) return;
          
          const todoStartDate = new Date(todo.startDate);
          const todoEndDate = todo.recurrenceEndDate 
            ? new Date(todo.recurrenceEndDate) 
            : null;
          
          // 주 범위 내 모든 날짜 체크
          let loopDate = weekStart.clone();
          while (loopDate.isBefore(weekEnd) || loopDate.isSame(weekEnd, 'day')) {
            // exdates 확인
            const dateStr = loopDate.format('YYYY-MM-DD');
            const isExcluded = todo.exdates?.some(exdate => {
              const exdateStr = typeof exdate === 'string'
                ? exdate.split('T')[0]
                : dayjs(exdate).format('YYYY-MM-DD');
              return exdateStr === dateStr;
            });
            
            if (!isExcluded && isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
              if (!weekEvents[dateStr]) weekEvents[dateStr] = [];
              weekEvents[dateStr].push({
                _id: todo._id,
                title: todo.title,
                color: categoryColorMap[todo.categoryId] || '#808080',
                isRecurring: true,
                event: todo,
              });
            }
            loopDate = loopDate.add(1, 'day');
          }
        } else {
          // 단일/기간 일정
          const start = dayjs(todo.startDate);
          const end = todo.endDate ? dayjs(todo.endDate) : start;
          
          let current = start.clone();
          while (current.isBefore(end) || current.isSame(end, 'day')) {
            // 주 범위 내에 있는지 확인
            if ((current.isAfter(weekStart) || current.isSame(weekStart, 'day')) &&
                (current.isBefore(weekEnd) || current.isSame(weekEnd, 'day'))) {
              const dateStr = current.format('YYYY-MM-DD');
              if (!weekEvents[dateStr]) weekEvents[dateStr] = [];
              weekEvents[dateStr].push({
                _id: todo._id,
                title: todo.title,
                color: categoryColorMap[todo.categoryId] || '#808080',
                isRecurring: false,
                event: todo,
              });
            }
            current = current.add(1, 'day');
          }
        }
      });
      
      // 캐시 저장
      eventsCacheRef.current[weekKey] = weekEvents;
      Object.assign(eventsMap, weekEvents);
    }
    
    // 캐시 메모리 관리 (최근 40주만 유지 - 왕복 스크롤 대응)
    const cacheKeys = Object.keys(eventsCacheRef.current);
    if (cacheKeys.length > 40) {
      const sortedKeys = cacheKeys.sort();
      const keysToDelete = sortedKeys.slice(0, cacheKeys.length - 40);
      keysToDelete.forEach(key => delete eventsCacheRef.current[key]);
      console.log(`🗑️ [캐시] 오래된 캐시 삭제: ${keysToDelete.length}개`);
    }
    
    const eventCount = Object.keys(eventsMap).length;
    const endTime = performance.now();
    
    console.log(`📊 [캐시] 히트: ${cacheHits}개, 미스: ${cacheMisses}개, 총 캐시: ${cacheKeys.length}개`);
    console.log(`✅ [이벤트] ${eventCount}개 날짜 계산 완료 (${(endTime - startTime).toFixed(2)}ms)`);
    
    return eventsMap;
  }, [todos, categories, weeks, visibleIndex, range, cacheType, cacheVersion]);
  
  return eventsByDate;
}
