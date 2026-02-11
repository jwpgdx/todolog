import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import WeekRow from './WeekRow';
import { generateWeeks, formatMonthTitle } from '../utils/calendarHelpers';

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
  // useMemo로 weeks 배열 생성 (6주 × 7일 = 42개 날짜)
  // startDayOfWeek 설정에 따라 첫 주 시작일이 달라짐
  const weeks = useMemo(() => {
    return generateWeeks(monthMetadata.year, monthMetadata.month, startDayOfWeek);
  }, [monthMetadata.year, monthMetadata.month, startDayOfWeek]);

  // useMemo로 monthTitle 생성 (언어 설정 반영)
  const monthTitle = useMemo(() => {
    return formatMonthTitle(monthMetadata.year, monthMetadata.month, language);
  }, [monthMetadata.year, monthMetadata.month, language]);

  return (
    <View style={styles.container}>
      {/* 월 타이틀 렌더링 */}
      <Text style={styles.title}>{monthTitle}</Text>
      
      {/* 6개 WeekRow 렌더링 */}
      {weeks.map((week, idx) => (
        <WeekRow key={idx} week={week} />
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
