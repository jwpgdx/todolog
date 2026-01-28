import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';

dayjs.extend(weekOfYear);
dayjs.locale('ko'); // Default (will be overridden by i18n)

/**
 * Generates an array of weeks for the calendar.
 * Range: 18 months before and after the current date.
 * 
 * @param {dayjs.Dayjs} today - The reference "today" date object.
 * @returns {object} { weeks, todayWeekIndex }
 */
export const generateCalendarData = (today, startDayOfWeek = 'sunday') => {
    // 1. Determine the target day index (0 = Sunday, 1 = Monday)
    const targetDayIndex = startDayOfWeek === 'monday' ? 1 : 0;

    // 2. Identify the first day of the 18-month range
    const monthStart = today.subtract(18, 'month').startOf('month');

    // 3. Calculate the start of the week relative to the month start
    // Formula to find the previous [TargetDay]: (currentDay + 7 - targetDay) % 7
    // e.g. If Mon(1) start, and Month starts on Sun(0) -> (0 + 7 - 1) % 7 = 6 days back.
    const diff = (monthStart.day() + 7 - targetDayIndex) % 7;
    const start = monthStart.subtract(diff, 'day');

    const end = today.add(18, 'month').endOf('month').endOf('week'); // This end buffer is generous enough

    const weeksArray = [];
    let currentDateIter = start;
    let tIndex = 0;

    // Use a while loop to generate weeks until we pass the end date
    // Safety break added to prevent infinite loops if calculation is wrong
    let safetyCounter = 0;
    while ((currentDateIter.isBefore(end) || currentDateIter.isSame(end, 'day')) && safetyCounter < 1000) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            const date = currentDateIter.add(i, 'day');
            const month = date.month() + 1;
            const dayOfWeek = date.day();
            const isFirstDay = date.date() === 1;
            const isToday = date.isSame(today, 'day');
            const dateString = date.format('YYYY-MM-DD');

            week.push({
                dateObj: date,
                dateString,
                text: date.date(),
                dayOfWeek,
                monthIndex: date.month(), // 0-11
                isToday,
                isFirstDay,
                isSunday: dayOfWeek === 0,
                isSaturday: dayOfWeek === 6,
            });
        }

        // Check if this week contains "today" to identify the initial index
        if (week.some(d => d.dateString === today.format('YYYY-MM-DD'))) {
            tIndex = weeksArray.length;
        }

        weeksArray.push(week);
        currentDateIter = currentDateIter.add(7, 'day');
        safetyCounter++;
    }

    return { weeks: weeksArray, todayWeekIndex: tIndex };
};

/**
 * 월별로 그룹화된 캘린더 데이터 생성
 * CalendarScreen에서 월별 무한 스크롤에 사용
 * 
 * @param {number} pastMonths - 과거 몇 개월 (기본 12)
 * @param {number} futureMonths - 미래 몇 개월 (기본 24)
 * @param {string} startDayOfWeek - 'sunday' 또는 'monday'
 * @returns {Array<{ monthKey, title, weeks, monthIndex }>}
 */
export const generateMonthlyData = (pastMonths = 12, futureMonths = 24, startDayOfWeek = 'sunday') => {
    const today = dayjs();
    const targetDayIndex = startDayOfWeek === 'monday' ? 1 : 0;
    const monthsData = [];
    let currentMonthIndex = 0;
    let todayMonthIndex = 0;

    for (let i = -pastMonths; i <= futureMonths; i++) {
        const monthStart = today.add(i, 'month').startOf('month');
        const monthEnd = monthStart.endOf('month');
        const monthKey = monthStart.format('YYYY-MM');
        const title = monthStart.format('YYYY년 M월');

        // 해당 월의 첫 주 시작일 계산 (주 시작 요일 기준)
        const diff = (monthStart.day() + 7 - targetDayIndex) % 7;
        let weekStart = monthStart.subtract(diff, 'day');

        const weeks = [];

        // 해당 월의 마지막 날이 포함된 주까지 반복
        while (weekStart.isBefore(monthEnd) || weekStart.isSame(monthEnd, 'day')) {
            const week = [];
            for (let d = 0; d < 7; d++) {
                const date = weekStart.add(d, 'day');
                const isCurrentMonth = date.month() === monthStart.month();
                const isToday = date.isSame(today, 'day');
                const isFirstDay = date.date() === 1;

                week.push({
                    dateObj: date,
                    dateString: date.format('YYYY-MM-DD'),
                    text: date.date(),
                    dayOfWeek: date.day(),
                    monthIndex: date.month(), // 0-11
                    isToday,
                    isFirstDay,
                    isSunday: date.day() === 0,
                    isSaturday: date.day() === 6,
                    isCurrentMonth, // 해당 월 소속인지 (회색 처리용)
                });
            }
            weeks.push(week);
            weekStart = weekStart.add(7, 'day');
        }

        // 오늘이 포함된 월 인덱스 저장
        if (i === 0) {
            todayMonthIndex = currentMonthIndex;
        }

        monthsData.push({
            monthKey,
            title,
            weeks,
            monthIndex: currentMonthIndex,
        });

        currentMonthIndex++;
    }

    return { months: monthsData, todayMonthIndex };
};
