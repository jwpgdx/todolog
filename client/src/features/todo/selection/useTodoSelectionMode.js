import { useCallback, useEffect, useMemo, useState } from 'react';

import { useAppChromeStore } from '../../../store/appChromeStore';

export default function useTodoSelectionMode() {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedTodoIds, setSelectedTodoIds] = useState([]);
  const setBottomTabBarHidden = useAppChromeStore((state) => state.setBottomTabBarHidden);

  useEffect(() => {
    setBottomTabBarHidden(isSelectionMode);
    return () => {
      setBottomTabBarHidden(false);
    };
  }, [isSelectionMode, setBottomTabBarHidden]);

  const selectedTodoIdSet = useMemo(
    () => new Set(selectedTodoIds),
    [selectedTodoIds]
  );

  const enterSelectionMode = useCallback((initialTodoId) => {
    setIsSelectionMode(true);
    setSelectedTodoIds(initialTodoId ? [initialTodoId] : []);
  }, []);

  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedTodoIds([]);
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

  return {
    isSelectionMode,
    selectedTodoIds,
    selectedTodoIdSet,
    selectedCount: selectedTodoIds.length,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectedTodo,
  };
}
