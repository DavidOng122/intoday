import { useEffect, useMemo, useRef } from 'react';
import { resolveDesktopCanvasEntries } from '../model/canvasEntries.js';

export const useCanvasEntries = ({ currentWorkspaceTasks }) => {
  const canvasEntries = useMemo(
    () => resolveDesktopCanvasEntries(currentWorkspaceTasks),
    [currentWorkspaceTasks],
  );
  const canvasEntriesRef = useRef([]);

  useEffect(() => {
    canvasEntriesRef.current = canvasEntries;
  }, [canvasEntries]);

  return {
    canvasEntries,
    canvasEntriesRef,
  };
};
