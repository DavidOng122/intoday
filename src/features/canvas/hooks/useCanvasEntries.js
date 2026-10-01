import { useEffect, useMemo, useRef } from 'react';
import { resolveDesktopCanvasEntries } from '../model/canvasEntries.js';

export const useCanvasEntries = ({ currentWorkspaceTasks, selectedDateKey }) => {
  const selectedDayEntries = useMemo(
    () => {
      // Keep the memo scoped to the selected day even though filtering stays upstream.
      void selectedDateKey;
      return resolveDesktopCanvasEntries(currentWorkspaceTasks);
    },
    [currentWorkspaceTasks, selectedDateKey],
  );
  const selectedDayEntriesRef = useRef([]);

  useEffect(() => {
    selectedDayEntriesRef.current = selectedDayEntries;
  }, [selectedDayEntries]);

  return {
    selectedDayEntries,
    selectedDayEntriesRef,
  };
};
