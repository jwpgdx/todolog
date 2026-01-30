import { useMemo } from 'react';
import { useDateStore } from '../../../../store/dateStore';
import { THEME } from '../constants';

/**
 * 🎯 공통 DayCell 로직 Hook
 * 
 * 모든 DayCell 변형(Compact, List, Timetable)에서 공유하는 로직:
 * - 선택 상태 계산
 * - 텍스트 색상 결정
 * - 이벤트 카테고리별 그룹화 (중복 제거)
 * - 추가 이벤트 개수 계산
 */
export const useDayCell = (day, events = [], maxVisibleEvents = 5) => {
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

    // ✅ 카테고리별로 그룹화 (중복 제거)
    const uniqueEventsByCategory = useMemo(() => {
        const categoryMap = new Map();
        
        events.forEach(event => {
            // 여러 경로 시도
            const categoryId = event.event?.categoryId || event.categoryId || event.todo?.categoryId || 'no-category';
            
            if (!categoryMap.has(categoryId)) {
                categoryMap.set(categoryId, event);
            }
        });
        
        return Array.from(categoryMap.values());
    }, [events, day.dateString]);

    // 이벤트 슬라이싱 (카테고리 중복 제거 후)
    const visibleEvents = useMemo(() =>
        uniqueEventsByCategory.slice(0, maxVisibleEvents),
        [uniqueEventsByCategory, maxVisibleEvents]
    );

    // 추가 이벤트 계산
    const hasMore = uniqueEventsByCategory.length > maxVisibleEvents;
    const remainingCount = hasMore ? uniqueEventsByCategory.length - maxVisibleEvents : 0;

    return {
        isSelected,
        textColor,
        visibleEvents,
        hasMore,
        remainingCount,
        totalCategories: uniqueEventsByCategory.length,
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
