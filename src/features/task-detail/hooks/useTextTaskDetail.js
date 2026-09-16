import { useCallback, useMemo, useState } from 'react';
import { isTextCardType, normalizeCardType } from '../../../entities/task/model/taskCardPresentation';

// Detail visibility is UI state only. The task itself remains owned by the
// existing local-first task store in DesktopApp/useSyncedTodos.
export const useTextTaskDetail = ({ tasks = [] }) => {
  const [openTaskId, setOpenTaskId] = useState(null);

  const task = useMemo(
    () => tasks.find((item) => item.id === openTaskId) || null,
    [openTaskId, tasks],
  );

  const openTextTask = useCallback((nextTask) => {
    if (!nextTask || !isTextCardType(normalizeCardType(nextTask.cardType))) return;
    setOpenTaskId(nextTask.id);
  }, []);

  const closeTextTask = useCallback(() => setOpenTaskId(null), []);

  return {
    activeTextTask: task && isTextCardType(normalizeCardType(task.cardType)) ? task : null,
    closeTextTask,
    openTextTask,
  };
};
