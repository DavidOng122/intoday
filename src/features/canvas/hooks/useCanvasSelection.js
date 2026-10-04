import { useCallback, useEffect, useState } from 'react';

const areTaskIdSelectionsEqual = (currentIds, nextIds) => (
  currentIds.size === nextIds.size && [...nextIds].every((taskId) => currentIds.has(taskId))
);

export const useCanvasSelection = ({
  selectedTaskIdsRef,
  suppressTaskClickTimeoutRef,
}) => {
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);

  useEffect(() => {
    selectedTaskIdsRef.current = new Set(selectedTaskIds);
  }, [selectedTaskIds, selectedTaskIdsRef]);

  useEffect(() => () => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
      suppressTaskClickTimeoutRef.current = null;
    }
  }, [suppressTaskClickTimeoutRef]);

  const handleSelectionChange = useCallback((nextSelectionOrUpdater) => {
    const nextSelection = typeof nextSelectionOrUpdater === 'function'
      ? nextSelectionOrUpdater([...selectedTaskIdsRef.current])
      : nextSelectionOrUpdater;
    const normalizedSelection = [...new Set(nextSelection)];
    const nextSelectionSet = new Set(normalizedSelection);
    if (areTaskIdSelectionsEqual(selectedTaskIdsRef.current, nextSelectionSet)) return;

    selectedTaskIdsRef.current = nextSelectionSet;
    setSelectedTaskIds(normalizedSelection);
  }, [selectedTaskIdsRef]);

  return {
    selectedTaskIds,
    selectedTaskIdsRef,
    handleSelectionChange,
  };
};
