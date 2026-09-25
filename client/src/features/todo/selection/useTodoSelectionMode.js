import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppChromeStore } from '../../../store/appChromeStore';
import { generateId } from '../../../utils/idGenerator';
import { useTodoSelectionResultStore } from './todoSelectionResultStore';

export default function useTodoSelectionMode() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState([]);
  const [selectionSessionId, setSelectionSessionId] = useState(null);
  const [tabBarHideOwnerId] = useState(() => generateId());
  const setBottomTabBarHiddenForOwner = useAppChromeStore(
    (state) => state.setBottomTabBarHiddenForOwner
  );
  const selectionResult = useTodoSelectionResultStore((state) =>
    selectionSessionId ? state.resultsBySessionId[selectionSessionId] || null : null
  );
  const clearSelectionResult = useTodoSelectionResultStore((state) => state.clearResult);

  useEffect(() => {
    setBottomTabBarHiddenForOwner(tabBarHideOwnerId, isSelectionMode);
    return () => {
      setBottomTabBarHiddenForOwner(tabBarHideOwnerId, false);
    };
  }, [isSelectionMode, setBottomTabBarHiddenForOwner, tabBarHideOwnerId]);

  const selectedTodoIdSet = useMemo(
    () => new Set(selectedTodoIds),
    [selectedTodoIds]
  );

  const enterSelectionMode = useCallback((initialTodoId) => {
    setIsSelectionMode(true);
    setSelectedTodoIds(initialTodoId ? [initialTodoId] : []);
    setSelectionSessionId(generateId());
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedTodoIds([]);
    setSelectionSessionId(null);
  }, []);

  const toggleSelectedTodo = useCallback((todoId) => {
    if (!todoId) {
      return;
    }

    setSelectedTodoIds((currentIds) => {
      if (currentIds.includes(todoId)) {
        return currentIds.filter((id) => id !== todoId);
      }

      return [...currentIds, todoId];
    });
  }, []);

  useEffect(() => {
    if (
      !isSelectionMode ||
      !selectionSessionId ||
      selectionResult?.sessionId !== selectionSessionId
    ) {
      return;
    }

    if (selectionResult.status === 'success') {
      clearSelectionResult(selectionSessionId);
      exitSelectionMode();
      return;
    }

    if (selectionResult.status === 'selection_stale') {
      const invalidIdSet = new Set(selectionResult.invalidTodoIds || []);
      setSelectedTodoIds((currentIds) =>
        currentIds.filter((todoId) => !invalidIdSet.has(todoId))
      );
      clearSelectionResult(selectionSessionId);
    }
  }, [
    clearSelectionResult,
    exitSelectionMode,
    isSelectionMode,
    selectionResult,
    selectionSessionId,
  ]);

  return {
    isSelectionMode,
    selectedTodoIds,
    selectedTodoIdSet,
    selectedCount: selectedTodoIds.length,
    selectionSessionId,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectedTodo,
  };
}
