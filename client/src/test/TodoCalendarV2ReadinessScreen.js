import React, { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { createTodoCalendarV2ScenarioData } from './guestDataHelper';
import { getAllTodos } from '../services/db/todoService';
import { getCategoryByName } from '../services/db/categoryService';
import { invalidateAllScreenCaches } from '../services/query-aggregation/cache';
import { useCreateTodo } from '../hooks/queries/useCreateTodo';
import { useUpdateTodo } from '../hooks/queries/useUpdateTodo';
import { useDeleteTodo } from '../hooks/queries/useDeleteTodo';
import { useToggleCompletion } from '../hooks/queries/useToggleCompletion';
import TodoCalendarV2CalendarList from '../features/todo-calendar-v2/ui/TodoCalendarV2CalendarList';

async function findTodoByTitles(titles = []) {
  const todos = await getAllTodos();
  return titles
    .map((title) => todos.find((todo) => todo.title === title))
    .find(Boolean) || null;
}

function ActionButton({ title, onPress, disabled = false }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      style={[styles.button, disabled && styles.buttonDisabled]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </TouchableOpacity>
  );
}

export default function TodoCalendarV2ReadinessScreen() {
  const queryClient = useQueryClient();
  const createTodoMutation = useCreateTodo();
  const updateTodoMutation = useUpdateTodo();
  const deleteTodoMutation = useDeleteTodo();
  const toggleCompletionMutation = useToggleCompletion();

  const [status, setStatus] = useState('idle');
  const [isBusy, setIsBusy] = useState(false);

  const isMutating = useMemo(
    () =>
      isBusy ||
      createTodoMutation.isPending ||
      updateTodoMutation.isPending ||
      deleteTodoMutation.isPending ||
      toggleCompletionMutation.isPending,
    [
      createTodoMutation.isPending,
      deleteTodoMutation.isPending,
      isBusy,
      toggleCompletionMutation.isPending,
      updateTodoMutation.isPending,
    ],
  );

  const runAction = useCallback(async (name, fn) => {
    setIsBusy(true);
    setStatus(`running:${name}`);

    try {
      await fn();
      setStatus(`done:${name}`);
    } catch (error) {
      console.error(`[TC2 Readiness] ${name} failed:`, error);
      setStatus(`error:${name}:${error?.message || String(error)}`);
    } finally {
      setIsBusy(false);
    }
  }, []);

  const handleSeedScenario = useCallback(() => {
    return runAction('seed-scenario7', async () => {
      await createTodoCalendarV2ScenarioData();
      invalidateAllScreenCaches({
        queryClient,
        reason: 'tc2-readiness:seed-scenario7',
      });
    });
  }, [queryClient, runAction]);

  const handleCreateVisibleTodo = useCallback(() => {
    return runAction('create-visible-todo', async () => {
      const workCategory = await getCategoryByName('Work');
      if (!workCategory?._id) {
        throw new Error('Work category not found');
      }

      await createTodoMutation.mutateAsync({
        title: 'New Visible',
        date: '2026-03-05',
        startDate: '2026-03-05',
        endDate: '2026-03-05',
        recurrence: null,
        recurrenceEndDate: null,
        categoryId: workCategory._id,
        isAllDay: true,
        startTime: null,
        endTime: null,
        memo: null,
        color: null,
      });
    });
  }, [createTodoMutation, runAction]);

  const handleUpdateVisibleTodo = useCallback(() => {
    return runAction('update-visible-todo', async () => {
      const target = await findTodoByTitles(['Quarter Sprint', 'Sprint X']);
      if (!target?._id) {
        throw new Error('Quarter Sprint not found');
      }

      await updateTodoMutation.mutateAsync({
        id: target._id,
        data: {
          ...target,
          title: 'Sprint X',
        },
      });
    });
  }, [runAction, updateTodoMutation]);

  const handleDeleteVisibleTodo = useCallback(() => {
    return runAction('delete-visible-todo', async () => {
      const target = await findTodoByTitles(['Client Workshop']);
      if (!target?._id) {
        throw new Error('Client Workshop not found');
      }

      await deleteTodoMutation.mutateAsync(target);
    });
  }, [deleteTodoMutation, runAction]);

  const handleToggleCompletion = useCallback(() => {
    return runAction('toggle-visible-completion', async () => {
      const target = await findTodoByTitles(['Month Bridge']);
      if (!target?._id) {
        throw new Error('Month Bridge not found');
      }

      await toggleCompletionMutation.mutateAsync({
        todoId: target._id,
        date: target.date || target.startDate,
        todo: target,
      });
    });
  }, [runAction, toggleCompletionMutation]);

  const handleCoarseInvalidate = useCallback(() => {
    return runAction('coarse-invalidate', async () => {
      invalidateAllScreenCaches({
        queryClient,
        reason: 'tc2-readiness:coarse-invalidate',
      });
    });
  }, [queryClient, runAction]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.controls}>
        <Text style={styles.title}>TC2 Readiness Harness</Text>
        <Text style={styles.subtitle}>status: {status}</Text>

        <View style={styles.buttonGrid}>
          <ActionButton
            title="Seed Scenario 7"
            onPress={handleSeedScenario}
            disabled={isMutating}
          />
          <ActionButton
            title="Create Visible Todo"
            onPress={handleCreateVisibleTodo}
            disabled={isMutating}
          />
          <ActionButton
            title="Update Visible Todo"
            onPress={handleUpdateVisibleTodo}
            disabled={isMutating}
          />
          <ActionButton
            title="Delete Visible Todo"
            onPress={handleDeleteVisibleTodo}
            disabled={isMutating}
          />
          <ActionButton
            title="Toggle Visible Completion"
            onPress={handleToggleCompletion}
            disabled={isMutating}
          />
          <ActionButton
            title="Coarse Invalidate"
            onPress={handleCoarseInvalidate}
            disabled={isMutating}
          />
        </View>
      </View>

      <View style={styles.calendarContainer}>
        <TodoCalendarV2CalendarList />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  controls: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 12,
    color: '#475569',
  },
  buttonGrid: {
    marginTop: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#0F172A',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  calendarContainer: {
    flex: 1,
  },
});
