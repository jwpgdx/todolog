import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WeekRow from './WeekRow';
import { generateWeeks, formatMonthTitle } from '../utils/calendarHelpers';
import { useTodoCalendarStore } from '../store/todoCalendarStore';
import dayjs from 'dayjs';

/**
 * MonthSection Component
 * 
 * 월 단위 렌더링 (weeks 배열 생성)
 * Supports dynamic startDayOfWeek and language settings
 * 
 * @param {Object} props
 * @param {Object} props.monthMetadata - 월 메타데이터
 * @param {number} props.monthMetadata.year - 연도 (예: 2025)
 * @param {number} props.monthMetadata.month - 월 (1~12)
 * @param {string} props.monthMetadata.id - 고유 ID (예: "2025-01")
 * @param {number} props.startDayOfWeek - 0 (Sunday) or 1 (Monday)
 * @param {string} props.language - 'ko' | 'en' | 'ja' | 'system'
 * 
 * Requirements: 2.4, 3.1, 4.5, 9.2
 */
function MonthSection({ monthMetadata, startDayOfWeek = 0, language = 'ko' }) {
  // Selector: 이 월의 데이터만 구독 (다른 월 변경 시 리렌더 안 함)
  const todos = useTodoCalendarStore(
    state => state.todosByMonth[monthMetadata.id]
  );
  const completions = useTodoCalendarStore(
    state => state.completionsByMonth[monthMetadata.id]
  );

  // useMemo로 weeks 배열 생성 (6주 × 7일 = 42개 날짜)
  // startDayOfWeek 설정에 따라 첫 주 시작일이 달라짐
  const weeks = useMemo(() => {
    return generateWeeks(monthMetadata.year, monthMetadata.month, startDayOfWeek);
  }, [monthMetadata.year, monthMetadata.month, startDayOfWeek]);

  // useMemo로 monthTitle 생성 (언어 설정 반영)
  const monthTitle = useMemo(() => {
    return formatMonthTitle(monthMetadata.year, monthMetadata.month, language);
  }, [monthMetadata.year, monthMetadata.month, language]);

  // Todo를 날짜별로 그룹핑 (DayCell에 전달용)
  // Critical Fix: 기간 일정은 startDate ~ endDate 사이의 모든 날짜에 매핑
  const todosByDate = useMemo(() => {
    if (!todos || todos.length === 0) return {};
    
    const map = {};
    for (const todo of todos) {
      if (todo.startDate && todo.endDate) {
        // 기간 일정: startDate ~ endDate 사이의 모든 날짜에 추가
        let current = dayjs(todo.startDate);
        const end = dayjs(todo.endDate);
        
        while (current.isBefore(end) || current.isSame(end, 'day')) {
          const dateKey = current.format('YYYY-MM-DD');
          if (!map[dateKey]) map[dateKey] = [];
          map[dateKey].push(todo);
          current = current.add(1, 'day');
        }
      } else {
        // 단일 일정: date 하나에만 추가
        const dateKey = todo.date || todo.startDate;
        if (!dateKey) continue;
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(todo);
      }
    }
    return map;
  }, [todos]);

  return (
    <View style={styles.container}>
      {/* 월 타이틀 렌더링 */}
      <Text style={styles.title}>{monthTitle}</Text>
      
      {/* 6개 WeekRow 렌더링 */}
      {weeks.map((week, idx) => (
        <WeekRow
          key={idx}
          week={week}
          todosByDate={todosByDate}
          completions={completions}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingHorizontal: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingVertical: 12,
    textAlign: 'center',
  },
});

// React.memo로 최적화 - monthMetadata가 변경되지 않으면 리렌더링 방지
export default React.memo(MonthSection);
