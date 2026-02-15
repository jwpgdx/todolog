import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

export default function StripCalendarHeader({
  title,
  mode,
  showTodayJumpButton,
  onTodayJump,
  onPrevWeek,
  onNextWeek,
  onToggleMode,
}) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <View style={styles.leftGroup}>
        <Pressable onPress={onPrevWeek} style={styles.iconButton}>
          <Text style={styles.iconText}>{'<'}</Text>
        </Pressable>
        <Pressable onPress={onNextWeek} style={styles.iconButton}>
          <Text style={styles.iconText}>{'>'}</Text>
        </Pressable>
      </View>

      <View style={styles.centerGroup}>
        <Text style={styles.title}>{title}</Text>
        {showTodayJumpButton ? (
          <Pressable onPress={onTodayJump} style={styles.todayButton}>
            <Text style={styles.todayText}>{t('calendar.today')}</Text>
          </Pressable>
        ) : (
          <View style={styles.todayPlaceholder} />
        )}
      </View>

      <Pressable onPress={onToggleMode} style={styles.rightGroup}>
        <Text style={styles.modeText}>{mode === 'weekly' ? '▾' : '▴'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    width: 88,
  },
  iconButton: {
    width: 40,
    height: 36,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: {
    color: '#1F2937',
    fontSize: 20,
    fontWeight: '600',
  },
  centerGroup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  todayButton: {
    marginTop: 2,
    backgroundColor: '#DBEAFE',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  todayText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  todayPlaceholder: {
    height: 18,
  },
  rightGroup: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeText: {
    fontSize: 18,
    color: '#111827',
    fontWeight: '700',
  },
});
