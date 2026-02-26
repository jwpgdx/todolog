import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Platform } from 'react-native';
import dayjs from 'dayjs';
import { useQueryClient } from '@tanstack/react-query';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import { useTodos } from '../hooks/queries/useTodos';
import NetInfo from '@react-native-community/netinfo';
// SQLite
import { initDatabase, getDbStats, resetDatabase, getDatabase, getMetadata } from '../services/db/database';
import {
  getTodosByDate as sqliteGetTodosByDate,
  getTodosByMonth as sqliteGetTodosByMonth,
  getAllTodos as sqliteGetAllTodos,
  getTodoCount,
} from '../services/db/todoService';
import {
  getCompletionsByDate as sqliteGetCompletionsByDate,
  toggleCompletion as sqliteToggleCompletion,
  getCompletionStats,
  getCompletionCount,
} from '../services/db/completionService';
import {
  getPendingChanges as sqliteGetPendingChanges,
  addPendingChange,
  clearPendingChanges as sqliteClearPendingChanges,
  getPendingChangesCount,
  getPendingReady,
} from '../services/db/pendingService';
import { runPendingPush } from '../services/sync/pendingPush';
import { runCommonQueryForDate, runCommonQueryForRange } from '../services/query-aggregation';
import {
  adaptTodoScreenFromDateHandoff,
  adaptTodoCalendarFromRangeHandoff,
  adaptStripCalendarFromRangeHandoff,
} from '../services/query-aggregation/adapters';
import {
  getOrLoadRange,
  getRangeCacheDebugStats,
  invalidateAllRangeCache,
  invalidateAllScreenCaches,
} from '../services/query-aggregation/cache';
import { useStripCalendarStore } from '../features/strip-calendar/store/stripCalendarStore';
import { useTodoCalendarStore } from '../features/todo-calendar/store/todoCalendarStore';
import { addDaysDateOnly } from '../utils/recurrenceEngine';
import {
  getAllCategories as sqliteGetAllCategories,
  getCategoryCount,
} from '../services/db/categoryService';
import { useSyncContext } from '../providers/SyncProvider';

function getLocalDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const PERF_DATASET_ID = 'PERF_DS_V1';
const PERF_REPEAT = 5;

function percentile(values, p) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length) - 1;
  const index = Math.min(Math.max(rank, 0), sorted.length - 1);
  return Number(sorted[index].toFixed(2));
}

export default function DebugScreen({ navigation }) {
  const [logs, setLogs] = useState([]);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString());
  const [validationSummary, setValidationSummary] = useState({
    date: null,
    range: null,
    syncSmoke: null,
    screenCompare: null,
    perfProbe: null,
  });
  const queryClient = useQueryClient();
  const toggleCompletionMutation = useToggleCompletion();
  const { data: todos = [], refetch: refetchTodos } = useTodos(selectedDate);
  const { syncAll, isSyncing, error: syncError, lastSyncTime } = useSyncContext();

  const addLog = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [`[${timestamp}] ${message}`, ...prev].slice(0, 100));
  };

  const setDebugDate = (dateValue) => {
    const parsed = dayjs(dateValue);
    if (!parsed.isValid()) {
      addLog(`❌ 날짜 형식 오류: ${dateValue}`);
      return;
    }
    const normalized = parsed.format('YYYY-MM-DD');
    setSelectedDate(normalized);
    addLog(`📅 날짜 변경: ${normalized}`);
  };

  const shiftDebugDate = (days) => {
    const nextDate = addDaysDateOnly(selectedDate, days) || dayjs(selectedDate).add(days, 'day').format('YYYY-MM-DD');
    setDebugDate(nextDate);
  };

  const setDebugDateToday = () => {
    setDebugDate(getLocalDateString());
  };

  const promptDebugDate = () => {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || typeof window.prompt !== 'function') {
      addLog('⚠️ 직접 입력은 웹에서만 지원됩니다. ±1/±7 버튼을 사용하세요.');
      return;
    }

    const input = window.prompt('테스트 날짜 입력 (YYYY-MM-DD)', selectedDate);
    if (input == null) return;

    const trimmed = input.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      addLog(`❌ 날짜 형식 오류: ${trimmed}`);
      return;
    }

    setDebugDate(trimmed);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogs = async () => {
    if (logs.length === 0) {
      addLog('⚠️ 복사할 로그가 없습니다');
      return;
    }

    const text = logs.join('\n');
    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        addLog(`✅ 로그 ${logs.length}줄 복사 완료`);
      } else {
        addLog('⚠️ 현재 플랫폼은 자동 로그 복사를 지원하지 않습니다');
      }
    } catch (error) {
      addLog(`❌ 로그 복사 실패: ${error.message}`);
    }
  };

  const recordValidation = (key, payload) => {
    setValidationSummary(prev => ({
      ...prev,
      [key]: {
        ...payload,
        at: new Date().toISOString(),
      },
    }));
  };

  const printValidationSummary = () => {
    const rows = [
      { key: 'date', label: 'common-date', value: validationSummary.date },
      { key: 'range', label: 'common-range', value: validationSummary.range },
      { key: 'syncSmoke', label: 'sync-smoke', value: validationSummary.syncSmoke },
      { key: 'screenCompare', label: 'screen-compare', value: validationSummary.screenCompare },
      { key: 'perfProbe', label: 'perf-probe', value: validationSummary.perfProbe },
    ];

    const executed = rows.filter(row => !!row.value);
    const passed = rows.filter(row => row.value?.ok).length;
    const failed = rows.filter(row => row.value && !row.value.ok).length;

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📄 공통 레이어 PASS/FAIL 요약');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`총 실행: ${executed.length} | PASS: ${passed} | FAIL: ${failed}`);

    rows.forEach((row) => {
      if (!row.value) {
        addLog(`- ${row.label}: 미실행`);
        return;
      }

      const stamp = row.value.at ? new Date(row.value.at).toLocaleTimeString() : 'n/a';
      const stage = row.value.stage || { candidate: 0, decided: 0, aggregated: 0 };
      const stale = row.value.meta?.isStale ? 'stale' : 'fresh';
      const reason = row.value.meta?.staleReason || 'none';
      const statusText = row.value.ok ? 'PASS' : 'FAIL';
      addLog(`- ${row.label}: ${statusText} @ ${stamp}`);
      addLog(`  stage(c=${stage.candidate}, d=${stage.decided}, a=${stage.aggregated}) | ${stale}/${reason}`);

      if (row.value.error) {
        addLog(`  errorSample: ${row.value.error}`);
      }
    });

    const overallPass = executed.length > 0 && failed === 0;
    addLog(overallPass ? '✅ OVERALL PASS' : '❌ OVERALL FAIL');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const printRangeCacheStats = () => {
    const stats = getRangeCacheDebugStats();

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧠 Range Cache 상태');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(
      `hit=${stats.hit}, miss=${stats.miss}, inFlightDeduped=${stats.inFlightDeduped}, loads=${stats.loads}`
    );
    addLog(`invalidateAll=${stats.invalidateAll}, invalidateRange=${stats.invalidateRange}`);
    addLog(`entries=${stats.loadedRanges.length}, inFlight=${stats.inFlightRanges.length}`);

    if (stats.loadedRanges.length > 0) {
      addLog('📦 loadedRanges:');
      stats.loadedRanges.forEach((range, index) => {
        addLog(
          `  [${index + 1}] ${range.startDate} ~ ${range.endDate} | source=${range.sourceTag}`
        );
      });
    }

    if (stats.inFlightRanges.length > 0) {
      addLog('⏳ inFlightRanges:');
      stats.inFlightRanges.forEach((range, index) => {
        addLog(
          `  [${index + 1}] ${range.startDate} ~ ${range.endDate} | source=${range.sourceTag}`
        );
      });
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const printStripL1CacheStats = () => {
    const stripState = useStripCalendarStore.getState();
    const summaryDates = Object.keys(stripState.summariesByDate || {});
    const sortedSummaryDates = [...summaryDates].sort();

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧩 Strip L1 Cache 상태');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`loadedRanges=${stripState.loadedRanges.length}, summariesByDate=${sortedSummaryDates.length}`);

    if (stripState.loadedRanges.length > 0) {
      addLog('📦 strip loadedRanges:');
      stripState.loadedRanges.forEach((range, index) => {
        addLog(`  [${index + 1}] ${range.startDate} ~ ${range.endDate}`);
      });
    }

    if (sortedSummaryDates.length > 0) {
      const firstDate = sortedSummaryDates[0];
      const lastDate = sortedSummaryDates[sortedSummaryDates.length - 1];
      addLog(`🗓️ summaryDate 범위(키 기준): ${firstDate} ~ ${lastDate}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const printTodoCalendarL1CacheStats = () => {
    const state = useTodoCalendarStore.getState();
    const todoMonthIds = Object.keys(state.todosByMonth || {}).sort();
    const completionMonthIds = Object.keys(state.completionsByMonth || {}).sort();
    const unionMonthIds = Array.from(new Set([...todoMonthIds, ...completionMonthIds])).sort();

    let totalTodos = 0;
    for (const monthId of todoMonthIds) {
      const list = state.todosByMonth?.[monthId];
      if (Array.isArray(list)) totalTodos += list.length;
    }

    let totalCompletions = 0;
    for (const monthId of completionMonthIds) {
      const map = state.completionsByMonth?.[monthId];
      if (map && typeof map === 'object') totalCompletions += Object.keys(map).length;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📅 TodoCalendar L1 Cache 상태');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(
      `todosByMonth=${todoMonthIds.length}, completionsByMonth=${completionMonthIds.length}, union=${unionMonthIds.length}`
    );
    addLog(`items(total): todos=${totalTodos}, completions=${totalCompletions}`);

    if (unionMonthIds.length > 0) {
      addLog(`🗓️ month 범위(키 기준): ${unionMonthIds[0]} ~ ${unionMonthIds[unionMonthIds.length - 1]}`);
    }

    // Keep output readable when users scroll a lot.
    if (unionMonthIds.length > 0) {
      const head = unionMonthIds.slice(0, 8);
      const tail = unionMonthIds.length > 12 ? unionMonthIds.slice(-4) : [];
      const sample = tail.length > 0 ? [...head, '...', ...tail] : head;
      addLog(`📦 cached months(sample): ${sample.join(', ')}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const clearSharedRangeCacheOnly = () => {
    const result = invalidateAllRangeCache({ reason: 'debug:manual-clear-shared-range-cache' });
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧠 Shared Range Cache만 클리어');
    addLog(`ok=${result.ok}, removedEntries=${result.removedEntries}, reason=${result.reason}`);
    addLog('ℹ️ Strip/TodoCalendar L1 store는 유지됩니다');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const setStripMonthlyPolicyLegacy = () => {
    useStripCalendarStore.getState().setMonthlyRangePolicy('legacy_9week');
    addLog('⚙️ Strip 월간 정책 변경: legacy_9week (-14 ~ +48일)');
  };

  const setStripMonthlyPolicyThreeMonth = () => {
    useStripCalendarStore.getState().setMonthlyRangePolicy('three_month');
    addLog('⚙️ Strip 월간 정책 변경: three_month (월 기준 -1M ~ +1M)');
  };

  const setStripMonthlyPolicySixMonth = () => {
    useStripCalendarStore.getState().setMonthlyRangePolicy('six_month');
    addLog('⚙️ Strip 월간 정책 변경: six_month (월 기준 -2M ~ +3M)');
  };

  const printStripMonthlyPolicy = () => {
    const policy = useStripCalendarStore.getState().monthlyRangePolicy;
    addLog(`ℹ️ Strip 월간 정책 현재값: ${policy}`);
  };

  const buildMonthlyRangeByPolicy = (anchorDate, policy) => {
    if (policy === 'legacy_9week') {
      return {
        startDate: dayjs(anchorDate).subtract(14, 'day').format('YYYY-MM-DD'),
        endDate: dayjs(anchorDate).add(48, 'day').format('YYYY-MM-DD'),
      };
    }
    const monthStart = dayjs(anchorDate).startOf('month');
    if (policy === 'six_month') {
      return {
        startDate: monthStart.subtract(2, 'month').format('YYYY-MM-DD'),
        endDate: monthStart.add(3, 'month').endOf('month').format('YYYY-MM-DD'),
      };
    }
    return {
      startDate: monthStart.subtract(1, 'month').format('YYYY-MM-DD'),
      endDate: monthStart.add(1, 'month').endOf('month').format('YYYY-MM-DD'),
    };
  };

  const buildMonthlyAnchorSequence = (baseDate, count = 6) => {
    const normalized = dayjs(baseDate).startOf('month');
    return Array.from({ length: count }, (_, index) =>
      normalized.add(index, 'month').format('YYYY-MM-DD')
    );
  };

  const runOptionABenchmark = async () => {
    const syncStatus = { isSyncing, error: syncError, lastSyncTime };
    const anchors = buildMonthlyAnchorSequence(selectedDate, 6);

    const benchmarkPolicy = async (policy) => {
      invalidateAllRangeCache({ reason: `debug:option-a-benchmark:${policy}` });
      useStripCalendarStore.getState().clearRangeCache();
      const before = getRangeCacheDebugStats();
      const startedAt = performance.now();

      for (const anchor of anchors) {
        const range = buildMonthlyRangeByPolicy(anchor, policy);
        const result = await getOrLoadRange({
          startDate: range.startDate,
          endDate: range.endDate,
          sourceTag: `option-a-benchmark:${policy}`,
          syncStatus,
        });

        if (!result.ok) {
          throw new Error(`${policy} load failed @ ${anchor}: ${result.error || 'unknown'}`);
        }
      }

      const after = getRangeCacheDebugStats();
      const elapsedMs = Number((performance.now() - startedAt).toFixed(2));
      return {
        policy,
        elapsedMs,
        missDelta: after.miss - before.miss,
        hitDelta: after.hit - before.hit,
        loadsDelta: after.loads - before.loads,
      };
    };

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🧪 Option A 정량 벤치마크 시작 (base=${selectedDate}, months=${anchors.length})`);
    addLog(`anchors=${anchors.join(', ')}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const legacy = await benchmarkPolicy('legacy_9week');
      const threeMonth = await benchmarkPolicy('three_month');
      const sixMonth = await benchmarkPolicy('six_month');

      const elapsedImprovement =
        legacy.elapsedMs > 0 ? ((legacy.elapsedMs - threeMonth.elapsedMs) / legacy.elapsedMs) * 100 : 0;
      const missImprovement =
        legacy.missDelta > 0 ? ((legacy.missDelta - threeMonth.missDelta) / legacy.missDelta) * 100 : 0;

      addLog(
        `legacy_9week: elapsed=${legacy.elapsedMs}ms, missΔ=${legacy.missDelta}, hitΔ=${legacy.hitDelta}, loadsΔ=${legacy.loadsDelta}`
      );
      addLog(
        `three_month: elapsed=${threeMonth.elapsedMs}ms, missΔ=${threeMonth.missDelta}, hitΔ=${threeMonth.hitDelta}, loadsΔ=${threeMonth.loadsDelta}`
      );
      addLog(
        `six_month: elapsed=${sixMonth.elapsedMs}ms, missΔ=${sixMonth.missDelta}, hitΔ=${sixMonth.hitDelta}, loadsΔ=${sixMonth.loadsDelta}`
      );
      addLog(`improvement(elapsed)=${elapsedImprovement.toFixed(1)}%`);
      addLog(`improvement(miss)=${missImprovement.toFixed(1)}%`);

      const sixVsThreeElapsed =
        threeMonth.elapsedMs > 0 ? ((sixMonth.elapsedMs - threeMonth.elapsedMs) / threeMonth.elapsedMs) * 100 : 0;
      const sixVsThreeMiss =
        threeMonth.missDelta > 0 ? ((sixMonth.missDelta - threeMonth.missDelta) / threeMonth.missDelta) * 100 : 0;
      addLog(`six_month vs three_month(elapsed)=${sixVsThreeElapsed.toFixed(1)}%`);
      addLog(`six_month vs three_month(miss)=${sixVsThreeMiss.toFixed(1)}%`);

      if (elapsedImprovement >= 30 || missImprovement >= 30) {
        addLog('✅ PASS [option-a-benchmark]: 30%+ 개선 충족');
      } else {
        addLog('❌ FAIL [option-a-benchmark]: 30% 개선 미달');
      }
    } catch (error) {
      addLog(`❌ 예외 [option-a-benchmark]: ${error.message}`);
    } finally {
      // benchmark 종료 후 기본 정책 복구
      useStripCalendarStore.getState().setMonthlyRangePolicy('three_month');
      addLog('ℹ️ Strip 월간 정책 자동 복구: three_month');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const runRangeCacheHitSmoke = async () => {
    const endDate = addDaysDateOnly(selectedDate, 6) || selectedDate;
    const syncStatus = { isSyncing, error: syncError, lastSyncTime };

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🧪 Range Cache hit 스모크: ${selectedDate} ~ ${endDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const before = getRangeCacheDebugStats();

      // 1차: forceRefresh로 miss를 강제 발생시켜 baseline을 고정
      const first = await getOrLoadRange({
        startDate: selectedDate,
        endDate,
        sourceTag: 'debug-range-smoke',
        forceRefresh: true,
        syncStatus,
      });

      if (!first.ok) {
        addLog(`❌ FAIL [range-hit-smoke]: 1차 로드 실패 (${first.error || 'unknown'})`);
        return;
      }

      const afterFirst = getRangeCacheDebugStats();

      // 2차: 동일 range 재요청, hit 증가 기대
      const second = await getOrLoadRange({
        startDate: selectedDate,
        endDate,
        sourceTag: 'debug-range-smoke',
        syncStatus,
      });

      if (!second.ok) {
        addLog(`❌ FAIL [range-hit-smoke]: 2차 로드 실패 (${second.error || 'unknown'})`);
        return;
      }

      const afterSecond = getRangeCacheDebugStats();

      const firstMissDelta = afterFirst.miss - before.miss;
      const firstHitDelta = afterFirst.hit - before.hit;
      const secondMissDelta = afterSecond.miss - afterFirst.miss;
      const secondHitDelta = afterSecond.hit - afterFirst.hit;

      addLog(`1차(forceRefresh): missΔ=${firstMissDelta}, hitΔ=${firstHitDelta}`);
      addLog(`2차(same-range): missΔ=${secondMissDelta}, hitΔ=${secondHitDelta}`);

      const passed = firstMissDelta >= 1 && secondHitDelta >= 1 && secondMissDelta === 0;
      if (passed) {
        addLog('✅ PASS [range-hit-smoke]: 1차 miss, 2차 hit 확인');
      } else {
        addLog('❌ FAIL [range-hit-smoke]: 기대 카운터 패턴 불일치');
      }

      addLog(
        `stats: hit=${afterSecond.hit}, miss=${afterSecond.miss}, loads=${afterSecond.loads}, inFlightDeduped=${afterSecond.inFlightDeduped}`
      );
    } catch (error) {
      addLog(`❌ 예외 [range-hit-smoke]: ${error.message}`);
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const checkAndRepairIndexes = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔧 인덱스 점검 및 복구');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const db = getDatabase();
      const indexes = await db.getAllAsync("PRAGMA index_list('completions')");
      const hasIndex = indexes.some(idx => idx.name === 'idx_completions_date');

      if (hasIndex) {
        addLog('✅ idx_completions_date 인덱스 존재함');
        addLog('🔄 REINDEX 실행...');
        await db.execAsync('REINDEX completions');
        addLog('✅ REINDEX 완료');
      } else {
        addLog('⚠️ idx_completions_date 인덱스 없음!');
        addLog('🛠 인덱스 생성 중...');
        await db.execAsync('CREATE INDEX IF NOT EXISTS idx_completions_date ON completions(date)');
        addLog('✅ 인덱스 생성 완료');
      }

      // 쿼리 속도 테스트
      const start = performance.now();
      await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const end = performance.now();
      addLog(`🚀 쿼리 테스트 (After): ${(end - start).toFixed(2)}ms`);

    } catch (e) {
      addLog(`❌ 오류: ${e.message}`);
    }
  };

  // ========== 🔬 성능 테스트 ==========

  const testLimitImpact = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔬 LIMIT 영향 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const db = getDatabase();

      // Test 1: LIMIT 1 워밍업 → LIMIT 없는 쿼리
      addLog('');
      addLog('━━━ Test 1: LIMIT 1 워밍업 후 ━━━');
      
      const warmup1Start = performance.now();
      await db.getAllAsync('SELECT * FROM completions WHERE date = ? LIMIT 1', ['1970-01-01']);
      const warmup1End = performance.now();
      addLog(`🔥 워밍업 (LIMIT 1): ${(warmup1End - warmup1Start).toFixed(2)}ms`);

      const query1Start = performance.now();
      const result1 = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const query1End = performance.now();
      addLog(`📊 실제 쿼리 (LIMIT 없음): ${(query1End - query1Start).toFixed(2)}ms (${result1.length} rows)`);

      // Test 2: LIMIT 없는 워밍업 → LIMIT 없는 쿼리
      addLog('');
      addLog('━━━ Test 2: LIMIT 없는 워밍업 후 ━━━');
      
      const warmup2Start = performance.now();
      await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['1970-01-01']);
      const warmup2End = performance.now();
      addLog(`🔥 워밍업 (LIMIT 없음): ${(warmup2End - warmup2Start).toFixed(2)}ms`);

      const query2Start = performance.now();
      const result2 = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-05']);
      const query2End = performance.now();
      addLog(`📊 실제 쿼리 (LIMIT 없음): ${(query2End - query2Start).toFixed(2)}ms (${result2.length} rows)`);

      // Test 3: 연속 호출 (캐싱 확인)
      addLog('');
      addLog('━━━ Test 3: 연속 호출 ━━━');

      const call1Start = performance.now();
      await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const call1End = performance.now();
      addLog(`1️⃣ 첫 호출: ${(call1End - call1Start).toFixed(2)}ms`);

      const call2Start = performance.now();
      await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const call2End = performance.now();
      addLog(`2️⃣ 두 번째: ${(call2End - call2Start).toFixed(2)}ms`);

      const call3Start = performance.now();
      await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const call3End = performance.now();
      addLog(`3️⃣ 세 번째: ${(call3End - call3Start).toFixed(2)}ms`);

      addLog('');
      addLog('✅ LIMIT 테스트 완료!');

    } catch (e) {
      addLog(`❌ 오류: ${e.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const testCompletionPerformance = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔬 Completion 쿼리 성능 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const db = getDatabase();

      // Test 1: 연속 호출 (캐싱 효과 확인)
      addLog('');
      addLog('━━━ Test 1: 연속 호출 (같은 날짜) ━━━');
      
      const call1Start = performance.now();
      const result1 = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const call1End = performance.now();
      addLog(`1️⃣ 첫 호출: ${(call1End - call1Start).toFixed(2)}ms (${result1.length} rows)`);

      const call2Start = performance.now();
      const result2 = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const call2End = performance.now();
      addLog(`2️⃣ 두 번째: ${(call2End - call2Start).toFixed(2)}ms (${result2.length} rows)`);

      const call3Start = performance.now();
      const result3 = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const call3End = performance.now();
      addLog(`3️⃣ 세 번째: ${(call3End - call3Start).toFixed(2)}ms (${result3.length} rows)`);

      // Test 2: 다양한 날짜
      addLog('');
      addLog('━━━ Test 2: 다양한 날짜 ━━━');

      const emptyStart = performance.now();
      const emptyResult = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['1970-01-01']);
      const emptyEnd = performance.now();
      addLog(`📭 빈 결과 (1970-01-01): ${(emptyEnd - emptyStart).toFixed(2)}ms (${emptyResult.length} rows)`);

      const date1Start = performance.now();
      const date1Result = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const date1End = performance.now();
      addLog(`📦 데이터 있음 (2026-02-04): ${(date1End - date1Start).toFixed(2)}ms (${date1Result.length} rows)`);

      const date2Start = performance.now();
      const date2Result = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-05']);
      const date2End = performance.now();
      addLog(`📦 다른 날짜 (2026-02-05): ${(date2End - date2Start).toFixed(2)}ms (${date2Result.length} rows)`);

      // Test 3: 쿼리 변형
      addLog('');
      addLog('━━━ Test 3: 쿼리 변형 ━━━');

      const limitStart = performance.now();
      const limitResult = await db.getAllAsync('SELECT * FROM completions LIMIT 1');
      const limitEnd = performance.now();
      addLog(`🔢 LIMIT 1: ${(limitEnd - limitStart).toFixed(2)}ms (${limitResult.length} rows)`);

      const firstStart = performance.now();
      const firstResult = await db.getFirstAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const firstEnd = performance.now();
      addLog(`1️⃣ getFirstAsync: ${(firstEnd - firstStart).toFixed(2)}ms`);

      const allStart = performance.now();
      const allResult = await db.getAllAsync('SELECT * FROM completions WHERE date = ?', ['2026-02-04']);
      const allEnd = performance.now();
      addLog(`📋 getAllAsync: ${(allEnd - allStart).toFixed(2)}ms (${allResult.length} rows)`);

      // Test 4: Service 함수 호출
      addLog('');
      addLog('━━━ Test 4: Service 함수 (Map 변환 포함) ━━━');

      const serviceStart = performance.now();
      const serviceResult = await sqliteGetCompletionsByDate('2026-02-04');
      const serviceEnd = performance.now();
      addLog(`🔧 getCompletionsByDate: ${(serviceEnd - serviceStart).toFixed(2)}ms (${Object.keys(serviceResult).length} keys)`);

      addLog('');
      addLog('✅ 성능 테스트 완료!');

    } catch (e) {
      addLog(`❌ 오류: ${e.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== 기본 상태 확인 ==========

  const checkDbStatus = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 SQLite DB 상태 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const netInfo = await NetInfo.fetch();
      addLog(`🌐 네트워크: ${netInfo.isConnected ? '✅ 온라인' : '❌ 오프라인'} (${netInfo.type})`);
      addLog('');

      const stats = await getDbStats();
      addLog('📊 SQLite 통계:');
      addLog(`  - Todos: ${stats.todos}개`);
      addLog(`  - Completions: ${stats.completions}개`);
      addLog(`  - Categories: ${stats.categories}개`);
      addLog(`  - Pending: ${stats.pending}개`);
      addLog('');

      const cachedTodos = queryClient.getQueryData(['todos', 'all']);
      const cachedCategories = queryClient.getQueryData(['categories']);
      addLog('💾 React Query 캐시:');
      addLog(`  - Todos: ${cachedTodos?.length || 0}개`);
      addLog(`  - Categories: ${cachedCategories?.length || 0}개`);
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== Completion 토글 테스트 ==========

  const checkCurrentTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔍 현재 Todo 상세 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const netInfo = await NetInfo.fetch();
      addLog(`🌐 네트워크: ${netInfo.isConnected ? '✅ 온라인' : '❌ 오프라인'}`);
      addLog(`📅 날짜: ${selectedDate}`);
      addLog(`📊 Todo 개수: ${todos.length}개`);
      addLog('');

      if (todos.length === 0) {
        addLog('⚠️ Todo가 없습니다');
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      const completions = await sqliteGetCompletionsByDate(selectedDate);
      addLog(`💾 SQLite Completions: ${Object.keys(completions).length}개`);
      addLog('');

      todos.forEach((todo, index) => {
        const key = `${todo._id}_${selectedDate}`;
        const hasCompletion = !!completions[key];

        addLog(`[${index + 1}] ${todo.title}`);
        addLog(`    _id: ${todo._id.slice(-8)}`);
        addLog(`    completed (UI): ${todo.completed ? '✅' : '⬜'}`);
        addLog(`    SQLite: ${hasCompletion ? '✅' : '⬜'}`);

        if (todo.completed !== hasCompletion) {
          addLog(`    ⚠️ 불일치 발견!`);
        }
        addLog('');
      });
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const testToggleCompletion = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔄 Completion 토글 테스트');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (todos.length === 0) {
      addLog('❌ Todo가 없습니다');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      return;
    }

    const todo = todos[0];
    const date = selectedDate;

    addLog(`📌 Todo: ${todo.title}`);
    addLog(`📅 Date: ${date}`);
    addLog(`🔄 현재 상태: ${todo.completed ? '✅ 완료' : '⬜ 미완료'}`);
    
    // 기간 일정 여부 확인
    const isRangeTodo = todo.startDate !== todo.endDate;
    if (isRangeTodo) {
      addLog(`📅 기간 일정: ${todo.startDate} ~ ${todo.endDate}`);
    }
    addLog('');

    try {
      addLog('━━━ Step 1: 토글 전 상태 ━━━');
      const beforeCompletions = await sqliteGetCompletionsByDate(date);
      const key = isRangeTodo ? `${todo._id}_null` : `${todo._id}_${date}`;
      const beforeState = !!beforeCompletions[key];
      addLog(`SQLite: ${beforeState ? '✅ 완료' : '⬜ 미완료'}`);
      addLog('');

      addLog('━━━ Step 2: 토글 실행 ━━━');
      await toggleCompletionMutation.mutateAsync({
        todoId: todo._id,
        date: date,
        currentCompleted: todo.completed,
        todo,  // ← todo 객체 전달
      });
      addLog('✅ 토글 완료');
      addLog('');

      addLog('━━━ Step 3: 토글 후 상태 ━━━');
      const afterCompletions = await sqliteGetCompletionsByDate(date);
      const afterState = !!afterCompletions[key];
      addLog(`SQLite: ${afterState ? '✅ 완료' : '⬜ 미완료'}`);

      const pending = await sqliteGetPendingChanges();
      const todoPending = pending.filter(p => p.todoId === todo._id && p.date === date);
      addLog(`Pending: ${todoPending.length}개`);
      if (todoPending.length > 0) {
        todoPending.forEach(p => addLog(`  - ${p.type}`));
      }
      addLog('');

      addLog('━━━ Step 4: UI 재조회 ━━━');
      await refetchTodos();
      const updatedTodos = queryClient.getQueryData(['todos', date]) || [];
      const updatedTodo = updatedTodos.find(t => t._id === todo._id);
      if (updatedTodo) {
        addLog(`UI: ${updatedTodo.completed ? '✅ 완료' : '⬜ 미완료'}`);
      } else {
        addLog('⚠️ Todo를 찾을 수 없습니다');
      }

      addLog('');
      addLog('🎉 토글 테스트 완료!');
    } catch (error) {
      addLog(`❌ 토글 실패: ${error.message}`);
      console.error('Toggle error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const checkPendingChanges = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('⏳ Pending Changes 확인');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const pending = await sqliteGetPendingChanges();
      const ready = await getPendingReady();
      const statusSummary = pending.reduce((acc, item) => {
        const key = item.status || 'pending';
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      const completionPending = pending.filter(p =>
        p.type === 'createCompletion' || p.type === 'deleteCompletion'
      );

      addLog(`⏳ 전체 Pending: ${pending.length}개`);
      addLog(`🚀 즉시 처리 가능(ready): ${ready.length}개`);
      addLog(
        `📊 상태 요약: pending=${statusSummary.pending || 0}, failed=${statusSummary.failed || 0}, dead_letter=${statusSummary.dead_letter || 0}`
      );
      addLog(`✅ Completion Pending: ${completionPending.length}개`);
      addLog('');

      if (pending.length === 0) {
        addLog('✅ Pending 없음');
      } else {
        addLog('📋 최근 Pending (최대 10개):');
        pending.slice(0, 10).forEach((p, index) => {
          addLog(`  [${index + 1}] ${p.type} | status=${p.status || 'pending'} | retry=${p.retryCount || 0}`);
          addLog(`      todoId: ${p.todoId?.slice(-8)}`);
          addLog(`      date: ${p.date || 'null'}`);
          addLog(`      nextRetryAt: ${p.nextRetryAt || 'null'}`);
          addLog(`      lastError: ${p.lastError || 'null'}`);
          addLog(`      created: ${new Date(p.createdAt).toLocaleString()}`);
          addLog('');
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const runPendingPushWithLimit = async (maxItems, label = `${maxItems}`) => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🚀 Pending Push 실행 (maxItems=${label})`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const result = await runPendingPush({ maxItems });
      addLog(`ok=${result.ok}`);
      addLog(`processed=${result.processed}, succeeded=${result.succeeded}, failed=${result.failed}`);
      addLog(`removed=${result.removed}, deadLetter=${result.deadLetter}, deferred=${result.deferred}`);
      addLog(`blockingFailure=${result.blockingFailure}`);
      addLog(`lastError=${result.lastError || 'null'}`);

      const count = await getPendingChangesCount();
      addLog(`📊 현재 Pending: ${count}개`);
    } catch (error) {
      addLog(`❌ Pending Push 실행 실패: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const runPendingPushOnce = async () => runPendingPushWithLimit(200, '200');
  const runPendingPushOne = async () => runPendingPushWithLimit(1, '1');
  const runPendingPushThree = async () => runPendingPushWithLimit(3, '3');

  const logCandidateProfile = (profile, decisionProfile = null) => {
    if (!profile) {
      addLog('profile: ensure=0ms | todoQuery=0ms | todoDeserialize=0ms | completionQuery=0ms | completionDeserialize=0ms');
      return;
    }

    addLog(
      `profile: ensure=${profile.ensureMs || 0}ms | ` +
      `ensurePath=${profile.ensurePath || 'unknown'} | ` +
      `todoQuery=${profile.todoQueryMs || 0}ms | ` +
      `todoDeserialize=${profile.todoDeserializeMs || 0}ms | ` +
      `completionQuery=${profile.completionQueryMs || 0}ms | ` +
      `completionDeserialize=${profile.completionDeserializeMs || 0}ms`
    );

    if (profile.ensureStateBefore || profile.ensureStateAfter) {
      const before = profile.ensureStateBefore || {};
      const after = profile.ensureStateAfter || {};
      addLog(
        `  ensureState: ` +
        `before(phase=${before.phase || 'unknown'}, hasDb=${before.hasDb ? 'Y' : 'N'}, inFlight=${before.hasInitPromise ? 'Y' : 'N'}, elapsed=${before.elapsedSinceStartMs || 0}ms) -> ` +
        `after(phase=${after.phase || 'unknown'}, hasDb=${after.hasDb ? 'Y' : 'N'}, inFlight=${after.hasInitPromise ? 'Y' : 'N'}, total=${after.totalMs || 0}ms)`
      );
    }

    if (decisionProfile) {
      addLog(
        `  decisionProfile: ` +
        `rec=${decisionProfile.recurringCount || 0}/${decisionProfile.recurringPassedCount || 0} ` +
        `(${decisionProfile.recurringDecisionMs || 0}ms), ` +
        `nonRec=${decisionProfile.nonRecurringCount || 0}/${decisionProfile.nonRecurringPassedCount || 0} ` +
        `(${decisionProfile.nonRecurringDecisionMs || 0}ms)`
      );
    }
  };

  const logCandidateExplain = (label, explain) => {
    if (!explain) {
      addLog(`explain(${label}): 없음`);
      return;
    }

    const todoPlan = Array.isArray(explain.todoPlan) ? explain.todoPlan : [];
    const completionPlan = Array.isArray(explain.completionPlan) ? explain.completionPlan : [];
    const maxRows = 8;

    addLog(`explain(${label}): todoPlan=${todoPlan.length}, completionPlan=${completionPlan.length}`);
    todoPlan.slice(0, maxRows).forEach((row, idx) => {
      addLog(`  todo[${idx + 1}] ${row}`);
    });
    if (todoPlan.length > maxRows) {
      addLog(`  ... todo ${todoPlan.length - maxRows} rows more`);
    }

    completionPlan.slice(0, maxRows).forEach((row, idx) => {
      addLog(`  completion[${idx + 1}] ${row}`);
    });
    if (completionPlan.length > maxRows) {
      addLog(`  ... completion ${completionPlan.length - maxRows} rows more`);
    }
  };

  const runCandidateExplainProbe = async () => {
    const rangeStart = dayjs(selectedDate).startOf('month').subtract(1, 'month').format('YYYY-MM-DD');
    const rangeEnd = dayjs(selectedDate).add(1, 'month').endOf('month').format('YYYY-MM-DD');
    const syncStatus = { isSyncing, error: syncError, lastSyncTime };

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🔍 Candidate EXPLAIN 시작: date=${selectedDate}, range=${rangeStart}~${rangeEnd}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const [dateResult, rangeResult] = await Promise.all([
        runCommonQueryForDate({ targetDate: selectedDate, syncStatus, debugExplain: true }),
        runCommonQueryForRange({ startDate: rangeStart, endDate: rangeEnd, syncStatus, debugExplain: true }),
      ]);

      if (!dateResult.ok || !rangeResult.ok) {
        const error = dateResult.ok ? rangeResult.error : dateResult.error;
        addLog(`❌ FAIL [candidate-explain]: ${error}`);
        return;
      }

      addLog(
        `date elapsed: total=${dateResult.elapsed.totalMs}ms | candidate=${dateResult.elapsed.candidateMs}ms | ` +
        `decision=${dateResult.elapsed.decisionMs}ms | aggregation=${dateResult.elapsed.aggregationMs}ms`
      );
      logCandidateProfile(dateResult.diagnostics?.candidateProfile, dateResult.diagnostics?.decisionProfile);
      logCandidateExplain('date', dateResult.diagnostics?.candidateExplain);

      addLog(
        `range elapsed: total=${rangeResult.elapsed.totalMs}ms | candidate=${rangeResult.elapsed.candidateMs}ms | ` +
        `decision=${rangeResult.elapsed.decisionMs}ms | aggregation=${rangeResult.elapsed.aggregationMs}ms`
      );
      logCandidateProfile(rangeResult.diagnostics?.candidateProfile, rangeResult.diagnostics?.decisionProfile);
      logCandidateExplain(`range:${rangeStart}~${rangeEnd}`, rangeResult.diagnostics?.candidateExplain);

      addLog('✅ PASS [candidate-explain]');
    } catch (error) {
      addLog(`❌ 예외 [candidate-explain]: ${error.message}`);
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const buildPerfProbeRange = (anchorDate) => ({
    startDate: dayjs(anchorDate).startOf('month').subtract(1, 'month').format('YYYY-MM-DD'),
    endDate: dayjs(anchorDate).add(1, 'month').endOf('month').format('YYYY-MM-DD'),
  });

  const getRecurrenceText = (rawRecurrence) => {
    if (!rawRecurrence) return '';
    if (typeof rawRecurrence === 'string') return rawRecurrence.toUpperCase();
    if (Array.isArray(rawRecurrence)) return rawRecurrence.map((item) => getRecurrenceText(item)).join(' ');
    try {
      return JSON.stringify(rawRecurrence).toUpperCase();
    } catch {
      return '';
    }
  };

  const collectPerfDatasetMeta = async () => {
    const db = getDatabase();
    const [todoRows, completionRows] = await Promise.all([
      db.getAllAsync(`
        SELECT _id, date, start_date, end_date, recurrence, start_time
        FROM todos
        WHERE deleted_at IS NULL
        ORDER BY _id ASC
      `),
      db.getAllAsync(`
        SELECT key, todo_id, date
        FROM completions
        ORDER BY key ASC
      `),
    ]);

    const typeCounts = {
      single: 0,
      period: 0,
      recDaily: 0,
      recWeekly: 0,
      recMonthly: 0,
      recTimeBased: 0,
      recOther: 0,
    };

    todoRows.forEach((row) => {
      if (!row.recurrence) {
        const isPeriod = !!row.start_date && !!row.end_date && row.start_date !== row.end_date;
        if (isPeriod) typeCounts.period += 1;
        else typeCounts.single += 1;
        return;
      }

      const recurrenceText = getRecurrenceText(row.recurrence);
      if (recurrenceText.includes('DAILY')) typeCounts.recDaily += 1;
      else if (recurrenceText.includes('WEEKLY')) typeCounts.recWeekly += 1;
      else if (recurrenceText.includes('MONTHLY')) typeCounts.recMonthly += 1;
      else typeCounts.recOther += 1;

      if (row.start_time) typeCounts.recTimeBased += 1;
    });

    return {
      datasetId: PERF_DATASET_ID,
      todoCount: todoRows.length,
      completionCount: completionRows.length,
      typeCounts,
      todoIds: todoRows.map((row) => row._id),
      completionKeys: completionRows.map((row) => row.key),
    };
  };

  const validatePerfDatasetMeta = (meta) => {
    const issues = [];

    if (meta.todoCount < 20) issues.push(`todos 부족: ${meta.todoCount} < 20`);
    if (meta.completionCount < 5) issues.push(`completions 부족: ${meta.completionCount} < 5`);
    if (meta.typeCounts.single < 1) issues.push('single todo 없음');
    if (meta.typeCounts.period < 1) issues.push('period todo 없음');
    if (meta.typeCounts.recDaily < 1) issues.push('daily recurrence 없음');
    if (meta.typeCounts.recWeekly < 1) issues.push('weekly recurrence 없음');
    if (meta.typeCounts.recMonthly < 1) issues.push('monthly recurrence 없음');
    if (meta.typeCounts.recTimeBased < 1) issues.push('time-based recurrence 없음');

    return {
      ok: issues.length === 0,
      issues,
    };
  };

  const clearCachesForProbeCold = (reason) => {
    invalidateAllScreenCaches({ queryClient, reason });
  };

  const logPerfProbeRow = (row) => {
    const cacheText =
      row.cacheHit == null
        ? 'cache=-'
        : `cache=${row.cacheHit ? 'hit' : 'miss'}(hitΔ=${row.hitDelta}, missΔ=${row.missDelta}, loadsΔ=${row.loadsDelta})`;

    addLog(
      `[${row.scenario}] run=${row.run} total=${row.totalMs}ms ` +
      `candidate=${row.candidateMs}ms decision=${row.decisionMs}ms aggregation=${row.aggregationMs}ms ` +
      `stage=${row.stage.candidate}/${row.stage.decided}/${row.stage.aggregated} ` +
      `stale=${row.isStale} ${cacheText} note=${row.note || '-'}`
    );
  };

  const summarizePerfProbeScenario = (rows) => {
    const totalList = rows.map((row) => row.totalMs);
    const candidateList = rows.map((row) => row.candidateMs);
    const decisionList = rows.map((row) => row.decisionMs);
    const aggregationList = rows.map((row) => row.aggregationMs);

    return {
      totalP50: percentile(totalList, 50),
      totalP95: percentile(totalList, 95),
      candidateP50: percentile(candidateList, 50),
      candidateP95: percentile(candidateList, 95),
      decisionP95: percentile(decisionList, 95),
      aggregationP95: percentile(aggregationList, 95),
    };
  };

  const runDatePerfScenario = async ({ scenario, mode, targetDate, syncStatus }) => {
    const rows = [];

    if (mode === 'hot') {
      clearCachesForProbeCold(`perf-probe:${scenario}:warmup-reset`);
      const warmup = await runCommonQueryForDate({ targetDate, syncStatus });
      if (!warmup.ok) {
        throw new Error(`[${scenario}] warmup 실패: ${warmup.error || 'unknown'}`);
      }
    }

    for (let run = 1; run <= PERF_REPEAT; run += 1) {
      if (mode === 'cold') {
        clearCachesForProbeCold(`perf-probe:${scenario}:run-${run}:cold-reset`);
      }

      const result = await runCommonQueryForDate({ targetDate, syncStatus });
      if (!result.ok) {
        throw new Error(`[${scenario}] run ${run} 실패: ${result.error || 'unknown'}`);
      }

      const row = {
        scenario,
        run,
        totalMs: Number((result.elapsed?.totalMs || 0).toFixed(2)),
        candidateMs: Number((result.elapsed?.candidateMs || 0).toFixed(2)),
        decisionMs: Number((result.elapsed?.decisionMs || 0).toFixed(2)),
        aggregationMs: Number((result.elapsed?.aggregationMs || 0).toFixed(2)),
        stage: result.stage || { candidate: 0, decided: 0, aggregated: 0 },
        isStale: Boolean(result.meta?.isStale),
        cacheHit: null,
        hitDelta: 0,
        missDelta: 0,
        loadsDelta: 0,
        note: mode === 'cold' ? 'cold-reset' : 'immediate-rerun',
      };

      rows.push(row);
      logPerfProbeRow(row);
    }

    return rows;
  };

  const runRangePerfScenario = async ({ scenario, mode, range, syncStatus }) => {
    const rows = [];

    if (mode === 'hot') {
      clearCachesForProbeCold(`perf-probe:${scenario}:warmup-reset`);
      const warmup = await getOrLoadRange({
        startDate: range.startDate,
        endDate: range.endDate,
        sourceTag: `perf-probe:${scenario}:warmup`,
        forceRefresh: true,
        syncStatus,
      });
      if (!warmup.ok) {
        throw new Error(`[${scenario}] warmup 실패: ${warmup.error || 'unknown'}`);
      }
    }

    for (let run = 1; run <= PERF_REPEAT; run += 1) {
      if (mode === 'cold') {
        clearCachesForProbeCold(`perf-probe:${scenario}:run-${run}:cold-reset`);
      }

      const beforeStats = getRangeCacheDebugStats();
      const startedAt = performance.now();
      const result = await getOrLoadRange({
        startDate: range.startDate,
        endDate: range.endDate,
        sourceTag: `perf-probe:${scenario}:run-${run}`,
        syncStatus,
      });
      const totalMs = Number((performance.now() - startedAt).toFixed(2));
      const afterStats = getRangeCacheDebugStats();

      if (!result.ok) {
        throw new Error(`[${scenario}] run ${run} 실패: ${result.error || 'unknown'}`);
      }

      const cacheHit = Boolean(result.cacheInfo?.hit);
      const fromCache = mode === 'hot' && cacheHit;

      const row = {
        scenario,
        run,
        totalMs,
        candidateMs: Number((fromCache ? 0 : result.elapsed?.candidateMs || 0).toFixed(2)),
        decisionMs: Number((fromCache ? 0 : result.elapsed?.decisionMs || 0).toFixed(2)),
        aggregationMs: Number((fromCache ? 0 : result.elapsed?.aggregationMs || 0).toFixed(2)),
        stage: result.stage || { candidate: 0, decided: 0, aggregated: 0 },
        isStale: Boolean(result.meta?.isStale),
        cacheHit,
        hitDelta: afterStats.hit - beforeStats.hit,
        missDelta: afterStats.miss - beforeStats.miss,
        loadsDelta: afterStats.loads - beforeStats.loads,
        note: cacheHit ? 'cache-hit' : 'cache-miss',
      };

      rows.push(row);
      logPerfProbeRow(row);
    }

    return rows;
  };

  const runTask15PerfProbe = async () => {
    const range = buildPerfProbeRange(selectedDate);
    const syncStatus = { isSyncing, error: syncError, lastSyncTime };

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🚀 Task15 Perf Probe 시작 (repeat=${PERF_REPEAT}, dataset=${PERF_DATASET_ID})`);
    addLog(`anchorDate=${selectedDate}, range(3개월)=${range.startDate}~${range.endDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      if (isSyncing) {
        throw new Error('sync 진행 중입니다. sync 완료 후 다시 실행하세요.');
      }

      const freshness = await runCommonQueryForDate({ targetDate: selectedDate, syncStatus });
      if (!freshness.ok) {
        throw new Error(`freshness 체크 실패: ${freshness.error || 'unknown'}`);
      }
      if (freshness.meta?.isStale) {
        throw new Error(`freshness 실패: isStale=true (${freshness.meta?.staleReason || 'unknown'})`);
      }

      const datasetMeta = await collectPerfDatasetMeta();
      const datasetValidation = validatePerfDatasetMeta(datasetMeta);

      addLog(`dataset: id=${datasetMeta.datasetId}, todos=${datasetMeta.todoCount}, completions=${datasetMeta.completionCount}`);
      addLog(
        `dataset-types: single=${datasetMeta.typeCounts.single}, period=${datasetMeta.typeCounts.period}, ` +
        `recDaily=${datasetMeta.typeCounts.recDaily}, recWeekly=${datasetMeta.typeCounts.recWeekly}, ` +
        `recMonthly=${datasetMeta.typeCounts.recMonthly}, recTime=${datasetMeta.typeCounts.recTimeBased}, recOther=${datasetMeta.typeCounts.recOther}`
      );
      addLog(`dataset-todoIds(sample): ${datasetMeta.todoIds.slice(0, 20).join(', ') || '(none)'}`);
      addLog(`dataset-completionKeys(sample): ${datasetMeta.completionKeys.slice(0, 20).join(', ') || '(none)'}`);

      if (!datasetValidation.ok) {
        datasetValidation.issues.forEach((issue) => addLog(`❌ dataset issue: ${issue}`));
        throw new Error('Task15 최소 데이터셋 조건 미충족');
      }

      addLog('🧪 S1 date-cold 시작');
      const s1Rows = await runDatePerfScenario({
        scenario: 'S1',
        mode: 'cold',
        targetDate: selectedDate,
        syncStatus,
      });

      addLog('🧪 S2 date-hot 시작');
      const s2Rows = await runDatePerfScenario({
        scenario: 'S2',
        mode: 'hot',
        targetDate: selectedDate,
        syncStatus,
      });

      addLog('🧪 S3 range-cold 시작');
      const s3Rows = await runRangePerfScenario({
        scenario: 'S3',
        mode: 'cold',
        range,
        syncStatus,
      });

      addLog('🧪 S4 range-hot 시작');
      const s4Rows = await runRangePerfScenario({
        scenario: 'S4',
        mode: 'hot',
        range,
        syncStatus,
      });

      const summary = {
        S1: summarizePerfProbeScenario(s1Rows),
        S2: summarizePerfProbeScenario(s2Rows),
        S3: summarizePerfProbeScenario(s3Rows),
        S4: summarizePerfProbeScenario(s4Rows),
      };

      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      addLog('📊 Task15 요약 통계 (p50/p95)');
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      Object.entries(summary).forEach(([scenario, stats]) => {
        addLog(
          `${scenario}: total(p50=${stats.totalP50}, p95=${stats.totalP95}) ` +
          `candidate(p50=${stats.candidateP50}, p95=${stats.candidateP95}) ` +
          `decision(p95=${stats.decisionP95}) aggregation(p95=${stats.aggregationP95})`
        );
      });

      const s4HotPass = s4Rows.every(
        (row) => row.cacheHit === true && row.totalMs <= 20 && row.missDelta === 0 && row.loadsDelta === 0
      );
      const staleFreePass = [...s1Rows, ...s2Rows, ...s3Rows, ...s4Rows].every((row) => !row.isStale);
      const repeatPass =
        s1Rows.length === PERF_REPEAT &&
        s2Rows.length === PERF_REPEAT &&
        s3Rows.length === PERF_REPEAT &&
        s4Rows.length === PERF_REPEAT;
      const dateColdPass = summary.S1.totalP95 <= 120;

      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      addLog('✅ DoD 체크');
      addLog(`- date cold total p95 <= 120ms: ${dateColdPass ? 'PASS' : 'FAIL'} (${summary.S1.totalP95}ms)`);
      addLog(`- range cold candidate baseline(고정값): ${summary.S3.candidateP95}ms`);
      addLog(`- range hot <=20ms + cache-hit/no-miss: ${s4HotPass ? 'PASS' : 'FAIL'}`);
      addLog(`- stale=false + repeat=5 고정: ${staleFreePass && repeatPass ? 'PASS' : 'FAIL'}`);
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

      const overallPass = dateColdPass && s4HotPass && staleFreePass && repeatPass;
      addLog(overallPass ? '✅ PASS [task15-perf-probe]' : '❌ FAIL [task15-perf-probe]');

      const lastStage = s4Rows[s4Rows.length - 1]?.stage || { candidate: 0, decided: 0, aggregated: 0 };
      recordValidation('perfProbe', {
        ok: overallPass,
        stage: lastStage,
        elapsed: {
          totalMs: summary.S4.totalP95,
          candidateMs: summary.S3.candidateP95,
          decisionMs: summary.S4.decisionP95,
          aggregationMs: summary.S4.aggregationP95,
        },
        meta: { isStale: !staleFreePass, staleReason: staleFreePass ? null : 'sync_failed', lastSyncTime: lastSyncTime || null },
        error: overallPass ? null : 'task15 probe did not satisfy DoD',
      });
    } catch (error) {
      addLog(`❌ 예외 [task15-perf-probe]: ${error.message}`);
      recordValidation('perfProbe', {
        ok: false,
        stage: { candidate: 0, decided: 0, aggregated: 0 },
        elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
        meta: { isStale: true, staleReason: 'sync_failed', lastSyncTime: lastSyncTime || null },
        error: error.message,
      });
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const runCommonLayerDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🧩 공통 레이어 실행(date): ${selectedDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const result = await runCommonQueryForDate({
        targetDate: selectedDate,
        syncStatus: { isSyncing, error: syncError, lastSyncTime },
      });

      if (!result.ok) {
        addLog(`❌ FAIL [common-date]: ${result.error}`);
        addLog(`stage: candidate=${result.stage.candidate}, decided=${result.stage.decided}, aggregated=${result.stage.aggregated}`);
        logCandidateProfile(result.diagnostics?.candidateProfile, result.diagnostics?.decisionProfile);
        recordValidation('date', {
          ok: false,
          stage: result.stage,
          elapsed: result.elapsed,
          meta: result.meta,
          error: result.error,
        });
        return;
      }

      addLog('✅ PASS [common-date]');
      addLog(`stage: candidate=${result.stage.candidate}, decided=${result.stage.decided}, aggregated=${result.stage.aggregated}`);
      addLog(`elapsed: total=${result.elapsed.totalMs}ms | candidate=${result.elapsed.candidateMs}ms | decision=${result.elapsed.decisionMs}ms | aggregation=${result.elapsed.aggregationMs}ms`);
      addLog(`stale: isStale=${result.meta.isStale}, reason=${result.meta.staleReason || 'none'}, lastSync=${result.meta.lastSyncTime || 'null'}`);
      addLog(`diag: completionCandidates=${result.diagnostics.completionCandidates}, invalidRecurrence=${result.diagnostics.invalidRecurrenceCount}`);
      logCandidateProfile(result.diagnostics?.candidateProfile, result.diagnostics?.decisionProfile);
      recordValidation('date', {
        ok: true,
        stage: result.stage,
        elapsed: result.elapsed,
        meta: result.meta,
        error: null,
      });

      const preview = result.items.slice(0, 5);
      preview.forEach((item, index) => {
        addLog(`  [${index + 1}] ${item.title} | completed=${item.completed ? 'Y' : 'N'} | key=${item.completionKey}`);
      });
    } catch (error) {
      addLog(`❌ 예외: ${error.message}`);
      recordValidation('date', {
        ok: false,
        stage: { candidate: 0, decided: 0, aggregated: 0 },
        elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
        meta: { isStale: true, staleReason: 'sync_failed', lastSyncTime: lastSyncTime || null },
        error: error.message,
      });
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const runCommonLayerRange = async () => {
    const endDate = addDaysDateOnly(selectedDate, 6) || selectedDate;

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🧩 공통 레이어 실행(range): ${selectedDate} ~ ${endDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const result = await runCommonQueryForRange({
        startDate: selectedDate,
        endDate,
        syncStatus: { isSyncing, error: syncError, lastSyncTime },
      });

      if (!result.ok) {
        addLog(`❌ FAIL [common-range]: ${result.error}`);
        addLog(`stage: candidate=${result.stage.candidate}, decided=${result.stage.decided}, aggregated=${result.stage.aggregated}`);
        logCandidateProfile(result.diagnostics?.candidateProfile, result.diagnostics?.decisionProfile);
        recordValidation('range', {
          ok: false,
          stage: result.stage,
          elapsed: result.elapsed,
          meta: result.meta,
          error: result.error,
        });
        return;
      }

      const dateCount = Object.keys(result.itemsByDate).length;
      addLog('✅ PASS [common-range]');
      addLog(`stage: candidate=${result.stage.candidate}, decided=${result.stage.decided}, aggregated=${result.stage.aggregated}`);
      addLog(`rangeDates=${dateCount}`);
      addLog(`elapsed: total=${result.elapsed.totalMs}ms | candidate=${result.elapsed.candidateMs}ms | decision=${result.elapsed.decisionMs}ms | aggregation=${result.elapsed.aggregationMs}ms`);
      addLog(`stale: isStale=${result.meta.isStale}, reason=${result.meta.staleReason || 'none'}, lastSync=${result.meta.lastSyncTime || 'null'}`);
      addLog(`diag: completionCandidates=${result.diagnostics.completionCandidates}, invalidRecurrence=${result.diagnostics.invalidRecurrenceCount}`);
      logCandidateProfile(result.diagnostics?.candidateProfile, result.diagnostics?.decisionProfile);
      recordValidation('range', {
        ok: true,
        stage: result.stage,
        elapsed: result.elapsed,
        meta: result.meta,
        error: null,
      });
    } catch (error) {
      addLog(`❌ 예외: ${error.message}`);
      recordValidation('range', {
        ok: false,
        stage: { candidate: 0, decided: 0, aggregated: 0 },
        elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
        meta: { isStale: true, staleReason: 'sync_failed', lastSyncTime: lastSyncTime || null },
        error: error.message,
      });
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const runSyncCoupledSmoke = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧪 Sync 결합 스모크 시작');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const before = await runCommonQueryForDate({
        targetDate: selectedDate,
        syncStatus: { isSyncing, error: syncError, lastSyncTime },
      });

      await syncAll();
      addLog('🔄 syncAll 호출 완료');
      const latestCursor = await getMetadata('sync.last_success_at');

      const after = await runCommonQueryForDate({
        targetDate: selectedDate,
        syncStatus: { isSyncing, error: syncError, lastSyncTime: latestCursor || lastSyncTime },
      });

      if (!after.ok) {
        addLog(`❌ FAIL [sync-smoke]: ${after.error}`);
        addLog(`stage: candidate=${after.stage.candidate}, decided=${after.stage.decided}, aggregated=${after.stage.aggregated}`);
        recordValidation('syncSmoke', {
          ok: false,
          stage: after.stage,
          elapsed: after.elapsed,
          meta: after.meta,
          error: after.error,
        });
      } else {
        addLog(`✅ PASS [sync-smoke]: stage(c=${after.stage.candidate}, d=${after.stage.decided}, a=${after.stage.aggregated})`);
        if (before.ok) {
          addLog(`staleTransition: ${before.meta.isStale} -> ${after.meta.isStale}`);
        }
        addLog(`stale: isStale=${after.meta.isStale}, reason=${after.meta.staleReason || 'none'}`);
        recordValidation('syncSmoke', {
          ok: true,
          stage: after.stage,
          elapsed: after.elapsed,
          meta: after.meta,
          error: null,
        });
      }
    } catch (error) {
      addLog(`❌ 예외: ${error.message}`);
      recordValidation('syncSmoke', {
        ok: false,
        stage: { candidate: 0, decided: 0, aggregated: 0 },
        elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
        meta: { isStale: true, staleReason: 'sync_failed', lastSyncTime: lastSyncTime || null },
        error: error.message,
      });
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  const toCompletionKeySet = (items, targetDate) => {
    const list = Array.isArray(items) ? items : [];
    const set = new Set();
    list.forEach((item) => {
      const fallbackKey = `${item?.todoId || item?._id || 'unknown'}_${targetDate}`;
      set.add(item?.completionKey || fallbackKey);
    });
    return set;
  };

  const sampleDiff = (leftSet, rightSet, max = 5) => {
    const diff = [];
    for (const key of leftSet) {
      if (!rightSet.has(key)) diff.push(key);
      if (diff.length >= max) break;
    }
    return diff;
  };

  const diffCount = (leftSet, rightSet) => {
    let count = 0;
    for (const key of leftSet) {
      if (!rightSet.has(key)) count += 1;
    }
    return count;
  };

  const runScreenAdapterCompare = async () => {
    const endDate = addDaysDateOnly(selectedDate, 6) || selectedDate;

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`🧪 화면 결과 비교: ${selectedDate} (range ~ ${endDate})`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const syncStatus = { isSyncing, error: syncError, lastSyncTime };
      const [dateResult, rangeResult] = await Promise.all([
        runCommonQueryForDate({ targetDate: selectedDate, syncStatus }),
        runCommonQueryForRange({ startDate: selectedDate, endDate, syncStatus }),
      ]);

      if (!dateResult.ok || !rangeResult.ok) {
        const error = dateResult.ok ? rangeResult.error : dateResult.error;
        addLog(`❌ FAIL [screen-compare]: common-layer 실패 (${error})`);
        recordValidation('screenCompare', {
          ok: false,
          stage: { candidate: 0, decided: 0, aggregated: 0 },
          elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
          meta: { isStale: true, staleReason: 'sync_failed', lastSyncTime: lastSyncTime || null },
          error,
        });
        return;
      }

      const todoScreen = adaptTodoScreenFromDateHandoff(dateResult);
      const todoCalendar = adaptTodoCalendarFromRangeHandoff(rangeResult, {
        monthRanges: [{ id: 'compare-range', startDate: selectedDate, endDate }],
        visibleLimit: 3,
      });
      const stripCalendar = adaptStripCalendarFromRangeHandoff(rangeResult, { maxDots: 3 });

      if (!todoScreen.ok || !todoCalendar.ok || !stripCalendar.ok) {
        const error = todoScreen.error || todoCalendar.error || stripCalendar.error || 'adapter failed';
        addLog(`❌ FAIL [screen-compare]: adapter 실패 (${error})`);
        recordValidation('screenCompare', {
          ok: false,
          stage: rangeResult.stage,
          elapsed: rangeResult.elapsed,
          meta: rangeResult.meta,
          error,
        });
        return;
      }

      const todoScreenItems = todoScreen.items || [];
      const calendarDateItems = todoCalendar.itemsByDate?.[selectedDate] || [];
      const stripSummary = stripCalendar.summariesByDate?.[selectedDate] || {
        date: selectedDate,
        hasTodo: false,
        uniqueCategoryColors: [],
        dotCount: 0,
        overflowCount: 0,
      };

      const todoScreenKeys = toCompletionKeySet(todoScreenItems, selectedDate);
      const todoCalendarKeys = toCompletionKeySet(calendarDateItems, selectedDate);
      const onlyTodoScreenCount = diffCount(todoScreenKeys, todoCalendarKeys);
      const onlyTodoCalendarCount = diffCount(todoCalendarKeys, todoScreenKeys);
      const onlyTodoScreen = sampleDiff(todoScreenKeys, todoCalendarKeys);
      const onlyTodoCalendar = sampleDiff(todoCalendarKeys, todoScreenKeys);
      const parity = onlyTodoScreenCount === 0 && onlyTodoCalendarCount === 0;

      addLog(`TodoScreen: count=${todoScreenItems.length}`);
      addLog(`TodoCalendar(date): count=${calendarDateItems.length}`);
      addLog(
        `StripCalendar(date): hasTodo=${stripSummary.hasTodo ? 'Y' : 'N'}, ` +
        `dotCount=${stripSummary.dotCount}, overflow=${stripSummary.overflowCount || 0}`
      );
      addLog(`Strip colors: ${stripSummary.uniqueCategoryColors.join(', ') || '(none)'}`);
      addLog(
        `ID diff: onlyTodoScreen=${onlyTodoScreenCount}, ` +
        `onlyTodoCalendar=${onlyTodoCalendarCount}`
      );

      if (!parity) {
        if (onlyTodoScreen.length > 0) addLog(`  sample onlyTodoScreen: ${onlyTodoScreen.join(', ')}`);
        if (onlyTodoCalendar.length > 0) addLog(`  sample onlyTodoCalendar: ${onlyTodoCalendar.join(', ')}`);
      }

      addLog(parity ? '✅ PASS [screen-compare]' : '⚠️ WARN [screen-compare]: ID diff 존재');
      recordValidation('screenCompare', {
        ok: parity,
        stage: rangeResult.stage,
        elapsed: rangeResult.elapsed,
        meta: rangeResult.meta,
        error: parity ? null : 'todo-screen vs todo-calendar id diff',
      });
    } catch (error) {
      addLog(`❌ 예외: ${error.message}`);
      recordValidation('screenCompare', {
        ok: false,
        stage: { candidate: 0, decided: 0, aggregated: 0 },
        elapsed: { totalMs: 0, candidateMs: 0, decisionMs: 0, aggregationMs: 0 },
        meta: { isStale: true, staleReason: 'sync_failed', lastSyncTime: lastSyncTime || null },
        error: error.message,
      });
    } finally {
      addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  };

  // ========== SQLite 조회 테스트 ==========

  const sqlite_TodosByDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`📋 날짜별 Todo 조회: ${selectedDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const todos = await sqliteGetTodosByDate(selectedDate);
      addLog(`📊 결과: ${todos.length}개`);
      addLog('');

      if (todos.length === 0) {
        addLog('⚠️ 해당 날짜에 Todo가 없습니다');
      } else {
        todos.forEach((todo, i) => {
          addLog(`[${i + 1}] ${todo.title}`);
          addLog(`    ID: ${todo._id.slice(-8)}`);
          addLog(`    카테고리: ${todo.category?.name || '없음'} (${todo.category?.color || '-'})`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const sqlite_AllTodos = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📋 전체 Todo 조회');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const todos = await sqliteGetAllTodos();
      const count = await getTodoCount();
      addLog(`📊 총 ${count}개`);
      addLog('');

      todos.slice(0, 10).forEach((todo, i) => {
        addLog(`[${i + 1}] ${todo.title}`);
        addLog(`    날짜: ${todo.date || `${todo.startDate} ~ ${todo.endDate}`}`);
      });

      if (todos.length > 10) {
        addLog(`  ... 외 ${todos.length - 10}개`);
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const sqlite_CompletionsByDate = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog(`✅ 날짜별 Completion: ${selectedDate}`);
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const completions = await sqliteGetCompletionsByDate(selectedDate);
      const count = Object.keys(completions).length;
      addLog(`📊 결과: ${count}개`);
      addLog('');

      if (count === 0) {
        addLog('⚠️ 해당 날짜에 완료된 Todo가 없습니다');
      } else {
        Object.entries(completions).forEach(([key, comp]) => {
          addLog(`- ${key}`);
          addLog(`  completedAt: ${new Date(comp.completedAt).toLocaleString()}`);
        });
      }
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const sqlite_CategoryList = async () => {
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('📂 Categories 목록');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const categories = await sqliteGetAllCategories();
      const count = await getCategoryCount();

      addLog(`📊 총 ${count}개`);
      addLog('');

      categories.forEach((cat, i) => {
        addLog(`[${i + 1}] ${cat.name}`);
        addLog(`    ID: ${cat._id.slice(-8)}`);
        addLog(`    색상: ${cat.color}`);
        addLog(`    순서: ${cat.order}`);
      });
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  // ========== 위험한 작업 ==========

  const clearCache = () => {
    queryClient.clear();
    addLog(`🗑️ React Query 캐시 클리어 완료`);
    addLog(`💡 앱을 재시작하여 초기 로딩 테스트`);
  };

  const clearStripL1CacheOnly = () => {
    useStripCalendarStore.getState().clearRangeCache();
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🧹 Strip L1 캐시만 클리어');
    addLog('✅ stripCalendarStore loadedRanges/summariesByDate 초기화 완료');
    addLog('ℹ️ shared range cache(hit/miss/loadedRanges)는 유지됩니다');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const clearPending = async () => {
    const confirmClear = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm('⚠️ Pending Changes를 삭제하시겠습니까?');
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ Pending 삭제',
            'Pending Changes를 삭제하시겠습니까?',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '삭제', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmClear();
    if (!confirmed) {
      addLog('❌ 삭제 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🗑️ Pending Changes 삭제');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      await sqliteClearPendingChanges();
      addLog('✅ 삭제 완료!');

      const count = await getPendingChangesCount();
      addLog(`📊 현재 Pending: ${count}개`);
    } catch (error) {
      addLog(`❌ 오류: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const resetDb = async () => {
    const confirmReset = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '⚠️ SQLite 데이터를 전체 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!'
          );
          resolve(confirmed);
        } else {
          Alert.alert(
            '⚠️ SQLite 전체 삭제',
            'SQLite 데이터를 전체 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '삭제', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmReset();
    if (!confirmed) {
      addLog('❌ 삭제 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🗑️ SQLite 전체 초기화');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      await resetDatabase();
      addLog('✅ SQLite 전체 초기화 완료');

      const stats = await getDbStats();
      addLog('');
      addLog('📊 현재 상태:');
      addLog(`  - Todos: ${stats.todos}개`);
      addLog(`  - Completions: ${stats.completions}개`);
      addLog(`  - Categories: ${stats.categories}개`);
    } catch (error) {
      addLog(`❌ 초기화 실패: ${error.message}`);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const forceMigration = async () => {
    const confirmMigration = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '🔧 강제 마이그레이션\n\n' +
            'migration_version을 리셋하고 v3 마이그레이션을 강제 실행합니다.\n\n' +
            'completions 테이블이 재생성됩니다.\n\n' +
            '계속하시겠습니까?'
          );
          resolve(confirmed);
        } else {
          Alert.alert(
            '🔧 강제 마이그레이션',
            'migration_version을 리셋하고 v3 마이그레이션을 강제 실행합니다.\n\n' +
            'completions 테이블이 재생성됩니다.\n\n' +
            '계속하시겠습니까?',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '실행', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmMigration();
    if (!confirmed) {
      addLog('❌ 마이그레이션 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🔧 강제 마이그레이션 시작');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      const db = getDatabase();

      // 1. 현재 버전 확인
      addLog('1️⃣ 현재 마이그레이션 버전 확인 중...');
      const currentVersion = await db.getFirstAsync(
        'SELECT value FROM metadata WHERE key = ?',
        ['migration_version']
      );
      addLog(`   현재 버전: ${currentVersion?.value || '없음'}`);

      // 2. 현재 스키마 확인
      addLog('2️⃣ 현재 completions 테이블 스키마 확인 중...');
      const schema = await db.getAllAsync("PRAGMA table_info('completions')");
      const hasIdColumn = schema.some(col => col.name === '_id');
      addLog(`   _id 컬럼 존재: ${hasIdColumn ? '✅' : '❌'}`);
      addLog(`   컬럼 목록: ${schema.map(c => c.name).join(', ')}`);

      if (hasIdColumn) {
        addLog('');
        addLog('✅ 이미 _id 컬럼이 있습니다!');
        addLog('💡 다른 문제일 수 있습니다. 로그를 확인하세요.');
        addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
      }

      // 3. migration_version 리셋
      addLog('3️⃣ migration_version 리셋 중...');
      await db.runAsync('DELETE FROM metadata WHERE key = ?', ['migration_version']);
      addLog('✅ migration_version 삭제 완료');

      // 4. 페이지 새로고침 안내
      addLog('');
      addLog('✅ 강제 마이그레이션 준비 완료!');
      addLog('🔄 3초 후 페이지를 새로고침합니다...');
      addLog('   (새로고침 후 v3 마이그레이션이 자동 실행됩니다)');

      // 3초 후 새로고침
      setTimeout(() => {
        if (Platform.OS === 'web') {
          window.location.reload();
        } else {
          addLog('💡 앱을 재시작해주세요.');
        }
      }, 3000);

    } catch (error) {
      addLog(`❌ 강제 마이그레이션 실패: ${error.message}`);
      console.error('Force migration error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  const fullReset = async () => {
    const confirmFullReset = () => {
      return new Promise((resolve) => {
        if (Platform.OS === 'web') {
          const confirmed = window.confirm(
            '🚨 완전 초기화\n\n' +
            '다음 작업을 수행합니다:\n' +
            '1. SQLite DB 파일 삭제 (IndexedDB)\n' +
            '2. React Query 캐시 클리어\n' +
            '3. 페이지 새로고침 필요\n\n' +
            '계속하시겠습니까?'
          );
          resolve(confirmed);
        } else {
          Alert.alert(
            '🚨 완전 초기화',
            '다음 작업을 수행합니다:\n\n' +
            '1. SQLite 전체 삭제\n' +
            '2. React Query 캐시 클리어\n' +
            '3. 앱 재시작 필요\n\n' +
            '계속하시겠습니까?',
            [
              { text: '취소', style: 'cancel', onPress: () => resolve(false) },
              { text: '초기화', style: 'destructive', onPress: () => resolve(true) }
            ]
          );
        }
      });
    };

    const confirmed = await confirmFullReset();
    if (!confirmed) {
      addLog('❌ 초기화 취소됨');
      return;
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    addLog('🚨 완전 초기화 시작');
    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    try {
      // 웹 환경: IndexedDB 삭제
      if (Platform.OS === 'web') {
        addLog('1️⃣ IndexedDB 삭제 중...');
        
        // SQLite DB 파일 삭제
        const dbNames = ['todos.db', 'SQLite'];
        for (const dbName of dbNames) {
          try {
            await new Promise((resolve, reject) => {
              const request = indexedDB.deleteDatabase(dbName);
              request.onsuccess = () => {
                addLog(`✅ ${dbName} 삭제 완료`);
                resolve();
              };
              request.onerror = () => {
                addLog(`⚠️ ${dbName} 삭제 실패 (없을 수 있음)`);
                resolve(); // 에러여도 계속 진행
              };
              request.onblocked = () => {
                addLog(`⚠️ ${dbName} 삭제 차단됨 (다른 탭에서 사용 중)`);
                resolve();
              };
            });
          } catch (e) {
            addLog(`⚠️ ${dbName} 삭제 중 오류: ${e.message}`);
          }
        }

        // 2. React Query 캐시 클리어
        addLog('2️⃣ React Query 캐시 클리어 중...');
        queryClient.clear();
        addLog('✅ 캐시 클리어 완료');

        addLog('');
        addLog('✅ 완전 초기화 완료!');
        addLog('🔄 3초 후 페이지를 새로고침합니다...');
        
        // 3초 후 새로고침
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        // 네이티브: SQLite 초기화
        addLog('1️⃣ SQLite 초기화 중...');
        await resetDatabase();
        addLog('✅ SQLite 초기화 완료');

        // 2. React Query 캐시 클리어
        addLog('2️⃣ React Query 캐시 클리어 중...');
        queryClient.clear();
        addLog('✅ 캐시 클리어 완료');

        // 3. 상태 확인
        addLog('3️⃣ 상태 확인 중...');
        const stats = await getDbStats();
        addLog('');
        addLog('📊 현재 상태:');
        addLog(`  - Todos: ${stats.todos}개`);
        addLog(`  - Completions: ${stats.completions}개`);
        addLog(`  - Categories: ${stats.categories}개`);
        addLog(`  - Pending: ${stats.pending}개`);
        addLog('');
        addLog('✅ 완전 초기화 완료!');
        addLog('💡 앱을 재시작하거나 로그인하여 서버 데이터를 동기화하세요.');
      }
    } catch (error) {
      addLog(`❌ 초기화 실패: ${error.message}`);
      console.error('Full reset error:', error);
    }

    addLog('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 Debug Screen (SQLite)</Text>

      <View style={styles.dateSelector}>
        <Text style={styles.dateLabel}>테스트 날짜:</Text>
        <TouchableOpacity style={styles.dateStepButton} onPress={() => shiftDebugDate(-7)}>
          <Text style={styles.dateStepButtonText}>-7</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateStepButton} onPress={() => shiftDebugDate(-1)}>
          <Text style={styles.dateStepButtonText}>-1</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={promptDebugDate}
        >
          <Text style={styles.dateButtonText}>{selectedDate}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateStepButton} onPress={() => shiftDebugDate(1)}>
          <Text style={styles.dateStepButtonText}>+1</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateStepButton} onPress={() => shiftDebugDate(7)}>
          <Text style={styles.dateStepButtonText}>+7</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.dateTodayButton} onPress={setDebugDateToday}>
          <Text style={styles.dateTodayButtonText}>오늘</Text>
        </TouchableOpacity>
        <Text style={styles.todoCount}>({todos.length}개)</Text>
      </View>

      <ScrollView style={styles.buttonContainer}>
        <Text style={styles.sectionTitle}>📊 기본 상태 확인</Text>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkDbStatus}>
          <Text style={styles.buttonText}>🔍 DB 상태 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.primaryButton]} onPress={checkCurrentTodos}>
          <Text style={styles.buttonText}>🔍 현재 Todo 상세 확인</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>✅ Completion 토글 테스트</Text>

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={testToggleCompletion}>
          <Text style={styles.buttonText}>🔄 Completion 토글 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={checkPendingChanges}>
          <Text style={styles.buttonText}>⏳ Pending Changes 확인</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={runPendingPushOnce}>
          <Text style={styles.buttonText}>🚀 Pending Push 1회 실행</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={runPendingPushOne}>
          <Text style={styles.buttonText}>🚀 Pending Push 1건 실행</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={runPendingPushThree}>
          <Text style={styles.buttonText}>🚀 Pending Push 3건 실행</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>🗄️ SQLite 조회</Text>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_TodosByDate}>
          <Text style={styles.buttonText}>📋 날짜별 Todo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_AllTodos}>
          <Text style={styles.buttonText}>📋 전체 Todo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_CompletionsByDate}>
          <Text style={styles.buttonText}>✅ 날짜별 Completion</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.sqliteButton]} onPress={sqlite_CategoryList}>
          <Text style={styles.buttonText}>📂 Categories</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.actionButton]} onPress={checkAndRepairIndexes}>
          <Text style={styles.buttonText}>🔧 인덱스 점검 및 복구</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={testCompletionPerformance}>
          <Text style={styles.buttonText}>🔬 Completion 성능 테스트</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.testButton]} onPress={testLimitImpact}>
          <Text style={styles.buttonText}>🔬 LIMIT 영향 테스트</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>⚠️ 위험한 작업</Text>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearCache}>
          <Text style={styles.buttonText}>🗑️ 캐시 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearSharedRangeCacheOnly}>
          <Text style={styles.buttonText}>🧠 Shared Range 캐시만 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearStripL1CacheOnly}>
          <Text style={styles.buttonText}>🧹 Strip L1 캐시만 클리어</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={clearPending}>
          <Text style={styles.buttonText}>🗑️ Pending 삭제</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={resetDb}>
          <Text style={styles.buttonText}>🗑️ SQLite 전체 초기화</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={fullReset}>
          <Text style={styles.buttonText}>🚨 완전 초기화 (SQLite + 캐시)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.warningButton]} onPress={forceMigration}>
          <Text style={styles.buttonText}>🔧 강제 마이그레이션 (v3)</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <Text style={styles.sectionTitle}>🧪 통합 테스트</Text>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={runCommonLayerDate}
        >
          <Text style={styles.buttonText}>🧩 공통 레이어 실행 (date)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={runCommonLayerRange}
        >
          <Text style={styles.buttonText}>🧩 공통 레이어 실행 (range)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={runCandidateExplainProbe}
        >
          <Text style={styles.buttonText}>🔍 Candidate EXPLAIN (date + 3개월)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={runTask15PerfProbe}
        >
          <Text style={styles.buttonText}>🚀 Task15 Perf Probe (S1~S4)</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={runSyncCoupledSmoke}
        >
          <Text style={styles.buttonText}>🧪 Sync 결합 스모크</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={runScreenAdapterCompare}
        >
          <Text style={styles.buttonText}>🧪 화면 결과 비교</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={printValidationSummary}
        >
          <Text style={styles.buttonText}>📄 PASS/FAIL 요약 출력</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={printRangeCacheStats}
        >
          <Text style={styles.buttonText}>🧠 Range Cache 상태 출력</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={printStripL1CacheStats}
        >
          <Text style={styles.buttonText}>🧩 Strip L1 상태 출력</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={printTodoCalendarL1CacheStats}
        >
          <Text style={styles.buttonText}>📅 TodoCalendar L1 상태 출력</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={printStripMonthlyPolicy}
        >
          <Text style={styles.buttonText}>ℹ️ Strip 월간 정책 상태</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.warningButton]}
          onPress={setStripMonthlyPolicyLegacy}
        >
          <Text style={styles.buttonText}>⚙️ Strip 월간 정책: legacy 9주</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={setStripMonthlyPolicyThreeMonth}
        >
          <Text style={styles.buttonText}>⚙️ Strip 월간 정책: 3개월</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={setStripMonthlyPolicySixMonth}
        >
          <Text style={styles.buttonText}>⚙️ Strip 월간 정책: 6개월</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={runRangeCacheHitSmoke}
        >
          <Text style={styles.buttonText}>🧪 Range Cache hit 스모크</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.actionButton]}
          onPress={runOptionABenchmark}
        >
          <Text style={styles.buttonText}>🧪 Option A 정량 벤치마크</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={() => navigation.navigate('GuestMigrationTest')}
        >
          <Text style={styles.buttonText}>🔬 Guest Migration Test</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={() => navigation.navigate('CalendarServiceTest')}
        >
          <Text style={styles.buttonText}>📅 Calendar Service Test</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={() => navigation.navigate('RecurrenceEngineTest')}
        >
          <Text style={styles.buttonText}>🔁 Recurrence Engine Test</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.logContainer}>
        <View style={styles.logHeader}>
          <Text style={styles.logTitle}>📋 로그</Text>
          <View style={styles.logActions}>
            <TouchableOpacity style={styles.logSmallButton} onPress={copyLogs}>
              <Text style={styles.logSmallButtonText}>복사</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.logSmallButton, styles.logSmallButtonSpacing]} onPress={clearLogs}>
              <Text style={styles.logSmallButtonText}>초기화</Text>
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logText}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
  },
  dateLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginRight: 8,
  },
  dateButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  dateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  dateStepButton: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginHorizontal: 2,
  },
  dateStepButtonText: {
    color: '#374151',
    fontSize: 12,
    fontWeight: '600',
  },
  dateTodayButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 4,
  },
  dateTodayButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  todoCount: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 8,
    marginBottom: 8,
  },
  buttonContainer: {
    flex: 1,
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  testButton: {
    backgroundColor: '#8b5cf6',
  },
  actionButton: {
    backgroundColor: '#10b981',
  },
  warningButton: {
    backgroundColor: '#f59e0b',
  },
  dangerButton: {
    backgroundColor: '#ef4444',
  },
  sqliteButton: {
    backgroundColor: '#0891b2',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: '#d1d5db',
    marginVertical: 16,
  },
  logContainer: {
    height: 300,
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  logTitle: {
    color: '#f3f4f6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logActions: {
    flexDirection: 'row',
  },
  logSmallButton: {
    backgroundColor: '#374151',
    borderWidth: 1,
    borderColor: '#4b5563',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logSmallButtonSpacing: {
    marginLeft: 6,
  },
  logSmallButtonText: {
    color: '#e5e7eb',
    fontSize: 11,
    fontWeight: '600',
  },
  logScroll: {
    flex: 1,
  },
  logText: {
    color: '#d1d5db',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});
