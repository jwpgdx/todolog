import { useMemo } from 'react';
import { useDateStore } from '../../../../store/dateStore';
import { THEME } from '../constants';

/**
 * 🎯 공통 DayCell 로직 Hook
 * 
 * 모든 DayCell 변형(Compact, List, Timetable)에서 공유하는 로직:
 * - 선택 상태 계산
 * - 텍스트 색상 결정
 * - 이벤트 처리 (mode에 따라 다름)
 * - 추가 이벤트 개수 계산
 * 
 * @param {Object} day - 날짜 객체
 * @param {Array} events - 이벤트 배열
 * @param {number} maxVisibleEvents - 최대 표시 이벤트 수
 * @param {string} mode - 'dot' (카테고리 중복 제거) | 'list' (모든 이벤트 표시)
 */
export const useDayCell = (day, events = [], maxVisibleEvents = 5, mode = 'dot') => {
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

    // ✅ mode에 따라 이벤트 처리
    const processedEvents = useMemo(() => {
        if (mode === 'dot') {
            // UltimateCalendar: 카테고리별로 그룹화 (중복 제거)
            const categoryMap = new Map();
            
            events.forEach(event => {
                // 여러 경로 시도
                const categoryId = event.event?.categoryId || event.categoryId || event.todo?.categoryId || 'no-category';
                
                if (!categoryMap.has(categoryId)) {
                    categoryMap.set(categoryId, event);
                }
            });
            
            return Array.from(categoryMap.values());
        }
        
        // CalendarScreen: 모든 이벤트 표시
        return events;
    }, [events, mode, day.dateString]);

    // 이벤트 슬라이싱
    const visibleEvents = useMemo(() =>
        processedEvents.slice(0, maxVisibleEvents),
        [processedEvents, maxVisibleEvents]
    );

    // 추가 이벤트 계산
    const hasMore = processedEvents.length > maxVisibleEvents;
    const remainingCount = hasMore ? processedEvents.length - maxVisibleEvents : 0;

    return {
        isSelected,
        textColor,
        visibleEvents,
        hasMore,
        remainingCount,
        totalCategories: mode === 'dot' ? processedEvents.length : undefined,
        totalEvents: events.length,
        // 편의를 위해 day 속성들도 전달
        isToday: day.isToday,
        isSunday: day.isSunday,
        isSaturday: day.isSaturday,
        dateString: day.dateString,
        text: day.text,
    };
};

export default useDayCell;
