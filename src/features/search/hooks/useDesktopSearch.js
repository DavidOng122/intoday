import { useCallback, useState } from 'react';

export const useDesktopSearch = ({ searchDragSeparateRef }) => {
  const [historyOpen, setHistoryOpenState] = useState(false);

  const setHistoryOpen = useCallback((value) => {
    setHistoryOpenState(Boolean(value));
  }, []);

  const handleSearchTaskLongPress = useCallback((task, startDesktopTaskDrag) => {
    searchDragSeparateRef.current = true;
    startDesktopTaskDrag(task);
  }, [searchDragSeparateRef]);

  return {
    handleSearchTaskLongPress,
    historyOpen,
    setHistoryOpen,
  };
};
