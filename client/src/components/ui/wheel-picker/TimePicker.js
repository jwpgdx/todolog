import React from 'react';
import { RootPicker, WheelItem } from './core';
import { getHours, getMinutes } from './utils/date-helpers';

export default function TimePicker({ hour, setHour, min, setMin }) {
    const hours = getHours();
    const minutes = getMinutes();

    return (
        <RootPicker className="bg-white dark:bg-black">
            <WheelItem
                items={hours}
                value={hour}
                onChange={setHour}
                loop // 무한 회전
            />
            <WheelItem
                items={minutes}
                value={min}
                onChange={setMin}
                loop
            />
        </RootPicker>
    );
}