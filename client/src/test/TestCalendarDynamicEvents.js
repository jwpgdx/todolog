import React from 'react';
import { View, Text, Button, ScrollView, StyleSheet } from 'react-native';
import { useCalendarDynamicEvents } from '../hooks/useCalendarDynamicEvents';
import { generateCalendarData } from '../components/ui/ultimate-calendar/calendarUtils';
import dayjs from 'dayjs';

export default function TestCalendarDynamicEvents() {
  const [visibleIndex, setVisibleIndex] = React.useState(30);
  
  // 테스트용 주 데이터 생성 (18개월 = 약 78주)
  const { weeks } = React.useMemo(() => {
    const today = dayjs();
    return generateCalendarData(today, 'sunday', 
      today.subtract(6, 'month'), 
      today.add(12, 'month')
    );
  }, []);
  
  // Hook 테스트
  const eventsByDate = useCalendarDynamicEvents({
    weeks,
    visibleIndex,
    range: 3,
    cacheType: 'week'
  });
  
  const eventCount = Object.keys(eventsByDate).length;
  const totalEvents = Object.values(eventsByDate).reduce((sum, arr) => sum + arr.length, 0);
  
  // 현재 보이는 주 정보
  const currentWeek = weeks[visibleIndex];
  const weekRange = currentWeek 
    ? `${currentWeek[0].dateString} ~ ${currentWeek[6].dateString}`
    : 'N/A';
  
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>useCalendarDynamicEvents 테스트</Text>
      
      <View style={styles.infoBox}>
        <Text style={styles.infoText}>현재 인덱스: {visibleIndex} / {weeks.length}</Text>
        <Text style={styles.infoText}>현재 주: {weekRange}</Text>
        <Text style={styles.infoText}>이벤트 있는 날짜: {eventCount}개</Text>
        <Text style={styles.infoText}>총 이벤트 수: {totalEvents}개</Text>
      </View>
      
      <View style={styles.buttonRow}>
        <Button 
          title="◀ 이전 주" 
          onPress={() => setVisibleIndex(prev => Math.max(0, prev - 1))} 
        />
        <Button 
          title="오늘" 
          onPress={() => setVisibleIndex(30)} 
        />
        <Button 
          title="다음 주 ▶" 
          onPress={() => setVisibleIndex(prev => Math.min(weeks.length - 1, prev + 1))} 
        />
      </View>
      
      <View style={styles.buttonRow}>
        <Button 
          title="◀◀ -10주" 
          onPress={() => setVisibleIndex(prev => Math.max(0, prev - 10))} 
        />
        <Button 
          title="처음" 
          onPress={() => setVisibleIndex(0)} 
        />
        <Button 
          title="+10주 ▶▶" 
          onPress={() => setVisibleIndex(prev => Math.min(weeks.length - 1, prev + 10))} 
        />
      </View>
      
      <Text style={styles.sectionTitle}>이벤트 목록 (최대 20개 날짜):</Text>
      
      {eventCount === 0 ? (
        <Text style={styles.noEvents}>이벤트가 없습니다.</Text>
      ) : (
        Object.entries(eventsByDate)
          .slice(0, 20)
          .map(([date, events]) => (
            <View key={date} style={styles.dateBox}>
              <Text style={styles.dateText}>
                {date} ({events.length}개)
              </Text>
              {events.map((e, i) => (
                <View key={i} style={styles.eventRow}>
                  <View style={[styles.colorDot, { backgroundColor: e.color }]} />
                  <Text style={styles.eventText}>
                    {e.title} {e.isRecurring ? '🔁' : ''}
                  </Text>
                </View>
              ))}
            </View>
          ))
      )}
      
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  infoBox: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 10,
  },
  noEvents: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
  },
  dateBox: {
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dateText: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 20,
    marginTop: 3,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  eventText: {
    fontSize: 13,
    color: '#333',
  },
});
