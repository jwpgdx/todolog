import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  TC2_DAY_CELL_HEIGHT,
  TC2_EVENT_LANE_HEIGHT,
  TC2_VISIBLE_LANE_COUNT,
} from '../utils/monthLayoutUtils';

const EVENT_AREA_TOP = 22;
const OVERFLOW_TOP = EVENT_AREA_TOP + (TC2_VISIBLE_LANE_COUNT * TC2_EVENT_LANE_HEIGHT) + 4;

function getVisibleSegment(segment, days = []) {
  const visibleCols = days
    .map((day, index) => (day.isCurrentMonth ? index : -1))
    .filter((index) => index >= 0);

  if (visibleCols.length === 0) return null;

  const visibleStartCol = visibleCols[0];
  const visibleEndCol = visibleCols[visibleCols.length - 1];
  const clippedStartCol = Math.max(segment.startCol, visibleStartCol);
  const clippedEndCol = Math.min(segment.endCol, visibleEndCol);

  if (clippedStartCol > clippedEndCol) return null;

  return {
    ...segment,
    startCol: clippedStartCol,
    endCol: clippedEndCol,
    continuesFromPrevious:
      Boolean(segment.continuesFromPrevious) || clippedStartCol > segment.startCol,
    continuesToNext:
      Boolean(segment.continuesToNext) || clippedEndCol < segment.endCol,
  };
}

function getSegmentStyle(segment) {
  const widthPerCol = 100 / 7;
  const left = `${segment.startCol * widthPerCol}%`;
  const width = `${(segment.endCol - segment.startCol + 1) * widthPerCol}%`;
  const top = EVENT_AREA_TOP + (segment.lane * TC2_EVENT_LANE_HEIGHT);

  return {
    left,
    width,
    top,
    backgroundColor: segment.color || '#64748B',
    borderTopLeftRadius: segment.continuesFromPrevious ? 2 : 6,
    borderBottomLeftRadius: segment.continuesFromPrevious ? 2 : 6,
    borderTopRightRadius: segment.continuesToNext ? 2 : 6,
    borderBottomRightRadius: segment.continuesToNext ? 2 : 6,
  };
}

export default function TodoCalendarV2WeekRow({ week, todayDate }) {
  const visibleSegments = week.segments
    .map((segment) => getVisibleSegment(segment, week.days))
    .filter(Boolean);

  return (
    <View style={styles.row}>
      <View style={styles.dayGrid}>
        {week.days.map((day) => {
          if (!day.isCurrentMonth) {
            return <View key={day.dateString} style={styles.dayCell} />;
          }

          const isToday = day.dateString === todayDate;
          return (
            <View key={day.dateString} style={styles.dayCell}>
              <Text
                style={[
                  styles.dateText,
                  isToday && styles.todayDateText,
                ]}
              >
                {day.date}
              </Text>

              {day.hiddenCount > 0 ? (
                <Text style={styles.overflowText}>...</Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <View style={styles.segmentLayer}>
        {visibleSegments.map((segment) => (
          <View key={segment.id} style={[styles.segment, getSegmentStyle(segment)]}>
            <Text numberOfLines={1} style={styles.segmentText}>
              {segment.title}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'relative',
    height: TC2_DAY_CELL_HEIGHT,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  dayGrid: {
    flexDirection: 'row',
    height: '100%',
  },
  dayCell: {
    flex: 1,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#E2E8F0',
    paddingTop: 4,
    paddingHorizontal: 4,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  todayDateText: {
    color: '#1D4ED8',
  },
  overflowText: {
    position: 'absolute',
    top: OVERFLOW_TOP,
    right: 6,
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  segmentLayer: {
    ...StyleSheet.absoluteFillObject,
    pointerEvents: 'none',
  },
  segment: {
    position: 'absolute',
    height: TC2_EVENT_LANE_HEIGHT,
    paddingHorizontal: 4,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  segmentText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
