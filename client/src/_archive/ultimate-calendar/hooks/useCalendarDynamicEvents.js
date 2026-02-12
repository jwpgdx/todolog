import { useMemo, useRef, useState, useEffect } from 'react';
import { useAllTodos } from './queries/useAllTodos';
import { useCategories } from './queries/useCategories';
import dayjs from 'dayjs';
import { isDateInRRule } from '../utils/routineUtils';

/**
 * 캘린더 동적 이벤트 계산 Hook
 * 
 * 무한 스크롤 캘린더에서 보이는 범위만 동적으로 이벤트를 계산합니다.
 * 주별/월별 캐싱을 통해 성능을 최적화합니다.
 * 
 * @param {Object} params
 * @param {Array} params.weeks - 주 데이터 배열 (UltimateCalendar용)
 * @param {Array} params.months - 월 데이터 배열 (CalendarScreen용)
 * @param {number} params.visibleIndex - 현재 보이는 인덱스
 * @param {number} params.range - 계산 범위 (±N)
 * @param {string} params.cacheType - 'week' 또는 'month'
 * @returns {Object} eventsByDate 맵 { "YYYY-MM-DD": [{ _id, title, color, isRecurring, event }] }
 */
export function useCalendarDynamicEvents({ 
  weeks, 
  months,
  visibleIndex, 
  range = 3, 
  cacheType = 'week' 
}) {
  // 데이터 소스 결정 (weeks 또는 months)
  const dataSource = cacheType === 'month' ? months : weeks;
  
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
    console.log(`🎯 [useCalendarDynamicEvents] useMemo 실행 (cacheVersion: ${cacheVersion})`);
    
    // ✋ [Critical] 데이터 완전 로딩 대기
    // categories가 없거나 빈 배열이면 렌더링 보류 → 회색 dot 방지
    if (!todos || !categories || categories.length === 0 || !dataSource || dataSource.length === 0) {
      return {};
    }
    
    const startTime = performance.now();
    
    // 1️⃣ 보이는 범위 계산
    const startIdx = Math.max(0, visibleIndex - range);
    const endIdx = Math.min(dataSource.length - 1, visibleIndex + range);
    
    // console.log(`🎯 [useCalendarDynamicEvents] 범위: ${startIdx} ~ ${endIdx} (총 ${endIdx - startIdx + 1}${cacheType})`);
    
    // 2️⃣ 날짜 범위 계산
    let rangeStart, rangeEnd, cacheKeyGetter;
    
    if (cacheType === 'month') {
      // 월별 데이터 (CalendarScreen)
      const startMonth = dataSource[startIdx];
      const endMonth = dataSource[endIdx];
      
      if (!startMonth || !endMonth) {
        // console.log('⚠️ [useCalendarDynamicEvents] 월 데이터 없음');
        return {};
      }
      
      rangeStart = dayjs(startMonth.monthKey).startOf('month');
      rangeEnd = dayjs(endMonth.monthKey).endOf('month');
      cacheKeyGetter = (item) => item.monthKey;
    } else {
      // 주별 데이터 (UltimateCalendar)
      const startWeek = dataSource[startIdx];
      const endWeek = dataSource[endIdx];
      
      if (!startWeek || !endWeek) {
        // console.log('⚠️ [useCalendarDynamicEvents] 주 데이터 없음');
        return {};
      }
      
      rangeStart = dayjs(startWeek[0].dateString);
      rangeEnd = dayjs(endWeek[6].dateString);
      cacheKeyGetter = (item) => item[0].dateString;
    }
    
    // console.log(`📅 [useCalendarDynamicEvents] 날짜 범위: ${rangeStart.format('YYYY-MM-DD')} ~ ${rangeEnd.format('YYYY-MM-DD')}`);
    
    // 3️⃣ 캐싱 및 이벤트 계산
    const eventsMap = {};
    let cacheHits = 0;
    let cacheMisses = 0;
    
    // 카테고리 색상 맵
    const categoryColorMap = {};
    categories.forEach(c => categoryColorMap[c._id] = c.color);
    
    // ✅ Fallback: categoryId가 null일 때 사용할 기본 카테고리
    const defaultCategoryId = categories[0]?._id;
    const defaultColor = categories[0]?.color || '#CCCCCC';
    
    // console.log('🎨 [카테고리 색상 맵]', categoryColorMap);
    // console.log('📝 [전체 todos]', todos.length, '개');
    
    // 각 항목별로 캐시 확인 및 계산
    for (let i = startIdx; i <= endIdx; i++) {
      const item = dataSource[i];
      if (!item) continue;
      
      // 캐시 키 생성
      const cacheKey = cacheKeyGetter(item);
      
      // 캐시 확인
      if (eventsCacheRef.current[cacheKey]) {
        // 캐시 히트
        Object.assign(eventsMap, eventsCacheRef.current[cacheKey]);
        cacheHits++;
        continue;
      }
      
      // 캐시 미스 - 계산 필요
      cacheMisses++;
      const periodEvents = {};
      
      // 기간의 시작/끝 날짜
      let periodStart, periodEnd;
      
      if (cacheType === 'month') {
        periodStart = dayjs(item.monthKey).startOf('month');
        periodEnd = periodStart.endOf('month');
      } else {
        periodStart = dayjs(item[0].dateString);
        periodEnd = dayjs(item[6].dateString);
      }
      
      // 모든 todos 순회
      todos.forEach(todo => {
        if (!todo.startDate) return;
        
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
          
          // 기간 범위 내 모든 날짜 체크
          let loopDate = periodStart.clone();
          while (loopDate.isBefore(periodEnd) || loopDate.isSame(periodEnd, 'day')) {
            // exdates 확인
            const dateStr = loopDate.format('YYYY-MM-DD');
            const isExcluded = todo.exdates?.some(exdate => {
              const exdateStr = typeof exdate === 'string'
                ? exdate.split('T')[0]
                : dayjs(exdate).format('YYYY-MM-DD');
              return exdateStr === dateStr;
            });
            
            if (!isExcluded && isDateInRRule(loopDate.toDate(), rruleString, todoStartDate, todoEndDate)) {
              if (!periodEvents[dateStr]) periodEvents[dateStr] = [];
              periodEvents[dateStr].push({
                _id: todo._id,
                title: todo.title,
                color: categoryColorMap[todo.categoryId] || defaultColor,
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
            // 기간 범위 내에 있는지 확인
            if ((current.isAfter(periodStart) || current.isSame(periodStart, 'day')) &&
                (current.isBefore(periodEnd) || current.isSame(periodEnd, 'day'))) {
              const dateStr = current.format('YYYY-MM-DD');
              if (!periodEvents[dateStr]) periodEvents[dateStr] = [];
              periodEvents[dateStr].push({
                _id: todo._id,
                title: todo.title,
                color: categoryColorMap[todo.categoryId] || defaultColor,
                isRecurring: false,
                event: todo,
              });
            }
            current = current.add(1, 'day');
          }
        }
      });
      
      // 캐시 저장
      eventsCacheRef.current[cacheKey] = periodEvents;
      Object.assign(eventsMap, periodEvents);
    }
    
    // 캐시 메모리 관리 (최근 60주 또는 24개월만 유지)
    const maxCacheSize = cacheType === 'month' ? 24 : 60;
    const cacheKeys = Object.keys(eventsCacheRef.current);
    if (cacheKeys.length > maxCacheSize) {
      const sortedKeys = cacheKeys.sort();
      const keysToDelete = sortedKeys.slice(0, cacheKeys.length - maxCacheSize);
      keysToDelete.forEach(key => delete eventsCacheRef.current[key]);
      // console.log(`🗑️ [캐시] 오래된 캐시 삭제: ${keysToDelete.length}개`);
    }
    
    const eventCount = Object.keys(eventsMap).length;
    const endTime = performance.now();
    
    console.log(`📊 [캐시] 히트: ${cacheHits}개, 미스: ${cacheMisses}개, 총 캐시: ${Object.keys(eventsCacheRef.current).length}개`);
    console.log(`✅ [이벤트] ${eventCount}개 날짜 계산 완료 (${(endTime - startTime).toFixed(2)}ms)`);
    console.log(`🔄 [eventsMap 참조] ${Object.keys(eventsMap).slice(0, 3).join(', ')}...`);
    
    return eventsMap;
  }, [dataSource, visibleIndex, range, cacheType, cacheVersion]); // todos, categories 제거 - cacheVersion으로 재계산 트리거
  
  return { eventsByDate, cacheVersion };
}
