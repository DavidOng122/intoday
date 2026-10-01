import { useCallback, useEffect, useState } from 'react';
import {
  getDesktopCanvasEntryHeight,
  getDesktopCanvasEntryTaskIds,
} from '../model/canvasEntries.js';
import { DESKTOP_CANVAS_CARD_WIDTH } from '../model/canvasConstants.js';
import { doDesktopRectsIntersect } from '../model/canvasGeometry.js';

const areTaskIdSelectionsEqual = (currentIds, nextIds) => (
  currentIds.length === nextIds.length && nextIds.every((taskId) => currentIds.includes(taskId))
);

export const useCanvasSelection = ({
  selectedDayEntriesRef,
  selectedTaskIdsRef,
  suppressTaskClickTimeoutRef,
}) => {
  const [selectedTaskIds, setSelectedTaskIds] = useState([]);
  const [desktopSelectionRect, setDesktopSelectionRect] = useState(null);

  useEffect(() => {
    selectedTaskIdsRef.current = new Set(selectedTaskIds);
  }, [selectedTaskIds, selectedTaskIdsRef]);

  useEffect(() => () => {
    if (suppressTaskClickTimeoutRef.current !== null) {
      window.clearTimeout(suppressTaskClickTimeoutRef.current);
      suppressTaskClickTimeoutRef.current = null;
    }
  }, [suppressTaskClickTimeoutRef]);

  const handleSelectionChange = useCallback((nextSelection) => {
    setSelectedTaskIds(nextSelection);
  }, []);

  const clearSelection = useCallback(() => {
    selectedTaskIdsRef.current = new Set();
    setSelectedTaskIds([]);
  }, [selectedTaskIdsRef]);

  const updateMarqueeSelection = useCallback((selectionRect) => {
    const nextSelectedTaskIds = selectedDayEntriesRef.current.flatMap((entry) => {
      const entryRect = {
        x: entry.x,
        y: entry.y,
        width: DESKTOP_CANVAS_CARD_WIDTH,
        height: getDesktopCanvasEntryHeight(entry),
      };
      return doDesktopRectsIntersect(selectionRect, entryRect)
        ? getDesktopCanvasEntryTaskIds(entry)
        : [];
    });
    const nextSelection = [...new Set(nextSelectedTaskIds)];

    // Delete can be pressed immediately after pointer-up. Keep the keyboard
    // source of truth in sync with the visible marquee, not one render later.
    selectedTaskIdsRef.current = new Set(nextSelection);
    setSelectedTaskIds(nextSelection);
  }, [selectedDayEntriesRef, selectedTaskIdsRef]);

  const updateSelection = useCallback((taskIds, event, openAction) => {
    const normalizedTaskIds = [...new Set(taskIds)];
    if (!normalizedTaskIds.length) return;

    if (event?.metaKey || event?.ctrlKey) {
      event.preventDefault?.();
      event.stopPropagation?.();
      setSelectedTaskIds((current) => {
        const currentSet = new Set(current);
        const isFullySelected = normalizedTaskIds.every((taskId) => currentSet.has(taskId));
        normalizedTaskIds.forEach((taskId) => {
          if (isFullySelected) currentSet.delete(taskId);
          else currentSet.add(taskId);
        });
        return [...currentSet];
      });
      return;
    }

    if (areTaskIdSelectionsEqual(selectedTaskIdsRef.current, normalizedTaskIds)) {
      openAction?.();
      return;
    }

    setSelectedTaskIds(normalizedTaskIds);

    if (normalizedTaskIds.length === 1) {
      openAction?.();
    }
  }, [selectedTaskIdsRef]);

  return {
    selectedTaskIds,
    desktopSelectionRect,
    selectedTaskIdsRef,
    setDesktopSelectionRect,
    updateSelection,
    clearSelection,
    handleSelectionChange,
    updateMarqueeSelection,
  };
};
