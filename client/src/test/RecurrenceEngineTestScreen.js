import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import {
  MAX_EXPANSION_DAYS,
  addDaysDateOnly,
  compareDateOnly,
  expandOccurrencesInRange,
  normalizeDateOnlyString,
  normalizeRecurrence,
  occursOnDateNormalized,
} from '../utils/recurrenceEngine';

function createCases() {
  return [
    {
      id: 'normalize-date-only',
      name: '날짜 정규화 YYYYMMDD -> YYYY-MM-DD',
      run: () => normalizeDateOnlyString('20260217') === '2026-02-17',
      detail: () => `normalizeDateOnlyString("20260217")`,
    },
    {
      id: 'daily-basic',
      name: 'DAILY 기본 판정',
      run: () => {
        const rule = normalizeRecurrence('RRULE:FREQ=DAILY', null, { startDate: '2026-02-10' });
        return occursOnDateNormalized(rule, '2026-02-17') === true;
      },
      detail: () => `RRULE:FREQ=DAILY, start=2026-02-10, target=2026-02-17`,
    },
    {
      id: 'weekly-byday',
      name: 'WEEKLY BYDAY 판정',
      run: () => {
        const rule = normalizeRecurrence('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR', null, { startDate: '2026-02-01' });
        const mon = occursOnDateNormalized(rule, '2026-02-16');
        const tue = occursOnDateNormalized(rule, '2026-02-17');
        return mon === true && tue === false;
      },
      detail: () => `MO(2026-02-16)=true, TU(2026-02-17)=false`,
    },
    {
      id: 'monthly-31-policy',
      name: 'MONTHLY 31일 엣지 정책 (짧은 달 skip)',
      run: () => {
        const rule = normalizeRecurrence('RRULE:FREQ=MONTHLY;BYMONTHDAY=31', null, { startDate: '2026-01-31' });
        const feb = occursOnDateNormalized(rule, '2026-02-28');
        const mar = occursOnDateNormalized(rule, '2026-03-31');
        return feb === false && mar === true;
      },
      detail: () => `2026-02-28=false, 2026-03-31=true`,
    },
    {
      id: 'yearly-leap-policy',
      name: 'YEARLY 2/29 엣지 정책 (윤년만)',
      run: () => {
        const rule = normalizeRecurrence('RRULE:FREQ=YEARLY;BYMONTH=2;BYMONTHDAY=29', null, { startDate: '2024-02-29' });
        const nonLeap = occursOnDateNormalized(rule, '2027-02-28');
        const leap = occursOnDateNormalized(rule, '2028-02-29');
        return nonLeap === false && leap === true;
      },
      detail: () => `2027-02-28=false, 2028-02-29=true`,
    },
    {
      id: 'effective-end-date',
      name: '종료일 우선순위 (UNTIL vs recurrenceEndDate)',
      run: () => {
        const rule = normalizeRecurrence(
          'RRULE:FREQ=DAILY;UNTIL=20260310',
          '2026-03-05',
          { startDate: '2026-03-01' }
        );
        const inDate = occursOnDateNormalized(rule, '2026-03-05');
        const outDate = occursOnDateNormalized(rule, '2026-03-06');
        return inDate === true && outDate === false;
      },
      detail: () => `effectiveEndDate=min(2026-03-10, 2026-03-05)=2026-03-05`,
    },
    {
      id: 'expand-guard',
      name: `범위 가드 (${MAX_EXPANSION_DAYS}일 초과)`,
      run: () => {
        const rule = normalizeRecurrence('RRULE:FREQ=DAILY', null, { startDate: '2026-01-01' });
        return expandOccurrencesInRange(rule, '2026-01-01', '2027-02-01').length === 0;
      },
      detail: () => `range > ${MAX_EXPANSION_DAYS} days => []`,
    },
    {
      id: 'expand-reverse-range',
      name: '역범위 처리 (end < start)',
      run: () => {
        const rule = normalizeRecurrence('RRULE:FREQ=DAILY', null, { startDate: '2026-01-01' });
        return expandOccurrencesInRange(rule, '2026-02-10', '2026-02-01').length === 0;
      },
      detail: () => `2026-02-10 ~ 2026-02-01 => []`,
    },
    {
      id: 'date-utils',
      name: 'date-only 유틸 sanity',
      run: () => {
        const next = addDaysDateOnly('2026-02-28', 1);
        const cmp = compareDateOnly('2026-03-01', '2026-02-28');
        return next === '2026-03-01' && cmp === 1;
      },
      detail: () => `addDays(2026-02-28,+1)=2026-03-01, compare=1`,
    },
  ];
}

export default function RecurrenceEngineTestScreen() {
  const testCases = useMemo(() => createCases(), []);
  const [results, setResults] = useState([]);
  const [startedAt, setStartedAt] = useState(null);
  const [finishedAt, setFinishedAt] = useState(null);

  const handleRunAll = () => {
    const started = Date.now();
    setStartedAt(started);
    setFinishedAt(null);

    const nextResults = testCases.map((testCase) => {
      try {
        const passed = !!testCase.run();
        return {
          id: testCase.id,
          name: testCase.name,
          passed,
          detail: testCase.detail(),
          error: null,
        };
      } catch (error) {
        return {
          id: testCase.id,
          name: testCase.name,
          passed: false,
          detail: testCase.detail(),
          error: error?.message || String(error),
        };
      }
    });

    setResults(nextResults);
    setFinishedAt(Date.now());
  };

  const handleClear = () => {
    setResults([]);
    setStartedAt(null);
    setFinishedAt(null);
  };

  const summary = useMemo(() => {
    const total = results.length;
    const passed = results.filter((row) => row.passed).length;
    const failed = total - passed;
    return { total, passed, failed };
  }, [results]);

  const elapsedMs =
    startedAt != null && finishedAt != null ? finishedAt - startedAt : null;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Recurrence Engine Test</Text>
        <Text style={styles.subtitle}>Phase 3 Step 1-3 수동 검증 화면</Text>

        <View style={styles.buttonRow}>
          <TouchableOpacity style={[styles.button, styles.runButton]} onPress={handleRunAll}>
            <Text style={styles.buttonText}>Run All</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.clearButton]} onPress={handleClear}>
            <Text style={styles.buttonText}>Clear</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.summaryRow}>
          <Text style={styles.summaryText}>Total: {summary.total}</Text>
          <Text style={styles.summaryText}>Pass: {summary.passed}</Text>
          <Text style={styles.summaryText}>Fail: {summary.failed}</Text>
          <Text style={styles.summaryText}>Elapsed: {elapsedMs == null ? '-' : `${elapsedMs}ms`}</Text>
        </View>
      </View>

      <ScrollView style={styles.resultList} contentContainerStyle={styles.resultListContent}>
        {results.map((result) => (
          <View
            key={result.id}
            style={[styles.resultCard, result.passed ? styles.passCard : styles.failCard]}
          >
            <Text style={styles.resultTitle}>
              {result.passed ? 'PASS' : 'FAIL'} - {result.name}
            </Text>
            <Text style={styles.resultDetail}>{result.detail}</Text>
            {result.error ? <Text style={styles.errorText}>Error: {result.error}</Text> : null}
          </View>
        ))}

        {results.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>아직 실행된 테스트가 없습니다.</Text>
            <Text style={styles.emptyText}>Run All 버튼으로 엔진 케이스를 실행하세요.</Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerCard: {
    margin: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: '#4B5563',
  },
  buttonRow: {
    marginTop: 12,
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  runButton: {
    backgroundColor: '#2563EB',
  },
  clearButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  summaryText: {
    fontSize: 13,
    color: '#1F2937',
    fontWeight: '600',
  },
  resultList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  resultListContent: {
    paddingBottom: 20,
  },
  resultCard: {
    marginBottom: 10,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  passCard: {
    borderColor: '#86EFAC',
  },
  failCard: {
    borderColor: '#FCA5A5',
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  resultDetail: {
    marginTop: 4,
    fontSize: 12,
    color: '#374151',
  },
  errorText: {
    marginTop: 6,
    fontSize: 12,
    color: '#B91C1C',
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  emptyText: {
    fontSize: 13,
    color: '#4B5563',
  },
});

