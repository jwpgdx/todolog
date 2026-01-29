import dayjs from 'dayjs';
import weekOfYear from 'dayjs/plugin/weekOfYear';
import 'dayjs/locale/ko';
import 'dayjs/locale/en';
import 'dayjs/locale/ja';

dayjs.extend(weekOfYear);
dayjs.locale('ko'); // Default (will be overridden by i18n)

/**
 * Generates an array of weeks for the calendar.
 * Range: 36 months before and after the current date.
 * 
 * @param {dayjs.Dayjs} today - The reference "today" date object.
 * @returns {object} { weeks, todayWeekIndex }
 */
export const generateCalendarData = (today, startDayOfWeek = 'sunday') => {
    // 1. Determine the target day index (0 = Sunday, 1 = Monday)
    const targetDayIndex = startDayOfWeek === 'monday' ? 1 : 0;

    // 2. Identify the first day of the 36-month range
    const monthStart = today.subtract(36, 'month').startOf('month');

    // 3. Calculate the start of the week relative to the month start
    // Formula to find the previous [TargetDay]: (currentDay + 7 - targetDay) % 7
    // e.g. If Mon(1) start, and Month starts on Sun(0) -> (0 + 7 - 1) % 7 = 6 days back.
    const diff = (monthStart.day() + 7 - targetDayIndex) % 7;
    const start = monthStart.subtract(diff, 'day');

    const end = today.add(36, 'month').endOf('month').endOf('week'); // This end buffer is generous enough

    const weeksArray = [];
    let currentDateIter = start;
    let tIndex = 0;

    // Use a while loop to generate weeks until we pass the end date
    // Safety break added to prevent infinite loops if calculation is wrong
    let safetyCounter = 0;
    while ((currentDateIter.isBefore(end) || currentDateIter.isSame(end, 'day')) && safetyCounter < 2000) {
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
                text: isFirstDay ? `${month}.1` : date.date(),
                dayOfWeek,
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
