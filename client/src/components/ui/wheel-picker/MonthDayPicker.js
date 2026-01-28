import React, { useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { RootPicker, WheelItem } from './core';
import { getMonths, getDaysInMonth } from './utils/date-helpers';

export default function MonthDayPicker({ month, setMonth, day, setDay, currentYear = '2025' }) {
    const { i18n } = useTranslation();

    // 언어가 바뀌면 월 목록도 재계산됨
    const months = useMemo(() => {
        return getMonths(i18n.language);
    }, [i18n.language]);

    // 선택된 월에 따라 '일' 배열을 다시 계산 (Memoization)
    const days = useMemo(() => {
        return getDaysInMonth(currentYear, month);
    }, [currentYear, month]);

    // 월을 바꿨는데 현재 선택된 '일'이 그 달에 없으면 (예: 31일 -> 2월) 마지막 날짜로 변경
    useEffect(() => {
        if (!days.includes(day)) {
            setDay(days[days.length - 1]);
        }
    }, [days, day, setDay]);

    return (
        <RootPicker className="bg-white dark:bg-black">
            <WheelItem
                items={months}
                value={month}
                onChange={setMonth}
                loop
            />
            <WheelItem
                items={days}
                value={day}
                onChange={setDay}
                loop
            />
        </RootPicker>
    );
}