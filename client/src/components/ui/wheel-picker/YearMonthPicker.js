import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { RootPicker, WheelItem } from './core';
import { getYears, getMonths } from './utils/date-helpers';

export default function YearMonthPicker({ year, setYear, month, setMonth }) {
    const { i18n } = useTranslation();
    const years = useMemo(() => getYears(2020, 2030), []);
    const months = useMemo(() => getMonths(i18n.language), [i18n.language]);

    return (
        <RootPicker className="bg-white dark:bg-black">
            <WheelItem
                items={years}
                value={year}
                onChange={setYear}
            />
            <WheelItem
                items={months}
                value={month}
                onChange={setMonth}
                loop
            />
        </RootPicker>
    );
}