import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { runTodoCalendarV2FixtureMatrix } from '../features/todo-calendar-v2/utils/fixtureMatrix';

export default function TodoCalendarV2FixtureMatrixScreen() {
  const result = useMemo(() => runTodoCalendarV2FixtureMatrix(), []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.eyebrow}>Todo Calendar V2</Text>
        <Text style={styles.title}>Fixture Matrix</Text>
        <Text style={styles.summary}>
          Passed {result.passedCount} / {result.totalCount}
        </Text>
        <Text style={[styles.badge, result.allPassed ? styles.badgePass : styles.badgeFail]}>
          {result.allPassed ? 'ALL PASS' : 'FAILURES DETECTED'}
        </Text>

        {result.cases.map((entry) => (
          <View
            key={entry.id}
            style={[
              styles.card,
              entry.passed ? styles.cardPass : styles.cardFail,
            ]}
          >
            <Text style={styles.cardTitle}>
              {entry.passed ? 'PASS' : 'FAIL'} · {entry.label}
            </Text>
            {entry.details.length > 0 ? (
              entry.details.map((detail) => (
                <Text key={detail} style={styles.detailText}>
                  {detail}
                </Text>
              ))
            ) : (
              <Text style={styles.detailText}>deterministic contract matched</Text>
            )}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    gap: 12,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: '#475569',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0F172A',
  },
  summary: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    fontSize: 12,
    fontWeight: '800',
    overflow: 'hidden',
  },
  badgePass: {
    backgroundColor: '#DCFCE7',
    color: '#166534',
  },
  badgeFail: {
    backgroundColor: '#FEE2E2',
    color: '#991B1B',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  cardPass: {
    borderColor: '#BBF7D0',
  },
  cardFail: {
    borderColor: '#FCA5A5',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  detailText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: '#334155',
  },
});
