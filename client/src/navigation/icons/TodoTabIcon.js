import React from 'react';
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { useTodayDate } from '../../hooks/useTodayDate';

export default function TodoTabIcon({ color = '#6B7280', focused = false, size = 24 }) {
  const { todayDate } = useTodayDate();
  const dayNumber = todayDate ? String(Number(todayDate.slice(-2))) : '';
  const dateColor = focused ? '#2563EB' : color;

  if (focused) {
    return (
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path
          fill={color}
          d="M5 22c-.6 0-1-.2-1.4-.6-.4-.4-.6-.9-.6-1.4V6c0-.6.2-1 .6-1.4.4-.4.9-.6 1.4-.6h1v-1c0-.3 0-.5.3-.7.2-.2.4-.3.7-.3s.5 0 .7.3.3.4.3.7v1h8v-1c0-.3 0-.5.3-.7s.4-.3.7-.3.5 0 .7.3.3.4.3.7v1h1c.6 0 1 .2 1.4.6s.6.9.6 1.4v14c0 .6-.2 1-.6 1.4s-.9.6-1.4.6H5Z"
        />
        <SvgText
          x="12"
          y="16.5"
          fill={dateColor}
          fontSize="10"
          fontWeight="800"
          letterSpacing="-0.4"
          textAnchor="middle"
        >
          {dayNumber}
        </SvgText>
      </Svg>
    );
  }

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        fill={color}
        d="M5 22c-.6 0-1-.2-1.4-.6-.4-.4-.6-.9-.6-1.4V6c0-.6.2-1 .6-1.4.4-.4.9-.6 1.4-.6h1v-1c0-.3 0-.5.3-.7.2-.2.4-.3.7-.3s.5 0 .7.3.3.4.3.7v1h8v-1c0-.3 0-.5.3-.7s.4-.3.7-.3.5 0 .7.3.3.4.3.7v1h1c.6 0 1 .2 1.4.6s.6.9.6 1.4v14c0 .6-.2 1-.6 1.4s-.9.6-1.4.6H5Zm0-2h14V6H5v14Z"
      />
      <SvgText
        x="12"
        y="16.5"
        fill={dateColor}
        fontSize="10"
        fontWeight="700"
        letterSpacing="-0.4"
        textAnchor="middle"
      >
        {dayNumber}
      </SvgText>
    </Svg>
  );
}
