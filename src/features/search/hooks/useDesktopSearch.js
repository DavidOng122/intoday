import { useCallback, useEffect, useState } from 'react';

export const useDesktopSearch = ({ searchDragSeparateRef }) => {
  const [historyOpen, setHistoryOpenState] = useState(false);

  const setHistoryOpen = useCallback((value) => {
    const open = Boolean(value);
    window.sessionStorage.setItem('shared_history_open', String(open));
    setHistoryOpenState(open);
  }, []);

  const handleSearchTaskLongPress = useCallback((task, startDesktopTaskDrag) => {
    searchDragSeparateRef.current = true;
    startDesktopTaskDrag(task);
  }, [searchDragSeparateRef]);

  useEffect(() => {
    window.sessionStorage.setItem('shared_history_open', 'false');
  }, []);

  return {
    handleSearchTaskLongPress,
    historyOpen,
    setHistoryOpen,
  };
};
