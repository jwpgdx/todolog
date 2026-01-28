import { useMemo } from 'react';
import { useDateStore } from '../../../../store/dateStore';
import { THEME } from '../constants';

/**
 * 🎯 공통 DayCell 로직 Hook
 * 
 * 모든 DayCell 변형(Compact, List, Timetable)에서 공유하는 로직:
 * - 선택 상태 계산
 * - 텍스트 색상 결정
 * - 이벤트 슬라이싱 (최대 3개)
 * - 추가 이벤트 개수 계산
 */
export const useDayCell = (day, events = [], maxVisibleEvents = 3) => {
    const currentDate = useDateStore(state => state.currentDate);

    // 선택 상태
    const isSelected = day.dateString === currentDate;

    // 텍스트 색상 계산
    const textColor = useMemo(() => {
        if (isSelected) return THEME.selectedText;
        if (day.isToday) return THEME.primary;
        if (day.isSunday) return THEME.sunday;
        if (day.isSaturday) return THEME.saturday;
        return THEME.text;
    }, [isSelected, day.isToday, day.isSunday, day.isSaturday]);

    // 이벤트 슬라이싱
    const visibleEvents = useMemo(() =>
        events.slice(0, maxVisibleEvents),
        [events, maxVisibleEvents]
    );

    // 추가 이벤트 계산
    const hasMore = events.length > maxVisibleEvents;
    const remainingCount = hasMore ? events.length - maxVisibleEvents : 0;

    return {
        isSelected,
        textColor,
        visibleEvents,
        hasMore,
        remainingCount,
        // 편의를 위해 day 속성들도 전달
        isToday: day.isToday,
        isSunday: day.isSunday,
        isSaturday: day.isSaturday,
        dateString: day.dateString,
        text: day.text,
    };
};

export default useDayCell;
