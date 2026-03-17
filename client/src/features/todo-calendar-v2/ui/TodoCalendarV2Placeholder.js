import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function TodoCalendarV2Placeholder() {
  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Todo Calendar V2</Text>
        <Text style={styles.title}>Line Monthly Renderer</Text>
        <Text style={styles.body}>
          Separate module, separate tab, baseline monthly-only flow.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Frozen Baseline</Text>
        <Text style={styles.cardText}>6-week fixed month grid</Text>
        <Text style={styles.cardText}>3 visible lanes per day</Text>
        <Text style={styles.cardText}>Title-only colored lines</Text>
        <Text style={styles.cardText}>No-op interactions</Text>
        <Text style={styles.cardText}>Completion glyphs excluded</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Next Implementation Steps</Text>
        <Text style={styles.cardText}>1. Shared-query adapter</Text>
        <Text style={styles.cardText}>2. Fixed 42-day grid</Text>
        <Text style={styles.cardText}>3. Span segmentation by week row</Text>
        <Text style={styles.cardText}>4. Deterministic lane allocation</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 18,
    backgroundColor: '#F8FAFC',
  },
  hero: {
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: '#E2E8F0',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    marginTop: 6,
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: '#334155',
  },
  card: {
    marginTop: 14,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  cardText: {
    marginTop: 8,
    fontSize: 14,
    color: '#334155',
  },
});
